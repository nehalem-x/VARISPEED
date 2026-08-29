"""Descoberta local de sessoes de navegador para importacao do YouTube.

Somente nomes publicos de navegador/perfil saem deste modulo. Caminhos e
cookies permanecem no backend local e sao entregues diretamente ao yt-dlp.
"""

from __future__ import annotations

import json
import os
import threading
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

BROWSER_LABELS = {
    "chrome": "Google Chrome",
    "edge": "Microsoft Edge",
    "firefox": "Mozilla Firefox",
    "brave": "Brave",
    "vivaldi": "Vivaldi",
}


@dataclass(frozen=True)
class BrowserProfile:
    browser: str
    profile: Path
    label: str

    def public(self) -> dict[str, str]:
        return {"browser": self.browser, "browser_label": BROWSER_LABELS[self.browser], "profile_label": self.label}


class BrowserAuthError(RuntimeError):
    def __init__(self, code: str, message: str, *, detected: tuple[str, ...] = ()) -> None:
        super().__init__(message)
        self.code = code
        self.detected = detected


def _windows_browser_roots() -> dict[str, Path]:
    local = Path(os.getenv("LOCALAPPDATA", ""))
    roaming = Path(os.getenv("APPDATA", ""))
    return {
        "chrome": local / "Google/Chrome/User Data",
        "edge": local / "Microsoft/Edge/User Data",
        "brave": local / "BraveSoftware/Brave-Browser/User Data",
        "vivaldi": local / "Vivaldi/User Data",
        "firefox": roaming / "Mozilla/Firefox/Profiles",
    }


def _cookie_database_exists(profile: Path) -> bool:
    return (profile / "Network/Cookies").is_file() or (profile / "Cookies").is_file()


def _chromium_profiles(root: Path) -> list[tuple[Path, str]]:
    info_cache: dict[str, Any] = {}
    last_used = ""
    try:
        state = json.loads((root / "Local State").read_text(encoding="utf-8"))
        profile_state = state.get("profile") or {}
        info_cache = profile_state.get("info_cache") or {}
        last_used = str(profile_state.get("last_used") or "")
    except (OSError, ValueError, TypeError):
        pass

    keys = list(info_cache)
    for child in root.iterdir() if root.is_dir() else ():
        if child.is_dir() and (child.name == "Default" or child.name.startswith("Profile ")) and child.name not in keys:
            keys.append(child.name)
    if last_used in keys:
        keys.remove(last_used)
        keys.insert(0, last_used)

    found: list[tuple[Path, str]] = []
    for key in keys:
        profile = (root / key).resolve()
        if not _cookie_database_exists(profile):
            continue
        metadata = info_cache.get(key) if isinstance(info_cache.get(key), dict) else {}
        label = str(metadata.get("name") or ("Padrão" if key == "Default" else key))
        found.append((profile, label))
    return found


def discover_browser_profiles(roots: dict[str, Path] | None = None) -> list[BrowserProfile]:
    roots = roots or _windows_browser_roots()
    found: list[BrowserProfile] = []
    for browser in ("firefox", "chrome", "edge", "brave", "vivaldi"):
        root = roots.get(browser)
        if not root or not root.is_dir():
            continue
        if browser == "firefox":
            profiles = [
                (path.resolve(), path.name)
                for path in root.iterdir()
                if path.is_dir() and (path / "cookies.sqlite").is_file()
            ]
        else:
            profiles = _chromium_profiles(root)
        found.extend(BrowserProfile(browser, path, label) for path, label in profiles)
    return found


class BrowserSessionResolver:
    """Seleciona uma sessao que realmente abre o alvo, sem exportar cookies."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._active: BrowserProfile | None = None

    def clear(self) -> None:
        with self._lock:
            self._active = None

    def active(self) -> BrowserProfile | None:
        with self._lock:
            return self._active

    def status(self) -> dict[str, Any]:
        candidates = discover_browser_profiles()
        detected = []
        for candidate in candidates:
            if candidate.browser not in detected:
                detected.append(candidate.browser)
        active = self.active()
        return {
            "available": detected,
            "active": active.public() if active else None,
        }

    def resolve(
        self,
        url: str,
        tester: Callable[[str, str, str], dict[str, Any]],
    ) -> tuple[BrowserProfile, dict[str, Any]]:
        candidates = discover_browser_profiles()
        detected = tuple(dict.fromkeys(candidate.browser for candidate in candidates))
        if not candidates:
            raise BrowserAuthError(
                "browser_not_found",
                "Nenhum navegador compatível com uma sessão local foi encontrado.",
            )

        locked: list[BrowserProfile] = []
        playback_blocked: list[BrowserProfile] = []
        invalid: list[BrowserProfile] = []
        for candidate in candidates:
            try:
                info = tester(url, candidate.browser, str(candidate.profile))
            except Exception as exc:
                text = str(exc)
                if getattr(exc, "varispeed_playback_verification", False):
                    playback_blocked.append(candidate)
                elif "could not copy" in text.lower() and "cookie database" in text.lower():
                    locked.append(candidate)
                else:
                    invalid.append(candidate)
                continue
            with self._lock:
                self._active = candidate
            return candidate, info

        if playback_blocked:
            names = ", ".join(dict.fromkeys(BROWSER_LABELS[item.browser] for item in playback_blocked))
            raise BrowserAuthError(
                "youtube_playback_verification_required",
                f"A sessão do {names} foi reconhecida, mas o YouTube recusou a reprodução deste vídeo "
                "fora do site. Isso pode ocorrer mesmo com a idade já verificada; este conteúdo exige "
                "verificação de reprodução (PO Token).",
                detected=detected,
            )
        if locked:
            names = ", ".join(dict.fromkeys(BROWSER_LABELS[item.browser] for item in locked))
            raise BrowserAuthError(
                "browser_locked",
                f"O {names} foi encontrado, mas está em uso e bloqueia o banco de cookies. "
                "Como o VARISPEED está aberto nele, use a Sessão dedicada; ela não depende do navegador principal.",
                detected=detected,
            )
        raise BrowserAuthError(
            "youtube_session_not_found",
            "Os navegadores instalados foram verificados, mas nenhum perfil conseguiu abrir este conteúdo com uma sessão válida do YouTube.",
            detected=detected,
        )
