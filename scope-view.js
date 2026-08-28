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
  const Core = window.VarispeedCore;

  function createScopeView(canvas, viewOptions = {}) {
    const ctx = canvas.getContext('2d');
    const doc = canvas.ownerDocument;
    const root = doc.documentElement;
    let w = 0, h = 0, cssW = 0, cssH = 0, dpr = 1;
    let top = null, bot = null;
    let frozen = false;
    let activeVisualizer = 'waveform';
    let vectorLeft = null, vectorRight = null;
    let vectorNeedsRedraw = false;
    let vectorStyleKey = '';
    let mediaKey = '';

    /* cores lidas do próprio documento — cada alvo respeita o seu tema */
    let cc = null;
    const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
    const colors = () => (cc || (cc = {
      axis: css('--wave-axis'),
      text: css('--text'),
      t2: css('--text-2'),
      t3: css('--text-3'),
    }));

    function resetVisualState() {
      if (top) top.fill(0);
      if (bot) bot.fill(0);
      frozen = false;
      vectorLeft = null;
      vectorRight = null;
      vectorNeedsRedraw = false;
      if (w && h) ctx.clearRect(0, 0, w, h);
    }

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
      vectorNeedsRedraw = !!(vectorLeft && vectorRight);
      return true;
    }

    function drawVector(left, right, opts, alpha = 1) {
      if (!left || !right || !Core) return;
      const N = Math.min(left.length, right.length);
      if (N < 2) return;
      const stride = Core.stereoVectorStride(N, w, h, opts.vectorDensity);
      const radius = clamp(Number(opts.vectorSize) || 1.15, 0.5, 3) * clamp(Math.min(w, h) / 250, 0.7, 1.75);
      const cx = w * 0.5;
      const cy = h * 0.5;
      const color = colors().text;

      const position = viewOptions.compactHorizontal
        ? (p) => ({
          x: cx + p.y * w * 0.47,
          y: cy + p.x * h * 0.43,
        })
        : (p) => {
          const amp = Math.max(2, Math.min(w, h) * 0.455);
          return { x: cx + p.x * amp, y: cy - p.y * amp };
        };

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = color;

      /* Halo difuso em uma única passagem; evita shadowBlur por partícula. */
      ctx.globalAlpha = 0.12 * alpha;
      ctx.beginPath();
      for (let i = 0; i < N; i += stride) {
        const p = Core.stereoVectorPoint(left[i], right[i], opts.gain);
        const { x, y } = position(p);
        ctx.moveTo(x + radius * 2.4, y);
        ctx.arc(x, y, radius * 2.4, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.globalAlpha = 0.72 * alpha;
      ctx.beginPath();
      for (let i = 0; i < N; i += stride) {
        const p = Core.stereoVectorPoint(left[i], right[i], opts.gain);
        const { x, y } = position(p);
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }

    function renderVectorscope(frame, opts) {
      const st = frame.state;
      const styleKey = [opts.gain, opts.vectorSize, opts.vectorDensity].join('|');
      if (styleKey !== vectorStyleKey) {
        vectorStyleKey = styleKey;
        vectorNeedsRedraw = true;
      }
      if (st === 'busy') {
        ctx.clearRect(0, 0, w, h);
        const p = (((frame.ts || 0) - (frame.t0 || 0)) % 1000) / 1000;
        const radius = Math.max(1, Math.min(w, h) * 0.035);
        ctx.fillStyle = colors().t2;
        ctx.beginPath();
        ctx.arc(w * 0.5 + Math.cos(p * Math.PI * 2) * Math.min(w, h) * 0.22,
          h * 0.5 + Math.sin(p * Math.PI * 2) * Math.min(w, h) * 0.22,
          radius, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      const stereo = frame.stereo;
      if (st === 'live' && stereo && stereo.left && stereo.right) {
        /* Apaga apenas uma fração do quadro anterior. A persistência nasce do
           próprio canvas, sem manter milhares de partículas em JavaScript. */
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${clamp(1 - opts.vectorTrail, 0.035, 0.5)})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        drawVector(stereo.left, stereo.right, opts);
        vectorLeft = stereo.left;
        vectorRight = stereo.right;
        vectorNeedsRedraw = false;
        frozen = true;
        return;
      }

      if (st === 'ready' && stereo && stereo.left && stereo.right && (!vectorLeft || !vectorRight)) {
        vectorLeft = stereo.left;
        vectorRight = stereo.right;
        vectorNeedsRedraw = true;
      }
      if (st === 'ready' && vectorLeft && vectorRight) {
        if (vectorNeedsRedraw) {
          ctx.clearRect(0, 0, w, h);
          drawVector(vectorLeft, vectorRight, opts, 0.55);
          vectorNeedsRedraw = false;
        }
        return;
      }

      if (st === 'idle') {
        ctx.clearRect(0, 0, w, h);
        vectorLeft = null;
        vectorRight = null;
        vectorNeedsRedraw = false;
        frozen = false;
      }
    }

    /* frame: { state, samples, ts, t0 }
       opts:  { gain, mode, smooth }                                */
    function render(frame, opts) {
      if (!w || !h) return;
      if (frame.mediaKey !== undefined && String(frame.mediaKey) !== mediaKey) {
        mediaKey = String(frame.mediaKey);
        resetVisualState();
      }
      const visualizer = opts.visualizer === 'vectorscope' ? 'vectorscope' : 'waveform';
      if (visualizer !== activeVisualizer) {
        activeVisualizer = visualizer;
        ctx.clearRect(0, 0, w, h);
        vectorNeedsRedraw = true;
      }
      if (visualizer === 'vectorscope') {
        renderVectorscope(frame, opts);
        return;
      }
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
      reset: resetVisualState,
      invalidateColors() { cc = null; vectorNeedsRedraw = true; },
      get width() { return w; },
      get live() { return !!w; },
    };
  }

  window.ScopeView = { create: createScopeView };
})();
