"""Contratos de autenticação local e opcional do yt-dlp."""

from __future__ import annotations

import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from server.main import (
    DEDICATED_AUTH,
    _auth_mode_for_url,
    _authentication_error_code,
    _clean_error,
    _common_opts,
    _has_authorized_local_origin,
    _requires_authentication,
    _set_auth_browser,
    start_dedicated_auth,
)


class YtDlpAuthTests(unittest.TestCase):
    def tearDown(self) -> None:
        _set_auth_browser("off")

    def test_detecta_somente_erros_que_pedem_autenticacao(self) -> None:
        self.assertTrue(_requires_authentication("Sign in to confirm your age"))
        self.assertTrue(_requires_authentication("Use --cookies-from-browser for authentication"))
        self.assertFalse(_requires_authentication("HTTP Error 404: Not Found"))

    def test_browser_vira_tupla_oficial_sem_arquivo_temporario(self) -> None:
        with patch.dict(os.environ, {"VARISPEED_COOKIES_FILE": "", "TEMPO_COOKIES_FILE": ""}, clear=False), patch(
            "server.main.authenticated_youtube_options", return_value={"js_runtimes": {"node": {}}},
        ):
            opts = _common_opts("chrome")
        self.assertEqual(opts["cookiesfrombrowser"], ("chrome", None, None, None))
        self.assertIn("js_runtimes", opts)
        self.assertNotIn("cookiefile", opts)

    def test_link_publico_nao_inicia_provider_nem_runtime_auxiliar(self) -> None:
        with patch.dict(os.environ, {"VARISPEED_COOKIES_FILE": "", "TEMPO_COOKIES_FILE": ""}, clear=False):
            opts = _common_opts()
        self.assertNotIn("extractor_args", opts)
        self.assertNotIn("js_runtimes", opts)

    def test_perfil_descoberto_e_entregue_sem_expor_arquivo(self) -> None:
        with patch.dict(os.environ, {"VARISPEED_COOKIES_FILE": "", "TEMPO_COOKIES_FILE": ""}, clear=False):
            opts = _common_opts("edge", r"C:\Browser\Profile 2")
        self.assertEqual(opts["cookiesfrombrowser"], ("edge", r"C:\Browser\Profile 2", None, None))

    def test_auto_so_e_usado_em_links_do_youtube(self) -> None:
        self.assertEqual(_auth_mode_for_url("https://youtube.com/watch?v=x", "auto"), "auto")
        self.assertEqual(_auth_mode_for_url("https://example.com/audio", "auto"), "")

    def test_arquivo_explicito_tem_precedencia_sobre_browser(self) -> None:
        with patch.dict(os.environ, {"VARISPEED_COOKIES_FILE": r"C:\segredo\youtube.txt"}, clear=False):
            opts = _common_opts("edge")
        self.assertEqual(opts["cookiefile"], r"C:\segredo\youtube.txt")
        self.assertNotIn("cookiesfrombrowser", opts)

    def test_sessao_dedicada_usa_apenas_o_arquivo_filtrado_do_varispeed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cookie_file = Path(tmp) / "youtube.cookies.txt"
            cookie_file.write_text("# Netscape HTTP Cookie File\n", encoding="utf-8")
            with patch.object(DEDICATED_AUTH, "cookie_file", cookie_file), patch.dict(
                os.environ, {"VARISPEED_COOKIES_FILE": "", "TEMPO_COOKIES_FILE": ""}, clear=False,
            ):
                opts = _common_opts("dedicated")
        self.assertEqual(opts["cookiefile"].getvalue(), "# Netscape HTTP Cookie File\n")
        self.assertNotIn("cookiesfrombrowser", opts)

    def test_sessao_dedicada_nunca_e_enviada_para_outros_sites(self) -> None:
        self.assertEqual(_auth_mode_for_url("https://www.youtube.com/watch?v=x", "dedicated"), "dedicated")
        self.assertEqual(_auth_mode_for_url("https://youtu.be/x", "dedicated"), "dedicated")
        self.assertEqual(_auth_mode_for_url("https://example.com/audio", "dedicated"), "")
        self.assertEqual(_auth_mode_for_url("https://youtube.com.evil.test/x", "dedicated"), "")

    def test_modo_dedicado_e_aceito_sem_fingir_ser_navegador(self) -> None:
        self.assertEqual(_set_auth_browser("dedicated"), "dedicated")

    def test_navegador_fora_da_lista_e_rejeitado(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            _set_auth_browser("qualquer-coisa")
        self.assertEqual(raised.exception.status_code, 400)

    def test_erro_tecnico_de_idade_vira_orientacao_do_varispeed(self) -> None:
        message = _clean_error(Exception("ERROR: Sign in to confirm your age. Use --cookies-from-browser"))
        self.assertIn("Configurações", message)
        self.assertNotIn("--cookies", message)

    def test_conta_reconhecida_com_provider_pronto_nao_finge_cookie_invalido(self) -> None:
        error = Exception("This video is age-restricted")
        error.varispeed_playback_verification = True
        with patch("server.main.youtube_pot_status", return_value={"ready": True, "message": "Pronto"}):
            message = _clean_error(error)
            code = _authentication_error_code(error)
        self.assertIn("provedor local", message)
        self.assertNotIn("escolha o navegador", message)
        self.assertEqual(code, "youtube_po_token_failed")

    def test_provider_ausente_tem_erro_acionavel(self) -> None:
        error = Exception("This video is age-restricted")
        error.varispeed_playback_verification = True
        with patch(
            "server.main.youtube_pot_status",
            return_value={"ready": False, "message": "Node.js 22 não foi encontrado."},
        ):
            message = _clean_error(error)
            code = _authentication_error_code(error)
        self.assertIn("Node.js 22", message)
        self.assertEqual(code, "youtube_po_token_unavailable")

    def test_banco_de_cookies_bloqueado_orienta_usar_outro_navegador(self) -> None:
        message = _clean_error(Exception("ERROR: Could not copy Chrome cookie database."))
        self.assertIn("está aberto", message)
        self.assertIn("outro navegador", message)
        self.assertNotIn("cookie database", message)

    def test_origem_local_precisa_corresponder_exatamente(self) -> None:
        def request(origin: str) -> Request:
            return Request({
                "type": "http",
                "headers": [(b"origin", origin.encode("ascii"))],
                "client": ("127.0.0.1", 50000),
            })

        with patch("server.main.APP_PORT", 8765):
            self.assertTrue(_has_authorized_local_origin(request("http://127.0.0.1:8765")))
            self.assertTrue(_has_authorized_local_origin(request("http://localhost:8765")))
            self.assertFalse(_has_authorized_local_origin(request("http://127.0.0.1:8765.evil.test")))
            self.assertFalse(_has_authorized_local_origin(request("https://localhost:8765")))

    def test_inicio_dedicado_so_retorna_estado_sem_segredos(self) -> None:
        state = {"available": True, "connected": False, "login_open": True}
        with patch.object(DEDICATED_AUTH, "start", return_value=state):
            request = Request({
                "type": "http", "method": "POST", "path": "/api/auth/dedicated/start",
                "headers": [(b"origin", b"http://127.0.0.1:8765")],
                "client": ("127.0.0.1", 50100),
            })
            response = asyncio.run(start_dedicated_auth(request))
        self.assertEqual(response["dedicated"], state)
        self.assertNotIn("cookie", str(response).lower())

    def test_inicio_dedicado_e_negado_para_cliente_da_lan(self) -> None:
        request = Request({
            "type": "http", "method": "POST", "path": "/api/auth/dedicated/start",
            "headers": [(b"origin", b"http://192.168.1.10:8765")],
            "client": ("192.168.1.20", 50100),
        })
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(start_dedicated_auth(request))
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
