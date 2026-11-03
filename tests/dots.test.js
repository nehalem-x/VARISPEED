'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadDots() {
  const window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const context = {
    window,
    document: { addEventListener() {} },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    getComputedStyle: () => ({ color: '#000' }),
    Math,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dots.js'), 'utf8'), context);
  return window.Dots._shapes;
}

const shapes = loadDots();

test('rotação dupla mantém três pontos num anel de raio 1', () => {
  for (const t of [0, 0.4, 1.1, 2.7, 3.6]) {
    const dots = shapes.double.at(t);
    assert.equal(dots.length, 3);
    for (const p of dots) assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-9);
  }
});

test('rotação dupla gira nos dois eixos e fecha o ciclo em 3,67 s', () => {
  const cycle = 2 * (55 / 30);
  const a = shapes.double.at(0.3);
  const b = shapes.double.at(0.3 + cycle);
  a.forEach((p, i) => {
    assert.ok(Math.abs(p.x - b[i].x) < 1e-9 && Math.abs(p.y - b[i].y) < 1e-9 && Math.abs(p.z - b[i].z) < 1e-9);
  });
  const ys = Array.from({ length: 40 }, (_, k) => shapes.double.at((k * cycle) / 40)).flat().map((p) => p.y);
  assert.ok(Math.max(...ys) > 0.5 && Math.min(...ys) < -0.5);
  assert.equal(shapes.double.depth, true);
  assert.equal(shapes.grid.depth, false);
});
