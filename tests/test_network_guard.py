"""Trava de rede do yt-dlp e recusa antes do download."""

import os
import socket
import threading
import unittest
from unittest import mock

from server import main


def _fake_infos(*ips: str) -> list[tuple]:
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 443)) for ip in ips]


class NetworkGuardTests(unittest.TestCase):
    def test_guard_blocks_private_addresses_only_inside_guarded_threads(self) -> None:
        with mock.patch.object(main, "_ORIGINAL_GETADDRINFO", return_value=_fake_infos("192.168.0.1")):
            # Fora da trava (rotas de login, devtools locais), nada muda.
            self.assertEqual(socket.getaddrinfo("roteador.exemplo", 80)[0][4][0], "192.168.0.1")
            with main._network_guard():
                with self.assertRaises(socket.gaierror):
                    socket.getaddrinfo("roteador.exemplo", 80)

    def test_guard_keeps_public_and_loopback_and_drops_private_mix(self) -> None:
        infos = _fake_infos("10.0.0.5", "93.184.216.34", "127.0.0.1")
        with mock.patch.object(main, "_ORIGINAL_GETADDRINFO", return_value=infos):
            with main._network_guard():
                kept = [info[4][0] for info in socket.getaddrinfo("misto.exemplo", 443)]
        self.assertEqual(kept, ["93.184.216.34", "127.0.0.1"])

    def test_guard_is_per_thread(self) -> None:
        seen: list[str] = []
        with mock.patch.object(main, "_ORIGINAL_GETADDRINFO", return_value=_fake_infos("192.168.0.1")):
            with main._network_guard():
                worker = threading.Thread(target=lambda: seen.append(socket.getaddrinfo("x", 80)[0][4][0]))
                worker.start()
                worker.join()
        self.assertEqual(seen, ["192.168.0.1"])


class DownloadRefusalTests(unittest.TestCase):
    def test_live_is_refused_before_download(self) -> None:
        self.assertIn("ao vivo", main._download_refusal({"is_live": True}))
        self.assertIn("ao vivo", main._download_refusal({"live_status": "is_upcoming"}))

    def test_duration_limit_applies_to_download(self) -> None:
        with mock.patch.dict(os.environ, {"VARISPEED_MAX_DURATION_SECONDS": "60"}):
            self.assertIn("60 segundos", main._download_refusal({"duration": 61}))
            self.assertEqual(main._download_refusal({"duration": 59}), "")

    def test_filesize_limit(self) -> None:
        with mock.patch.object(main, "MAX_FILESIZE_MB", 10):
            self.assertIn("10 MB", main._download_refusal({"filesize_approx": 11 * 1024 * 1024}))
            self.assertEqual(main._download_refusal({"filesize": 5 * 1024 * 1024}), "")

    def test_regular_media_passes(self) -> None:
        self.assertEqual(main._download_refusal({"duration": 200, "filesize": 4_000_000}), "")


if __name__ == "__main__":
    unittest.main()
