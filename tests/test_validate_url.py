"""Testes de `_validate_url` — a única barreira SSRF do backend local.

Rodar:  python3 -m unittest discover -s tests -v
        (dentro do .venv do projeto, onde fastapi já existe)

Só a biblioteca padrão: `unittest`, nada de pytest, para não mexer em
`server/requirements.txt`.

`socket.getaddrinfo` é substituído em todos os testes. A validação
depende de DNS, e um teste que consulta a rede de verdade é lento,
frágil e depende de onde está rodando. O resolvedor falso também
permite exercitar o caminho que mais importa: um domínio público que
resolve para um endereço privado.
"""

import ipaddress
import socket
import sys
import types
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# yt_dlp não é necessário para testar a validação de URL e nem sempre
# está instalado. Um módulo vazio basta para o import de server.main.
sys.modules.setdefault("yt_dlp", types.ModuleType("yt_dlp"))

try:
    from fastapi import HTTPException

    from server.main import _validate_url
except ImportError as exc:  # pragma: no cover
    raise unittest.SkipTest(
        f"dependências do backend ausentes ({exc}). "
        "Ative o .venv do projeto antes de rodar estes testes."
    ) from exc


def fake_addrinfo(mapping):
    """Resolvedor falso: dict de host -> lista de IPs (ou uma exceção)."""

    def resolver(host, port, *args, **kwargs):
        entry = mapping.get(host, socket.gaierror("host desconhecido no teste"))
        if isinstance(entry, BaseException):
            raise entry
        infos = []
        for ip_text in entry:
            ip = ipaddress.ip_address(ip_text)
            family = socket.AF_INET6 if ip.version == 6 else socket.AF_INET
            sockaddr = (ip_text, port, 0, 0) if ip.version == 6 else (ip_text, port)
            infos.append((family, socket.SOCK_STREAM, 6, "", sockaddr))
        return infos

    return resolver


PUBLIC = {"exemplo.com": ["93.184.216.34"], "www.youtube.com": ["142.250.219.206"]}


class SchemeTests(unittest.TestCase):
    """Só http e https passam. O resto é recusado antes de qualquer DNS."""

    def test_esquemas_recusados(self):
        for raw in [
            "ftp://exemplo.com/a.mp3",
            "file:///etc/passwd",
            "file://C:/Windows/System32/config/SAM",
            "javascript:alert(1)",
            "data:audio/wav;base64,AAAA",
            "gopher://exemplo.com",
            "mailto:alguem@exemplo.com",
            "exemplo.com/audio.mp3",  # sem esquema
            "//exemplo.com/audio.mp3",
            "",
            "   ",
            "http://",
            "https://",
            "http:///caminho",
        ]:
            with self.subTest(raw=raw), mock.patch(
                "socket.getaddrinfo", fake_addrinfo(PUBLIC)
            ):
                with self.assertRaises(HTTPException) as ctx:
                    _validate_url(raw)
                self.assertEqual(ctx.exception.status_code, 400, raw)

    def test_esquema_maiusculo_e_aceito(self):
        """urlparse normaliza o esquema, então HTTPS:// é válido."""
        with mock.patch("socket.getaddrinfo", fake_addrinfo(PUBLIC)):
            self.assertEqual(
                _validate_url("HTTPS://exemplo.com/a.mp3"),
                "HTTPS://exemplo.com/a.mp3",
            )


class LocalHostnameTests(unittest.TestCase):
    """Nomes locais são recusados por nome, sem depender do resolvedor."""

    def test_nomes_locais(self):
        for host in [
            "localhost",
            "LOCALHOST",
            "localhost.",
            "LocalHost.LocalDomain",
            "localhost.localdomain",
            "nas.local",
            "IMPRESSORA.LOCAL",
            "qualquer.coisa.local.",
        ]:
            with self.subTest(host=host), mock.patch(
                "socket.getaddrinfo", fake_addrinfo({})
            ):
                with self.assertRaises(HTTPException) as ctx:
                    _validate_url(f"http://{host}/audio.mp3")
                self.assertEqual(ctx.exception.status_code, 400, host)


class LiteralIpTests(unittest.TestCase):
    """IP literal na URL: recusado sem consultar DNS."""

    NAO_GLOBAIS = [
        "127.0.0.1",
        "127.1.2.3",
        "0.0.0.0",
        "10.0.0.5",
        "10.255.255.255",
        "172.16.0.1",
        "172.31.255.254",
        "192.168.0.1",
        "192.168.1.254",
        "169.254.169.254",  # metadados de nuvem
        "100.64.0.1",  # CGNAT
        "224.0.0.1",  # multicast
        "255.255.255.255",
        "[::1]",
        "[fc00::1]",
        "[fe80::1]",
        "[::ffff:127.0.0.1]",
    ]

    def test_ips_locais_recusados(self):
        for host in self.NAO_GLOBAIS:
            with self.subTest(host=host), mock.patch(
                "socket.getaddrinfo", fake_addrinfo({})
            ) as _:
                with self.assertRaises(HTTPException) as ctx:
                    _validate_url(f"http://{host}/audio.mp3")
                self.assertEqual(ctx.exception.status_code, 400, host)

    def test_ip_publico_literal_passa(self):
        alvo = "http://8.8.8.8/audio.mp3"
        with mock.patch("socket.getaddrinfo", fake_addrinfo({"8.8.8.8": ["8.8.8.8"]})):
            self.assertEqual(_validate_url(alvo), alvo)

    def test_ip_decimal_ainda_e_barrado_pelo_dns(self):
        """`http://2130706433/` é 127.0.0.1 escrito em decimal.

        `ipaddress` não reconhece esse formato, então a checagem
        literal deixa passar; é a resolução seguinte que barra. O teste
        existe para garantir que a segunda camada não seja removida
        pensando que a primeira já cobre esse caso.
        """
        with mock.patch(
            "socket.getaddrinfo", fake_addrinfo({"2130706433": ["127.0.0.1"]})
        ):
            with self.assertRaises(HTTPException) as ctx:
                _validate_url("http://2130706433/audio.mp3")
            self.assertEqual(ctx.exception.status_code, 400)


class ResolutionTests(unittest.TestCase):
    """O caso central: domínio público que aponta para dentro da rede."""

    def test_dominio_que_resolve_para_privado_e_recusado(self):
        for ip in ["127.0.0.1", "10.1.2.3", "192.168.0.10", "169.254.169.254", "::1"]:
            with self.subTest(ip=ip), mock.patch(
                "socket.getaddrinfo", fake_addrinfo({"interno.exemplo.com": [ip]})
            ):
                with self.assertRaises(HTTPException) as ctx:
                    _validate_url("https://interno.exemplo.com/a.mp3")
                self.assertEqual(ctx.exception.status_code, 400, ip)

    def test_um_endereco_privado_entre_varios_publicos_recusa_tudo(self):
        """DNS com múltiplos registros: um privado invalida a URL inteira."""
        with mock.patch(
            "socket.getaddrinfo",
            fake_addrinfo({"misto.exemplo.com": ["93.184.216.34", "10.0.0.7"]}),
        ):
            with self.assertRaises(HTTPException):
                _validate_url("https://misto.exemplo.com/a.mp3")

    def test_falha_de_dns_vira_400(self):
        with mock.patch("socket.getaddrinfo", fake_addrinfo({})):
            with self.assertRaises(HTTPException) as ctx:
                _validate_url("https://nao-existe.exemplo/a.mp3")
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("resolver", ctx.exception.detail.lower())

    def test_porta_default_por_esquema(self):
        """https resolve na 443, http na 80 — a porta vai ao getaddrinfo."""
        vistos = []

        def espiao(host, port, *args, **kwargs):
            vistos.append((host, port))
            return fake_addrinfo(PUBLIC)(host, port, *args, **kwargs)

        with mock.patch("socket.getaddrinfo", espiao):
            _validate_url("https://exemplo.com/a.mp3")
            _validate_url("http://exemplo.com/a.mp3")
            _validate_url("http://exemplo.com:8443/a.mp3")
        self.assertEqual(vistos, [
            ("exemplo.com", 443),
            ("exemplo.com", 80),
            ("exemplo.com", 8443),
        ])


class PassthroughTests(unittest.TestCase):
    """O que é aceito volta praticamente intacto para o yt-dlp."""

    def test_retorna_a_url_original_apenas_sem_espacos(self):
        casos = [
            "https://www.youtube.com/watch?v=abc123",
            "  https://www.youtube.com/watch?v=abc123  ",
            "https://www.youtube.com/watch?v=abc123&t=42s#frag",
        ]
        with mock.patch("socket.getaddrinfo", fake_addrinfo(PUBLIC)):
            for raw in casos:
                with self.subTest(raw=raw):
                    self.assertEqual(_validate_url(raw), raw.strip())

    def test_query_e_fragmento_preservados(self):
        """Nada de normalizar: o yt-dlp precisa da URL como o usuário deu."""
        raw = "https://exemplo.com/v?id=1&list=PL%20A#t=10"
        with mock.patch("socket.getaddrinfo", fake_addrinfo(PUBLIC)):
            self.assertEqual(_validate_url(raw), raw)

    def test_validacao_nao_fixa_o_ip_resolvido(self):
        """Limitação conhecida, registrada de propósito.

        A função devolve a URL com o *nome*, não com o IP aprovado.
        Quem baixa (yt-dlp) resolve o nome outra vez, então existe uma
        janela de DNS rebinding entre validar e baixar. Se algum dia a
        função passar a fixar o IP, este teste falha e a decisão fica
        visível em vez de silenciosa.
        """
        with mock.patch("socket.getaddrinfo", fake_addrinfo(PUBLIC)):
            out = _validate_url("https://exemplo.com/a.mp3")
        self.assertIn("exemplo.com", out)
        self.assertNotIn("93.184.216.34", out)


class InvalidPortTests(unittest.TestCase):
    """Portas inválidas sempre viram uma resposta 400 controlada."""

    def test_portas_invalidas_viram_400(self):
        with mock.patch("socket.getaddrinfo", fake_addrinfo(PUBLIC)):
            for raw in [
                "http://exemplo.com:99999/a.mp3",
                "http://exemplo.com:abc/a.mp3",
                "http://exemplo.com:0/a.mp3",
            ]:
                with self.subTest(raw=raw), self.assertRaises(HTTPException) as ctx:
                    _validate_url(raw)
                self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main(verbosity=2)
