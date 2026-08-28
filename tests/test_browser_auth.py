"""Contratos da descoberta automatica de sessao do navegador."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from server.browser_auth import BrowserAuthError, BrowserSessionResolver, discover_browser_profiles


class BrowserAuthTests(unittest.TestCase):
    def test_descobre_perfis_chromium_com_banco_de_cookies(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            edge = Path(tmp) / "Edge/User Data"
            profile = edge / "Profile 2/Network"
            profile.mkdir(parents=True)
            (profile / "Cookies").touch()
            (edge / "Local State").write_text(json.dumps({
                "profile": {
                    "last_used": "Profile 2",
                    "info_cache": {"Profile 2": {"name": "Musica"}},
                },
            }), encoding="utf-8")
            found = discover_browser_profiles({"edge": edge})
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0].browser, "edge")
        self.assertEqual(found[0].label, "Musica")

    def test_resolver_so_ativa_perfil_que_abre_o_alvo(self) -> None:
        resolver = BrowserSessionResolver()
        with tempfile.TemporaryDirectory() as tmp:
            edge = Path(tmp) / "Edge/User Data"
            for key in ("Default", "Profile 1"):
                database = edge / key / "Network/Cookies"
                database.parent.mkdir(parents=True)
                database.touch()
            (edge / "Local State").write_text(json.dumps({
                "profile": {"info_cache": {
                    "Default": {"name": "Pessoal"},
                    "Profile 1": {"name": "YouTube"},
                }},
            }), encoding="utf-8")
            import server.browser_auth as module
            original = module._windows_browser_roots
            module._windows_browser_roots = lambda: {"edge": edge}
            try:
                def tester(url: str, browser: str, profile: str) -> dict[str, str]:
                    if profile.endswith("Default"):
                        raise RuntimeError("sem sessao")
                    return {"id": "ok"}

                candidate, info = resolver.resolve("https://youtube.com/watch?v=x", tester)
            finally:
                module._windows_browser_roots = original
        self.assertEqual(candidate.label, "YouTube")
        self.assertEqual(info["id"], "ok")
        self.assertNotIn(str(candidate.profile), str(candidate.public()))

    def test_banco_bloqueado_vira_erro_pratico(self) -> None:
        resolver = BrowserSessionResolver()
        with tempfile.TemporaryDirectory() as tmp:
            edge = Path(tmp) / "Edge/User Data"
            database = edge / "Default/Network/Cookies"
            database.parent.mkdir(parents=True)
            database.touch()
            import server.browser_auth as module
            original = module._windows_browser_roots
            module._windows_browser_roots = lambda: {"edge": edge}
            try:
                with self.assertRaises(BrowserAuthError) as raised:
                    resolver.resolve(
                        "https://youtube.com/watch?v=x",
                        lambda *_: (_ for _ in ()).throw(RuntimeError("Could not copy Chrome cookie database")),
                    )
            finally:
                module._windows_browser_roots = original
        self.assertEqual(raised.exception.code, "browser_locked")
        self.assertIn("Sessão dedicada", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
