"""Preferência de acesso pela rede local.

Por padrão o servidor só aceita conexões deste computador (127.0.0.1). Com a
opção "Permitir acesso de outros aparelhos da rede" ligada nas Configurações,
ele passa a escutar em 0.0.0.0 e outros aparelhos do mesmo Wi-Fi abrem o app
pelo IPv4 privado do computador.

A preferência fica fora do repositório, junto das preferências do yt-dlp.
O launcher importa este módulo, então ele não pode depender de bibliotecas
externas.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from server.ytdlp_update import storage_root

LOCAL_HOST = "127.0.0.1"
LAN_HOST = "0.0.0.0"  # noqa: S104 - só quando o usuário liga o acesso pela rede


def prefs_file() -> Path:
    return storage_root() / "network.json"


def lan_enabled() -> bool:
    try:
        saved = json.loads(prefs_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return isinstance(saved, dict) and saved.get("lan") is True


def set_lan(enabled: bool) -> None:
    path = prefs_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"lan": bool(enabled)}), encoding="utf-8")
    os.replace(tmp, path)


def bind_host() -> str:
    return LAN_HOST if lan_enabled() else LOCAL_HOST


def listens_on_lan(host: str) -> bool:
    return host in {LAN_HOST, "::", ""}
