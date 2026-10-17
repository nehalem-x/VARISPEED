"""O download pronto leva o app inteiro e nada de desenvolvimento."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

import build_bundle  # noqa: E402


class BundleFilesTests(unittest.TestCase):
    def test_app_files_skip_development_material(self):
        for target in ("windows", "linux"):
            with self.subTest(target=target):
                files = build_bundle.app_files(target)
                self.assertIn("launcher.py", files)
                self.assertIn("index.html", files)
                self.assertIn("server/main.py", files)
                self.assertIn("server/requirements.txt", files)
                self.assertIn("assets/icons/LICENSE.lucide.txt", files)
                for name in files:
                    self.assertFalse(name.startswith(("tests/", "docs/", ".github/", "tools/")), name)
                self.assertNotIn("start-tempo.bat", files)
                self.assertNotIn("pyproject.toml", files)

    def test_each_system_gets_only_its_own_launchers(self):
        windows = build_bundle.app_files("windows")
        linux = build_bundle.app_files("linux")
        self.assertIn("VARISPEED.vbs", windows)
        self.assertNotIn("VARISPEED.sh", windows)
        self.assertIn("VARISPEED.sh", linux)
        self.assertIn("criar-atalho.sh", linux)
        self.assertNotIn("VARISPEED.vbs", linux)
        self.assertNotIn("VARISPEED.desktop", linux)

    def test_every_page_asset_served_by_the_backend_is_shipped(self):
        from server.main import PUBLIC_FILES

        files = set(build_bundle.app_files("windows"))
        missing = sorted(name for name in PUBLIC_FILES if name not in files and not name.startswith("assets/creator-"))
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
