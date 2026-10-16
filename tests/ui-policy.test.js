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
