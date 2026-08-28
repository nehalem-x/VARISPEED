"""Compatibilidade local de PO Token e desafios JavaScript do YouTube.

O VARISPEED usa o plugin ``yt-dlp-getpot-wpc`` somente quando uma extração
autenticada é necessária. O plugin abre um Chromium isolado e minimizado para
executar o WebPoClient do próprio YouTube; cookies continuam sendo entregues
diretamente ao yt-dlp e nunca são copiados para esse navegador auxiliar.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from functools import lru_cache
from importlib import metadata
from pathlib import Path
from typing import Any


MIN_NODE_MAJOR = 22
PROVIDER_DISTRIBUTION = "yt-dlp-getpot-wpc"


def _first_executable(candidates: list[str | None]) -> Path | None:
    for raw in candidates:
        if not raw:
            continue
        path = Path(raw).expanduser()
        if path.is_file():
            return path.resolve()
    return None


@lru_cache(maxsize=1)
def find_chromium_executable() -> tuple[Path | None, str]:
    override = os.getenv("VARISPEED_CHROMIUM_PATH", "").strip()
    local = Path(os.getenv("LOCALAPPDATA", ""))
    program_files = Path(os.getenv("PROGRAMFILES", ""))
    program_files_x86 = Path(os.getenv("PROGRAMFILES(X86)", ""))
    groups = (
        ("Chromium configurado", [override]),
        ("Google Chrome", [
            shutil.which("chrome"),
            str(program_files / "Google/Chrome/Application/chrome.exe"),
            str(program_files_x86 / "Google/Chrome/Application/chrome.exe"),
            str(local / "Google/Chrome/Application/chrome.exe"),
        ]),
        ("Microsoft Edge", [
            shutil.which("msedge"),
            str(program_files_x86 / "Microsoft/Edge/Application/msedge.exe"),
            str(program_files / "Microsoft/Edge/Application/msedge.exe"),
            str(local / "Microsoft/Edge/Application/msedge.exe"),
        ]),
        ("Brave", [
            shutil.which("brave"),
            str(program_files / "BraveSoftware/Brave-Browser/Application/brave.exe"),
            str(program_files_x86 / "BraveSoftware/Brave-Browser/Application/brave.exe"),
            str(local / "BraveSoftware/Brave-Browser/Application/brave.exe"),
        ]),
        ("Vivaldi", [
            shutil.which("vivaldi"),
            str(program_files / "Vivaldi/Application/vivaldi.exe"),
            str(local / "Vivaldi/Application/vivaldi.exe"),
        ]),
    )
    for label, candidates in groups:
        if path := _first_executable(candidates):
            return path, label
    return None, ""


@lru_cache(maxsize=1)
def find_node_runtime() -> tuple[Path | None, str]:
    override = os.getenv("VARISPEED_NODE_PATH", "").strip()
    program_files = Path(os.getenv("PROGRAMFILES", ""))
    path = _first_executable([
        override,
        shutil.which("node"),
        str(program_files / "nodejs/node.exe"),
    ])
    if not path:
        return None, ""
    try:
        flags: dict[str, Any] = {}
        if os.name == "nt":
            flags["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        result = subprocess.run(
            [str(path), "--version"],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
            **flags,
        )
        match = re.search(r"v?(\d+)", result.stdout or "")
        major = int(match.group(1)) if match else 0
    except (OSError, subprocess.SubprocessError, ValueError):
        return None, ""
    if major < MIN_NODE_MAJOR:
        return None, ""
    return path, f"Node {major}"


@lru_cache(maxsize=1)
def provider_version() -> str:
    try:
        return metadata.version(PROVIDER_DISTRIBUTION)
    except metadata.PackageNotFoundError:
        return ""


def status() -> dict[str, Any]:
    browser, browser_label = find_chromium_executable()
    node, node_label = find_node_runtime()
    version = provider_version()
    ready = bool(version and browser and node)
    if not version:
        message = "O componente local de PO Token não está instalado."
    elif not browser:
        message = "Chrome, Edge, Brave ou Vivaldi não foi encontrado para gerar o PO Token."
    elif not node:
        message = f"Node.js {MIN_NODE_MAJOR} ou superior não foi encontrado para resolver os desafios do YouTube."
    else:
        message = "Compatibilidade de reprodução do YouTube pronta."
    return {
        "ready": ready,
        "provider": "wpc" if version else "",
        "provider_version": version,
        "browser": browser_label,
        "js_runtime": node_label,
        "message": message,
    }


def authenticated_youtube_options() -> dict[str, Any]:
    """Opções privadas aplicadas apenas ao retry autenticado do YouTube."""

    current = status()
    if not current["ready"]:
        return {}
    browser, _ = find_chromium_executable()
    node, _ = find_node_runtime()
    assert browser is not None and node is not None
    return {
        "extractor_args": {
            # mweb solicita ao provider o token GVS ligado ao vídeo. O cliente
            # padrão continua intocado em toda extração pública/não autenticada.
            "youtube": {"player_client": ["mweb"]},
            "youtubepot-wpc": {"browser_path": [str(browser)]},
        },
        "js_runtimes": {"node": {"path": str(node)}},
    }
