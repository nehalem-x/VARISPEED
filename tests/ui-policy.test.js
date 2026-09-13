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

test('focus is represented inside controls and track artwork extends into rows', () => {
  const css = read('styles.css');
  const outlineValues = [...css.matchAll(/\boutline\s*:\s*([^;]+);/g)].map((match) => match[1].trim());
  assert.ok(outlineValues.every((value) => value === 'none' || value === '0'), outlineValues.join(', '));
  assert.match(css, /\.btn:focus-visible,[\s\S]*?border-width:\s*2px;/);
  assert.match(css, /\.library__track-wash\s*\{/);
  assert.match(css, /mask-image:\s*linear-gradient/);
});
