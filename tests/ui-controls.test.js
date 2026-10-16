'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const Core = require('../core.js');

// Executa os eventos reais do campo com o áudio substituído por estado controlado.
const app = readFileSync(join(__dirname, '../app.js'), 'utf8');
const start = app.indexOf('  const rateStep =');
const end = app.indexOf('  function bindRateStep', start);
assert.ok(start >= 0 && end > start, 'Tratadores de velocidade ausentes');
function harness(unit = 'pct') {
  const element = () => ({ value: '', hidden: true, textContent: '', attributes: new Map(), events: {},
    setAttribute(k, v) { this.attributes.set(k, v); }, removeAttribute(k) { this.attributes.delete(k); },
    addEventListener(k, fn) { this.events[k] = fn; } });
  const el = { rateInput: element(), rateSlider: element(), rateError: element() };
  const state = { rate: 100 };
  let blurred = false;
  el.rateInput.blur = () => { blurred = true; el.rateInput.events.blur(); };
  const context = { el, state, cfg: () => 1, rateMin: () => 25, rateMax: () => 400,
    parseRate: text => Core.parseRate(text, unit), rateText: value => Core.rateText(value, unit),
    rateSuffix: () => unit === 'pct' ? '%' : unit === 'mult' ? '×' : 'st',
    setRate(value, opts = {}) {
      state.rate = value;
      if (!opts.fromInput) { el.rateInput.value = Core.rateText(value, unit); context.clearRateError(); }
    } };
  vm.runInNewContext(app.slice(start, end), context);
  return { el, state, blurred: () => blurred, input(value) { el.rateInput.value = value; el.rateInput.events.input(); },
    commit() { el.rateInput.events.blur(); }, enter() { el.rateInput.events.keydown({ key: 'Enter', preventDefault() {} }); } };
}

test('Valor inválido permanece editável sem alterar a última velocidade válida', () => {
  const h = harness(); h.input('75'); h.input('abc'); h.commit();
  assert.equal(h.state.rate, 75);
  assert.equal(h.el.rateInput.value, 'abc');
  assert.equal(h.el.rateInput.attributes.get('aria-invalid'), 'true');
  assert.equal(h.el.rateError.hidden, false);
  assert.match(h.el.rateError.textContent, /25.*%.*400.*%/);
  h.enter(); assert.equal(h.blurred(), false);
});

test('Correção limpa o erro e confirma o valor com vírgula decimal', () => {
  const h = harness(); h.input('900'); h.commit(); h.input('125,5'); h.enter();
  assert.equal(h.state.rate, 125.5);
  assert.equal(h.el.rateInput.attributes.has('aria-invalid'), false);
  assert.equal(h.el.rateError.hidden, true);
  assert.equal(h.blurred(), true);
});

test('Limites e mensagem acompanham multiplicador e semitons', () => {
  const mult = harness('mult'); mult.input('5'); mult.commit();
  assert.equal(mult.state.rate, 100); assert.match(mult.el.rateError.textContent, /0\.25.*×.*4\.00.*×/);
  mult.input('1,5'); mult.enter(); assert.equal(mult.state.rate, 150);
  const st = harness('st'); st.input('30'); st.commit();
  assert.equal(st.state.rate, 100); assert.match(st.el.rateError.textContent, /24.*st.*24.*st/);
  st.input('−12'); st.enter(); assert.equal(st.state.rate, 50);
});
