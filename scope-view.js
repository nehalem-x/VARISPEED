/* ═════════════════════════════════════════════════════════
   VARISPEED — apresentação do osciloscópio
   Um único renderizador, vários alvos: o osciloscópio do
   header, o Focus Mode e a janela independente são apenas
   canvases diferentes recebendo o MESMO quadro de sinal.
   Nenhuma análise ou reprodução acontece aqui.
   ═════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function createScopeView(canvas) {
    const ctx = canvas.getContext('2d');
    const doc = canvas.ownerDocument;
    const root = doc.documentElement;
    let w = 0, h = 0, cssW = 0, cssH = 0, dpr = 1;
    let top = null, bot = null;
    let frozen = false;

    /* cores lidas do próprio documento — cada alvo respeita o seu tema */
    let cc = null;
    const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
    const colors = () => (cc || (cc = {
      axis: css('--wave-axis'),
      text: css('--text'),
      t2: css('--text-2'),
      t3: css('--text-3'),
    }));

    function resize(force = false) {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return false;

      const view = doc.defaultView || window;
      const nextDpr = clamp(Number(view.devicePixelRatio) || 1, 0.5, 3);
      const nextCssW = Math.max(1, r.width);
      const nextCssH = Math.max(1, r.height);
      /* O envelope continua indexado por colunas CSS inteiras; o backing store,
         porém, usa a medida fracionária real. Isso mantém o custo previsível e
         evita blur extra quando zoom/escala geram 643.2 CSS px, por exemplo. */
      const nextW = Math.max(8, Math.round(nextCssW));
      const nextH = Math.max(6, Math.round(nextCssH));
      const changed = force || Math.abs(nextCssW - cssW) > 0.05 ||
        Math.abs(nextCssH - cssH) > 0.05 || Math.abs(nextDpr - dpr) > 0.0001;
      if (!changed) return false;

      /* Preserve o último traço pausado ao redimensionar. O canvas perde os
         pixels quando width/height muda, então reamostramos o envelope salvo
         para a nova largura em vez de zerar o estado visual. */
      const oldW = w;
      const oldTop = top;
      const oldBot = bot;
      const hadFrozen = frozen && oldTop && oldBot && oldW > 1;

      w = nextW; h = nextH; cssW = nextCssW; cssH = nextCssH; dpr = nextDpr;
      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      canvas.width = bw;
      canvas.height = bh;
      /* Usar a razão efetiva backing/logical elimina a pequena escala residual
         criada por Math.round() em DPR como 1.25, 1.5 ou 2.25. */
      ctx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
      top = new Float32Array(w);
      bot = new Float32Array(w);

      if (hadFrozen) {
        const at = (buf, fx) => {
          const i = Math.floor(fx);
          const f = fx - i;
          const a = buf[clamp(i, 0, oldW - 1)];
          const b = buf[clamp(i + 1, 0, oldW - 1)];
          return a + (b - a) * f;
        };
        const denom = Math.max(1, w - 1);
        for (let x = 0; x < w; x++) {
          const fx = (x / denom) * (oldW - 1);
          top[x] = at(oldTop, fx);
          bot[x] = at(oldBot, fx);
        }
      }
      return true;
    }

    /* frame: { state, samples, ts, t0 }
       opts:  { gain, mode, smooth }                                */
    function render(frame, opts) {
      if (!w || !h) return;
      const c = colors();
      const mid = Math.round(h / 2) + 0.5;
      const st = frame.state;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = c.axis;
      ctx.fillRect(0, mid - 0.5, w, 1);

      /* trabalho em andamento: varredura indeterminada */
      if (st === 'busy') {
        const period = 1000;
        const p = (((frame.ts || 0) - (frame.t0 || 0)) % period) / period;
        const segW = Math.max(8, w * 0.22);
        const x = -segW + p * (w + segW);
        const g = ctx.createLinearGradient(x, 0, x + segW, 0);
        g.addColorStop(0, 'transparent');
        g.addColorStop(0.5, c.t2);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(Math.max(0, x), mid - 1, Math.min(segW, w), 2);
        return;
      }

      const amp = ((h / 2) - 1.5) * opts.gain;
      const buf = frame.samples;

      if (st === 'live' && buf && buf.length > 2) {
        const N = buf.length;
        const per = N / w;
        /* leitura contínua do sinal: quando há mais pixels que
           amostras (Focus Mode, janela larga), o valor entre duas
           amostras é interpolado — traço contínuo, nunca pontilhado */
        const at = (fx) => {
          const i = Math.floor(fx);
          const f = fx - i;
          const a = buf[clamp(i, 0, N - 1)];
          const b = buf[clamp(i + 1, 0, N - 1)];
          return a + (b - a) * f;
        };

        if (opts.mode === 'line') {
          ctx.strokeStyle = c.text;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const v = clamp(at(x * per), -1, 1);
            const y = mid - v * amp;
            if (x === 0) ctx.moveTo(x + 0.5, y); else ctx.lineTo(x + 0.5, y);
          }
          ctx.stroke();
          frozen = false;
          return;
        }

        const k = opts.smooth;
        ctx.fillStyle = c.text;
        for (let x = 0; x < w; x++) {
          let lo, hi;
          if (per >= 1) {
            const s0 = Math.floor(x * per);
            const s1 = Math.max(s0 + 1, Math.floor((x + 1) * per));
            lo = 1; hi = -1;
            for (let s = s0; s < s1 && s < N; s++) {
              const v = buf[s];
              if (v < lo) lo = v;
              if (v > hi) hi = v;
            }
          } else {
            const v0 = at(x * per);
            const v1 = at((x + 1) * per);
            lo = Math.min(v0, v1);
            hi = Math.max(v0, v1);
          }
          if (hi < lo) { lo = 0; hi = 0; }
          top[x] = top[x] * (1 - k) + hi * k;
          bot[x] = bot[x] * (1 - k) + lo * k;
          const yT = mid - clamp(top[x], -1, 1) * amp;
          const yB = mid - clamp(bot[x], -1, 1) * amp;
          ctx.fillRect(x, Math.max(0, yT), 1, Math.max(1, Math.min(h, yB) - Math.max(0, yT)));
        }
        frozen = true;
        return;
      }

      /* pausado com material carregado: último quadro, atenuado */
      if (st === 'ready' && frozen && top) {
        ctx.fillStyle = c.t3;
        for (let x = 0; x < w; x++) {
          const yT = mid - top[x] * amp;
          const yB = mid - bot[x] * amp;
          ctx.fillRect(x, yT, 1, Math.max(1, yB - yT));
        }
      }
    }

    return {
      canvas,
      resize,
      render,
      invalidateColors() { cc = null; },
      get width() { return w; },
      get live() { return !!w; },
    };
  }

  window.ScopeView = { create: createScopeView };
})();
