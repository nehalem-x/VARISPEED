"""Isolated visual QA: python tests/ui_preview.py, then http://127.0.0.1:8767/.

Never uses the production origin/storage. Synthetic tracks reset on each reload.
The real backend and frontend are served, with one test-only bootstrap script.
"""
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ['VARISPEED_PORT'] = '8767'

from fastapi.responses import HTMLResponse, FileResponse
from server.main import app
import uvicorn


@app.middleware('http')
async def preview(request, call_next):
    if request.url.path == '/':
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        return HTMLResponse(html.replace('<script src="app.js"></script>', '<script src="/__ui-preview.js"></script>'))
    if request.url.path == '/__ui-preview.js':
        return FileResponse(ROOT / 'tests' / 'ui-preview.js', media_type='text/javascript')
    return await call_next(request)


if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8767)
