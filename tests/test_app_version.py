"""Impressão digital da versão em disco e decisão do launcher de reiniciar."""

import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import launcher
from server import app_version


class AppVersionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "server").mkdir()
        (self.root / "app.js").write_text("// v1", encoding="utf-8")
        (self.root / "server" / "main.py").write_text("# v1", encoding="utf-8")
        (self.root / "notas.md").write_text("fora da conta", encoding="utf-8")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_same_files_same_fingerprint(self) -> None:
        self.assertEqual(app_version.fingerprint(self.root), app_version.fingerprint(self.root))

    def test_changed_or_new_file_changes_fingerprint(self) -> None:
        before = app_version.fingerprint(self.root)
        (self.root / "modal.js").write_text("// novo", encoding="utf-8")
        added = app_version.fingerprint(self.root)
        self.assertNotEqual(before, added)
        later = time.time() + 5
        os.utime(self.root / "server" / "main.py", (later, later))
        self.assertNotEqual(added, app_version.fingerprint(self.root))

    def test_files_outside_the_app_do_not_count(self) -> None:
        before = app_version.fingerprint(self.root)
        (self.root / "notas.md").write_text("mudou", encoding="utf-8")
        self.assertEqual(before, app_version.fingerprint(self.root))


class LauncherReuseTests(unittest.TestCase):
    def test_server_without_build_is_stale(self) -> None:
        # Servidores anteriores a esta mudança não informam "build".
        self.assertFalse(launcher._is_current({"ok": True}))

    def test_server_with_same_build_is_reused(self) -> None:
        with mock.patch.object(app_version, "fingerprint", return_value="abc"):
            self.assertTrue(launcher._is_current({"ok": True, "build": "abc"}))
            self.assertFalse(launcher._is_current({"ok": True, "build": "velho"}))


if __name__ == "__main__":
    unittest.main()
