"""Sessão dedicada e local do YouTube para o VARISPEED.

O navegador normal do usuário nunca é inspecionado. Uma instância isolada do
Edge é iniciada com um perfil temporário e uma porta DevTools aleatória limitada
ao loopback. Ao concluir, somente cookies de ``youtube.com`` são exportados; a
janela e o perfil temporário são encerrados e removidos.
"""

from __future__ import annotations

import io
import json
import os
import secrets
import shutil
import socket
import stat
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from websockets.sync.client import connect
from yt_dlp.cookies import YoutubeDLCookieJar

YOUTUBE_HOST = "youtube.com"
YOUTUBE_AUTH_COOKIES = frozenset({
    "SID", "HSID", "SSID", "APISID", "SAPISID", "LOGIN_INFO",
    "__Secure-1PSID", "__Secure-3PSID", "__Secure-1PAPISID", "__Secure-3PAPISID",
})


class DedicatedAuthError(RuntimeError):
    """Erro seguro e apresentável do fluxo de autenticação dedicada."""


class EphemeralCookieBuffer(io.StringIO):
    """Buffer que permite ao yt-dlp salvar cookies sem tocar no arquivo-fonte."""

    def truncate(self, size: int | None = None) -> int:
        self.seek(0)
        return super().truncate(0 if size is None else size)


def _default_storage_root() -> Path:
    base = os.getenv("LOCALAPPDATA", "").strip()
    if base:
        return Path(base) / "VARISPEED" / "youtube-auth"
    return Path.home() / ".varispeed" / "youtube-auth"


def find_edge_executable() -> Path | None:
    candidates = [
        shutil.which("msedge"),
        str(Path(os.getenv("PROGRAMFILES(X86)", "")) / "Microsoft/Edge/Application/msedge.exe"),
        str(Path(os.getenv("PROGRAMFILES", "")) / "Microsoft/Edge/Application/msedge.exe"),
        str(Path(os.getenv("LOCALAPPDATA", "")) / "Microsoft/Edge/Application/msedge.exe"),
    ]
    for raw in candidates:
        if not raw:
            continue
        path = Path(raw)
        if path.is_file():
            return path.resolve()
    return None


def _safe_cookie_text(cookies: list[dict[str, Any]]) -> tuple[str, bool]:
    """Converte apenas cookies do YouTube para o formato Netscape do yt-dlp."""
    lines: list[str] = []
    has_auth = False
    for cookie in cookies:
        domain = str(cookie.get("domain") or "").strip().lower()
        bare_domain = domain.lstrip(".")
        if bare_domain != YOUTUBE_HOST and not bare_domain.endswith(f".{YOUTUBE_HOST}"):
            continue

        name = str(cookie.get("name") or "")
        value = str(cookie.get("value") or "")
        path = str(cookie.get("path") or "/")
        if not name or any(char in name + value + domain + path for char in "\r\n\t"):
            continue
        if not path.startswith("/"):
            path = "/"

        expires_raw = cookie.get("expires")
        try:
            expires = max(0, int(float(expires_raw))) if expires_raw is not None else 0
        except (TypeError, ValueError, OverflowError):
            expires = 0

        include_subdomains = "TRUE" if domain.startswith(".") else "FALSE"
        secure = "TRUE" if bool(cookie.get("secure")) else "FALSE"
        output_domain = f"#HttpOnly_{domain}" if cookie.get("httpOnly") else domain
        lines.append("\t".join((output_domain, include_subdomains, path, secure, str(expires), name, value)))
        if name in YOUTUBE_AUTH_COOKIES and value:
            has_auth = True

    lines.sort(key=str.casefold)
    header = (
        "# Netscape HTTP Cookie File\n"
        "# Sessão dedicada do YouTube criada localmente pelo VARISPEED.\n"
        "# Não compartilhe este arquivo.\n"
    )
    return header + "\n".join(lines) + ("\n" if lines else ""), has_auth


class _CdpConnection:
    def __init__(self, websocket_url: str) -> None:
        self._socket = connect(websocket_url, open_timeout=4, close_timeout=1)
        self._next_id = 0

    def close(self) -> None:
        try:
            self._socket.close()
        except Exception:
            pass

    def call(self, method: str, params: dict[str, Any] | None = None, timeout: float = 6) -> dict[str, Any]:
        self._next_id += 1
        request_id = self._next_id
        self._socket.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            remaining = max(0.05, deadline - time.monotonic())
            raw = self._socket.recv(timeout=remaining)
            payload = json.loads(raw)
            if payload.get("id") != request_id:
                continue
            if payload.get("error"):
                raise DedicatedAuthError("A janela dedicada recusou a operação solicitada.")
            return payload.get("result") or {}
        raise DedicatedAuthError("A janela dedicada demorou demais para responder.")


class DedicatedYouTubeSession:
    def __init__(self, storage_root: Path | None = None) -> None:
        self.root = (storage_root or _default_storage_root()).resolve()
        self.cookie_file = self.root / "youtube.cookies.txt"
        self.validation_file = self.root / "session-state.json"
        self._lock = threading.RLock()
        self._process: subprocess.Popen[bytes] | None = None
        self._profile: Path | None = None
        self._port = 0

    def _ensure_root(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        try:
            self.root.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
        except OSError:
            pass

    def _is_login_open_locked(self) -> bool:
        return self._process is not None and self._process.poll() is None

    def _safe_remove_profile(self, profile: Path | None) -> None:
        if not profile:
            return
        resolved = profile.resolve()
        if resolved.parent != self.root or not resolved.name.startswith("login-"):
            raise RuntimeError("Perfil temporário fora do diretório de autenticação.")
        shutil.rmtree(resolved, ignore_errors=True)

    def _clear_process_state_locked(self) -> tuple[subprocess.Popen[bytes] | None, Path | None, int]:
        process, profile, port = self._process, self._profile, self._port
        self._process = None
        self._profile = None
        self._port = 0
        return process, profile, port

    @staticmethod
    def _free_loopback_port() -> int:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            return int(sock.getsockname()[1])

    @staticmethod
    def _targets(port: int) -> list[dict[str, Any]]:
        with urlopen(f"http://127.0.0.1:{port}/json/list", timeout=1.5) as response:
            data = json.loads(response.read().decode("utf-8"))
        return data if isinstance(data, list) else []

    def _page_websocket(self, port: int) -> str:
        targets = self._targets(port)
        pages = [item for item in targets if item.get("type") == "page" and item.get("webSocketDebuggerUrl")]
        preferred = next((item for item in pages if "youtube.com" in str(item.get("url", ""))), None)
        target = preferred or (pages[0] if pages else None)
        if not target:
            raise DedicatedAuthError("A janela dedicada não disponibilizou uma página para conexão.")
        return str(target["webSocketDebuggerUrl"])

    def _wait_until_ready(self, port: int, timeout: float = 10) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                if self._page_websocket(port):
                    return
            except Exception:
                time.sleep(0.15)
        raise DedicatedAuthError("Não foi possível iniciar a janela dedicada do YouTube.")

    def status(self) -> dict[str, Any]:
        with self._lock:
            login_open = self._is_login_open_locked()
            if self._process is not None and not login_open:
                _, profile, _ = self._clear_process_state_locked()
                self._safe_remove_profile(profile)
            validation = "missing"
            connected = False
            try:
                jar = YoutubeDLCookieJar(self.cookie_file)
                jar.load()
                connected = any(cookie.name in YOUTUBE_AUTH_COOKIES and cookie.value for cookie in jar)
            except (OSError, ValueError):
                connected = False
            if connected:
                validation = "unverified"
                try:
                    saved = json.loads(self.validation_file.read_text(encoding="utf-8"))
                    candidate = str(saved.get("validation") or "")
                    if candidate == "age_verification_required":
                        candidate = "playback_verification_required"
                    if candidate in {"unverified", "verified", "playback_verification_required", "invalid"}:
                        validation = candidate
                except (OSError, ValueError, TypeError):
                    pass
            return {
                "available": find_edge_executable() is not None,
                "connected": connected,
                "login_open": login_open,
                "validation": validation,
            }

    def mark_validation(self, validation: str) -> None:
        if validation not in {"unverified", "verified", "playback_verification_required", "invalid"}:
            raise ValueError("Estado de validacao desconhecido.")
        self._ensure_root()
        temporary = self.root / f"state-{secrets.token_hex(8)}.tmp"
        try:
            temporary.write_text(json.dumps({"validation": validation}), encoding="utf-8")
            os.replace(temporary, self.validation_file)
        finally:
            temporary.unlink(missing_ok=True)

    def cookie_buffer(self) -> EphemeralCookieBuffer | None:
        try:
            content = self.cookie_file.read_text(encoding="utf-8")
        except OSError:
            return None
        return EphemeralCookieBuffer(content)

    def start(self) -> dict[str, Any]:
        edge = find_edge_executable()
        if not edge:
            raise DedicatedAuthError("Microsoft Edge não foi encontrado neste computador.")

        with self._lock:
            if self._is_login_open_locked():
                return self.status()
            if self._process is not None:
                _, stale_profile, _ = self._clear_process_state_locked()
                self._safe_remove_profile(stale_profile)

            self._ensure_root()
            profile = Path(tempfile.mkdtemp(prefix="login-", dir=self.root)).resolve()
            port = self._free_loopback_port()
            flags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            command = [
                str(edge),
                f"--user-data-dir={profile}",
                "--profile-directory=Default",
                f"--remote-debugging-port={port}",
                "--remote-debugging-address=127.0.0.1",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-sync",
                "--disable-extensions",
                "--new-window",
                "https://www.youtube.com/account",
            ]
            try:
                process = subprocess.Popen(
                    command,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=flags,
                )
            except OSError as exc:
                self._safe_remove_profile(profile)
                raise DedicatedAuthError("Não foi possível abrir a sessão dedicada do YouTube.") from exc
            self._process, self._profile, self._port = process, profile, port

        try:
            self._wait_until_ready(port)
        except Exception:
            self.abort_login()
            raise
        return self.status()

    @staticmethod
    def _wait_for_page(connection: _CdpConnection, expected_url: str, timeout: float = 5) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                result = connection.call("Runtime.evaluate", {
                    "expression": "({state: document.readyState, href: location.href})",
                    "returnByValue": True,
                })
                value = (result.get("result") or {}).get("value") or {}
                if value.get("state") in {"interactive", "complete"} and str(value.get("href", "")).startswith(expected_url):
                    return
            except Exception:
                pass
            time.sleep(0.12)
        raise DedicatedAuthError("A página de confirmação do YouTube demorou demais para carregar.")

    def _write_cookie_file(self, content: str) -> None:
        self._ensure_root()
        temporary = self.root / f"cookies-{secrets.token_hex(8)}.tmp"
        try:
            with temporary.open("x", encoding="utf-8", newline="\n") as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            try:
                temporary.chmod(stat.S_IRUSR | stat.S_IWUSR)
            except OSError:
                pass
            os.replace(temporary, self.cookie_file)
            try:
                self.cookie_file.chmod(stat.S_IRUSR | stat.S_IWUSR)
            except OSError:
                pass
        finally:
            temporary.unlink(missing_ok=True)

    def finish(self) -> dict[str, Any]:
        with self._lock:
            if not self._is_login_open_locked():
                raise DedicatedAuthError("A janela dedicada foi fechada. Comece a conexão novamente.")
            port = self._port

        connection = _CdpConnection(self._page_websocket(port))
        try:
            initial = connection.call("Network.getAllCookies")
            _, initially_authenticated = _safe_cookie_text(initial.get("cookies") or [])
            if not initially_authenticated:
                raise DedicatedAuthError(
                    "A conta ainda não foi identificada. Entre no YouTube nessa janela e clique em Concluir novamente."
                )

            connection.call("Page.navigate", {"url": "https://www.youtube.com/robots.txt"})
            self._wait_for_page(connection, "https://www.youtube.com/robots.txt")
            result = connection.call("Network.getAllCookies")
            content, has_auth = _safe_cookie_text(result.get("cookies") or [])
            if not has_auth:
                raise DedicatedAuthError(
                    "A sessão do YouTube não permaneceu disponível após a confirmação. Entre novamente e repita o processo."
                )
            self._write_cookie_file(content)
            self.mark_validation("unverified")
            try:
                connection.call("Browser.close", timeout=2)
            except Exception:
                pass
        finally:
            connection.close()

        self.abort_login()
        return self.status()

    def abort_login(self) -> None:
        with self._lock:
            process, profile, _ = self._clear_process_state_locked()
        if process is not None and process.poll() is None:
            try:
                process.terminate()
                process.wait(timeout=3)
            except Exception:
                try:
                    process.kill()
                    process.wait(timeout=2)
                except Exception:
                    pass
        self._safe_remove_profile(profile)

    def disconnect(self) -> dict[str, Any]:
        self.abort_login()
        self.cookie_file.unlink(missing_ok=True)
        self.validation_file.unlink(missing_ok=True)
        return self.status()

    def shutdown(self) -> None:
        self.abort_login()
