"""Verifica interações reais do frontend em Firefox com backend simulado.

Executar: python3 tests/run-ui-browser.py
As capturas e os relatórios ficam no diretório temporário informado na saída.
"""
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
browser = shutil.which('firefox-bin') or shutil.which('firefox')
if not browser:
    raise SystemExit('Firefox não encontrado.')
out = Path(tempfile.mkdtemp(prefix='varispeed-ui-browser-'))
html = (root / 'index.html').read_text().replace('<script src="theme-boot.js"></script>', '')
setup = '<base href="' + root.as_uri() + '/">' + '''<script>
localStorage.clear();
localStorage.setItem('varispeed.library.tutorial.v1','1');
window.fetch=async()=>new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});
</script><style>*,*::before,*::after{transition:none!important;animation:none!important}</style>'''
html = html.replace('<head>', '<head>' + setup)
checks = (root / 'tests/ui-controls.browser.js').read_text()
html = html.replace('</body>', '<script>' + checks + '</script></body>')
fixture = out / 'controls.html'
fixture.write_text(html)
failed = False
for width in (390, 1280):
    profile = out / f'profile-{width}'
    profile.mkdir()
    (profile / 'user.js').write_text('user_pref("browser.dom.window.dump.enabled", true);\n')
    env = dict(os.environ, MOZ_CRASHREPORTER_DISABLE='1')
    cmd = [browser, '--headless', '--no-remote', '--profile', str(profile),
           '--screenshot', str(out / f'controls-{width}.png'),
           '--window-size', f'{width},1000', fixture.as_uri()]
    with (out / f'log-{width}.txt').open('w') as log:
        process = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT, env=env)
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            # Neste sandbox o Firefox salva a captura, mas pode travar ao encerrar.
            process.kill()
            process.wait()
    reports = [line.split('UI_REPORT=', 1)[1] for line in
               (out / f'log-{width}.txt').read_text().splitlines() if 'UI_REPORT=' in line]
    if not reports or not (out / f'controls-{width}.png').is_file():
        print(f'{width}px: execução incompleta; consulte o log.')
        failed = True
        continue
    result = json.loads(reports[-1])
    (out / f'report-{width}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    failures = [check['name'] for check in result['checks'] if not check['pass']]
    print(f"{width}px: {len(result['checks']) - len(failures)}/{len(result['checks'])} passaram.")
    for name in failures:
        print('  FALHOU:', name)
    failed |= bool(failures)
print('Relatórios e capturas:', out)
raise SystemExit(1 if failed else 0)
