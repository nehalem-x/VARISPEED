"""VARISPEED — backend local de importação remota via yt-dlp.

O frontend continua responsável por decodificação, waveform, playbackRate,
osciloscópio e exportação WAV. Este serviço faz somente duas coisas:
1) extrai metadados de uma URL sem baixar a mídia;
2) obtém a melhor faixa de áudio disponível e a entrega ao navegador.

O servidor pode ser exposto na rede local quando o launcher usa 0.0.0.0;
rotas sensíveis de controle continuam restritas ao próprio computador.
"""

from __future__ import annotations

import asyncio
import ipaddress
import mimetypes
import os
import re
import shutil
import socket
import tempfile
import threading
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yt_dlp
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask
from starlette.responses import Response

from server.browser_auth import BrowserAuthError, BrowserSessionResolver
from server.dedicated_auth import DedicatedAuthError, DedicatedYouTubeSession
from server.youtube_pot import authenticated_youtube_options
from server.youtube_pot import status as youtube_pot_status

ROOT = Path(__file__).resolve().parent.parent

APP_PORT = int(os.getenv("VARISPEED_PORT", "8765") or 8765)
SUPPORTED_AUTH_BROWSERS = frozenset({"chrome", "edge", "firefox", "brave", "vivaldi"})
SUPPORTED_AUTH_MODES = SUPPORTED_AUTH_BROWSERS | {"auto", "dedicated"}
_AUTH_LOCK = threading.Lock()
_AUTH_BROWSER = ""
_AUTH_PROFILE = ""
DEDICATED_AUTH = DedicatedYouTubeSession()
BROWSER_SESSIONS = BrowserSessionResolver()


def _local_ipv4s() -> list[str]:
    """Descobre IPv4s privados úteis para acesso pela LAN, priorizando a rota ativa."""
    ordered: list[str] = []

    def add(value: str) -> None:
        try:
            ip = ipaddress.ip_address(value)
        except ValueError:
            return
        if ip.version != 4 or not ip.is_private or ip.is_loopback or ip.is_link_local:
            return
        text = str(ip)
        if text not in ordered:
            ordered.append(text)

    # UDP connect não envia payload; apenas pede ao SO qual interface/rota
    # seria usada. Esse endereço tende a ser a LAN principal do computador.
    for target in (("8.8.8.8", 80), ("1.1.1.1", 80)):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.connect(target)
            add(sock.getsockname()[0])
            if ordered:
                break
        except OSError:
            pass
        finally:
            sock.close()

    try:
        host = socket.gethostname()
        for info in socket.getaddrinfo(host, None, family=socket.AF_INET):
            add(info[4][0])
    except OSError:
        pass

    return ordered


def _is_loopback_client(request: Request) -> bool:
    host = request.client.host if request.client else ""
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return host.lower() in {"localhost", "localhost.localdomain"}


def _has_authorized_local_origin(request: Request) -> bool:
    origin = (request.headers.get("origin") or "").lower().rstrip("/")
    return not origin or origin in {
        f"http://127.0.0.1:{APP_PORT}",
        f"http://localhost:{APP_PORT}",
    }


def _shutdown_process(delay: float = 0.45) -> None:
    time.sleep(delay)
    DEDICATED_AUTH.shutdown()
    os._exit(0)


PUBLIC_FILES = {
    "index.html",
    "styles.css",
    "theme-boot.js",
    "core.js",
    "motion.js",
    "scope-view.js",
    "scope-win.js",
    "scope.html",
    "settings.js",
    "remote-import.js",
    "graph-engine.js",
    "library.js",
    "app.js",
    "assets/cat-brand-light.png",
    "assets/cat-brand-dark.png",
    "assets/favicon.png",
    "assets/varispeed.ico",
    "assets/creator-light.png",
    "assets/creator-dark.png",
    "assets/yt-dlp-logo.png",
}

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; "
        "script-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; "
        "media-src 'self' blob:; worker-src 'self' blob:; "
        "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com"
    ),
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


def _apply_response_headers(path: str, response: Response) -> Response:
    """Aplica a política HTTP do app sem sobrescrever decisões da rota.

    A interface local é pequena e muda junto com o código, então assets são
    sempre revalidados. Respostas da API podem conter metadados de mídia ou
    estado de autenticação e nunca devem ficar no cache do navegador.
    """

    for name, value in SECURITY_HEADERS.items():
        if name not in response.headers:
            response.headers[name] = value
    if "Cache-Control" not in response.headers:
        response.headers["Cache-Control"] = "no-store" if path.startswith("/api/") else "no-cache"
    return response

app = FastAPI(
    title="VARISPEED local backend",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)


@app.middleware("http")
async def response_policy(request: Request, call_next) -> Response:
    response = await call_next(request)
    return _apply_response_headers(request.url.path, response)


class MediaRequest(BaseModel):
    url: str = Field(min_length=4, max_length=8192)
    authenticated: bool = False


class BrowserAuthRequest(BaseModel):
    browser: str = Field(default="off", min_length=2, max_length=24)


class BrowserAutoRequest(BaseModel):
    url: str = Field(min_length=4, max_length=8192)


class QuietLogger:
    """Evita que mensagens normais do yt-dlp poluam o terminal."""

    def debug(self, msg: str) -> None:
        pass

    def warning(self, msg: str) -> None:
        pass

    def error(self, msg: str) -> None:
        pass


class ExtractionLogger(QuietLogger):
    """Registra somente sinais de autenticacao, nunca valores de cookies."""

    def __init__(self) -> None:
        self.account_cookies = False
        self.playback_verification = False

    def _track(self, msg: str) -> None:
        text = str(msg or "")
        if re.search(r"found youtube account cookies", text, re.I):
            self.account_cookies = True
        if re.search(r"requiring account age-verification", text, re.I):
            self.playback_verification = True

    def debug(self, msg: str) -> None:
        self._track(msg)

    def warning(self, msg: str) -> None:
        self._track(msg)

    def error(self, msg: str) -> None:
        self._track(msg)


def _clean_error(exc: Exception) -> str:
    text = re.sub(r"\x1b\[[0-9;]*m", "", str(exc)).strip()
    text = re.sub(r"^ERROR:\s*", "", text, flags=re.I)
    if getattr(exc, "varispeed_playback_verification", False):
        provider = youtube_pot_status()
        if not provider["ready"]:
            return f"{provider['message']} Reinicie o VARISPEED para concluir a instalação e tente novamente."
        return (
            "A sessão foi reconhecida, mas o provedor local não conseguiu concluir a verificação de "
            "reprodução deste link. Tente novamente; se persistir, reinicie o VARISPEED para atualizar "
            "o yt-dlp e o componente de PO Token."
        )
    if _requires_authentication(text):
        return (
            "Este conteúdo exige uma sessão autenticada. Use “Usar cookies do navegador” abaixo "
            "ou configure uma Sessão dedicada em Configurações → Importação por link."
        )
    if re.search(r"could not copy .*cookie database", text, re.I):
        return (
            "O navegador escolhido está aberto e mantém a sessão bloqueada. Feche-o completamente, "
            "inclusive em segundo plano, ou escolha outro navegador conectado que não esteja sendo usado "
            "para abrir o VARISPEED; depois clique em Analisar novamente."
        )
    if re.search(r"failed to load cookies|could not copy .*cookies|failed to decrypt|cookie.*database", text, re.I):
        return (
            "Não foi possível ler a sessão do navegador escolhido. Confirme que o YouTube está "
            "conectado nesse navegador; se necessário, feche-o completamente e tente novamente."
        )
    return text[-1000:] or "O yt-dlp não conseguiu processar esse endereço."


def _requires_authentication(message: object) -> bool:
    text = str(message or "")
    return bool(re.search(
        r"sign in to confirm your age|age[- ]restricted|login required|requires authentication|"
        r"use --cookies(?:-from-browser)?|members[- ]only|private video",
        text,
        re.I,
    ))


def _authentication_error_code(exc: Exception) -> str:
    if not getattr(exc, "varispeed_playback_verification", False):
        return "authentication_required"
    return "youtube_po_token_failed" if youtube_pot_status()["ready"] else "youtube_po_token_unavailable"


def _validate_url(raw: str) -> str:
    """Validação defensiva para o serviço local.

    Além de aceitar apenas HTTP(S), bloqueia hosts locais/privados para não
    transformar o endpoint em um proxy para recursos da rede local.
    """

    value = raw.strip()
    try:
        parsed = urlparse(value)
        port = parsed.port
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Endereço inválido.") from exc

    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Use um endereço http ou https válido.")
    if port == 0:
        raise HTTPException(status_code=400, detail="Porta inválida no endereço.")

    host = parsed.hostname.rstrip(".").lower()
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
        raise HTTPException(status_code=400, detail="Endereços locais não são permitidos.")

    def reject(ip_text: str) -> None:
        try:
            ip = ipaddress.ip_address(ip_text)
        except ValueError:
            return
        if not ip.is_global:
            raise HTTPException(status_code=400, detail="Endereços de rede local/privada não são permitidos.")

    reject(host)
    try:
        infos = socket.getaddrinfo(host, port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="Não foi possível resolver o domínio informado.") from exc

    for info in infos:
        reject(info[4][0])

    return value


def _common_opts(auth_browser: str = "", auth_profile: str = "") -> dict[str, Any]:
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "logger": QuietLogger(),
        "noplaylist": True,
        "socket_timeout": 25,
        "retries": 3,
        "fragment_retries": 3,
        "cachedir": False,
    }
    cookie_file = os.getenv("VARISPEED_COOKIES_FILE", os.getenv("TEMPO_COOKIES_FILE", "")).strip()
    authenticated_source = False
    if cookie_file:
        opts["cookiefile"] = cookie_file
        authenticated_source = True
    elif auth_browser == "dedicated":
        cookie_buffer = DEDICATED_AUTH.cookie_buffer()
        if cookie_buffer is not None:
            # O yt-dlp pode atualizar seu cookiejar ao encerrar. O buffer mantém
            # essas mudanças somente em memória e preserva o arquivo filtrado.
            opts["cookiefile"] = cookie_buffer
            authenticated_source = True
    elif auth_browser in SUPPORTED_AUTH_BROWSERS:
        # A API Python usa a mesma especificação de --cookies-from-browser.
        # Perfil/keyring/container ficam automáticos; nenhum cookie é gravado.
        opts["cookiesfrombrowser"] = (auth_browser, auth_profile or None, None, None)
        authenticated_source = True
    if authenticated_source:
        # O provider é acionado sob demanda pelo yt-dlp. Links públicos e
        # extrações sem sessão continuam usando o cliente padrão, sem navegador
        # auxiliar nem custo adicional.
        opts.update(authenticated_youtube_options())
    return opts


def _configured_auth_source(request: Request) -> tuple[str, str]:
    if not _is_loopback_client(request):
        return "", ""
    with _AUTH_LOCK:
        return _AUTH_BROWSER, _AUTH_PROFILE


def _configured_auth_browser(request: Request) -> str:
    return _configured_auth_source(request)[0]


def _set_auth_browser(browser: str, profile: str = "") -> str:
    normalized = str(browser or "").strip().lower()
    if normalized in {"", "off", "none"}:
        normalized = ""
    elif normalized not in SUPPORTED_AUTH_MODES:
        raise HTTPException(status_code=400, detail="Navegador de autenticação não suportado.")
    global _AUTH_BROWSER, _AUTH_PROFILE
    with _AUTH_LOCK:
        _AUTH_BROWSER = normalized
        _AUTH_PROFILE = str(profile or "") if normalized in SUPPORTED_AUTH_BROWSERS else ""
    if normalized != "auto":
        BROWSER_SESSIONS.clear()
    return normalized


def _single_media(info: Any) -> dict[str, Any]:
    if not isinstance(info, dict):
        raise HTTPException(status_code=422, detail="O endereço não retornou uma mídia reconhecível.")
    if info.get("_type") in {"playlist", "multi_video"} or info.get("entries"):
        raise HTTPException(status_code=422, detail="Use o link de uma faixa ou vídeo individual, não uma playlist.")
    if info.get("is_live"):
        raise HTTPException(status_code=422, detail="Streams ao vivo não são suportados nesta versão.")
    return info


def _auth_mode_for_url(url: str, auth_browser: str) -> str:
    if auth_browser not in {"auto", "dedicated"}:
        return auth_browser
    host = (urlparse(url).hostname or "").lower().rstrip(".")
    if host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com"):
        return auth_browser
    return ""


def _extract_info_once(url: str, auth_browser: str = "", auth_profile: str = "") -> dict[str, Any]:
    logger = ExtractionLogger()
    opts = _common_opts(auth_browser, auth_profile)
    opts["logger"] = logger
    opts.update({"skip_download": True, "format": "bestaudio/best"})
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = _single_media(ydl.extract_info(url, download=False))
            return ydl.sanitize_info(info)
    except Exception as exc:
        # Os atributos carregam apenas booleanos e permitem uma mensagem correta
        # sem guardar o log tecnico (que pode conter informacao sensivel).
        setattr(exc, "varispeed_account_cookies", logger.account_cookies)
        setattr(exc, "varispeed_playback_verification", logger.playback_verification)
        raise


def _extract_with_auto_browser(url: str) -> tuple[dict[str, Any], str]:
    active = BROWSER_SESSIONS.active()
    if active:
        try:
            return _extract_info_once(url, active.browser, str(active.profile)), active.browser
        except Exception:
            BROWSER_SESSIONS.clear()
    candidate, data = BROWSER_SESSIONS.resolve(url, _extract_info_once)
    return data, candidate.browser


def _media_payload(data: dict[str, Any], url: str, *, auth_required: bool) -> dict[str, Any]:
    duration = data.get("duration")
    max_duration = int(os.getenv("VARISPEED_MAX_DURATION_SECONDS", os.getenv("TEMPO_MAX_DURATION_SECONDS", "0")) or 0)
    if max_duration > 0 and duration and float(duration) > max_duration:
        raise HTTPException(
            status_code=413,
            detail=f"A mídia excede o limite configurado de {max_duration} segundos.",
        )
    return {
        "id": data.get("id"),
        "title": data.get("title") or data.get("fulltitle") or "Áudio",
        "uploader": data.get("uploader") or data.get("channel") or data.get("artist"),
        "channel": data.get("channel"),
        "duration": duration,
        "thumbnail": data.get("thumbnail"),
        "extractor": data.get("extractor_key") or data.get("extractor") or data.get("webpage_url_domain"),
        "site": data.get("webpage_url_domain"),
        "webpage_url": data.get("webpage_url") or url,
        "auth_required": auth_required,
    }


def _extract_info_sync(url: str, auth_browser: str = "", auth_profile: str = "") -> dict[str, Any]:
    auth_browser = _auth_mode_for_url(url, auth_browser)
    used_browser_auth = False
    try:
        try:
            data = _extract_info_once(url)
        except yt_dlp.utils.DownloadError as exc:
            if not auth_browser or not _requires_authentication(exc):
                raise
            if auth_browser == "auto":
                data, _ = _extract_with_auto_browser(url)
            else:
                data = _extract_info_once(url, auth_browser, auth_profile)
            used_browser_auth = True
            if auth_browser == "dedicated":
                DEDICATED_AUTH.mark_validation("verified")
    except HTTPException:
        raise
    except BrowserAuthError as exc:
        raise HTTPException(status_code=401, detail={"code": exc.code, "message": str(exc)}) from exc
    except yt_dlp.utils.DownloadError as exc:
        if auth_browser == "dedicated":
            if getattr(exc, "varispeed_playback_verification", False):
                DEDICATED_AUTH.mark_validation("playback_verification_required")
            elif not getattr(exc, "varispeed_account_cookies", False):
                DEDICATED_AUTH.mark_validation("invalid")
        code = _authentication_error_code(exc)
        if _requires_authentication(exc):
            raise HTTPException(status_code=401, detail={"code": code, "message": _clean_error(exc)}) from exc
        raise HTTPException(status_code=422, detail=_clean_error(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=_clean_error(exc)) from exc

    return _media_payload(data, url, auth_required=used_browser_auth)


def _download_sync(
    url: str,
    auth_browser: str = "",
    authenticated: bool = False,
    auth_profile: str = "",
) -> tuple[Path, Path, str]:
    auth_browser = _auth_mode_for_url(url, auth_browser)
    temp_dir = Path(tempfile.mkdtemp(prefix="tempo-ytdlp-"))
    def options(browser: str = "", profile: str = "") -> dict[str, Any]:
        opts = _common_opts(browser, profile)
        opts.update({
            # M4A e WebM são preferidos por terem bom suporte nos navegadores
            # atuais e evitarem uma transcodificação desnecessária no servidor.
            "format": "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
            "outtmpl": str(temp_dir / "%(id)s.%(ext)s"),
            "overwrites": True,
        })
        return opts

    def download_once(browser: str = "", profile: str = "") -> dict[str, Any]:
        logger = ExtractionLogger()
        opts = options(browser, profile)
        opts["logger"] = logger
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                return _single_media(ydl.extract_info(url, download=True))
        except Exception as exc:
            setattr(exc, "varispeed_account_cookies", logger.account_cookies)
            setattr(exc, "varispeed_playback_verification", logger.playback_verification)
            raise

    def resolved_source() -> tuple[str, str]:
        if auth_browser != "auto":
            return auth_browser, auth_profile
        active = BROWSER_SESSIONS.active()
        if not active:
            _extract_with_auto_browser(url)
            active = BROWSER_SESSIONS.active()
        if not active:
            raise BrowserAuthError("youtube_session_not_found", "Nenhuma sessão válida do YouTube foi encontrada.")
        return active.browser, str(active.profile)

    try:
        try:
            if authenticated:
                browser, profile = resolved_source()
                info = download_once(browser, profile)
            else:
                info = download_once()
        except yt_dlp.utils.DownloadError as exc:
            if authenticated or not auth_browser or not _requires_authentication(exc):
                raise
            browser, profile = resolved_source()
            info = download_once(browser, profile)
        title = str(info.get("title") or "audio")

        candidates = [
            path
            for path in temp_dir.iterdir()
            if path.is_file() and path.suffix.lower() not in {".part", ".ytdl", ".json"}
        ]
        if not candidates:
            raise RuntimeError("O download terminou sem produzir um arquivo de áudio.")
        media_path = max(candidates, key=lambda p: p.stat().st_size)

        # Nome apresentado ao navegador. O arquivo temporário continua usando
        # apenas o ID para não depender do título vindo da plataforma.
        safe_title = yt_dlp.utils.sanitize_filename(title, restricted=False).strip(" .") or "audio"
        # Títulos de algumas plataformas podem ser enormes. Limitar o nome
        # apresentado no Content-Disposition evita headers/nomes problemáticos,
        # preservando a extensão real do arquivo temporário.
        safe_title = safe_title[:180].rstrip(" .") or "audio"
        display_name = f"{safe_title}{media_path.suffix.lower()}"
        return temp_dir, media_path, display_name
    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except BrowserAuthError as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=401, detail={"code": exc.code, "message": str(exc)}) from exc
    except yt_dlp.utils.DownloadError as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        code = _authentication_error_code(exc)
        if _requires_authentication(exc):
            raise HTTPException(status_code=401, detail={"code": code, "message": _clean_error(exc)}) from exc
        raise HTTPException(status_code=422, detail=_clean_error(exc)) from exc
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=_clean_error(exc)) from exc


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "yt_dlp": yt_dlp.version.__version__,
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "youtube_po": youtube_pot_status(),
    }


@app.get("/api/system/info")
async def system_info(request: Request) -> dict[str, Any]:
    lan_urls = [f"http://{ip}:{APP_PORT}/" for ip in _local_ipv4s()]
    return {
        "ok": True,
        "port": APP_PORT,
        "local_url": f"http://127.0.0.1:{APP_PORT}/",
        "lan_urls": lan_urls,
        "can_shutdown": _is_loopback_client(request),
        "can_configure_auth": _is_loopback_client(request),
    }


@app.get("/api/auth/status")
async def auth_status(request: Request) -> dict[str, Any]:
    if not _is_loopback_client(request):
        raise HTTPException(status_code=403, detail="A autenticação só pode ser configurada neste computador.")
    browser, _ = _configured_auth_source(request)
    cookie_file = bool(os.getenv("VARISPEED_COOKIES_FILE", os.getenv("TEMPO_COOKIES_FILE", "")).strip())
    dedicated = DEDICATED_AUTH.status()
    return {
        "ok": True,
        "mode": "file" if cookie_file else (
            "dedicated" if browser == "dedicated" else ("auto" if browser == "auto" else ("browser" if browser else "off"))
        ),
        "browser": browser or "off",
        "dedicated": dedicated,
        "auto": BROWSER_SESSIONS.status(),
        "po_token": youtube_pot_status(),
    }


@app.post("/api/auth/browser")
async def configure_browser_auth(payload: BrowserAuthRequest, request: Request) -> dict[str, Any]:
    if not _is_loopback_client(request):
        raise HTTPException(status_code=403, detail="A autenticação só pode ser configurada neste computador.")
    if not _has_authorized_local_origin(request):
        raise HTTPException(status_code=403, detail="Origem não autorizada para configurar autenticação.")
    browser = _set_auth_browser(payload.browser)
    mode = "dedicated" if browser == "dedicated" else ("auto" if browser == "auto" else ("browser" if browser else "off"))
    return {
        "ok": True,
        "mode": mode,
        "browser": browser or "off",
        "dedicated": DEDICATED_AUTH.status(),
        "auto": BROWSER_SESSIONS.status(),
        "po_token": youtube_pot_status(),
    }


def _require_local_auth_control(request: Request) -> None:
    if not _is_loopback_client(request):
        raise HTTPException(status_code=403, detail="A autenticação só pode ser configurada neste computador.")
    if not _has_authorized_local_origin(request):
        raise HTTPException(status_code=403, detail="Origem não autorizada para configurar autenticação.")


@app.post("/api/auth/browser/auto")
async def use_browser_auth_automatically(payload: BrowserAutoRequest, request: Request) -> dict[str, Any]:
    _require_local_auth_control(request)
    url = await asyncio.to_thread(_validate_url, payload.url)
    if _auth_mode_for_url(url, "auto") != "auto":
        raise HTTPException(status_code=400, detail="A busca automática de sessão está disponível somente para links do YouTube.")
    try:
        data, _ = await asyncio.to_thread(_extract_with_auto_browser, url)
    except BrowserAuthError as exc:
        raise HTTPException(status_code=401, detail={"code": exc.code, "message": str(exc)}) from exc
    except yt_dlp.utils.DownloadError as exc:
        code = _authentication_error_code(exc)
        raise HTTPException(status_code=401, detail={"code": code, "message": _clean_error(exc)}) from exc
    active = BROWSER_SESSIONS.active()
    if not active:
        raise HTTPException(status_code=401, detail={"code": "youtube_session_not_found", "message": "Nenhuma sessão válida foi encontrada."})
    _set_auth_browser("auto")
    return {
        "ok": True,
        "mode": "auto",
        "browser": active.browser,
        "source": active.public(),
        "media": _media_payload(data, url, auth_required=True),
        "auto": BROWSER_SESSIONS.status(),
    }


@app.post("/api/auth/dedicated/start")
async def start_dedicated_auth(request: Request) -> dict[str, Any]:
    _require_local_auth_control(request)
    try:
        state = await asyncio.to_thread(DEDICATED_AUTH.start)
    except DedicatedAuthError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    _set_auth_browser("dedicated")
    return {"ok": True, "mode": "dedicated", "browser": "dedicated", "dedicated": state}


@app.post("/api/auth/dedicated/finish")
async def finish_dedicated_auth(request: Request) -> dict[str, Any]:
    _require_local_auth_control(request)
    try:
        state = await asyncio.to_thread(DEDICATED_AUTH.finish)
    except DedicatedAuthError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    _set_auth_browser("dedicated")
    return {"ok": True, "mode": "dedicated", "browser": "dedicated", "dedicated": state}


@app.post("/api/auth/dedicated/disconnect")
async def disconnect_dedicated_auth(request: Request) -> dict[str, Any]:
    _require_local_auth_control(request)
    state = await asyncio.to_thread(DEDICATED_AUTH.disconnect)
    if _configured_auth_browser(request) == "dedicated":
        _set_auth_browser("off")
    return {"ok": True, "mode": "off", "browser": "off", "dedicated": state}


@app.post("/api/auth/dedicated/cancel")
async def cancel_dedicated_auth(request: Request) -> dict[str, Any]:
    _require_local_auth_control(request)
    await asyncio.to_thread(DEDICATED_AUTH.abort_login)
    state = DEDICATED_AUTH.status()
    browser = _configured_auth_browser(request)
    mode = "dedicated" if browser == "dedicated" else ("auto" if browser == "auto" else ("browser" if browser else "off"))
    return {"ok": True, "mode": mode, "browser": browser or "off", "dedicated": state}


@app.post("/api/system/shutdown")
async def system_shutdown(request: Request) -> dict[str, Any]:
    # Controle destrutivo disponível apenas via loopback. Assim, abrir o
    # VARISPEED em outro dispositivo da LAN não dá poder para encerrar o host.
    if not _is_loopback_client(request):
        raise HTTPException(status_code=403, detail="O desligamento só pode ser feito neste computador.")

    if not _has_authorized_local_origin(request):
        raise HTTPException(status_code=403, detail="Origem não autorizada para desligamento.")

    threading.Thread(target=_shutdown_process, name="varispeed-shutdown", daemon=True).start()
    return {"ok": True, "message": "VARISPEED será desligado."}


@app.post("/api/media/info")
async def media_info(payload: MediaRequest, request: Request) -> dict[str, Any]:
    url = await asyncio.to_thread(_validate_url, payload.url)
    browser, profile = _configured_auth_source(request)
    return await asyncio.to_thread(_extract_info_sync, url, browser, profile)


@app.post("/api/media/audio")
async def media_audio(payload: MediaRequest, request: Request) -> FileResponse:
    url = await asyncio.to_thread(_validate_url, payload.url)
    browser, profile = _configured_auth_source(request)
    temp_dir, media_path, display_name = await asyncio.to_thread(
        _download_sync,
        url,
        browser,
        payload.authenticated,
        profile,
    )
    media_type = mimetypes.guess_type(media_path.name)[0] or "application/octet-stream"
    return FileResponse(
        path=media_path,
        filename=display_name,
        media_type=media_type,
        content_disposition_type="inline",
        background=BackgroundTask(shutil.rmtree, temp_dir, ignore_errors=True),
        headers={"Cache-Control": "no-store"},
    )


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(ROOT / "index.html", media_type="text/html")


@app.get("/{asset_name:path}")
async def public_asset(asset_name: str) -> FileResponse:
    # Whitelist explícita: o diretório server/ e a documentação não são
    # publicados acidentalmente pelo servidor local.
    if asset_name not in PUBLIC_FILES:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    return FileResponse(ROOT / asset_name)
