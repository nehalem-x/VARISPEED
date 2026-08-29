"""Contratos de cache e segurança das respostas do backend local."""

from __future__ import annotations

import unittest

from starlette.responses import Response

from server.main import SECURITY_HEADERS, _apply_response_headers


class ResponseHeaderTests(unittest.TestCase):
    def response_for(self, path: str, headers: dict[str, str] | None = None) -> Response:
        return _apply_response_headers(path, Response(headers=headers))

    def test_api_responses_are_never_cached(self):
        response = self.response_for("/api/media/info")
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_interface_assets_are_revalidated(self):
        for path in ["/", "/app.js", "/styles.css", "/assets/favicon.png"]:
            with self.subTest(path=path):
                response = self.response_for(path)
                self.assertEqual(response.headers["cache-control"], "no-cache")

    def test_route_specific_cache_policy_is_preserved(self):
        response = self.response_for("/api/media/audio", {"Cache-Control": "private, no-store"})
        self.assertEqual(response.headers["cache-control"], "private, no-store")

    def test_every_response_receives_security_headers(self):
        response = self.response_for("/")
        for name, value in SECURITY_HEADERS.items():
            with self.subTest(name=name):
                self.assertEqual(response.headers[name], value)
        self.assertIn("blob:", response.headers["content-security-policy"])
        self.assertIn("https://fonts.gstatic.com", response.headers["content-security-policy"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
