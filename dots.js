/* ═════════════════════════════════════════════════════════
   VARISPEED — indicador de pontos
   Indicador pequeno de "trabalhando", ao lado de um texto de status.
     tumble → três pontos num anel horizontal que gira; a câmera sobe e
              desce. Para tarefas de ler e trazer (decodificar, baixar,
              importar, abrir).
     grid   → grade 2×2 em que pares de cantos opostos trocam de lugar.
              Para tarefas de processar (renderizar, codificar).

   Uso: const d = Dots.mount(span); d.set('tumble' | 'grid' | null).
   A cor vem de `color` do host; o tamanho, da altura do host.
   Com movimento reduzido o indicador aparece parado.
   ═════════════════════════════════════════════════════════ */
window.Dots = (() => {
  'use strict';

  const TAU = Math.PI * 2;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => (window.Motion && window.Motion.reduced ? window.Motion.reduced() : mq.matches);

  /* Meia fase de 55 quadros a 30 fps: o anel dá uma volta inteira enquanto a
     câmera sai da altura dos pontos, sobe (ou desce, na fase seguinte) até
     ~40° e volta. O giro acelera um pouco no auge da inclinação. */
  const TUMBLE_HALF = 55 / 30;
  function tumble(t) {
    const n = Math.floor(t / TUMBLE_HALF);
    const u = t / TUMBLE_HALF - n;
    const spin = 1.5 * Math.PI - TAU * (n + u - (0.19 / TAU) * Math.sin(TAU * u));
    const pulse = Math.pow(0.5 - 0.5 * Math.cos(TAU * u), 3);
    const elev = (n % 2 === 0 ? 1 : -1) * 0.7 * pulse;
    const out = [];
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * TAU) / 3;
      const z = Math.sin(a);
      out.push({ x: Math.cos(a), y: z * Math.sin(elev), z: z * Math.cos(elev) });
    }
    return out;
  }

  /* Caminho do ponto que sai do canto de cima à esquerda até o de baixo à
     direita, um ponto por quadro (unidades da grade, y para baixo). O canto
     oposto faz o caminho espelhado; a fase seguinte usa o outro par. */
  const SWAP_PATH = [
    [-1, -1], [-0.98, -0.93], [-0.95, -0.85], [-0.9, -0.72], [-0.84, -0.56],
    [-0.77, -0.37], [-0.68, -0.13], [-0.52, 0.17], [-0.34, 0.52], [-0.15, 0.8],
    [0.07, 1.02], [0.27, 1.16], [0.47, 1.21], [0.65, 1.18], [0.77, 1.14],
    [0.86, 1.09], [0.92, 1.05], [0.96, 1.02], [0.99, 1], [1, 1],
  ];
  const GRID_FRAMES = 19;
  const GRID_HALF = GRID_FRAMES / 30;
  function swapPoint(f) {
    const last = SWAP_PATH.length - 1;
    if (f >= last) return SWAP_PATH[last];
    const i = Math.floor(f), u = f - i;
    const p0 = SWAP_PATH[Math.max(0, i - 1)], p1 = SWAP_PATH[i];
    const p2 = SWAP_PATH[i + 1], p3 = SWAP_PATH[Math.min(last, i + 2)];
    const at = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u
      + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u
      + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
    return [at(0), at(1)];
  }
  function grid(t) {
    const n = Math.floor(t / GRID_HALF);
    const [px, py] = swapPoint((t / GRID_HALF - n) * GRID_FRAMES);
    const pts = n % 2 === 0
      ? [[px, py], [-px, -py], [1, -1], [-1, 1]]
      : [[-px, py], [px, -py], [-1, -1], [1, 1]];
    return pts.map(([x, y]) => ({ x, y, z: 0 }));
  }

  const SHAPES = {
    tumble: { at: tumble, spread: 0.78, radius: 0.19 },
    grid: { at: grid, spread: 0.6, radius: 0.2 },
  };

  const active = new Set();
  let raf = 0;
  let last = 0;

  function draw(d) {
    const shape = SHAPES[d.kind];
    const { ctx, size } = d;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = getComputedStyle(d.host).color;
    const half = size / 2;
    const dots = shape.at(d.time).sort((a, b) => a.z - b.z);
    for (const p of dots) {
      const depth = (p.z + 1) / 2;                  // 0 fundo … 1 frente
      const tumbling = d.kind === 'tumble';
      ctx.globalAlpha = tumbling ? 0.55 + 0.45 * depth : 1;
      const r = half * shape.radius * (tumbling ? 0.75 + 0.25 * depth : 1);
      ctx.beginPath();
      ctx.arc(half + p.x * half * shape.spread, half + p.y * half * shape.spread, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const still = reduced();
    for (const d of active) {
      if (!still) d.time += dt;
      draw(d);
    }
    raf = active.size && !still ? requestAnimationFrame(frame) : 0;
  }

  function wake() {
    if (raf || !active.size) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function fit(d) {
    const size = Math.max(8, Math.round(d.host.getBoundingClientRect().height) || 14);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    if (size === d.size && dpr === d.dpr) return;
    d.size = size; d.dpr = dpr;
    d.canvas.width = Math.round(size * dpr);
    d.canvas.height = Math.round(size * dpr);
    d.canvas.style.width = `${size}px`;
    d.canvas.style.height = `${size}px`;
    d.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function mount(host) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.replaceChildren(canvas);
    const d = { host, canvas, ctx: canvas.getContext('2d'), kind: null, time: 0, size: 0, dpr: 0 };
    return {
      set(kind) {
        const next = SHAPES[kind] ? kind : null;
        if (next === d.kind) return;
        d.kind = next;
        host.hidden = !next;
        if (!next) { active.delete(d); return; }
        d.time = 0;
        fit(d);
        active.add(d);
        draw(d);
        wake();
      },
      get kind() { return d.kind; },
    };
  }

  // A preferência de movimento pode mudar com o indicador visível.
  mq.addEventListener?.('change', () => { for (const d of active) draw(d); wake(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  return { mount, wake, _shapes: SHAPES };
})();
