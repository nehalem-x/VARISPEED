"""Impressão digital da versão do app que está no disco.

O servidor calcula ao subir e devolve em /api/health ("build"). O launcher
calcula de novo ao ser aberto: se for diferente, o servidor em execução é de
uma versão anterior (git pull, pacote novo, arquivo editado) e é reiniciado,
em vez de ser reaproveitado com a lista de arquivos e o código antigos.

Só biblioteca padrão: o launcher importa este módulo antes da .venv existir.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

# Tudo que o servidor carrega ou serve e que muda entre versões.
PATTERNS = ("*.html", "*.js", "*.css", "server/*.py")


def fingerprint(root: Path) -> str:
    digest = hashlib.sha1(usedforsecurity=False)
    for pattern in PATTERNS:
        for path in sorted(root.glob(pattern)):
            try:
                stat = path.stat()
            except OSError:
                continue
            digest.update(f"{path.relative_to(root).as_posix()}|{stat.st_size}|{stat.st_mtime_ns}\n".encode())
    return digest.hexdigest()[:16]
