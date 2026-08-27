'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildNetscapeFile,
  isYouTubeDomain,
  toNetscapeLine,
} = require('../tools/youtube-cookie-exporter/cookie-exporter-core.js');

test('aceita somente youtube.com e seus subdomínios', () => {
  assert.equal(isYouTubeDomain('youtube.com'), true);
  assert.equal(isYouTubeDomain('.youtube.com'), true);
  assert.equal(isYouTubeDomain('.music.youtube.com'), true);
  assert.equal(isYouTubeDomain('notyoutube.com'), false);
  assert.equal(isYouTubeDomain('.google.com'), false);
});

test('gera linha Netscape preservando HttpOnly sem ampliar o domínio', () => {
  const line = toNetscapeLine({
    domain: '.youtube.com',
    hostOnly: false,
    httpOnly: true,
    path: '/',
    secure: true,
    expirationDate: 1999999999.9,
    name: '__Secure-3PSID',
    value: 'valor-de-teste',
  });
  assert.equal(
    line,
    '#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t1999999999\t__Secure-3PSID\tvalor-de-teste',
  );
});

test('descarta cookies externos e reconhece sessão autenticada', () => {
  const result = buildNetscapeFile([
    { domain: '.google.com', name: 'SID', value: 'fora' },
    {
      domain: '.youtube.com', hostOnly: false, httpOnly: false, path: '/',
      secure: true, expirationDate: 1999999999, name: 'SAPISID', value: 'dentro',
    },
  ]);
  assert.equal(result.count, 1);
  assert.equal(result.authenticated, true);
  assert.match(result.text, /^# Netscape HTTP Cookie File/m);
  assert.match(result.text, /\.youtube\.com/);
  assert.doesNotMatch(result.text, /google\.com|fora/);
});

test('rejeita campos que quebrariam o formato Netscape', () => {
  assert.throws(() => toNetscapeLine({
    domain: '.youtube.com', hostOnly: false, httpOnly: false, path: '/',
    secure: true, name: 'SID', value: 'linha\nmaliciosa',
  }), /Cookie inválido/);
});

test('manifesto e scripts mantêm a superfície de acesso mínima', () => {
  const root = path.join(__dirname, '..', 'tools', 'youtube-cookie-exporter');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const scripts = [
    fs.readFileSync(path.join(root, 'popup.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'cookie-exporter-core.js'), 'utf8'),
  ].join('\n');

  assert.deepEqual(manifest.permissions, ['cookies']);
  assert.deepEqual(manifest.optional_host_permissions, ['https://*.youtube.com/*']);
  assert.equal(manifest.incognito, 'split');
  assert.equal('background' in manifest, false);
  assert.equal('content_scripts' in manifest, false);
  assert.doesNotMatch(scripts, /\bfetch\s*\(|XMLHttpRequest|WebSocket|chrome\.storage|eval\s*\(/);
  assert.match(scripts, /getAll\(\{ domain: 'youtube\.com' \}\)/);
});
