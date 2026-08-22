/* ═════════════════════════════════════════════════════════
   VARISPEED — core puro
   ─────────────────────────────────────────────────────────
   Lógica sem DOM, sem estado global e sem Settings: tudo que
   entra vem por parâmetro. É o que permite testar formatação,
   parsing, nome de saída e matemática de canvas fora do
   navegador, com `node --test`.

   REGRAS DESTE ARQUIVO
   - nenhuma referência a document, window.devicePixelRatio,
     state, cfg() ou localStorage;
   - nenhuma função pode ter efeito colateral;
   - comportamento idêntico ao de app.js — divergência aqui é
     bug, não melhoria. tests/legacy-snapshot.js guarda as
     implementações originais e a suíte compara as duas.
   ═════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  const api = factory();
  /* CommonJS para os testes; global para o navegador, no mesmo
     padrão dos outros módulos (Motion, Settings, ScopeView). */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.VarispeedCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MINUS = '\u2212';   // U+2212 MINUS SIGN — sinal tipográfico da UI
  const TIMES = '\u00d7';   // U+00D7 MULTIPLICATION SIGN
  const DASH = '\u2014';    // U+2014 EM DASH — placeholder de tamanho ausente

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ── tempo ──────────────────────────────────────────────
     format: 'mmss' (padrão) · 'sec' · 'samples'
     sampleRate só é usado em 'samples'; 48000 é o fallback
     histórico para quando nenhuma mídia foi carregada.      */
  function fmtTime(s, opts) {
    const o = opts || {};
    let v = s;
    if (!isFinite(v) || v < 0) v = 0;
    if (o.format === 'sec') return `${v.toFixed(2)} s`;
    if (o.format === 'samples') {
      const sr = o.sampleRate || 48000;
      return String(Math.round(v * sr));
    }
    const m = Math.floor(v / 60);
    const sec = v - m * 60;
    return `${m}:${sec.toFixed(2).padStart(5, '0')}`;
  }

  /* Relógio de mídia remota: independente da preferência de
     régua/timeline, sempre h:mm:ss ou m:ss. Nunca retorna
     vazio — a linkbar decide antes se há duração conhecida. */
  function fmtClock(sec) {
    /* DIVERGÊNCIA DELIBERADA do app.js: o original não filtra
       Infinity e produzia "Infinity:NaN:NaN". Nenhum valor
       finito muda de resultado, então isto é endurecimento
       puro (o campo é alimentado por JSON do yt-dlp, que não
       representa Infinity — o caso era latente, não visível). */
    const raw = Number(sec);
    const n = Math.max(0, Math.round(Number.isFinite(raw) ? raw : 0));
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const s = n % 60;
    const pad = (x) => String(x).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  /* ── velocidade ─────────────────────────────────────────
     O estado interno do app é sempre porcentagem. Estas
     funções só traduzem para/da unidade exibida.
     unit: 'pct' · 'mult' · 'st'                            */
  function rateText(v, unit) {
    const r = v / 100;
    if (unit === 'mult') return r.toFixed(3);
    if (unit === 'st') {
      const st = 12 * Math.log2(r);
      return `${st >= 0 ? '+' : MINUS}${Math.abs(st).toFixed(2)}`;
    }
    return v.toFixed(1);
  }

  function rateSuffix(unit) {
    return { pct: '%', mult: TIMES, st: 'st' }[unit];
  }

  function rateUnitLabel(unit) {
    return { pct: 'porcentagem', mult: 'multiplicador', st: 'semitons' }[unit];
  }

  /* Aceita o minus tipográfico e vírgula decimal, porque o
     campo é editável e recebe texto colado da própria UI. */
  function parseRate(txt, unit) {
    const n = parseFloat(String(txt).replace(MINUS, '-').replace(',', '.'));
    if (isNaN(n)) return NaN;
    if (unit === 'mult') return n * 100;
    if (unit === 'st') return 100 * Math.pow(2, n / 12);
    return n;
  }

  /* Rótulo curto para presets e marcas do slider. Mais enxuto
     que rateText(): aqui o espaço é mínimo. */
  function presetLabel(v, unit) {
    if (unit === 'mult') return (v / 100).toFixed(2).replace(/0$/, '');
    if (unit === 'st') {
      const st = 12 * Math.log2(v / 100);
      return `${st > 0 ? '+' : st < 0 ? MINUS : ''}${Math.abs(st).toFixed(st % 1 ? 1 : 0)}`;
    }
    return String(+v.toFixed(1));
  }

  /* ── presets ────────────────────────────────────────────
     Entrada livre do usuário (campo de texto das
     Configurações): remove inválidos, fora de faixa e
     duplicatas, e aplica o teto de 8 itens.

     ATENÇÃO — comportamento preservado do original: a lista é
     separada por vírgula, então "1,5" resulta em 1 e 5, não em
     1.5. Decimal com vírgula não é suportado neste campo.     */
  function parsePresets(raw, min, max, cap) {
    const limit = cap == null ? 8 : cap;
    return [...new Set(String(raw)
      .split(',')
      .map((s) => parseFloat(s.trim().replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n >= min && n <= max))]
      .slice(0, limit);
  }

  /* Marcas do trilho de velocidade em valores redondos.
     Descarta marcas coladas nos extremos para não sobrepor
     texto com os rótulos de mínimo/máximo. */
  function rateMarks(lo, hi) {
    const step = [5, 10, 25, 50, 100, 200, 400].find((n) => n >= (hi - lo) / 4) || 400;
    const marks = [lo];
    for (let v = Math.ceil(lo / step) * step; v < hi; v += step) {
      if (v - lo > step * 0.4 && hi - v > step * 0.4) marks.push(v);
    }
    marks.push(hi);
    return marks;
  }

  /* Posição percentual de uma marca no trilho. */
  const markOffset = (v, lo, hi) => ((v - lo) / (hi - lo)) * 100;

  /* ── tamanho ────────────────────────────────────────────*/
  function fmtBytes(b) {
    if (!b) return DASH;
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return `${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
  }

  /* ── régua ──────────────────────────────────────────────
     Menor passo "redondo" que cobre o alvo, para os ticks não
     caírem em valores arbitrários ao mudar o zoom. */
  function niceStep(target) {
    const steps = [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
    for (const s of steps) if (s >= target) return s;
    return 3600;
  }

  /* ── nome do arquivo exportado ──────────────────────────
     Camada 1: substituição de tokens do template.
     Camada 2: saneamento para o sistema de arquivos.
     Separadas porque o saneamento também serve a nomes que
     não vêm de template (títulos remotos, por exemplo).      */
  const RESERVED_WIN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  const FS_ILLEGAL = /[\\/:*?"<>|\n\r\t]+/g;
  const TRAILING = /[. ]+$/g;
  const STEM_MAX = 176;   // 176 + '.wav' fica longe dos limites do Windows

  const stripExt = (n) => String(n == null ? '' : n).replace(/\.[^.]+$/, '');

  /* Um passe de saneamento: caracteres ilegais, espaços nas
     pontas e ponto/espaço final (que o Windows descarta). */
  const scrub = (s) => String(s).replace(FS_ILLEGAL, '-').trim().replace(TRAILING, '');

  function sanitizeStem(name, fallback) {
    const fb = fallback || 'audio';
    /* O original aplica o saneamento duas vezes: uma no nome
       resolvido e outra no resultado do fallback. Preservado
       porque o segundo passe é o que limpa o próprio fallback
       — nomes como "..." só sobram vazios depois do segundo
       passe, e é 'audio' (não o fallback) que os resgata. */
    const first = scrub(name);
    const stem = scrub(first || fb) || 'audio';
    const chars = Array.from(stem);
    let safe = (chars.length > STEM_MAX ? chars.slice(0, STEM_MAX).join('') : stem).replace(TRAILING, '') || 'audio';
    if (RESERVED_WIN.test(safe)) safe = `_${safe}`;
    return safe;
  }

  /* Tokens: {nome} {rate} {mult} {st} {sr} {data}
     Decimais usam '-' em vez de '.' para não competir com a
     extensão do arquivo. */
  function outNameTokens(ctx) {
    const c = ctx || {};
    const base = stripExt(c.name) || 'audio';
    const r = Number(c.rate);
    const st = 12 * Math.log2(r / 100);
    const dec = (n, d) => n.toFixed(d).replace('.', '-');
    return {
      nome: base,
      rate: dec(r, 1),
      mult: dec(r / 100, 2),
      st: `${st >= 0 ? '+' : '-'}${dec(Math.abs(st), 1)}`,
      sr: String(c.sampleRate),
      data: (c.date || new Date()).toISOString().slice(0, 10),
    };
  }

  function outName(template, ctx) {
    const tokens = outNameTokens(ctx);
    const raw = String(template).replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? tokens[k] : m));
    return `${sanitizeStem(raw, tokens.nome)}.wav`;
  }

  /* Sample rate efetivo da exportação: 'source' herda da
     mídia; qualquer outro valor é a taxa explícita. */
  function outSampleRate(setting, sourceRate) {
    return setting === 'source' ? (sourceRate || 44100) : parseInt(setting, 10);
  }

  /* ── canvas / DPR ───────────────────────────────────────
     O backing store é o único lugar que arredonda. O tamanho
     CSS pode ser fracionário (zoom de browser, escala do
     Windows) e não deve ser arredondado antes da conta.      */
  const DPR_MIN = 0.5, DPR_MAX = 3;
  const CSS_TOLERANCE = 0.05;     // CSS px
  const DPR_TOLERANCE = 0.0001;

  const dprClamp = (raw) => clamp(Number(raw) || 1, DPR_MIN, DPR_MAX);
  const sizeChanged = (a, b) => Math.abs(a - b) > CSS_TOLERANCE;
  const dprChanged = (a, b) => Math.abs(a - b) > DPR_TOLERANCE;

  /* Dimensão física do bitmap para um tamanho CSS + DPR. */
  const backingSize = (cssSize, dpr) => Math.max(1, Math.round(cssSize * dpr));

  /* Escala efetiva do contexto: razão entre o bitmap real e o
     tamanho lógico, não o DPR bruto. É isso que mantém o
     desenho alinhado quando o arredondamento muda a razão.   */
  function canvasScale(cssW, cssH, dpr) {
    const bw = backingSize(cssW, dpr);
    const bh = backingSize(cssH, dpr);
    return { bw, bh, sx: bw / cssW, sy: bh / cssH };
  }

  /* Alinha uma coordenada lógica à grade física, para o
     playhead não tremer em DPR fracionário. */
  const snapToDevice = (x, scale) => Math.round(x * scale) / scale;

  /* ── mapeamento de ponteiro ─────────────────────────────
     clientX chega em espaço CSS e precisa virar espaço lógico
     do canvas antes de qualquer conversão para tempo. O clamp
     no espaço CSS evita erro acumulado perto das bordas.     */
  const pointerToLogical = (clientX, rectLeft, rectWidth, logicalW) => {
    const localCss = clamp(clientX - rectLeft, 0, rectWidth);
    return (localCss / rectWidth) * logicalW;
  };

  /* ── janela visível da waveform ─────────────────────────*/
  const viewDuration = (duration, zoom) => (duration || 0) / zoom;
  const srcToX = (t, view, viewDur, W) => ((t - view) / viewDur) * W;
  const xToSrc = (x, view, viewDur, W) => view + (x / W) * viewDur;
  const clampView = (view, duration, viewDur) => clamp(view, 0, Math.max(0, (duration || 0) - viewDur));

  return {
    MINUS, TIMES, DASH,
    clamp,
    fmtTime, fmtClock, fmtBytes, niceStep,
    rateText, rateSuffix, rateUnitLabel, parseRate, presetLabel,
    parsePresets, rateMarks, markOffset,
    stripExt, scrub, sanitizeStem, outNameTokens, outName, outSampleRate,
    RESERVED_WIN, STEM_MAX,
    DPR_MIN, DPR_MAX, CSS_TOLERANCE, DPR_TOLERANCE,
    dprClamp, sizeChanged, dprChanged, backingSize, canvasScale, snapToDevice,
    pointerToLogical,
    viewDuration, srcToX, xToSrc, clampView,
  };
});
