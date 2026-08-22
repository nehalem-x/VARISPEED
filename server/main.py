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

ROOT = Path(__file__).resolve().parent.parent

APP_PORT = int(os.getenv("VARISPEED_PORT", "8765") or 8765)


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


def _shutdown_process(delay: float = 0.45) -> None:
    time.sleep(delay)
    os._exit(0)


PUBLIC_FILES = {
    "index.html",
    "styles.css",
    "core.js",
    "motion.js",
    "scope-view.js",
    "scope-win.js",
    "scope.html",
    "settings.js",
    "remote-import.js",
    "app.js",
    "assets/cat-brand-light.png",
    "assets/cat-brand-dark.png",
    "assets/favicon.png",
    "assets/varispeed.ico",
    "assets/creator-light.png",
    "assets/creator-dark.png",
}

app = FastAPI(
    title="VARISPEED local backend",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)


class MediaRequest(BaseModel):
    url: str = Field(min_length=4, max_length=8192)


class QuietLogger:
    """Evita que mensagens normais do yt-dlp poluam o terminal."""

    def debug(self, msg: str) -> None:
        pass

    def warning(self, msg: str) -> None:
        pass

    def error(self, msg: str) -> None:
        pass


def _clean_error(exc: Exception) -> str:
    text = re.sub(r"\x1b\[[0-9;]*m", "", str(exc)).strip()
    text = re.sub(r"^ERROR:\s*", "", text, flags=re.I)
    return text[-1000:] or "O yt-dlp não conseguiu processar esse endereço."


def _validate_url(raw: str) -> str:
    """Validação defensiva para o serviço local.

    Além de aceitar apenas HTTP(S), bloqueia hosts locais/privados para não
    transformar o endpoint em um proxy para recursos da rede local.
    """

    value = raw.strip()
    try:
        parsed = urlparse(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Endereço inválido.") from exc

    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Use um endereço http ou https válido.")

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
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="Não foi possível resolver o domínio informado.") from exc

    for info in infos:
        reject(info[4][0])

    return value


def _common_opts() -> dict[str, Any]:
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
    if cookie_file:
        opts["cookiefile"] = cookie_file
    return opts


def _single_media(info: Any) -> dict[str, Any]:
    if not isinstance(info, dict):
        raise HTTPException(status_code=422, detail="O endereço não retornou uma mídia reconhecível.")
    if info.get("_type") in {"playlist", "multi_video"} or info.get("entries"):
        raise HTTPException(status_code=422, detail="Use o link de uma faixa ou vídeo individual, não uma playlist.")
    if info.get("is_live"):
        raise HTTPException(status_code=422, detail="Streams ao vivo não são suportados nesta versão.")
    return info


def _extract_info_sync(url: str) -> dict[str, Any]:
    opts = _common_opts()
    opts.update({"skip_download": True, "format": "bestaudio/best"})
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = _single_media(ydl.extract_info(url, download=False))
            data = ydl.sanitize_info(info)
    except HTTPException:
        raise
    except yt_dlp.utils.DownloadError as exc:
        raise HTTPException(status_code=422, detail=_clean_error(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=_clean_error(exc)) from exc

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
    }


def _download_sync(url: str) -> tuple[Path, Path, str]:
    temp_dir = Path(tempfile.mkdtemp(prefix="tempo-ytdlp-"))
    opts = _common_opts()
    opts.update(
        {
            # M4A e WebM são preferidos por terem bom suporte nos navegadores
            # atuais e evitarem uma transcodificação desnecessária no servidor.
            "format": "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
            "outtmpl": str(temp_dir / "%(id)s.%(ext)s"),
            "overwrites": True,
        }
    )

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = _single_media(ydl.extract_info(url, download=True))
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
    except yt_dlp.utils.DownloadError as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=_clean_error(exc)) from exc
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=_clean_error(exc)) from exc


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "yt_dlp": yt_dlp.version.__version__,
        "ffmpeg": shutil.which("ffmpeg") is not None,
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
    }


@app.post("/api/system/shutdown")
async def system_shutdown(request: Request) -> dict[str, Any]:
    # Controle destrutivo disponível apenas via loopback. Assim, abrir o
    # VARISPEED em outro dispositivo da LAN não dá poder para encerrar o host.
    if not _is_loopback_client(request):
        raise HTTPException(status_code=403, detail="O desligamento só pode ser feito neste computador.")

    origin = (request.headers.get("origin") or "").lower()
    if origin and not (
        origin.startswith(f"http://127.0.0.1:{APP_PORT}")
        or origin.startswith(f"http://localhost:{APP_PORT}")
    ):
        raise HTTPException(status_code=403, detail="Origem não autorizada para desligamento.")

    threading.Thread(target=_shutdown_process, name="varispeed-shutdown", daemon=True).start()
    return {"ok": True, "message": "VARISPEED será desligado."}


@app.post("/api/media/info")
async def media_info(request: MediaRequest) -> dict[str, Any]:
    url = await asyncio.to_thread(_validate_url, request.url)
    return await asyncio.to_thread(_extract_info_sync, url)


@app.post("/api/media/audio")
async def media_audio(request: MediaRequest) -> FileResponse:
    url = await asyncio.to_thread(_validate_url, request.url)
    temp_dir, media_path, display_name = await asyncio.to_thread(_download_sync, url)
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
