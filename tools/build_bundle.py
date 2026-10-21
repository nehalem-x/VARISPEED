"""Monta o download pronto do VARISPEED para Windows ou Linux.

O pacote traz tudo o que o app precisa para abrir sem instalar nada:

    VARISPEED/
      runtime/python/   Python portátil (python-build-standalone, via uv)
                        com as dependências de server/requirements.txt
      runtime/node/     Node.js LTS, usado nos desafios de JavaScript do YouTube
      launcher.py, server/, interface...

Uso (no GitHub Actions ou localmente):

    python tools/build_bundle.py --target windows --version v1.0.0
    python tools/build_bundle.py --target linux --version v1.0.0

O resultado fica em dist/: VARISPEED-<versão>-windows-x64.zip ou
VARISPEED-<versão>-linux-x64.tar.gz. Depois de compactar, o script extrai o
arquivo numa pasta nova e sobe o servidor de lá, para provar que o pacote
funciona fora do lugar onde foi montado.

Só usa a biblioteca padrão, mais o uv instalado pelo pip.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Versões fixas: o mesmo commit sempre gera o mesmo pacote.
UV_VERSION = "0.12.23"
PYTHON_VERSION = "3.12"
NODE_VERSION = "v22.23.3"
NODE_DIST = f"https://nodejs.org/dist/{NODE_VERSION}"

# O que não vai para o usuário final: testes, documentação interna, CI e
# scripts de desenvolvimento. O README fica.
EXCLUDED_PREFIXES = ("tests/", "docs/", ".github/", "tools/")
EXCLUDED_FILES = {".gitignore", ".gitattributes", "pyproject.toml", "start-tempo.bat", "start-tempo.sh"}
PLATFORM_ONLY = {
    "windows": {"VARISPEED.sh", "criar-atalho.sh", "VARISPEED.desktop"},
    # O .desktop do repositório é um modelo com caminho fixo; no pacote,
    # criar-atalho.sh gera um com o caminho real.
    "linux": {"VARISPEED.vbs", "Create VARISPEED shortcut.vbs", "VARISPEED.desktop"},
}


def log(message: str) -> None:
    print(f"[bundle] {message}", flush=True)


def run(command: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    log("$ " + " ".join(str(part) for part in command))
    return subprocess.run(command, check=True, text=True, **kwargs)


def download(url: str, target: Path) -> Path:
    log(f"baixando {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "VARISPEED-build"})
    with urllib.request.urlopen(request, timeout=120) as response, target.open("wb") as handle:  # noqa: S310
        shutil.copyfileobj(response, handle)
    return target


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def app_files(target: str) -> list[str]:
    tracked = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True
    ).stdout.decode("utf-8").split("\0")
    skip = EXCLUDED_FILES | PLATFORM_ONLY[target]
    return [
        name for name in tracked
        if name and name not in skip and not name.startswith(EXCLUDED_PREFIXES)
    ]


def copy_app(target: str, bundle: Path) -> None:
    files = app_files(target)
    for name in files:
        source = ROOT / name
        destination = bundle / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    log(f"{len(files)} arquivos do app copiados")


def install_python(work: Path, bundle: Path, target: str) -> Path:
    """Python portátil do python-build-standalone, o mesmo que o uv usa."""
    run([sys.executable, "-m", "pip", "install", "--quiet", f"uv=={UV_VERSION}"])
    install_dir = work / "uv-python"
    env = {**os.environ, "UV_PYTHON_INSTALL_DIR": str(install_dir)}
    run([sys.executable, "-m", "uv", "python", "install", PYTHON_VERSION], env=env)
    # O uv também cria um atalho "cpython-3.12-..." para a versão completa;
    # copia a pasta real, não o atalho.
    candidates = sorted(
        path for path in install_dir.glob(f"cpython-{PYTHON_VERSION}.*")
        if path.is_dir() and not path.is_symlink() and not path.is_junction()
    )
    if not candidates:
        raise SystemExit(f"o uv não deixou um Python {PYTHON_VERSION} em {install_dir}")
    source = candidates[-1]
    destination = bundle / "runtime" / "python"
    shutil.copytree(source, destination, symlinks=True)
    # O uv marca o Python como "gerenciado externamente" para o pip não
    # mexer nele. No pacote ele é nosso: o pip instala e atualiza o yt-dlp.
    for marker in destination.rglob("EXTERNALLY-MANAGED"):
        marker.unlink()
    python = destination / ("python.exe" if target == "windows" else "bin/python3")
    if not python.is_file():
        raise SystemExit(f"Python não encontrado em {python}")
    log(f"Python portátil: {source.name}")
    return python


def install_dependencies(python: Path) -> None:
    run([str(python), "-m", "ensurepip", "--upgrade"], stdout=subprocess.DEVNULL)
    run([
        str(python), "-m", "pip", "install",
        "--no-cache-dir", "--disable-pip-version-check", "--no-warn-script-location",
        "-r", str(ROOT / "server" / "requirements.txt"),
    ])
    run([str(python), "-m", "pip", "check"])


def install_node(work: Path, bundle: Path, target: str) -> None:
    name = (
        f"node-{NODE_VERSION}-win-x64.zip" if target == "windows"
        else f"node-{NODE_VERSION}-linux-x64.tar.xz"
    )
    sums = download(f"{NODE_DIST}/SHASUMS256.txt", work / "SHASUMS256.txt").read_text(encoding="utf-8")
    expected = next((line.split()[0] for line in sums.splitlines() if line.endswith(f"  {name}")), "")
    if not expected:
        raise SystemExit(f"{name} não aparece em SHASUMS256.txt")
    archive = download(f"{NODE_DIST}/{name}", work / name)
    if sha256(archive) != expected:
        raise SystemExit(f"o SHA-256 de {name} não confere")

    extracted = work / "node"
    if target == "windows":
        with zipfile.ZipFile(archive) as handle:
            handle.extractall(extracted)
    else:
        with tarfile.open(archive) as handle:
            handle.extractall(extracted, filter="data")
    top = next(extracted.iterdir())
    destination = bundle / "runtime" / "node"
    destination.mkdir(parents=True)
    # Só o executável e a licença: npm, headers e docs não são usados.
    binary = top / ("node.exe" if target == "windows" else "bin/node")
    binary_target = destination / ("node.exe" if target == "windows" else "bin/node")
    binary_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(binary, binary_target)
    shutil.copy2(top / "LICENSE", destination / "LICENSE")
    log(f"Node {NODE_VERSION} (SHA-256 conferido)")


def write_notes(bundle: Path, target: str, version: str, python: Path) -> None:
    python_version = run(
        [str(python), "-c", "import platform; print(platform.python_version())"], capture_output=True
    ).stdout.strip()
    ytdlp_version = run(
        [str(python), "-c", "from importlib.metadata import version; print(version('yt-dlp'))"], capture_output=True
    ).stdout.strip()
    start = "Dê dois cliques em VARISPEED.vbs." if target == "windows" else "Rode ./VARISPEED.sh."
    shortcut = (
        "Para ter um atalho na Área de Trabalho, dê dois cliques em “Create VARISPEED shortcut.vbs”."
        if target == "windows"
        else "Para ter o VARISPEED no menu de aplicativos, rode ./criar-atalho.sh."
    )
    (bundle / "LEIA-ME.txt").write_text(
        f"VARISPEED {version}\n\n"
        f"Para abrir: {start} O navegador abre sozinho.\n"
        f"{shortcut}\n\n"
        "Não precisa instalar Python, Node ou outras dependências: elas vêm na pasta runtime/.\n"
        "Mantenha a pasta inteira junta; o VARISPEED guarda os logs em logs/.\n"
        "O yt-dlp se atualiza sozinho uma vez por dia e pode ser atualizado em Configurações → Sistema.\n",
        encoding="utf-8",
    )
    (bundle / "THIRD-PARTY.txt").write_text(
        "Componentes de terceiros incluídos neste download\n\n"
        f"Python {python_version} (python-build-standalone) — PSF License. Ver runtime/python.\n"
        f"Node.js {NODE_VERSION} — MIT. Ver runtime/node/LICENSE.\n"
        f"yt-dlp {ytdlp_version} — Unlicense. Instalado em runtime/python com as demais dependências\n"
        "de server/requirements.txt (FastAPI, Uvicorn e outras), cada uma com sua licença.\n"
        "Ícones Lucide — ISC. Ver assets/icons/LICENSE.lucide.txt.\n"
        "Fontes Space Grotesk e JetBrains Mono — SIL Open Font License 1.1. Ver assets/fonts.\n",
        encoding="utf-8",
    )
    (bundle / "VERSION").write_text(json.dumps({"version": version}) + "\n", encoding="utf-8")


def make_archive(bundle: Path, out_dir: Path, target: str, version: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"VARISPEED-{version}-{target}-x64"
    if target == "windows":
        archive = out_dir / f"{stem}.zip"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as handle:
            for path in sorted(bundle.rglob("*")):
                if path.is_file():
                    handle.write(path, Path("VARISPEED") / path.relative_to(bundle))
    else:
        # tar.gz guarda permissões de execução e links simbólicos do Python.
        archive = out_dir / f"{stem}.tar.gz"
        with tarfile.open(archive, "w:gz", compresslevel=9) as handle:
            handle.add(bundle, arcname="VARISPEED")
    (out_dir / f"{archive.name}.sha256").write_text(f"{sha256(archive)}  {archive.name}\n", encoding="utf-8")
    size = archive.stat().st_size / (1024 * 1024)
    log(f"pacote: {archive.name} ({size:.1f} MB)")
    return archive


def smoke_test(archive: Path, target: str) -> None:
    """Extrai numa pasta nova e sobe o servidor de lá: o pacote não pode
    depender do caminho em que foi montado."""
    with tempfile.TemporaryDirectory(prefix="varispeed-smoke-") as tmp:
        if target == "windows":
            with zipfile.ZipFile(archive) as handle:
                handle.extractall(tmp)
        else:
            with tarfile.open(archive) as handle:
                handle.extractall(tmp, filter="tar")
        root = Path(tmp) / "VARISPEED"
        python = root / "runtime" / "python" / ("python.exe" if target == "windows" else "bin/python3")
        node = root / "runtime" / "node" / ("node.exe" if target == "windows" else "bin/node")
        run([str(node), "--version"])
        run([str(python), "-c", "import fastapi, uvicorn, yt_dlp, yt_dlp_ejs; import launcher"], cwd=root)

        port = 8799
        env = {**os.environ, "VARISPEED_PORT": str(port), "VARISPEED_NODE_PATH": str(node),
               "LOCALAPPDATA": str(Path(tmp) / "appdata")}
        server = subprocess.Popen(
            [str(python), "-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=root, env=env,
        )
        try:
            deadline = time.monotonic() + 60
            health = None
            while time.monotonic() < deadline and health is None:
                time.sleep(0.5)
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=2) as response:  # noqa: S310
                        health = json.load(response)
                except OSError:
                    if server.poll() is not None:
                        raise SystemExit("o servidor do pacote encerrou antes de responder") from None
            if not health or not health.get("ok"):
                raise SystemExit("o servidor do pacote não respondeu em /api/health")
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=5) as response:  # noqa: S310
                if b"VARISPEED" not in response.read():
                    raise SystemExit("a interface não foi servida")
            log(f"teste do pacote ok: yt-dlp {health.get('yt_dlp')}, {health.get('youtube_po', {}).get('js_runtime') or 'sem Node'}")
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--target", choices=("windows", "linux"), required=True)
    parser.add_argument("--version", default="dev")
    parser.add_argument("--out", default=str(ROOT / "dist"))
    parser.add_argument("--skip-smoke-test", action="store_true")
    args = parser.parse_args()

    expected_os = "nt" if args.target == "windows" else "posix"
    if os.name != expected_os:
        raise SystemExit(f"monte o pacote {args.target} num sistema {args.target}")

    with tempfile.TemporaryDirectory(prefix="varispeed-build-") as tmp:
        work = Path(tmp)
        bundle = work / "VARISPEED"
        bundle.mkdir()
        copy_app(args.target, bundle)
        python = install_python(work, bundle, args.target)
        install_dependencies(python)
        install_node(work, bundle, args.target)
        write_notes(bundle, args.target, args.version, python)
        archive = make_archive(bundle, Path(args.out), args.target, args.version)

    if not args.skip_smoke_test:
        smoke_test(archive, args.target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
