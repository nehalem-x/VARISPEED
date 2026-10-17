"""VARISPEED — reinício do backend depois de uma atualização.

O yt-dlp fica carregado na memória do processo do servidor. Para usar a versão
nova, o servidor dispara este script e se encerra; o script espera a porta
ficar livre e sobe o Uvicorn de novo com os mesmos parâmetros.

Uso: python -m server.relaunch --host 0.0.0.0 --port 8765
"""

from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _port_free(host: str, port: int) -> bool:
    family = socket.AF_INET6 if ":" in host else socket.AF_INET
    sock = socket.socket(family, socket.SOCK_STREAM)
    try:
        # O Uvicorn também usa SO_REUSEADDR, então TIME_WAIT não conta como ocupado.
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def detached_flags() -> dict[str, object]:
    if os.name == "nt":
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        return {"creationflags": flags}
    return {"start_new_session": True}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")  # noqa: S104 - mesmo bind do launcher
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--wait", type=float, default=20.0)
    args = parser.parse_args(argv)

    deadline = time.monotonic() + args.wait
    while not _port_free(args.host, args.port):
        if time.monotonic() > deadline:
            return 1
        time.sleep(0.2)

    log_dir = ROOT / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    with (log_dir / "server.log").open("a", encoding="utf-8") as log:
        log.write(f"\n[relaunch] reiniciando o servidor em {args.host}:{args.port}\n")
        log.flush()
        subprocess.Popen(  # noqa: S603 - comando fixo, sem shell
            [
                sys.executable,
                "-m",
                "uvicorn",
                "server.main:app",
                "--host",
                args.host,
                "--port",
                str(args.port),
                "--log-level",
                "warning",
            ],
            cwd=ROOT,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            **detached_flags(),
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
