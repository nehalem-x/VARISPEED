#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

PY=".venv/bin/python"
if [ ! -x "$PY" ]; then
  echo "[VARISPEED] Criando ambiente Python local..."
  python3 -m venv .venv
fi

if ! "$PY" -c 'import fastapi,uvicorn,yt_dlp; from importlib.metadata import version; v=tuple(map(int,yt_dlp.version.__version__.split(".")[:3])); assert v >= (2026,7,4); assert version("yt-dlp-ejs"); assert version("yt-dlp-getpot-wpc")' >/dev/null 2>&1; then
  echo "[VARISPEED] Instalando dependencias..."
  "$PY" -m pip install -r server/requirements.txt
fi

command -v ffmpeg >/dev/null 2>&1 || echo '[VARISPEED] Aviso: FFmpeg nao foi encontrado no PATH. Alguns links podem exigir FFmpeg.'
printf '\n[VARISPEED] Local: http://127.0.0.1:8765/\n[VARISPEED] Rede local: veja o endereco em Configuracoes > Sistema.\n[VARISPEED] Ctrl+C encerra o servidor.\n\n'
exec "$PY" -m uvicorn server.main:app --host 0.0.0.0 --port 8765
