@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo [VARISPEED] MODO DIAGNOSTICO - o launcher normal e VARISPEED.vbs
echo.
set "VENV_PY=.venv\Scripts\python.exe"

if exist "%VENV_PY%" goto :venv_ready

if exist ".venv" (
  echo [VARISPEED] Ambiente .venv incompleto encontrado. Recriando...
  rmdir /s /q ".venv"
)

echo [VARISPEED] Procurando Python 3.11+...

where py >nul 2>&1
if errorlevel 1 goto :try_python

py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
if errorlevel 1 goto :try_python

echo [VARISPEED] Python encontrado via py -3.
echo [VARISPEED] Criando ambiente Python local...
py -3 -m venv .venv
if errorlevel 1 goto :venv_error
goto :check_venv

:try_python
where python >nul 2>&1
if errorlevel 1 goto :python_missing

python -c "import sys; raise SystemExit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
if errorlevel 1 goto :python_missing

echo [VARISPEED] Python encontrado via python.
echo [VARISPEED] Criando ambiente Python local...
python -m venv .venv
if errorlevel 1 goto :venv_error

:check_venv
if not exist "%VENV_PY%" goto :venv_error

:venv_ready
"%VENV_PY%" -c "import fastapi, uvicorn, yt_dlp; from importlib.metadata import version; v=tuple(map(int, yt_dlp.version.__version__.split('.')[:3])); raise SystemExit(0 if v >= (2026,7,4) and version('yt-dlp-ejs') and version('yt-dlp-getpot-wpc') else 1)" >nul 2>&1
if not errorlevel 1 goto :deps_ready

echo [VARISPEED] Instalando dependencias...
"%VENV_PY%" -m pip install -r "server\requirements.txt"
if errorlevel 1 goto :deps_error

:deps_ready
where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo [VARISPEED] Aviso: FFmpeg nao foi encontrado no PATH. Alguns links podem exigir FFmpeg.
)

echo.
echo [VARISPEED] Local: http://127.0.0.1:8765/
echo [VARISPEED] Rede local: veja o endereco em Configuracoes ^> Sistema.
echo [VARISPEED] Ctrl+C encerra o servidor.
echo.
"%VENV_PY%" -m uvicorn server.main:app --host 0.0.0.0 --port 8765
exit /b %errorlevel%

:python_missing
echo.
echo [VARISPEED] ERRO: Python 3.11 ou superior nao foi encontrado.
echo [VARISPEED] Com o Python Install Manager, execute:
echo [VARISPEED]   py install 3.13
echo [VARISPEED] Depois confirme com:
echo [VARISPEED]   py -3.13 --version
echo.
exit /b 1

:venv_error
echo.
echo [VARISPEED] ERRO: nao foi possivel criar um ambiente .venv valido.
echo [VARISPEED] Teste manualmente: py -3 -m venv .venv
echo.
exit /b 1

:deps_error
echo.
echo [VARISPEED] ERRO: falha ao instalar as dependencias.
echo [VARISPEED] Teste manualmente:
echo [VARISPEED]   .venv\Scripts\python.exe -m pip install -r server\requirements.txt
echo.
exit /b 1
