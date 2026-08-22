/* ═════════════════════════════════════════════════════════
   VARISPEED — janela independente do osciloscópio
   Espelho visual: nenhuma reprodução, nenhuma análise e
   nenhuma fonte de áudio aqui. Cada quadro é pedido à sessão
   principal e desenhado pelo mesmo renderizador.
   ═════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const canvas = document.getElementById('scopeWin');
  const note = document.getElementById('winNote');
  const view = window.ScopeView.create(canvas);

  const host = window.opener;
  let frame = { state: 'idle', samples: null, ts: 0, t0: 0 };
  let opts = { gain: 1, mode: 'columns', smooth: 0.5 };
  let lastMsg = 0;

  const post = (msg) => {
    try { if (host && !host.closed) host.postMessage(msg, '*'); } catch (e) { /* sem canal */ }
  };

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'tempo:frame') {
      lastMsg = performance.now();
      frame = { state: d.state, samples: d.samples, ts: d.ts, t0: d.t0 };
      opts = { gain: d.gain, mode: d.mode, smooth: d.smooth };
      if (d.theme && document.documentElement.dataset.theme !== d.theme) {
        document.documentElement.dataset.theme = d.theme;
        view.invalidateColors();
      }
      if (d.title) document.title = `VARISPEED — ${d.title}`;
      note.hidden = true;
    } else if (d.type === 'tempo:bye') {
      note.textContent = 'A sessão do VARISPEED foi encerrada.';
      note.hidden = false;
      frame = { state: 'idle', samples: null, ts: 0, t0: 0 };
    }
  });

  let resizeRaf = 0, resizeSettle = 0, dprMedia = null;
  const scheduleResize = (settle = false) => {
    if (!resizeRaf) {
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        view.resize();
      });
    }
    if (settle) {
      clearTimeout(resizeSettle);
      resizeSettle = setTimeout(() => view.resize(), 140);
    }
  };

  const ro = new ResizeObserver(() => scheduleResize());
  ro.observe(canvas);
  window.addEventListener('resize', () => scheduleResize(true), { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => scheduleResize(true), { passive: true });
  }

  /* Zoom do navegador e troca de monitor podem alterar devicePixelRatio sem
     um resize de layout confiável. Rearmar a media query força o bitmap do
     osciloscópio a acompanhar DPR 1.25/1.5/2.25 etc. */
  function armDprWatcher() {
    if (!window.matchMedia) return;
    if (dprMedia) {
      try { dprMedia.removeEventListener('change', onDprChange); } catch (_) {
        try { dprMedia.removeListener(onDprChange); } catch (_) {}
      }
    }
    const raw = Number(window.devicePixelRatio) || 1;
    dprMedia = window.matchMedia(`(resolution: ${raw}dppx)`);
    try { dprMedia.addEventListener('change', onDprChange, { once: true }); } catch (_) {
      try { dprMedia.addListener(onDprChange); } catch (_) {}
    }
  }
  function onDprChange() {
    armDprWatcher();
    scheduleResize(true);
  }
  armDprWatcher();
  view.resize(true);

  /* o pedido de quadro é feito pelo próprio ritmo de vídeo desta
     janela — mantém baixa latência sem inundar o canal */
  function loop(ts) {
    post({ type: 'tempo:need' });
    view.render({ state: frame.state, samples: frame.samples, ts, t0: frame.t0 }, opts);
    if (host && host.closed) {
      note.textContent = 'A sessão do VARISPEED foi encerrada.';
      note.hidden = false;
    } else if (lastMsg && ts - lastMsg > 2500) {
      note.textContent = 'Sem resposta da sessão do VARISPEED.';
      note.hidden = false;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  if (!host) {
    note.textContent = 'Abra esta janela pelo botão de osciloscópio na sessão do VARISPEED.';
    note.hidden = false;
  } else {
    post({ type: 'tempo:hello' });
    window.addEventListener('beforeunload', () => post({ type: 'tempo:closed' }));
  }
})();
