"""Contratos do provedor local de PO Token do YouTube."""

from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from server.youtube_pot import authenticated_youtube_options, status


class YouTubePoTokenTests(unittest.TestCase):
    def test_status_publico_nao_expoe_caminhos_locais(self) -> None:
        with (
            patch("server.youtube_pot.provider_version", return_value="1.1.2"),
            patch(
                "server.youtube_pot.find_chromium_executable",
                return_value=(Path(r"C:\Program Files\Browser\browser.exe"), "Microsoft Edge"),
            ),
            patch(
                "server.youtube_pot.find_node_runtime",
                return_value=(Path(r"C:\Program Files\nodejs\node.exe"), "Node 24"),
            ),
        ):
            result = status()
        self.assertTrue(result["ready"])
        self.assertEqual(result["browser"], "Microsoft Edge")
        self.assertEqual(result["js_runtime"], "Node 24")
        self.assertNotIn("Program Files", str(result))

    def test_opcoes_ligam_mweb_provider_e_node_explicitos(self) -> None:
        browser = Path(r"C:\Browser\edge.exe")
        node = Path(r"C:\Node\node.exe")
        with (
            patch("server.youtube_pot.status", return_value={"ready": True}),
            patch("server.youtube_pot.find_chromium_executable", return_value=(browser, "Edge")),
            patch("server.youtube_pot.find_node_runtime", return_value=(node, "Node 24")),
        ):
            result = authenticated_youtube_options()
        self.assertEqual(result["extractor_args"]["youtube"]["player_client"], ["mweb"])
        self.assertEqual(result["extractor_args"]["youtubepot-wpc"]["browser_path"], [str(browser)])
        self.assertEqual(result["js_runtimes"], {"node": {"path": str(node)}})

    def test_sem_runtime_nao_forca_cliente_incompleto(self) -> None:
        with patch("server.youtube_pot.status", return_value={"ready": False}):
            self.assertEqual(authenticated_youtube_options(), {})


if __name__ == "__main__":
    unittest.main()
