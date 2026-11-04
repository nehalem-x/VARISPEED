"""Acesso pela rede local: desligado por padrão, ligado só pela preferência."""

import asyncio
import os
import tempfile
import unittest
from unittest import mock

from fastapi import HTTPException
from starlette.requests import Request

from server import main, network_prefs


def _request(client_host: str, origin: str = "") -> Request:
    headers = [(b"origin", origin.encode())] if origin else []
    return Request({"type": "http", "method": "POST", "path": "/", "headers": headers, "client": (client_host, 50000)})


class NetworkPrefsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.env = mock.patch.dict(os.environ, {"LOCALAPPDATA": self.tmp.name})
        self.env.start()

    def tearDown(self) -> None:
        self.env.stop()
        self.tmp.cleanup()

    def test_default_is_this_computer_only(self) -> None:
        self.assertFalse(network_prefs.lan_enabled())
        self.assertEqual(network_prefs.bind_host(), "127.0.0.1")

    def test_turning_lan_on_and_off(self) -> None:
        network_prefs.set_lan(True)
        self.assertEqual(network_prefs.bind_host(), "0.0.0.0")
        network_prefs.set_lan(False)
        self.assertEqual(network_prefs.bind_host(), "127.0.0.1")

    def test_broken_file_falls_back_to_local(self) -> None:
        path = network_prefs.prefs_file()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("{não é json", encoding="utf-8")
        self.assertEqual(network_prefs.bind_host(), "127.0.0.1")

    def test_server_default_bind_is_local(self) -> None:
        self.assertEqual(main.APP_BIND_HOST, os.getenv("VARISPEED_BIND_HOST") or "127.0.0.1")

    def test_other_devices_cannot_change_it(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            asyncio.run(main.system_network(main.NetworkRequest(lan=True), _request("192.168.0.20")))
        self.assertEqual(caught.exception.status_code, 403)
        self.assertFalse(network_prefs.lan_enabled())

    def test_other_sites_cannot_change_it(self) -> None:
        with self.assertRaises(HTTPException):
            asyncio.run(main.system_network(main.NetworkRequest(lan=True), _request("127.0.0.1", "https://site.exemplo")))
        self.assertFalse(network_prefs.lan_enabled())

    def test_change_from_this_computer_saves_and_restarts_when_managed(self) -> None:
        with mock.patch.object(main, "MANAGED", True), \
                mock.patch.object(main, "APP_BIND_HOST", "127.0.0.1"), \
                mock.patch.object(main, "_schedule_restart") as restart:
            body = asyncio.run(main.system_network(main.NetworkRequest(lan=True), _request("127.0.0.1")))
        self.assertTrue(network_prefs.lan_enabled())
        self.assertTrue(body["restarting"])
        restart.assert_called_once()

    def test_relaunch_tells_the_new_server_its_address(self) -> None:
        from server import relaunch

        with mock.patch.object(relaunch, "_port_free", return_value=True), \
                mock.patch.object(relaunch.subprocess, "Popen") as popen, \
                mock.patch.dict(os.environ, {"VARISPEED_BIND_HOST": "127.0.0.1"}):
            relaunch.main(["--host", "0.0.0.0", "--port", "8799"])
        env = popen.call_args.kwargs["env"]
        self.assertEqual(env["VARISPEED_BIND_HOST"], "0.0.0.0")

    def test_missing_optional_asset_is_404_not_500(self) -> None:
        with mock.patch.object(main, "ROOT", main.ROOT / "pasta-que-nao-existe"):
            with self.assertRaises(HTTPException) as caught:
                asyncio.run(main.public_asset("assets/creator-light.png"))
        self.assertEqual(caught.exception.status_code, 404)

    def test_system_info_hides_lan_urls_when_local_only(self) -> None:
        with mock.patch.object(main, "APP_BIND_HOST", "127.0.0.1"):
            info = asyncio.run(main.system_info(_request("127.0.0.1")))
        self.assertFalse(info["lan"])
        self.assertEqual(info["lan_urls"], [])


if __name__ == "__main__":
    unittest.main()
