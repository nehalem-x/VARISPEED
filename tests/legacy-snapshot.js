/* ═════════════════════════════════════════════════════════
   Snapshot LEGADO — cópia literal das implementações de app.js
   ─────────────────────────────────────────────────────────
   Este arquivo NÃO é carregado pelo aplicativo. Ele existe só
   para a suíte de testes comparar core.js contra o
   comportamento original, função por função, em vez de eu
   afirmar que são equivalentes.

   As dependências que no app vinham de closure (cfg(), state,
   W) aqui são injetadas por `CTX`, sem mudar o corpo das
   funções. Qualquer edição neste arquivo deve ser uma cópia
   fiel do app.js — não corrigir nada aqui.

   Origem: app.js do pacote VARISPEED_startup_modelo_final
   Linhas: 94-136, 229-240, 443-455, 463-467, 672-701, 793-800,
           1170-1196, 1561-1567
   ═════════════════════════════════════════════════════════ */
'use strict';

/* Contexto injetado no lugar de cfg()/state/W. */
const CTX = {
  settings: {},
  state: { meta: { sampleRate: 0, duration: 0, name: '' }, rate: 100, zoom: 1, view: 0 },
  W: 1000,
  now: null,
};

const cfg = (k) => CTX.settings[k];
const state = CTX.state;
const rateMin = () => cfg('rate.min');
const rateMax = () => cfg('rate.max');

/* ── verbatim: app.js:94 ─────────────────────────────────*/
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ── verbatim: app.js:97 ─────────────────────────────────*/
function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const f = cfg('tl.format');
  if (f === 'sec') return `${s.toFixed(2)} s`;
  if (f === 'samples') {
    const sr = state.meta.sampleRate || 48000;
    return String(Math.round(s * sr));
  }
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`;
}

/* ── verbatim: app.js:111 ────────────────────────────────*/
function rateText(v) {
  const u = cfg('rate.unit'), r = v / 100;
  if (u === 'mult') return r.toFixed(3);
  if (u === 'st') {
    const st = 12 * Math.log2(r);
    return `${st >= 0 ? '+' : '\u2212'}${Math.abs(st).toFixed(2)}`;
  }
  return v.toFixed(1);
}

/* ── verbatim: app.js:120 ────────────────────────────────*/
function rateSuffix() {
  return { pct: '%', mult: '\u00d7', st: 'st' }[cfg('rate.unit')];
}

/* ── verbatim: app.js:123 ────────────────────────────────*/
function parseRate(txt) {
  const u = cfg('rate.unit');
  const n = parseFloat(String(txt).replace('\u2212', '-').replace(',', '.'));
  if (isNaN(n)) return NaN;
  if (u === 'mult') return n * 100;
  if (u === 'st') return 100 * Math.pow(2, n / 12);
  return n;
}

/* ── verbatim: app.js:131 ────────────────────────────────*/
function fmtBytes(b) {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return `${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

/* ── verbatim: app.js:229-240 ────────────────────────────
   devicePixelRatio vem por parâmetro no lugar de window.     */
const canvasDprNow = (raw) => clamp(Number(raw) || 1, 0.5, 3);
const sizeChanged = (a, b) => Math.abs(a - b) > 0.05;
function setCanvasBitmap(cssW, cssH, dpr) {
  const bw = Math.max(1, Math.round(cssW * dpr));
  const bh = Math.max(1, Math.round(cssH * dpr));
  const sx = bw / cssW;
  const sy = bh / cssH;
  return { bw, bh, sx, sy };
}
const snapDeviceX = (x, waveScaleX) => Math.round(x * waveScaleX) / waveScaleX;

/* ── verbatim: app.js:443-455 ────────────────────────────*/
const viewDur = () => (state.meta.duration || 0) / state.zoom;
function clampView() {
  const d = state.meta.duration || 0;
  state.view = clamp(state.view, 0, Math.max(0, d - viewDur()));
}
const srcToX = (t) => ((t - state.view) / viewDur()) * CTX.W;
const xToSrc = (x) => state.view + (x / CTX.W) * viewDur();

/* ── verbatim: app.js:463 ────────────────────────────────*/
function niceStep(target) {
  const steps = [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
  for (const s of steps) if (s >= target) return s;
  return 3600;
}

/* ── verbatim: app.js:672 ────────────────────────────────*/
function presetLabel(v) {
  const u = cfg('rate.unit');
  if (u === 'mult') return (v / 100).toFixed(2).replace(/0$/, '');
  if (u === 'st') {
    const st = 12 * Math.log2(v / 100);
    return `${st > 0 ? '+' : st < 0 ? '\u2212' : ''}${Math.abs(st).toFixed(st % 1 ? 1 : 0)}`;
  }
  return String(+v.toFixed(1));
}

/* ── verbatim: app.js:682, só a parte de dados ───────────*/
function buildPresetsList() {
  return [...new Set(String(cfg('rate.presets'))
    .split(',')
    .map((s) => parseFloat(s.trim().replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n >= rateMin() && n <= rateMax()))]
    .slice(0, 8);
}

/* ── verbatim: app.js:709-716, só a parte de dados ───────*/
function rateMarksList(lo, hi) {
  const step = [5, 10, 25, 50, 100, 200, 400].find((n) => n >= (hi - lo) / 4) || 400;
  const marks = [lo];
  for (let v = Math.ceil(lo / step) * step; v < hi; v += step) {
    if (v - lo > step * 0.4 && hi - v > step * 0.4) marks.push(v);
  }
  marks.push(hi);
  return marks;
}

/* ── verbatim: app.js:793-800, sem DOM ───────────────────*/
function pointerSeekLogical(clientX, rectLeft, rectWidth) {
  const localCss = clamp(clientX - rectLeft, 0, rectWidth);
  return (localCss / rectWidth) * CTX.W;
}

/* ── verbatim: app.js:1170 ───────────────────────────────*/
const outSampleRate = () => {
  const v = cfg('export.sampleRate');
  return v === 'source' ? (state.meta.sampleRate || 44100) : parseInt(v, 10);
};

/* ── verbatim: app.js:1175 ───────────────────────────────
   `new Date()` trocado por CTX.now para o teste ser estável. */
function outName(sr) {
  const base = state.meta.name.replace(/\.[^.]+$/, '') || 'audio';
  const r = state.rate, st = 12 * Math.log2(r / 100);
  const dec = (n, d) => n.toFixed(d).replace('.', '-');
  const tokens = {
    nome: base,
    rate: dec(r, 1),
    mult: dec(r / 100, 2),
    st: `${st >= 0 ? '+' : '-'}${dec(Math.abs(st), 1)}`,
    sr: String(sr),
    data: (CTX.now || new Date()).toISOString().slice(0, 10),
  };
  let name = String(cfg('export.name')).replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? tokens[k] : m));
  name = name.replace(/[\\/:*?"<>|\n\r\t]+/g, '-').trim().replace(/[. ]+$/g, '');
  const stem = (name || base).replace(/[\\/:*?"<>|\n\r\t]+/g, '-').trim().replace(/[. ]+$/g, '') || 'audio';
  const chars = Array.from(stem);
  let safeStem = (chars.length > 176 ? chars.slice(0, 176).join('') : stem).replace(/[. ]+$/g, '') || 'audio';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safeStem)) safeStem = `_${safeStem}`;
  return `${safeStem}.wav`;
}

/* ── verbatim: app.js:1561 ───────────────────────────────*/
function fmtClock(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

module.exports = {
  CTX,
  clamp, fmtTime, rateText, rateSuffix, parseRate, fmtBytes,
  canvasDprNow, sizeChanged, setCanvasBitmap, snapDeviceX,
  viewDur, clampView, srcToX, xToSrc,
  niceStep, presetLabel, buildPresetsList, rateMarksList,
  pointerSeekLogical, outSampleRate, outName, fmtClock,
};
