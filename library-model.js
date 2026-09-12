/* Biblioteca: projeções puras. A organização persistida não depende da UI. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LibraryModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ROOT_ID = 'category:library';
  const FAVORITES_ID = 'category:favorites';
  const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
  const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const belongs = (item, id) => id === ROOT_ID || (id === FAVORITES_ID ? Boolean(item.favorite) : item.categoryId === id);

  function tracks(items, categories, { categoryId = ROOT_ID, query = '', sort = 'recent' } = {}) {
    const names = new Map(categories.map((category) => [category.id, category.name]));
    const needle = fold(query).trim();
    return items.filter((item) => belongs(item, categoryId) && (!needle ||
      fold([item.title, item.byline, item.sourceLabel, names.get(item.categoryId), item.favorite ? 'Favoritas' : ''].join(' ')).includes(needle)))
      .sort((a, b) => {
        if (sort === 'title') return collator.compare(a.title, b.title) || collator.compare(a.id, b.id);
        if (sort === 'duration') return (a.duration || 0) - (b.duration || 0) || collator.compare(a.title, b.title);
        if (sort === 'played') return (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0) || collator.compare(a.title, b.title);
        return (b.createdAt || 0) - (a.createdAt || 0) || collator.compare(a.title, b.title);
      });
  }

  function graph(items, categories, query = '') {
    const visible = tracks(items, categories, { query });
    const needle = fold(query).trim();
    const groups = [
      { id: ROOT_ID, name: 'Biblioteca', fixed: true },
      { id: FAVORITES_ID, name: 'Favoritas', fixed: true },
      ...categories,
    ];
    const nodes = groups.filter((category) => category.id === ROOT_ID || !needle ||
      fold(category.name).includes(needle) || visible.some((item) => belongs(item, category.id)))
      .map((category) => {
        const count = visible.filter((item) => belongs(item, category.id)).length;
        return { ...category, title: category.name, label: category.name,
          countLabel: `${count} ${count === 1 ? 'MÚSICA' : 'MÚSICAS'}`,
          role: category.id === ROOT_ID ? 'root' : 'category', isCategory: true };
      });
    return { nodes, links: nodes.filter((node) => node.id !== ROOT_ID).map((node) => ({
      source: ROOT_ID, target: node.id, distance: 380, strength: 0.52, kind: 'hierarchy',
    })) };
  }
  return { ROOT_ID, FAVORITES_ID, belongs, tracks, graph };
});
