"""Login de um botão: navegador, conclusão automática, sessão expirada e cookies manuais."""

from __future__ import annotations

import os
import stat
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import yt_dlp
from starlette.requests import Request

from server import dedicated_auth, main
from server.dedicated_auth import DedicatedAuthError, DedicatedYouTubeSession

COOKIES = (
    "# Netscape HTTP Cookie File\n"
    ".youtube.com\tTRUE\t/\tTRUE\t2000000000\tSAPISID\tsegredo\n"
)


def request_from(host: str) -> Request:
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [], "client": (host, 50000)})


class BrowserDiscoveryTests(unittest.TestCase):
    def test_prefers_edge_then_chrome_and_reports_the_name(self):
        def which(command):
            return {"google-chrome": "/usr/bin/google-chrome", "brave": "/usr/bin/brave"}.get(command)

        with (
            mock.patch.dict(os.environ, {"VARISPEED_LOGIN_BROWSER": ""}),
            mock.patch.object(dedicated_auth.shutil, "which", side_effect=which),
            mock.patch.object(dedicated_auth.Path, "is_file", return_value=True),
            mock.patch.object(dedicated_auth.Path, "resolve", lambda self: self),
        ):
            path, label = dedicated_auth.find_login_browser()
        self.assertEqual(label, "Chrome")
        self.assertEqual(str(path), "/usr/bin/google-chrome")

    def test_without_any_browser_login_is_unavailable(self):
        with tempfile.TemporaryDirectory() as tmp:
            session = DedicatedYouTubeSession(Path(tmp) / "auth")
            with mock.patch.object(dedicated_auth, "find_login_browser", return_value=None):
                self.assertFalse(session.status()["available"])
                with self.assertRaises(DedicatedAuthError) as ctx:
                    session.start()
        self.assertIn("Chrome", str(ctx.exception))


class AutoFinishTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.session = DedicatedYouTubeSession(Path(self.tmp.name) / "auth")
        self.process = mock.Mock()
        self.process.poll.return_value = None
        self.session._process = self.process
        self.patches = [
            mock.patch.object(dedicated_auth, "LOGIN_POLL_SECONDS", 0.01),
            mock.patch.object(dedicated_auth, "LOGIN_SETTLE_SECONDS", 0.03),
        ]
        for patch in self.patches:
            patch.start()

    def tearDown(self):
        for patch in self.patches:
            patch.stop()
        self.tmp.cleanup()

    def test_finishes_by_itself_once_the_account_stays_logged_in(self):
        answers = iter([False, False, True, True, True, True, True, True, True])
        with (
            mock.patch.object(self.session, "_logged_in", side_effect=lambda port: next(answers, True)),
            mock.patch.object(self.session, "finish") as finish,
        ):
            self.session._watch_login(self.process, 9222)
        finish.assert_called_once()

    def test_window_closed_by_the_user_stops_the_watcher(self):
        self.process.poll.return_value = 0
        with mock.patch.object(self.session, "finish") as finish:
            self.session._watch_login(self.process, 9222)
        finish.assert_not_called()

    def test_failed_finish_is_reported_in_the_status(self):
        with (
            mock.patch.object(self.session, "_logged_in", return_value=True),
            mock.patch.object(self.session, "finish", side_effect=DedicatedAuthError("A sessão não ficou salva.")),
            mock.patch.object(self.session, "abort_login"),
        ):
            self.session._watch_login(self.process, 9222)
        self.assertEqual(self.session._last_error, "A sessão não ficou salva.")

    def test_login_that_never_ends_times_out(self):
        with (
            mock.patch.object(dedicated_auth, "LOGIN_TIMEOUT_SECONDS", 0.05),
            mock.patch.object(self.session, "_logged_in", return_value=False),
            mock.patch.object(self.session, "abort_login") as abort,
        ):
            self.session._watch_login(self.process, 9222)
        abort.assert_called_once()
        self.assertIn("a tempo", self.session._last_error)


class SessionStateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.session = DedicatedYouTubeSession(Path(self.tmp.name) / "auth")
        self.session._ensure_root()

    def tearDown(self):
        self.tmp.cleanup()

    def test_invalid_validation_shows_as_expired(self):
        self.session.cookie_file.write_text(COOKIES, encoding="utf-8")
        self.assertFalse(self.session.status()["expired"])
        self.session.mark_validation("invalid")
        self.assertTrue(self.session.status()["expired"])

    def test_manual_cookies_are_checked_saved_privately_and_removed(self):
        with self.assertRaises(DedicatedAuthError):
            self.session.save_manual_cookies("isto não é um cookies.txt\tcom\tcampos")
        self.assertFalse(self.session.status()["manual_cookies"])

        state = self.session.save_manual_cookies(COOKIES)
        self.assertTrue(state["manual_cookies"])
        if os.name != "nt":
            mode = stat.S_IMODE(self.session.manual_cookie_file.stat().st_mode)
            self.assertEqual(mode, stat.S_IRUSR | stat.S_IWUSR)
        self.assertNotIn(str(self.tmp.name), str(state))

        self.assertFalse(self.session.remove_manual_cookies()["manual_cookies"])

    def test_huge_manual_file_is_rejected(self):
        with self.assertRaises(DedicatedAuthError):
            self.session.save_manual_cookies("#" * (dedicated_auth.MANUAL_COOKIES_MAX_BYTES + 1))


class AuthSourceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.session = DedicatedYouTubeSession(Path(self.tmp.name) / "auth")
        self.patch = mock.patch.object(main, "DEDICATED_AUTH", self.session)
        self.patch.start()
        main._set_auth_browser("off")

    def tearDown(self):
        main._set_auth_browser("off")
        self.patch.stop()
        self.tmp.cleanup()

    def test_connected_account_is_used_without_choosing_a_mode(self):
        self.assertEqual(main._configured_auth_source(request_from("127.0.0.1")), ("", ""))
        self.session._ensure_root()
        self.session.cookie_file.write_text(COOKIES, encoding="utf-8")
        self.assertEqual(main._configured_auth_source(request_from("127.0.0.1")), ("dedicated", ""))
        # Clientes da rede nunca herdam a conta.
        self.assertEqual(main._configured_auth_source(request_from("192.168.1.30")), ("", ""))

    def test_browser_chosen_in_advanced_options_wins(self):
        self.session._ensure_root()
        self.session.cookie_file.write_text(COOKIES, encoding="utf-8")
        main._set_auth_browser("firefox")
        self.assertEqual(main._configured_auth_source(request_from("127.0.0.1"))[0], "firefox")

    def test_manual_cookie_file_is_used_and_protected(self):
        self.session.save_manual_cookies(COOKIES)
        with mock.patch.dict(os.environ, {"VARISPEED_COOKIES_FILE": "", "TEMPO_COOKIES_FILE": ""}):
            opts = main._common_opts()
        self.assertIsInstance(opts["cookiefile"], dedicated_auth.EphemeralCookieBuffer)

    def test_rejected_account_becomes_session_expired(self):
        error = yt_dlp.utils.DownloadError("ERROR: Sign in to confirm your age")
        error.varispeed_account_cookies = False
        exc = main._authentication_error(error, "dedicated")
        self.assertEqual(exc.detail["code"], "youtube_session_expired")
        self.assertEqual(exc.detail["message"], main.SESSION_EXPIRED_MESSAGE)
        self.assertEqual(main._authentication_error(error, "").detail["code"], "authentication_required")

    def test_recognized_account_is_not_called_expired(self):
        error = yt_dlp.utils.DownloadError("ERROR: Sign in to confirm your age")
        error.varispeed_account_cookies = True
        self.assertEqual(main._authentication_error(error, "dedicated").detail["code"], "authentication_required")


if __name__ == "__main__":
    unittest.main(verbosity=2)
