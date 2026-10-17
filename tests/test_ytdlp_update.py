"""Contratos da atualização do yt-dlp: versões, preferências e permissões."""

from __future__ import annotations

import asyncio
import io
import json
import os
import tempfile
import unittest
from unittest import mock

from fastapi import HTTPException
from starlette.requests import Request

from server import main, ytdlp_update

PYPI = {
    "info": {"version": "2026.10.10"},
    "releases": {
        "2026.8.19": [{"yanked": False}],
        "2026.10.10": [{"yanked": False}],
        "2026.10.15.232912.dev0": [{"yanked": False}],
        "2026.10.16.101010.dev0": [{"yanked": True}],
        "2026.10.17.000000.dev0": [],
    },
}


def fake_urlopen(*_args, **_kwargs):
    return io.BytesIO(json.dumps(PYPI).encode())


def request_from(host: str, origin: str = "") -> Request:
    headers = [(b"origin", origin.encode())] if origin else []
    return Request({"type": "http", "method": "POST", "path": "/", "headers": headers, "client": (host, 50000)})


LOCAL = "127.0.0.1"
LAN = "192.168.1.30"


class VersionTests(unittest.TestCase):
    def test_versions_compare_numerically(self):
        self.assertTrue(ytdlp_update.is_newer("2026.10.10", "2026.8.19"))
        self.assertTrue(ytdlp_update.is_newer("2026.10.10.123.dev0", "2026.10.10"))
        self.assertTrue(ytdlp_update.same_version("2026.10.10.233141.dev0", "2026.10.10.233141"))
        self.assertFalse(ytdlp_update.is_newer("2026.10.10", "2026.10.10"))
        self.assertFalse(ytdlp_update.is_newer("", "2026.10.10"))
        self.assertTrue(ytdlp_update.same_version("2026.08.19", "2026.8.19"))
        self.assertFalse(ytdlp_update.same_version("2026.08.19", "2026.8.20"))

    def test_stable_channel_uses_the_published_version(self):
        with mock.patch("urllib.request.urlopen", fake_urlopen):
            self.assertEqual(ytdlp_update.latest_version("stable"), "2026.10.10")

    def test_nightly_channel_skips_yanked_and_empty_releases(self):
        with mock.patch("urllib.request.urlopen", fake_urlopen):
            self.assertEqual(ytdlp_update.latest_version("nightly"), "2026.10.15.232912.dev0")

    def test_nightly_upgrade_allows_prereleases(self):
        self.assertIn("--pre", ytdlp_update.upgrade_command("python", "nightly"))
        self.assertNotIn("--pre", ytdlp_update.upgrade_command("python", "stable"))
        self.assertEqual(ytdlp_update.upgrade_command("python")[-1], "yt-dlp[default]")


class PrefsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = mock.patch.dict(os.environ, {"LOCALAPPDATA": self.tmp.name})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def test_defaults_without_file(self):
        prefs = ytdlp_update.load_prefs()
        self.assertTrue(prefs["auto"])
        self.assertEqual(prefs["channel"], "stable")

    def test_saved_prefs_round_trip_and_ignore_unknown_values(self):
        ytdlp_update.save_prefs(auto=False, channel="nightly", other="x")
        prefs = ytdlp_update.load_prefs()
        self.assertFalse(prefs["auto"])
        self.assertEqual(prefs["channel"], "nightly")
        self.assertNotIn("other", prefs)

        ytdlp_update.prefs_file().write_text(json.dumps({"channel": "beta", "auto": "sim"}), encoding="utf-8")
        prefs = ytdlp_update.load_prefs()
        self.assertEqual(prefs["channel"], "stable")
        self.assertTrue(prefs["auto"])

    def test_auto_check_runs_once_a_day_and_respects_the_switch(self):
        now = 1_000_000.0
        self.assertTrue(ytdlp_update.auto_check_due({"auto": True, "checked_at": 0}, now))
        self.assertFalse(ytdlp_update.auto_check_due({"auto": True, "checked_at": now - 3600}, now))
        self.assertTrue(ytdlp_update.auto_check_due({"auto": True, "checked_at": now - 25 * 3600}, now))
        self.assertFalse(ytdlp_update.auto_check_due({"auto": False, "checked_at": 0}, now))


class EndpointTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = mock.patch.dict(os.environ, {"LOCALAPPDATA": self.tmp.name})
        self.env.start()
        ytdlp_update.save_prefs(latest="2026.8.19", checked_at=9e12)

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def call(self, coro):
        return asyncio.run(coro)

    def status_of(self, coro) -> int:
        with self.assertRaises(HTTPException) as ctx:
            self.call(coro)
        return ctx.exception.status_code

    def test_network_clients_can_read_but_not_update(self):
        with mock.patch.object(ytdlp_update, "installed_version", return_value="2026.8.19"):
            state = self.call(main.ytdlp_status(request_from(LAN)))
        self.assertFalse(state["can_update"])
        with mock.patch.object(ytdlp_update, "run_upgrade") as upgrade:
            self.assertEqual(self.status_of(main.ytdlp_update_now(request_from(LAN))), 403)
            prefs = main.YtDlpPrefsRequest(auto=False)
            self.assertEqual(self.status_of(main.ytdlp_prefs(prefs, request_from(LAN))), 403)
            upgrade.assert_not_called()

    def test_foreign_origin_cannot_update(self):
        request = request_from(LOCAL, "https://example.com")
        self.assertEqual(self.status_of(main.ytdlp_update_now(request)), 403)

    def test_unknown_channel_is_rejected(self):
        prefs = main.YtDlpPrefsRequest(channel="beta")
        self.assertEqual(self.status_of(main.ytdlp_prefs(prefs, request_from(LOCAL))), 422)

    def test_update_without_launcher_asks_for_manual_restart(self):
        with (
            mock.patch.object(main, "MANAGED", False),
            mock.patch.object(ytdlp_update, "run_upgrade", return_value=(True, "ok")),
            mock.patch.object(ytdlp_update, "installed_version", return_value="2099.1.1"),
            mock.patch.object(main, "_schedule_restart") as restart,
        ):
            result = self.call(main.ytdlp_update_now(request_from(LOCAL)))
        self.assertTrue(result["changed"])
        self.assertFalse(result["restarting"])
        self.assertTrue(result["restart_required"])
        restart.assert_not_called()

    def test_update_from_launcher_restarts_the_server(self):
        with (
            mock.patch.object(main, "MANAGED", True),
            mock.patch.object(ytdlp_update, "run_upgrade", return_value=(True, "ok")),
            mock.patch.object(ytdlp_update, "installed_version", return_value="2099.1.1"),
            mock.patch.object(main, "_schedule_restart") as restart,
        ):
            result = self.call(main.ytdlp_update_now(request_from(LOCAL)))
        self.assertTrue(result["restarting"])
        restart.assert_called_once()

    def test_same_version_does_not_restart(self):
        current = main.yt_dlp.version.__version__
        with (
            mock.patch.object(main, "MANAGED", True),
            mock.patch.object(ytdlp_update, "run_upgrade", return_value=(True, "ok")),
            mock.patch.object(ytdlp_update, "installed_version", return_value=current),
            mock.patch.object(main, "_schedule_restart") as restart,
        ):
            result = self.call(main.ytdlp_update_now(request_from(LOCAL)))
        self.assertFalse(result["changed"])
        self.assertFalse(result["restarting"])
        restart.assert_not_called()

    def test_failed_pip_reports_an_error(self):
        with mock.patch.object(ytdlp_update, "run_upgrade", return_value=(False, "ERROR: no network")):
            with self.assertRaises(HTTPException) as ctx:
                self.call(main.ytdlp_update_now(request_from(LOCAL)))
        self.assertEqual(ctx.exception.status_code, 502)
        self.assertIn("no network", ctx.exception.detail)


class LauncherAutoUpdateTests(unittest.TestCase):
    def setUp(self):
        import launcher

        self.launcher = launcher
        self.tmp = tempfile.TemporaryDirectory()
        self.env = mock.patch.dict(os.environ, {"LOCALAPPDATA": self.tmp.name})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def test_updates_once_when_a_newer_version_exists(self):
        with (
            mock.patch.object(ytdlp_update, "latest_version", return_value="2026.10.10"),
            mock.patch.object(ytdlp_update, "run_upgrade", return_value=(True, "ok")) as upgrade,
            mock.patch.object(ytdlp_update, "installed_version", return_value="2026.10.10"),
        ):
            self.assertEqual(self.launcher._auto_update_ytdlp("2026.8.19"), "2026.10.10")
            upgrade.assert_called_once()
            # Na mesma janela de 24 h não consulta de novo.
            self.assertEqual(self.launcher._auto_update_ytdlp("2026.10.10"), "2026.10.10")
            upgrade.assert_called_once()

    def test_offline_or_disabled_keeps_the_installed_version(self):
        with mock.patch.object(ytdlp_update, "latest_version", side_effect=OSError("offline")):
            self.assertEqual(self.launcher._auto_update_ytdlp("2026.8.19"), "2026.8.19")
        ytdlp_update.save_prefs(auto=False)
        with mock.patch.object(ytdlp_update, "latest_version") as latest:
            self.assertEqual(self.launcher._auto_update_ytdlp("2026.8.19"), "2026.8.19")
            latest.assert_not_called()

    def test_failed_upgrade_does_not_block_startup(self):
        with (
            mock.patch.object(ytdlp_update, "latest_version", return_value="2026.10.10"),
            mock.patch.object(ytdlp_update, "run_upgrade", return_value=(False, "erro")),
        ):
            self.assertEqual(self.launcher._auto_update_ytdlp("2026.8.19"), "2026.8.19")


if __name__ == "__main__":
    unittest.main(verbosity=2)
