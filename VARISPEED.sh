#!/usr/bin/env sh
# VARISPEED no Linux: usa o Python que vem no download pronto (runtime/python)
# ou, num clone do repositório, o python3 do sistema. O launcher prepara o
# resto e abre o navegador.
set -eu
cd "$(dirname "$0")"

if [ -x runtime/python/bin/python3 ]; then
  PY=runtime/python/bin/python3
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  echo "[VARISPEED] Python 3.11 ou mais novo nao foi encontrado." >&2
  exit 1
fi

exec "$PY" launcher.py
