'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ROOT_ID, FAVORITES_ID, tracks, graph } = require('../library-model');
const categories = [{ id: 'ambient', name: 'Atmosféricas' }, { id: 'empty', name: 'Silêncio' }];
const items = [
  { id: 'a', title: 'Música 10', byline: 'Ana', categoryId: 'ambient', favorite: true, duration: 180, createdAt: 1, lastOpenedAt: 30 },
  { id: 'b', title: 'Música 2', categoryId: '', favorite: false, duration: 60, createdAt: 3, lastOpenedAt: 10 },
  { id: 'c', title: 'Outra faixa', categoryId: 'ambient', favorite: false, duration: 120, createdAt: 2, lastOpenedAt: 20 },
];
test('graph contains categories only, including empty and favorite categories', () => {
  const data = graph(items, categories);
  assert.deepEqual(data.nodes.map(n => n.id), [ROOT_ID, FAVORITES_ID, 'ambient', 'empty']);
  assert.equal(data.nodes[0].countLabel, '3 músicas');
  assert.equal(data.nodes[1].countLabel, '1 música');
  assert.equal(data.nodes[2].countLabel, '2 músicas');
  assert.equal(data.nodes[3].countLabel, '0 músicas');
  assert.ok(data.nodes.every(n => n.isCategory));
  assert.ok(data.links.every(l => l.source === ROOT_ID && data.nodes.some(n => n.id === l.target)));
});
test('category nodes carry up to four distinct covers, newest first', () => {
  const art = [
    ...items,
    { id: 'd', title: 'D', categoryId: 'ambient', thumbnail: 'https://i/d.jpg', createdAt: 9 },
    { id: 'e', title: 'E', categoryId: 'ambient', thumbnail: 'https://i/d.jpg', createdAt: 8 },
    ...[4, 5, 6, 7].map((n) => ({ id: `t${n}`, title: `T${n}`, categoryId: '', thumbnail: `https://i/${n}.jpg`, createdAt: n })),
  ];
  const nodes = graph(art, categories).nodes;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n.covers]));
  assert.deepEqual(byId[ROOT_ID], ['https://i/d.jpg', 'https://i/7.jpg', 'https://i/6.jpg', 'https://i/5.jpg']);
  assert.deepEqual(byId.ambient, ['https://i/d.jpg']);
  assert.deepEqual(byId.empty, []);
});
test('all tracks remain in Biblioteca; favorites can overlap custom membership', () => {
  assert.equal(tracks(items, categories).length, 3);
  assert.deepEqual(tracks(items, categories, { categoryId: FAVORITES_ID }).map(n => n.id), ['a']);
  assert.equal(tracks(items, categories, { categoryId: 'ambient' }).length, 2);
  assert.equal(tracks(items, categories, { categoryId: 'empty' }).length, 0);
});
test('search handles Portuguese accents, category names, credits and favorites', () => {
  assert.equal(tracks(items, categories, { query: 'musica' }).length, 2);
  assert.equal(tracks(items, categories, { query: ' atmosfericas ' }).length, 2);
  assert.deepEqual(tracks(items, categories, { query: 'Ana' }).map(n => n.id), ['a']);
  assert.deepEqual(tracks(items, categories, { query: 'favoritas' }).map(n => n.id), ['a']);
  assert.equal(tracks(items, categories, { query: 'nothing' }).length, 0);
});
test('sorts are predictable and never mutate persisted ordering', () => {
  const snapshot = JSON.stringify(items);
  assert.deepEqual(tracks(items, categories, { sort: 'title' }).map(n => n.id), ['b', 'a', 'c']);
  assert.deepEqual(tracks(items, categories, { sort: 'duration' }).map(n => n.id), ['b', 'c', 'a']);
  assert.deepEqual(tracks(items, categories, { sort: 'played' }).map(n => n.id), ['a', 'c', 'b']);
  assert.deepEqual(tracks(items, categories).map(n => n.id), ['b', 'c', 'a']);
  assert.equal(JSON.stringify(items), snapshot);
});
test('empty libraries and filtered graphs retain a navigable root', () => {
  assert.equal(graph([], []).nodes.length, 2);
  const data = graph(items, categories, 'zzzz');
  assert.deepEqual(data.nodes.map(n => n.id), [ROOT_ID]);
  assert.equal(data.nodes[0].countLabel, '0 músicas');
  assert.equal(graph(items, categories, 'silencio').nodes.at(-1).id, 'empty');
});
