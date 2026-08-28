/* ═════════════════════════════════════════════════════════
   VARISPEED — cliente da importação remota via yt-dlp
   O navegador não executa yt-dlp. Toda resolução/obtenção de
   mídia remota acontece no backend local em /api/media/*.
   ═════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const parse = (raw) => {
    const txt = String(raw || '').trim();
    if (!txt) return { ok: false, error: 'Informe um endereço.' };
    let url;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(txt) ? txt : `https://${txt}`);
    } catch (e) {
      return { ok: false, error: 'Endereço inválido.' };
    }
    if (!/^https?:$/.test(url.protocol)) {
      return { ok: false, error: 'Somente endereços http e https.' };
    }
    return { ok: true, url: url.href };
  };

  async function apiError(res) {
    let msg = `O backend respondeu ${res.status}.`;
    let errCode = '';
    try {
      const data = await res.json();
      if (data && typeof data.detail === 'string') msg = data.detail;
      else if (data && data.detail && typeof data.detail.message === 'string') {
        msg = data.detail.message;
        if (typeof data.detail.code === 'string') errCode = data.detail.code;
      }
    } catch (e) { /* resposta não JSON */ }
    const err = new Error(msg);
    err.status = res.status;
    if (errCode) err.code = errCode;
    throw err;
  }

  async function info(url, signal) {
    const res = await fetch('/api/media/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal,
    });
    if (!res.ok) await apiError(res);
    return res.json();
  }

  async function configureAuth(browser) {
    const res = await fetch('/api/auth/browser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ browser: String(browser || 'off') }),
    });
    if (!res.ok) await apiError(res);
    return res.json();
  }

  async function authStatus() {
    const res = await fetch('/api/auth/status', { cache: 'no-store' });
    if (!res.ok) await apiError(res);
    return res.json();
  }

  async function useBrowserCookies(url, signal) {
    const res = await fetch('/api/auth/browser/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      cache: 'no-store',
      signal,
    });
    if (!res.ok) await apiError(res);
    return res.json();
  }

  async function dedicatedAuthAction(action) {
    const allowed = new Set(['start', 'finish', 'disconnect', 'cancel']);
    if (!allowed.has(action)) throw new Error('Ação de autenticação inválida.');
    const res = await fetch(`/api/auth/dedicated/${action}`, {
      method: 'POST',
      cache: 'no-store',
    });
    if (!res.ok) await apiError(res);
    return res.json();
  }

  const filenameFromDisposition = (header) => {
    if (!header) return '';
    const star = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (star) {
      try { return decodeURIComponent(star[1].trim()); } catch (e) { return star[1].trim(); }
    }
    const plain = header.match(/filename="?([^";]+)"?/i);
    return plain ? plain[1].trim() : '';
  };

  async function audio(url, opts = {}) {
    const res = await fetch('/api/media/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, authenticated: Boolean(opts.authenticated) }),
      signal: opts.signal,
    });
    if (!res.ok) await apiError(res);

    const type = (res.headers.get('content-type') || 'application/octet-stream').split(';')[0];
    const total = Number(res.headers.get('content-length') || 0);
    const filename = filenameFromDisposition(res.headers.get('content-disposition')) || 'audio';

    if (opts.onStart) opts.onStart({ total, type, filename });

    let blob;
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const parts = [];
      let received = 0;
      for (;;) {
        const step = await reader.read();
        if (step.done) break;
        parts.push(step.value);
        received += step.value.byteLength;
        if (opts.onProgress) opts.onProgress({ received, total });
      }
      blob = new Blob(parts, { type });
    } else {
      blob = await res.blob();
      if (opts.onProgress) opts.onProgress({ received: blob.size, total: total || blob.size });
    }

    return { blob, filename, type, size: blob.size };
  }

  window.RemoteImport = {
    parse, info, audio, configureAuth, authStatus, useBrowserCookies,
    startDedicatedAuth: () => dedicatedAuthAction('start'),
    finishDedicatedAuth: () => dedicatedAuthAction('finish'),
    cancelDedicatedAuth: () => dedicatedAuthAction('cancel'),
    disconnectDedicatedAuth: () => dedicatedAuthAction('disconnect'),
  };
})();
