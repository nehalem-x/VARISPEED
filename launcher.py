"""VARISPEED — launcher gráfico/local sem terminal visível.

Este arquivo usa somente a biblioteca padrão do Python. Ele sobe uma pequena
página de inicialização em 127.0.0.1:8764, prepara o ambiente do backend e,
quando o FastAPI estiver saudável, a página redireciona para 127.0.0.1. O
backend principal escuta em 0.0.0.0 para também ficar disponível na rede local.

No Windows, o ponto de entrada normal é VARISPEED.vbs, que executa este script
com a janela do console oculta. start-tempo.bat fica reservado para diagnóstico.
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
STARTUP_HOST = "127.0.0.1"
STARTUP_PORT = 8764
APP_BIND_HOST = "0.0.0.0"
APP_HOST = "127.0.0.1"
APP_PORT = int(os.getenv("VARISPEED_PORT", "8765") or 8765)
STARTUP_URL = f"http://{STARTUP_HOST}:{STARTUP_PORT}/"
APP_URL = f"http://{APP_HOST}:{APP_PORT}/"
HEALTH_URL = f"http://{APP_HOST}:{APP_PORT}/api/health"
LOG_DIR = ROOT / "logs"
LOG_FILE = LOG_DIR / "startup.log"
VENV_DIR = ROOT / ".venv"
VENV_PY = VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
REQ_FILE = ROOT / "server" / "requirements.txt"

STEP_ORDER = [
    "python",
    "environment",
    "dependencies",
    "ytdlp",
    "ffmpeg",
    "server",
    "interface",
]
STEP_LABELS = {
    "python": "Python",
    "environment": "Ambiente local",
    "dependencies": "Dependências",
    "ytdlp": "yt-dlp",
    "ffmpeg": "FFmpeg",
    "server": "Servidor local",
    "interface": "Interface",
}


def _default_steps() -> dict[str, dict[str, str]]:
    return {key: {"label": STEP_LABELS[key], "state": "pending", "detail": ""} for key in STEP_ORDER}


class StartupState:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.booting = False
        self.ready = False
        self.error = False
        self.stage = "AGUARDANDO"
        self.message = "Preparando inicialização..."
        self.progress = 0
        self.app_url = APP_URL
        self.steps = _default_steps()
        self.logs: list[str] = []
        self.server_pid: int | None = None

    def reset_for_retry(self) -> None:
        with self.lock:
            self.booting = True
            self.ready = False
            self.error = False
            self.stage = "INICIALIZANDO"
            self.message = "Preparando o VARISPEED..."
            self.progress = 0
            self.steps = _default_steps()
            self.logs = []

    def log(self, text: str) -> None:
        clean = str(text).rstrip()
        if not clean:
            return
        stamp = time.strftime("%H:%M:%S")
        line = f"[{stamp}] {clean}"
        with self.lock:
            self.logs.append(line)
            self.logs = self.logs[-80:]
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        try:
            with LOG_FILE.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
        except OSError:
            pass

    def set_stage(self, stage: str, message: str) -> None:
        with self.lock:
            self.stage = stage.upper()
            self.message = message

    def set_step(self, key: str, state: str, detail: str = "") -> None:
        with self.lock:
            self.steps[key]["state"] = state
            self.steps[key]["detail"] = detail
            completed = sum(1 for k in STEP_ORDER if self.steps[k]["state"] in {"ok", "warn"})
            # O passo ativo representa trabalho real em andamento; a barra só
            # avança quando um marco de inicialização é concluído.
            self.progress = round((completed / len(STEP_ORDER)) * 100)

    def mark_ready(self, message: str = "Sistema pronto.") -> None:
        with self.lock:
            self.ready = True
            self.error = False
            self.booting = False
            self.stage = "SISTEMA PRONTO"
            self.message = message
            self.progress = 100

    def mark_error(self, message: str) -> None:
        with self.lock:
            self.ready = False
            self.error = True
            self.booting = False
            self.stage = "FALHA NA INICIALIZAÇÃO"
            self.message = message

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            return {
                "booting": self.booting,
                "ready": self.ready,
                "error": self.error,
                "stage": self.stage,
                "message": self.message,
                "progress": self.progress,
                "app_url": self.app_url,
                "steps": [dict(key=k, **self.steps[k]) for k in STEP_ORDER],
                "logs": list(self.logs[-36:]),
                "server_pid": self.server_pid,
            }


STATE = StartupState()
BOOT_LOCK = threading.Lock()
APP_PROCESS: subprocess.Popen[Any] | None = None


def _http_json(url: str, timeout: float = 0.65) -> dict[str, Any] | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            if response.status != 200:
                return None
            return json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError):
        return None


def _http_ok(url: str, timeout: float = 0.65) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def _subprocess_flags() -> dict[str, Any]:
    if os.name == "nt":
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        return {"creationflags": flags}
    return {"start_new_session": True}


def _run(command: list[str], *, stream: bool = False) -> subprocess.CompletedProcess[str]:
    STATE.log("$ " + " ".join(command))
    if not stream:
        result = subprocess.run(
            command,
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            **_subprocess_flags(),
        )
        for line in result.stdout.splitlines()[-30:]:
            STATE.log(line)
        return result

    process = subprocess.Popen(
        command,
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        **_subprocess_flags(),
    )
    captured: list[str] = []
    assert process.stdout is not None
    for line in process.stdout:
        clean = line.rstrip()
        if clean:
            captured.append(clean)
            STATE.log(clean)
            # Pip não fornece um percentual global confiável. Exibimos a linha
            # real mais recente no detalhe, sem inventar porcentagem de download.
            with STATE.lock:
                STATE.steps["dependencies"]["detail"] = clean[-120:]
    code = process.wait()
    return subprocess.CompletedProcess(command, code, "\n".join(captured), "")


def _python_version(python: Path | str) -> tuple[int, int, int] | None:
    result = _run([str(python), "-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))"])
    if result.returncode != 0:
        return None
    try:
        parts = result.stdout.strip().splitlines()[-1].split(".")
        return tuple(int(x) for x in parts[:3])  # type: ignore[return-value]
    except (ValueError, IndexError):
        return None


def _deps_ok() -> tuple[bool, str]:
    if not VENV_PY.exists():
        return False, ""
    code = (
        "import fastapi,uvicorn,yt_dlp; from importlib.metadata import version; "
        "v=tuple(map(int,yt_dlp.version.__version__.split('.')[:3])); "
        "assert v >= (2026,7,4); "
        "assert version('yt-dlp-ejs'); assert version('yt-dlp-getpot-wpc'); "
        "print(yt_dlp.version.__version__)"
    )
    result = _run([str(VENV_PY), "-c", code])
    if result.returncode != 0:
        return False, ""
    version = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ""
    return True, version


def _start_backend() -> subprocess.Popen[Any]:
    global APP_PROCESS
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    server_log = (LOG_DIR / "server.log").open("a", encoding="utf-8")
    command = [
        str(VENV_PY),
        "-m",
        "uvicorn",
        "server.main:app",
        "--host",
        APP_BIND_HOST,
        "--port",
        str(APP_PORT),
        "--log-level",
        "warning",
    ]
    STATE.log("$ " + " ".join(command))
    APP_PROCESS = subprocess.Popen(
        command,
        cwd=ROOT,
        stdin=subprocess.DEVNULL,
        stdout=server_log,
        stderr=subprocess.STDOUT,
        **_subprocess_flags(),
    )
    with STATE.lock:
        STATE.server_pid = APP_PROCESS.pid
    return APP_PROCESS


def _bootstrap() -> None:
    if not BOOT_LOCK.acquire(blocking=False):
        return
    started_process: subprocess.Popen[Any] | None = None
    try:
        STATE.reset_for_retry()
        STATE.log("VARISPEED launcher iniciado.")

        # Se o backend já estiver ativo, não cria uma segunda instância.
        existing = _http_json(HEALTH_URL)
        if existing and existing.get("ok"):
            if not _http_ok(APP_URL):
                STATE.set_step("server", "ok", "Instância existente")
                STATE.set_step("interface", "error", "GET / falhou")
                raise RuntimeError("Existe um backend ativo em 127.0.0.1:8765, mas a interface não respondeu.")
            for key in ("python", "environment", "dependencies", "ytdlp", "server", "interface"):
                STATE.set_step(key, "ok", "Instância existente")
            ffmpeg_ok = bool(existing.get("ffmpeg"))
            STATE.set_step("ffmpeg", "ok" if ffmpeg_ok else "warn", "Disponível" if ffmpeg_ok else "Não encontrado no PATH")
            STATE.mark_ready("VARISPEED já estava em execução.")
            STATE.log("Backend já estava ativo; nenhuma nova instância foi criada.")
            return

        STATE.set_stage("VERIFICANDO PYTHON", "Confirmando runtime Python 3.11 ou superior...")
        STATE.set_step("python", "active", "Verificando runtime")
        version = sys.version_info[:3]
        if version < (3, 11):
            STATE.set_step("python", "error", f"Python {platform.python_version()}")
            raise RuntimeError("É necessário Python 3.11 ou superior.")
        STATE.set_step("python", "ok", f"Python {platform.python_version()}")
        STATE.log(f"Python {platform.python_version()} detectado em {sys.executable}")

        STATE.set_stage("PREPARANDO AMBIENTE", "Verificando o ambiente Python local...")
        STATE.set_step("environment", "active", "Verificando .venv")
        venv_version = _python_version(VENV_PY) if VENV_PY.exists() else None
        if venv_version is None or venv_version < (3, 11):
            if VENV_DIR.exists():
                STATE.log("Ambiente .venv incompleto/incompatível encontrado; recriando.")
                shutil.rmtree(VENV_DIR, ignore_errors=True)
            STATE.set_step("environment", "active", "Criando .venv")
            STATE.set_stage("CRIANDO AMBIENTE", "Criando ambiente Python local...")
            result = _run([sys.executable, "-m", "venv", str(VENV_DIR)])
            if result.returncode != 0 or not VENV_PY.exists():
                STATE.set_step("environment", "error", "Falha ao criar .venv")
                raise RuntimeError("Não foi possível criar o ambiente Python local.")
            venv_version = _python_version(VENV_PY)
        STATE.set_step("environment", "ok", f"Python {'.'.join(map(str, venv_version or version))}")

        STATE.set_stage("VERIFICANDO DEPENDÊNCIAS", "Conferindo FastAPI, Uvicorn e yt-dlp...")
        STATE.set_step("dependencies", "active", "Verificando pacotes")
        deps_ok, ytdlp_version = _deps_ok()
        if not deps_ok:
            STATE.set_stage("INSTALANDO DEPENDÊNCIAS", "Preparando componentes necessários...")
            STATE.set_step("dependencies", "active", "pip install -r server/requirements.txt")
            result = _run([str(VENV_PY), "-m", "pip", "install", "-r", str(REQ_FILE)], stream=True)
            if result.returncode != 0:
                STATE.set_step("dependencies", "error", "Falha no pip")
                raise RuntimeError("Falha ao instalar as dependências do VARISPEED.")
            deps_ok, ytdlp_version = _deps_ok()
            if not deps_ok:
                STATE.set_step("dependencies", "error", "Pacotes não validaram")
                raise RuntimeError("As dependências foram instaladas, mas não passaram na validação.")
        STATE.set_step("dependencies", "ok", "FastAPI / Uvicorn prontos")

        STATE.set_stage("VERIFICANDO YT-DLP", "Validando o importador de mídia...")
        STATE.set_step("ytdlp", "active", "Consultando versão")
        if not ytdlp_version:
            ok, ytdlp_version = _deps_ok()
            if not ok:
                STATE.set_step("ytdlp", "error", "Não disponível")
                raise RuntimeError("yt-dlp não está disponível no ambiente local.")
        STATE.set_step("ytdlp", "ok", f"yt-dlp {ytdlp_version}")

        STATE.set_stage("VERIFICANDO FFMPEG", "Procurando suporte opcional a formatos adicionais...")
        STATE.set_step("ffmpeg", "active", "Procurando no PATH")
        ffmpeg_path = shutil.which("ffmpeg")
        if ffmpeg_path:
            STATE.set_step("ffmpeg", "ok", "Disponível")
            STATE.log(f"FFmpeg encontrado: {ffmpeg_path}")
        else:
            STATE.set_step("ffmpeg", "warn", "Opcional — não encontrado")
            STATE.log("Aviso: FFmpeg não foi encontrado no PATH; alguns links podem exigir FFmpeg.")

        STATE.set_stage("INICIANDO SERVIDOR", "Subindo o backend local do VARISPEED...")
        STATE.set_step("server", "active", f"{APP_HOST}:{APP_PORT}")
        process = _start_backend()
        started_process = process
        deadline = time.monotonic() + 35
        health: dict[str, Any] | None = None
        while time.monotonic() < deadline:
            if process.poll() is not None:
                STATE.set_step("server", "error", f"Processo encerrou ({process.returncode})")
                raise RuntimeError("O servidor local encerrou durante a inicialização. Veja logs/server.log.")
            health = _http_json(HEALTH_URL, timeout=0.8)
            if health and health.get("ok"):
                break
            time.sleep(0.25)
        else:
            STATE.set_step("server", "error", "Timeout ao responder")
            raise RuntimeError("O servidor local não respondeu dentro do tempo esperado.")
        STATE.set_step("server", "ok", f"PID {process.pid}")

        STATE.set_stage("CARREGANDO INTERFACE", "Verificando os arquivos do aplicativo...")
        STATE.set_step("interface", "active", "GET /")
        if not _http_ok(APP_URL, timeout=1.2):
            STATE.set_step("interface", "error", "Interface não respondeu")
            raise RuntimeError("O backend iniciou, mas a interface não pôde ser carregada.")
        STATE.set_step("interface", "ok", "Interface disponível")

        STATE.mark_ready("Todos os componentes essenciais estão prontos.")
        STATE.log("Inicialização concluída. Interface pronta para uso.")
    except Exception as exc:
        # Se esta tentativa criou um backend que não chegou a ficar utilizável,
        # encerra somente esse processo antes de permitir retry. Nunca mata uma
        # instância preexistente detectada no começo do bootstrap.
        if started_process is not None and started_process.poll() is None:
            try:
                started_process.terminate()
                started_process.wait(timeout=3)
            except Exception:
                try:
                    started_process.kill()
                except Exception:
                    pass
        STATE.log(f"ERRO: {exc}")
        STATE.log(traceback.format_exc())
        STATE.mark_error(str(exc))
    finally:
        BOOT_LOCK.release()


def _retry() -> bool:
    with STATE.lock:
        if STATE.booting:
            return False
    threading.Thread(target=_bootstrap, name="varispeed-bootstrap-retry", daemon=True).start()
    return True


class StartupHandler(BaseHTTPRequestHandler):
    server_version = "VARISPEEDStartup/1.0"

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _send_bytes(self, data: bytes, content_type: str, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def _send_file(self, path: Path, content_type: str) -> None:
        try:
            data = path.read_bytes()
        except OSError:
            self._send_bytes(b"not found", "text/plain; charset=utf-8", HTTPStatus.NOT_FOUND)
            return
        self._send_bytes(data, content_type)

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in {"/", "/startup.html"}:
            self._send_file(ROOT / "startup.html", "text/html; charset=utf-8")
            return
        if path == "/startup.css":
            self._send_file(ROOT / "startup.css", "text/css; charset=utf-8")
            return
        if path == "/startup.js":
            self._send_file(ROOT / "startup.js", "application/javascript; charset=utf-8")
            return
        if path == "/motion.js":
            self._send_file(ROOT / "motion.js", "application/javascript; charset=utf-8")
            return
        if path == "/assets/favicon.png":
            self._send_file(ROOT / "assets" / "favicon.png", "image/png")
            return
        if path == "/status":
            body = json.dumps(STATE.snapshot(), ensure_ascii=False).encode("utf-8")
            self._send_bytes(body, "application/json; charset=utf-8")
            return
        self._send_bytes(b"not found", "text/plain; charset=utf-8", HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path == "/retry":
            started = _retry()
            body = json.dumps({"ok": True, "started": started}).encode("utf-8")
            self._send_bytes(body, "application/json; charset=utf-8")
            return
        self._send_bytes(b"not found", "text/plain; charset=utf-8", HTTPStatus.NOT_FOUND)


def _startup_server_already_running() -> bool:
    data = _http_json(f"http://{STARTUP_HOST}:{STARTUP_PORT}/status", timeout=0.35)
    return bool(data and isinstance(data.get("steps"), list) and "stage" in data)


def main() -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    # Segundo clique durante a inicialização: reutiliza a mesma tela.
    if _startup_server_already_running():
        webbrowser.open(STARTUP_URL, new=1)
        return 0

    # Segundo clique com o sistema já pronto: não cria outro backend.
    existing = _http_json(HEALTH_URL, timeout=0.45)
    if existing and existing.get("ok") and _http_ok(APP_URL, timeout=0.55):
        webbrowser.open(APP_URL, new=1)
        return 0

    try:
        server = ThreadingHTTPServer((STARTUP_HOST, STARTUP_PORT), StartupHandler)
    except OSError:
        # Se a porta de startup ficou ocupada entre a checagem e o bind,
        # simplesmente tenta reutilizar a instância já existente.
        webbrowser.open(STARTUP_URL, new=1)
        return 0

    threading.Thread(target=_bootstrap, name="varispeed-bootstrap", daemon=True).start()
    threading.Timer(0.18, lambda: webbrowser.open(STARTUP_URL, new=1)).start()

    # Após o sistema ficar pronto, a página redireciona para 8765. Mantemos o
    # servidor de startup vivo por alguns segundos para a transição completar.
    def retire_when_ready() -> None:
        while True:
            snap = STATE.snapshot()
            if snap["ready"]:
                time.sleep(12)
                server.shutdown()
                return
            # Em erro, a página precisa permanecer viva para mostrar detalhes e retry.
            time.sleep(0.5)

    threading.Thread(target=retire_when_ready, name="varispeed-startup-retire", daemon=True).start()
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
