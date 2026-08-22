/* ═════════════════════════════════════════════════════════
   Suíte do core puro — `node --test tests/`
   ─────────────────────────────────────────────────────────
   Dois tipos de teste, com propósitos diferentes:

   1. EQUIVALÊNCIA — compara core.js contra
      tests/legacy-snapshot.js (cópia literal do app.js atual)
      sobre uma malha grande de entradas. Protege a extração:
      se o core divergir do comportamento em produção, falha.

   2. CONTRATO — afirma as regras que o produto precisa manter
      independentemente da implementação (round-trip de
      velocidade, limites de nome de arquivo, erro máximo do
      backing store). Estes continuam válidos mesmo depois de
      o snapshot legado ser removido.

   Zero dependência externa: node:test e node:assert.
   ═════════════════════════════════════════════════════════ */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Core = require('../core.js');
const L = require('./legacy-snapshot.js');

/* ── malhas de entrada ───────────────────────────────────*/
const UNITS = ['pct', 'mult', 'st'];
const FORMATS = ['mmss', 'sec', 'samples'];

const TIMES = [
  0, 0.001, 0.005, 0.01, 0.5, 0.999, 1, 1.005, 9.994, 9.996,
  59.99, 59.994, 59.995, 59.999, 60, 60.001, 61.5, 119.999,
  599.99, 3599.994, 3599.999, 3600, 3600.5, 7261.239, 86399.99,
  -0.0001, -1, -1e6, NaN, Infinity, -Infinity, 1e6,
];

const RATES = [
  5, 12.5, 25, 33.3, 50, 66.7, 75, 87.5, 99.9, 100, 100.1,
  125, 133.4, 150, 175, 200, 250, 300, 400, 425.5, 600, 800,
];

const BYTES = [
  0, 1, 2, 512, 1023, 1024, 1025, 1536, 1048575, 1048576,
  1572864, 1073741823, 1073741824, 1e9, 1e12, 1e15,
];

const DPRS = [0, 0.3, 0.5, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2, 2.25, 3, 4, 5, NaN];
const CSS_SIZES = [0.6, 1, 1.4, 17.5, 320, 359.33, 640.5, 1000.4, 1366.66, 1439.2, 1919.5, 3839.04];

const NAMES = [
  '', 'audio', 'faixa.mp3', 'faixa.final.wav', 'CON', 'con.mp3', 'nul', 'prn.flac',
  'com1', 'lpt9', 'aux', 'com0', 'console', 'a/b\\c:d*e?f"g<h>i|j', 'nome\tcom\ttab',
  'termina com ponto...', 'termina com espaco   ', '   comeca com espaco',
  'ç ã é ü ñ', '日本語のタイトル', 'emoji 🎧 na faixa', '...', '   ', '.',
  'x'.repeat(500), 'ção'.repeat(120), '🎧'.repeat(200),
];

const TEMPLATES = [
  '{nome}_{rate}pct', '{nome}', '{rate}', '{mult}x', '{st}st', '{sr}Hz', '{data}',
  '{nome}_{rate}_{mult}_{st}_{sr}_{data}', '{desconhecido}', '{}', 'literal',
  '', '{nome}/{rate}', '{nome}:{rate}', '..', '{nome}.', 'con', '{nome}{nome}{nome}',
];

const PRESET_STRINGS = [
  '50, 75, 100, 125, 150, 200',
  '50,75,100,125,150,200,250,300,400,600',
  '100,100,100,50',
  '1,5',
  '  50 ,  100  ,  200  ',
  'abc, 100, def',
  '',
  '0, 5, 1000, 100',
  '99.5, 100.5',
  '-50, 100',
  'NaN, Infinity, 100',
  '100.000001, 100',
];

/* NaN precisa comparar igual a NaN nestes testes. */
const sameNum = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || Object.is(a, b);
const numMsg = (label, input, got, want) =>
  `${label} divergiu para ${JSON.stringify(input)}: core=${got} legado=${want}`;

/* ═══════════════════════════════════════════════════════
   1. EQUIVALÊNCIA COM O CÓDIGO ATUAL
   ═══════════════════════════════════════════════════════ */

test('fmtTime é equivalente ao legado em todos os formatos', () => {
  for (const format of FORMATS) {
    for (const sampleRate of [0, 8000, 44100, 48000, 96000]) {
      L.CTX.settings['tl.format'] = format;
      L.CTX.state.meta.sampleRate = sampleRate;
      for (const t of TIMES) {
        assert.equal(
          Core.fmtTime(t, { format, sampleRate }),
          L.fmtTime(t),
          `fmtTime(${t}) formato=${format} sr=${sampleRate}`,
        );
      }
    }
  }
});

test('fmtClock é equivalente ao legado em toda entrada finita', () => {
  const inputs = [...TIMES, null, undefined, '90', '', 3661, 36000, 359999]
    .filter((s) => Number.isFinite(Number(s)) || s === '' || s == null || Number.isNaN(Number(s)));
  for (const s of inputs) {
    assert.equal(Core.fmtClock(s), L.fmtClock(s), `fmtClock(${s})`);
  }
});

test('DIVERGÊNCIA · fmtClock filtra Infinity, o legado não', () => {
  /* Endurecimento deliberado. Se este teste falhar, ou o core
     regrediu ou o app.js foi corrigido e o snapshot legado
     precisa ser atualizado. */
  assert.equal(L.fmtClock(Infinity), 'Infinity:NaN:NaN', 'legado mudou de comportamento');
  assert.equal(Core.fmtClock(Infinity), '0:00');
  assert.equal(Core.fmtClock(-Infinity), '0:00');
});

test('fmtBytes é equivalente ao legado', () => {
  for (const b of BYTES) {
    assert.equal(Core.fmtBytes(b), L.fmtBytes(b), `fmtBytes(${b})`);
  }
});

test('rateText, rateSuffix e presetLabel são equivalentes ao legado', () => {
  for (const unit of UNITS) {
    L.CTX.settings['rate.unit'] = unit;
    assert.equal(Core.rateSuffix(unit), L.rateSuffix(), `rateSuffix ${unit}`);
    for (const v of RATES) {
      assert.equal(Core.rateText(v, unit), L.rateText(v), `rateText(${v}) ${unit}`);
      assert.equal(Core.presetLabel(v, unit), L.presetLabel(v), `presetLabel(${v}) ${unit}`);
    }
  }
});

test('parseRate é equivalente ao legado, incluindo entrada suja', () => {
  const raw = [
    '100', '100.5', '100,5', '1.5', '\u22123', '-3', '+3', '  200  ',
    'abc', '', '1e2', '0', '.5', '12,5%', '2x', 'NaN', '1.2.3',
  ];
  for (const unit of UNITS) {
    L.CTX.settings['rate.unit'] = unit;
    for (const txt of raw) {
      const got = Core.parseRate(txt, unit);
      const want = L.parseRate(txt);
      assert.ok(sameNum(got, want), numMsg(`parseRate ${unit}`, txt, got, want));
    }
  }
});

test('niceStep é equivalente ao legado', () => {
  const targets = [0, 0.001, 0.01, 0.011, 0.02, 0.049, 0.05, 0.1, 0.26, 1, 1.1,
    5, 5.1, 60, 61, 300, 1801, 3600, 3601, 1e6, -1];
  for (const t of targets) {
    assert.equal(Core.niceStep(t), L.niceStep(t), `niceStep(${t})`);
  }
});

test('parsePresets é equivalente ao legado', () => {
  for (const raw of PRESET_STRINGS) {
    for (const [min, max] of [[25, 400], [5, 800], [50, 150], [100, 100]]) {
      L.CTX.settings['rate.presets'] = raw;
      L.CTX.settings['rate.min'] = min;
      L.CTX.settings['rate.max'] = max;
      assert.deepEqual(
        Core.parsePresets(raw, min, max),
        L.buildPresetsList(),
        `parsePresets(${JSON.stringify(raw)}) faixa=${min}..${max}`,
      );
    }
  }
});

test('rateMarks é equivalente ao legado', () => {
  const pairs = [[25, 400], [5, 800], [50, 150], [100, 400], [25, 100],
    [5, 100], [150, 800], [95, 105], [25, 425]];
  for (const [lo, hi] of pairs) {
    assert.deepEqual(Core.rateMarks(lo, hi), L.rateMarksList(lo, hi), `rateMarks(${lo},${hi})`);
  }
});

test('dprClamp e sizeChanged são equivalentes ao legado', () => {
  for (const raw of DPRS) {
    assert.ok(sameNum(Core.dprClamp(raw), L.canvasDprNow(raw)), `dprClamp(${raw})`);
  }
  const pairs = [[0, 0], [1, 1], [1, 1.04], [1, 1.06], [1000.4, 1000.44],
    [1000.4, 1000.5], [1919.5, 1919.5]];
  for (const [a, b] of pairs) {
    assert.equal(Core.sizeChanged(a, b), L.sizeChanged(a, b), `sizeChanged(${a},${b})`);
  }
});

test('canvasScale é equivalente ao legado em toda a matriz DPR × CSS', () => {
  for (const rawDpr of DPRS) {
    const dpr = Core.dprClamp(rawDpr);
    for (const w of CSS_SIZES) {
      for (const h of [0.6, 40, 120.25, 300.75]) {
        const got = Core.canvasScale(w, h, dpr);
        const want = L.setCanvasBitmap(w, h, dpr);
        assert.deepEqual(got, want, `canvasScale(${w},${h},${dpr})`);
      }
    }
  }
});

test('snapToDevice é equivalente ao legado', () => {
  for (const scale of [0.5, 0.8, 1, 1.0003, 1.25, 1.5, 2, 3]) {
    for (const x of [0, 0.4, 1, 17.3, 500.5, 999.99, 1919.5]) {
      assert.equal(Core.snapToDevice(x, scale), L.snapDeviceX(x, scale), `snapToDevice(${x},${scale})`);
    }
  }
});

test('pointerToLogical é equivalente ao legado, inclusive fora das bordas', () => {
  const rects = [[0, 1000], [12.5, 987.5], [100, 640.5], [0, 1919.5]];
  for (const [left, width] of rects) {
    for (const W of [640, 1000, 1366.66, 1919.5]) {
      L.CTX.W = W;
      for (const clientX of [-50, left - 1, left, left + 1, left + width / 2,
        left + width - 1, left + width, left + width + 50]) {
        assert.equal(
          Core.pointerToLogical(clientX, left, width, W),
          L.pointerSeekLogical(clientX, left, width),
          `pointerToLogical(${clientX}) rect=${left}/${width} W=${W}`,
        );
      }
    }
  }
});

test('srcToX, xToSrc e clampView são equivalentes ao legado', () => {
  for (const duration of [0, 1, 12.5, 180, 3600]) {
    for (const zoom of [1, 1.5, 4, 16, 64]) {
      for (const view of [-5, 0, 1.25, 60, 3600]) {
        const viewDur = Core.viewDuration(duration, zoom);
        L.CTX.state.meta.duration = duration;
        L.CTX.state.zoom = zoom;
        L.CTX.state.view = view;
        L.CTX.W = 1000;

        assert.ok(sameNum(viewDur, L.viewDur()), `viewDuration(${duration},${zoom})`);
        for (const t of [0, 1, 60, 3600]) {
          assert.ok(
            sameNum(Core.srcToX(t, view, viewDur, 1000), L.srcToX(t)),
            `srcToX(${t}) d=${duration} z=${zoom} v=${view}`,
          );
        }
        for (const x of [0, 250, 999.5]) {
          assert.ok(
            sameNum(Core.xToSrc(x, view, viewDur, 1000), L.xToSrc(x)),
            `xToSrc(${x}) d=${duration} z=${zoom} v=${view}`,
          );
        }
        L.clampView();
        assert.ok(
          sameNum(Core.clampView(view, duration, viewDur), L.CTX.state.view),
          `clampView d=${duration} z=${zoom} v=${view}`,
        );
      }
    }
  }
});

test('outSampleRate é equivalente ao legado', () => {
  for (const setting of ['source', '44100', '48000', '96000']) {
    for (const sourceRate of [0, 22050, 44100, 48000, 96000]) {
      L.CTX.settings['export.sampleRate'] = setting;
      L.CTX.state.meta.sampleRate = sourceRate;
      assert.equal(Core.outSampleRate(setting, sourceRate), L.outSampleRate(),
        `outSampleRate(${setting}, ${sourceRate})`);
    }
  }
});

test('outName é equivalente ao legado em nomes, templates e velocidades extremos', () => {
  const date = new Date('2026-08-22T14:27:00.000Z');
  L.CTX.now = date;
  let combos = 0;
  for (const name of NAMES) {
    for (const template of TEMPLATES) {
      for (const rate of [25, 100, 137.5, 400, 800]) {
        const sr = 48000;
        L.CTX.state.meta.name = name;
        L.CTX.state.rate = rate;
        L.CTX.settings['export.name'] = template;

        assert.equal(
          Core.outName(template, { name, rate, sampleRate: sr, date }),
          L.outName(sr),
          `outName nome=${JSON.stringify(name.slice(0, 40))} tpl=${JSON.stringify(template)} rate=${rate}`,
        );
        combos++;
      }
    }
  }
  assert.ok(combos > 1000, `cobertura insuficiente: ${combos} combinações`);
});

/* ═══════════════════════════════════════════════════════
   2. CONTRATO DE PRODUTO
   ═══════════════════════════════════════════════════════ */

test('CONTRATO · velocidade sobrevive ao round-trip texto → número', () => {
  /* O usuário digita na unidade exibida e o app converte de
     volta para porcentagem. A ida e volta não pode derivar. */
  for (const unit of UNITS) {
    for (const v of RATES) {
      const back = Core.parseRate(Core.rateText(v, unit), unit);
      /* Em semitons o arredondamento é logarítmico: 0.005 st
         vale ~0.029% da velocidade, então a tolerância tem de
         ser relativa, não absoluta. */
      const tol = unit === 'st' ? v * 0.0005 : 0.05;
      assert.ok(
        Math.abs(back - v) < tol,
        `round-trip ${unit}: ${v} → "${Core.rateText(v, unit)}" → ${back}`,
      );
    }
  }
});

test('CONTRATO · 100% é exatamente neutro em todas as unidades', () => {
  assert.equal(Core.rateText(100, 'pct'), '100.0');
  assert.equal(Core.rateText(100, 'mult'), '1.000');
  assert.equal(Core.rateText(100, 'st'), '+0.00');
  assert.equal(Core.presetLabel(100, 'st'), '0');
  for (const unit of UNITS) {
    assert.equal(Core.parseRate(Core.rateText(100, unit), unit), 100, `neutro em ${unit}`);
  }
});

test('CONTRATO · semitons usam o sinal tipográfico, não hífen', () => {
  /* A UI usa U+2212; o parser precisa aceitar de volta. */
  const txt = Core.rateText(50, 'st');
  assert.ok(txt.startsWith(Core.MINUS), `esperado U+2212 em "${txt}"`);
  assert.ok(!txt.includes('-'), `hífen ASCII não deveria aparecer em "${txt}"`);
  assert.ok(Math.abs(Core.parseRate(txt, 'st') - 50) < 0.02);
});

test('CONTRATO · xToSrc e srcToX são inversos', () => {
  for (const duration of [12.5, 180, 3600]) {
    for (const zoom of [1, 4, 64]) {
      const viewDur = Core.viewDuration(duration, zoom);
      const view = Core.clampView(duration / 3, duration, viewDur);
      for (const W of [640, 1000, 1366.66, 1919.5]) {
        for (const x of [0, W / 3, W / 2, W - 0.5]) {
          const back = Core.srcToX(Core.xToSrc(x, view, viewDur, W), view, viewDur, W);
          assert.ok(Math.abs(back - x) < 1e-6, `inverso falhou x=${x} W=${W} z=${zoom}`);
        }
      }
    }
  }
});

test('CONTRATO · clampView nunca deixa a janela passar do fim da mídia', () => {
  for (const duration of [0, 1, 12.5, 180, 3600]) {
    for (const zoom of [1, 1.5, 4, 64]) {
      const viewDur = Core.viewDuration(duration, zoom);
      for (const view of [-100, 0, duration / 2, duration, duration * 2]) {
        const v = Core.clampView(view, duration, viewDur);
        assert.ok(v >= 0, `view negativa: ${v}`);
        assert.ok(v <= Math.max(0, duration - viewDur) + 1e-9, `view além do fim: ${v}`);
      }
    }
  }
});

test('CONTRATO · backing store erra no máximo meio device pixel', () => {
  /* Invariante declarado no HANDOFF (REV 6). */
  for (const rawDpr of DPRS) {
    const dpr = Core.dprClamp(rawDpr);
    for (const cssW of CSS_SIZES) {
      const { bw, sx } = Core.canvasScale(cssW, 40, dpr);
      assert.ok(Number.isInteger(bw), `bitmap fracionário: ${bw}`);
      assert.ok(bw >= 1, `bitmap menor que 1: ${bw}`);
      if (cssW * dpr >= 1) {
        assert.ok(
          Math.abs(bw - cssW * dpr) <= 0.5,
          `erro de ${Math.abs(bw - cssW * dpr)} device px em css=${cssW} dpr=${dpr}`,
        );
      }
      assert.ok(sx > 0 && Number.isFinite(sx), `escala inválida: ${sx}`);
    }
  }
});

test('CONTRATO · DPR fica dentro de 0.5–3 mesmo com entrada absurda', () => {
  for (const raw of [...DPRS, -1, 1e9, 'abc', null, undefined, Infinity]) {
    const d = Core.dprClamp(raw);
    assert.ok(d >= Core.DPR_MIN && d <= Core.DPR_MAX, `dprClamp(${raw}) = ${d}`);
    assert.ok(Number.isFinite(d), `dprClamp(${raw}) não é finito`);
  }
});

test('CONTRATO · nome exportado é sempre um arquivo .wav válido no Windows', () => {
  const date = new Date('2026-08-22T14:27:00.000Z');
  for (const name of NAMES) {
    for (const template of TEMPLATES) {
      const file = Core.outName(template, { name, rate: 137.5, sampleRate: 48000, date });
      const stem = file.slice(0, -4);

      assert.ok(file.endsWith('.wav'), `sem extensão: ${file}`);
      assert.ok(stem.length > 0, `stem vazio para nome=${JSON.stringify(name)}`);
      assert.ok(!/[\\/:*?"<>|\n\r\t]/.test(stem), `caractere ilegal em ${JSON.stringify(stem)}`);
      assert.ok(!/[. ]$/.test(stem), `termina com ponto/espaço: ${JSON.stringify(stem)}`);
      assert.ok(!/^\s/.test(stem), `começa com espaço: ${JSON.stringify(stem)}`);
      assert.ok(
        !Core.RESERVED_WIN.test(stem),
        `nome reservado do Windows não escapado: ${JSON.stringify(stem)}`,
      );
      assert.ok(
        Array.from(stem).length <= Core.STEM_MAX + 1,
        `stem longo demais (${Array.from(stem).length}) para ${JSON.stringify(name.slice(0, 30))}`,
      );
    }
  }
});

test('CONTRATO · truncamento não parte caractere multibyte', () => {
  const date = new Date('2026-08-22T14:27:00.000Z');
  for (const name of ['🎧'.repeat(300), 'ção'.repeat(200), '日本語'.repeat(200)]) {
    const file = Core.outName('{nome}', { name, rate: 100, sampleRate: 48000, date });
    const stem = file.slice(0, -4);
    /* Array.from itera por code point: nenhum surrogate órfão. */
    assert.ok(!/[\uD800-\uDFFF]/.test(stem.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')),
      `surrogate órfão em ${JSON.stringify(stem.slice(-8))}`);
    assert.equal(stem, Array.from(stem).join(''), 'stem não é sequência válida de code points');
  }
});

test('CONTRATO · nomes reservados do Windows recebem prefixo', () => {
  const date = new Date('2026-08-22T14:27:00.000Z');
  const ctx = { rate: 100, sampleRate: 48000, date };
  for (const reserved of ['con', 'CON', 'Con', 'nul', 'prn', 'aux', 'com1', 'com9', 'lpt1', 'lpt9']) {
    const file = Core.outName('{nome}', Object.assign({ name: reserved }, ctx));
    assert.equal(file, `_${reserved}.wav`, `reservado não escapado: ${file}`);
  }
  /* Fora da lista: não deve ganhar prefixo. */
  for (const ok of ['com0', 'com10', 'console', 'nulo', 'lpt', 'auxiliar']) {
    const file = Core.outName('{nome}', Object.assign({ name: ok }, ctx));
    assert.equal(file, `${ok}.wav`, `prefixo indevido: ${file}`);
  }
});

test('CONTRATO · presets respeitam faixa, unicidade e teto de 8', () => {
  const out = Core.parsePresets('50,75,100,125,150,200,250,300,400,600,50', 25, 400);
  assert.equal(out.length, 8, `teto de 8 não aplicado: ${out.length}`);
  assert.equal(new Set(out).size, out.length, 'duplicatas passaram');
  for (const v of out) {
    assert.ok(v >= 25 && v <= 400, `fora da faixa: ${v}`);
    assert.ok(Number.isFinite(v), `valor não finito: ${v}`);
  }
  assert.deepEqual(Core.parsePresets('abc,,NaN,Infinity,-5', 25, 400), [],
    'entrada inválida deveria resultar em lista vazia');
  assert.deepEqual(Core.parsePresets('', 25, 400), [], 'string vazia deveria resultar em lista vazia');
});

test('CONTRATO · presets tratam vírgula como separador, não decimal', () => {
  /* Comportamento conhecido e preservado: o campo é uma lista
     separada por vírgula, então "1,5" são dois valores. Se este
     teste falhar, a mudança foi deliberada e o HANDOFF precisa
     ser atualizado junto. */
  assert.deepEqual(Core.parsePresets('50,5', 5, 400), [50, 5]);
  assert.deepEqual(Core.parsePresets('99.5', 5, 400), [99.5], 'ponto decimal deve funcionar');
});

test('CONTRATO · marcas do trilho começam no mínimo e terminam no máximo', () => {
  for (const [lo, hi] of [[25, 400], [5, 800], [50, 150], [95, 105]]) {
    const marks = Core.rateMarks(lo, hi);
    assert.equal(marks[0], lo, `primeira marca != mínimo em ${lo}..${hi}`);
    assert.equal(marks[marks.length - 1], hi, `última marca != máximo em ${lo}..${hi}`);
    for (let i = 1; i < marks.length; i++) {
      assert.ok(marks[i] > marks[i - 1], `marcas fora de ordem em ${lo}..${hi}: ${marks}`);
    }
    for (const m of marks) {
      const pos = Core.markOffset(m, lo, hi);
      assert.ok(pos >= 0 && pos <= 100, `marca fora do trilho: ${pos}%`);
    }
  }
});

test('CONTRATO · tempo negativo, NaN e Infinity nunca vazam para a UI', () => {
  for (const format of FORMATS) {
    for (const bad of [-1, -1e9, NaN, Infinity, -Infinity]) {
      const out = Core.fmtTime(bad, { format, sampleRate: 48000 });
      assert.ok(!/NaN|Infinity|-/.test(out), `fmtTime(${bad}) formato=${format} → "${out}"`);
    }
  }
  for (const bad of [NaN, Infinity, -1, null, undefined, 'x']) {
    const out = Core.fmtClock(bad);
    assert.ok(!/NaN|Infinity|-/.test(out), `fmtClock(${bad}) → "${out}"`);
  }
});

test('CONTRATO · fmtTime em mmss zera-preenche os segundos', () => {
  assert.equal(Core.fmtTime(0, {}), '0:00.00');
  assert.equal(Core.fmtTime(5.5, {}), '0:05.50');
  assert.equal(Core.fmtTime(65.25, {}), '1:05.25');
  assert.equal(Core.fmtTime(3600, {}), '60:00.00');
  assert.equal(Core.fmtTime(7261.239, {}), '121:01.24');
});

test('CONTRATO · fmtBytes usa o marcador de ausência quando não há tamanho', () => {
  assert.equal(Core.fmtBytes(0), Core.DASH);
  assert.equal(Core.fmtBytes(undefined), Core.DASH);
  assert.equal(Core.fmtBytes(1024), '1.0 KB');
  assert.equal(Core.fmtBytes(512), '512 B');
  /* Não estoura a tabela de unidades em valores absurdos. */
  assert.ok(Core.fmtBytes(1e18).endsWith('GB'), Core.fmtBytes(1e18));
});

test('CONTRATO · sanitizeStem é idempotente', () => {
  for (const name of NAMES) {
    const once = Core.sanitizeStem(name, 'audio');
    const twice = Core.sanitizeStem(once, 'audio');
    assert.equal(twice, once, `não idempotente para ${JSON.stringify(name.slice(0, 30))}`);
  }
});

test('CONTRATO · niceStep sempre cobre o alvo e é monotônico', () => {
  let prev = 0;
  for (const t of [0.001, 0.01, 0.05, 0.2, 0.6, 3, 7, 45, 200, 1200, 4000]) {
    const s = Core.niceStep(t);
    assert.ok(s >= Math.min(t, 3600), `niceStep(${t}) = ${s} não cobre o alvo`);
    assert.ok(s >= prev, `niceStep não monotônico em ${t}`);
    prev = s;
  }
});
