"""VARISPEED — atualização do yt-dlp.

O YouTube muda com frequência e o yt-dlp acompanha com versões novas. Este
módulo consulta a última versão no PyPI, guarda as preferências e roda o pip
dentro do ambiente do VARISPEED.

Usa somente a biblioteca padrão: o launcher importa este arquivo antes de o
ambiente do backend existir.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

PYPI_URL = "https://pypi.org/pypi/yt-dlp/json"
PACKAGE_SPEC = "yt-dlp[default]"
CHANNELS = ("stable", "nightly")
AUTO_CHECK_INTERVAL = 24 * 60 * 60
DEFAULT_PREFS: dict[str, Any] = {"auto": True, "channel": "stable", "checked_at": 0.0, "latest": ""}


def storage_root() -> Path:
    base = os.getenv("LOCALAPPDATA", "").strip()
    if base:
        return Path(base) / "VARISPEED"
    return Path.home() / ".varispeed"


def prefs_file() -> Path:
    return storage_root() / "ytdlp-update.json"


def load_prefs() -> dict[str, Any]:
    prefs = dict(DEFAULT_PREFS)
    try:
        saved = json.loads(prefs_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return prefs
    if isinstance(saved, dict):
        if isinstance(saved.get("auto"), bool):
            prefs["auto"] = saved["auto"]
        if saved.get("channel") in CHANNELS:
            prefs["channel"] = saved["channel"]
        if isinstance(saved.get("checked_at"), (int, float)):
            prefs["checked_at"] = float(saved["checked_at"])
        if isinstance(saved.get("latest"), str):
            prefs["latest"] = saved["latest"][:64]
    return prefs


def save_prefs(**changes: Any) -> dict[str, Any]:
    prefs = load_prefs()
    prefs.update({key: value for key, value in changes.items() if key in DEFAULT_PREFS})
    path = prefs_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(prefs), encoding="utf-8")
    os.replace(tmp, path)
    return prefs


def version_key(version: str) -> tuple[int, ...]:
    """2026.10.10 < 2026.10.10.123456 < 2026.10.11. O sufixo .devN do PyPI é
    ignorado: o yt-dlp nightly se apresenta sem ele. Texto inválido fica no fim."""
    numeric = re.match(r"[\d.]+", (version or "").strip())
    parts = re.findall(r"\d+", numeric.group(0)) if numeric else []
    return tuple(int(part) for part in parts) or (0,)


def same_version(a: str, b: str) -> bool:
    """O yt-dlp se apresenta como 2026.08.19 e o pip registra 2026.8.19."""
    return version_key(a) == version_key(b)


def is_newer(candidate: str, current: str) -> bool:
    return bool(candidate) and version_key(candidate) > version_key(current)


def latest_version(channel: str = "stable", timeout: float = 6.0) -> str:
    """Última versão publicada. Nightly inclui as pré-versões (.devN) do PyPI."""
    request = urllib.request.Request(PYPI_URL, headers={"Accept": "application/json", "User-Agent": "VARISPEED"})
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - URL fixa em https
        data = json.load(response)
    if channel != "nightly":
        return str(data["info"]["version"])
    releases = [
        version
        for version, files in (data.get("releases") or {}).items()
        if files and not all(item.get("yanked") for item in files)
    ]
    return max(releases, key=version_key) if releases else str(data["info"]["version"])


def installed_version(python: Path | str = sys.executable) -> str:
    """Versão instalada no disco, que pode ser mais nova que a carregada na memória."""
    code = "from importlib.metadata import version; print(version('yt-dlp'))"
    try:
        result = subprocess.run(
            [str(python), "-c", code],
            capture_output=True,
            text=True,
            timeout=30,
            **_hidden_window(),
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return result.stdout.strip().splitlines()[-1] if result.returncode == 0 and result.stdout.strip() else ""


def upgrade_command(python: Path | str, channel: str = "stable") -> list[str]:
    command = [str(python), "-m", "pip", "install", "--upgrade", "--disable-pip-version-check"]
    if channel == "nightly":
        command.append("--pre")
    command.append(PACKAGE_SPEC)
    return command


def run_upgrade(python: Path | str = sys.executable, channel: str = "stable", timeout: float = 600) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            upgrade_command(python, channel),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            **_hidden_window(),
        )
    except subprocess.TimeoutExpired:
        return False, "O pip demorou demais e foi interrompido."
    except OSError as exc:
        return False, str(exc)
    output = "\n".join((result.stdout + result.stderr).strip().splitlines()[-30:])
    return result.returncode == 0, output


def auto_check_due(prefs: dict[str, Any], now: float | None = None) -> bool:
    if not prefs.get("auto"):
        return False
    now = time.time() if now is None else now
    return now - float(prefs.get("checked_at") or 0) >= AUTO_CHECK_INTERVAL


def _hidden_window() -> dict[str, Any]:
    if os.name == "nt":
        return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}
    return {}
