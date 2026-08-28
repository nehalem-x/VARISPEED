"""Contratos de segurança da sessão dedicada do YouTube."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from yt_dlp.cookies import YoutubeDLCookieJar

from server.dedicated_auth import DedicatedYouTubeSession, EphemeralCookieBuffer, _safe_cookie_text


class DedicatedAuthTests(unittest.TestCase):
    def test_exporta_somente_dominio_youtube_e_detecta_autenticacao(self) -> None:
        content, authenticated = _safe_cookie_text([
            {
                "domain": ".youtube.com", "path": "/", "secure": True,
                "httpOnly": True, "expires": 2_000_000_000,
                "name": "SAPISID", "value": "segredo-youtube",
            },
            {
                "domain": ".google.com", "path": "/", "secure": True,
                "name": "SID", "value": "nao-exportar",
            },
        ])
        self.assertTrue(authenticated)
        self.assertIn("#HttpOnly_.youtube.com", content)
        self.assertIn("SAPISID\tsegredo-youtube", content)
        self.assertNotIn("google.com", content)
        self.assertNotIn("nao-exportar", content)

    def test_descarta_campos_que_quebrariam_o_formato_netscape(self) -> None:
        content, authenticated = _safe_cookie_text([
            {"domain": ".youtube.com", "path": "/", "name": "SAPISID", "value": "valor\ninjetado"},
        ])
        self.assertFalse(authenticated)
        self.assertNotIn("injetado", content)

    def test_perfil_temporario_so_pode_ser_removido_dentro_da_raiz(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "auth"
            outside = Path(tmp) / "login-fora"
            session = DedicatedYouTubeSession(root)
            outside.mkdir()
            with self.assertRaises(RuntimeError):
                session._safe_remove_profile(outside)
            self.assertTrue(outside.exists())

    def test_disconnect_remove_cookie_mas_nao_expoe_caminho_no_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            session = DedicatedYouTubeSession(Path(tmp) / "auth")
            session._ensure_root()
            session.cookie_file.write_text(
                "# Netscape HTTP Cookie File\n"
                ".youtube.com\tTRUE\t/\tTRUE\t2000000000\tSAPISID\tsegredo\n",
                encoding="utf-8",
            )
            self.assertTrue(session.status()["connected"])
            self.assertEqual(session.status()["validation"], "unverified")
            session.mark_validation("playback_verification_required")
            self.assertEqual(session.status()["validation"], "playback_verification_required")
            state = session.disconnect()
            self.assertFalse(state["connected"])
            self.assertFalse(session.cookie_file.exists())
            self.assertFalse(session.validation_file.exists())
            self.assertNotIn("cookie_file", state)

    def test_buffer_impede_yt_dlp_de_reescrever_arquivo_persistente(self) -> None:
        original = (
            "# Netscape HTTP Cookie File\n"
            ".youtube.com\tTRUE\t/\tTRUE\t2000000000\tSAPISID\tsegredo\n"
        )
        buffer = EphemeralCookieBuffer(original)
        jar = YoutubeDLCookieJar(buffer)
        jar.load()
        jar.save()
        self.assertFalse(buffer.getvalue().startswith("\x00"))
        self.assertIn("SAPISID", buffer.getvalue())


if __name__ == "__main__":
    unittest.main()
