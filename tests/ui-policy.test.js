'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('pointer actions release focus without changing keyboard activation', () => {
  const app = read('app.js');
  assert.match(app, /if \(e\.detail === 0[^\n]+return;/);
  assert.match(app, /'\[role="option"\]'/);
  assert.match(app, /active\.matches\(actionSelector\)/);
  assert.match(app, /active\.blur\(\)/);
  assert.doesNotMatch(app, /getAttribute\('role'\) === 'option'/);
});

test('Space on a library option is contained and never opens the track', () => {
  const library = read('library.js');
  assert.match(library, /event\.key === ' '\) \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);/);
});

test('confirmações usam o modal do app, nunca as janelas do navegador', () => {
  // A janela do navegador só aparece no bloco de reserva, para quando modal.js não carrega.
  const outsideFallback = (src) => src.replace(/\/\* fallback-start \*\/[\s\S]*?\/\* fallback-end \*\//g, '');
  for (const name of ['app.js', 'library.js', 'settings.js', 'remote-import.js']) {
    const src = outsideFallback(read(name));
    assert.doesNotMatch(src, /(?:^|[^.\w])(?:window\.)?(?:confirm|alert|prompt)\(/m, name);
    // Sem modal.js os botões não podem quebrar: nada chama window.Modal fora da reserva.
    assert.doesNotMatch(src, /window\.Modal\./, name);
  }
  const css = read('styles.css');
  assert.match(css, /\.modal-layer\[data-state='enter'\]/);
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\.modal-layer/);
});

test('transições cinematográficas usam os mesmos tokens e respeitam reduzir movimento', () => {
  const css = read('styles.css');
  for (const token of ['--ease-cine:', '--dur-cine-fade:', '--dur-cine-move:', '--dur-cine-settle:', '--dur-cine-exit:', '--cine-stagger:']) {
    assert.ok(css.includes(token), token);
  }
  assert.match(css, /\.modal-layer\[data-state\] > \.modal,[^{]*\{\s*transition:\s*opacity var\(--dur-cine-fade\) var\(--ease-cine\)/);
  const motion = read('motion.js');
  assert.match(motion, /function spring\(/);
  assert.match(motion, /if \(reduced\(\)\) \{ cancelAnimationFrame\(raf\); finish\(\); return; \}/);
  const app = read('app.js');
  assert.match(app, /window\.Motion\.spring\(/);
  assert.match(app, /if \(window\.Motion\.reduced\(\)\) \{\s*focusSpring\?\.stop\(\);/);
});

test('Biblioteca nunca apaga áudio guardado só porque a lista não o conhece', () => {
  const library = read('library.js');
  // A carga recupera a música a partir do registro do áudio, em vez de apagar órfãos.
  assert.doesNotMatch(library, /deleteStoredMedia\(orphans\)/);
  assert.match(library, /item: \{ \.\.\.item \}/);
  // Gravar mantém músicas salvas por outra aba e só deixa sumir as removidas de propósito.
  assert.match(library, /!known\.has\(item\.id\) && !removedIds\.has\(item\.id\)/);
});

test('keyboard focus stays in controls without external outlines or changing geometry', () => {
  const css = read('styles.css');
  // Match CSS declarations rather than a selector such as .btn--outline:focus-visible.
  const outlines = [...css.matchAll(/(?:^|[;{])\s*outline\s*:\s*([^;}]+);/g)].map(match => match[1].trim());
  assert.ok(outlines.every(value => value === 'none' || value === '0'));
  assert.match(css, /\.txt:focus-visible\s*\{\s*border-color:\s*var\(--focus\);/);
  assert.doesNotMatch(css, /[^{}]*:focus(?:-visible|\b)[^{}]*\{[^{}]*border(?:-bottom)?-width:\s*2px;/);
  assert.match(css, /\.library__track:focus-visible\s*\{\s*outline:\s*0;\s*border-left-color:\s*var\(--focus\);/);
  assert.match(css, /\.library__track-wash\s*\{/);
  assert.match(css, /mask-image:\s*linear-gradient/);
});
