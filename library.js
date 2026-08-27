/* ═════════════════════════════════════════════════════════
   VARISPEED — biblioteca visual de mídias
   Metadados ficam no localStorage e os bytes de áudio no IndexedDB. Na
   inicialização, apenas entradas que ainda possuem uma fonte válida voltam
   ao grafo.
   ═════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const KEY = 'varispeed.library.v1';
  const CATEGORY_KEY = 'varispeed.library.categories.v1';
  const TUTORIAL_KEY = 'varispeed.library.tutorial.v1';
  const DB_NAME = 'varispeed.media.v1';
  const DB_STORE = 'audio';
  const LIMIT = 200;
  const CATEGORY_LIMIT = 64;
  const ROOT_ID = 'category:library';
  const FAVORITES_ID = 'category:favorites';
  const CATEGORY_LINK_DISTANCE = 520;
  const CATEGORY_LINK_STRENGTH = 0.52;
  const TRACK_LINK_DISTANCE = 198;
  const TRACK_LINK_STRENGTH = 0.44;
  const SELECTED_NODE_ZOOM = 1.35;
  const TUTORIAL_EXIT_MS = 420;
  const TUTORIAL_STEPS = Object.freeze([
    {
      kicker: 'A memória da sua escuta',
      title: 'Sua biblioteca deixa rastros.',
      body: 'Isto não é apenas uma lista. Cada música adicionada ocupa um lugar em um mapa que pertence somente a você.',
      signal: 'UM ARQUIVO · UM PRIMEIRO PONTO',
    },
    {
      kicker: 'Cada música é um nó',
      title: 'Ouvir também é construir.',
      body: 'Ao importar uma faixa, nasce um novo nó. Aos poucos, suas escolhas deixam de ser arquivos isolados e começam a formar uma memória visual.',
      signal: 'MÚSICA → NÓ',
    },
    {
      kicker: 'Categorias criam territórios',
      title: 'Organize sem apagar a complexidade.',
      body: 'Crie categorias e vincule músicas a elas. Cada categoria se torna um novo centro, aproximando o que faz sentido permanecer junto.',
      signal: 'CATEGORIA → NOVO CENTRO',
    },
    {
      kicker: 'Um mapa impossível de copiar',
      title: 'O grafo cresce com você.',
      body: 'Com o tempo, músicas, categorias e conexões formam um aglomerado de neurônios: complexo, vivo e organizado pela história da sua escuta.',
      signal: 'TEMPO + ESCUTA → UMA REDE ÚNICA',
    },
  ]);
  const cache = new Map();
  const durable = new Set();
  let items = [];
  let categories = [];
  let activeId = '';
  let playbackPlaying = false;
  let selectedId = '';
  let engine = null;
  let resizeTimer = 0;
  let focusFrame = 0;
  let focusSettleFrame = 0;
  let fitFrame = 0;
  let showFrame = 0;
  let viewToken = 0;
  let options = {};
  let mounted = false;
  let dbPromise = null;
  let readyPromise = Promise.resolve();
  let categoryDialogId = '';
  let categoryDialogAssignId = '';
  let categoryDialogReturnFocus = null;
  let tutorialStep = 0;
  let tutorialToken = 0;
  let tutorialTimer = 0;
  let tutorialCloseTimer = 0;
  let tutorialClosing = false;
  let tutorialDismissed = false;

  const $ = (id) => document.getElementById(id);
  const el = {};
  const now = () => Date.now();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `media-${now()}-${Math.random().toString(36).slice(2)}`);
  const categoryUid = () => `category:custom:${uid()}`;
  const text = (value, fallback = '') => String(value == null ? fallback : value).trim();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function openMediaDb() {
    if (!window.indexedDB) return Promise.reject(new Error('IndexedDB indisponível'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento de áudio'));
      request.onblocked = () => reject(new Error('Armazenamento de áudio bloqueado'));
    });
    return dbPromise;
  }

  async function storedMedia() {
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const request = tx.objectStore(DB_STORE).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error || new Error('Não foi possível ler os áudios'));
    });
  }

  async function storeMedia(item, blob) {
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put({
        id: item.id,
        blob,
        name: text(blob.name, item.fileName),
        type: text(blob.type),
        size: blob.size,
        lastModified: finite(blob.lastModified),
        savedAt: now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Não foi possível armazenar o áudio'));
      tx.onabort = () => reject(tx.error || new Error('Armazenamento do áudio interrompido'));
    });
  }

  async function deleteStoredMedia(ids) {
    const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
    if (!list.length) return;
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      list.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Não foi possível remover o áudio armazenado'));
      tx.onabort = () => reject(tx.error || new Error('Remoção do áudio interrompida'));
    });
  }

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.slice(0, LIMIT).map(normalize).filter((item) => item.id && item.title);
    } catch (_) { return []; }
  }

  function normalizeCategory(data = {}) {
    const rawName = Array.from(text(data.name, 'Nova categoria')).slice(0, 40).join('');
    return {
      id: text(data.id).startsWith('category:custom:') ? text(data.id) : categoryUid(),
      name: rawName || 'Nova categoria',
      createdAt: finite(data.createdAt, now()),
      updatedAt: finite(data.updatedAt, finite(data.createdAt, now())),
    };
  }

  function readCategories() {
    try {
      const raw = JSON.parse(localStorage.getItem(CATEGORY_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      const names = new Set();
      return raw.slice(0, CATEGORY_LIMIT).map(normalizeCategory).filter((category) => {
        const key = category.name.toLocaleLowerCase('pt-BR');
        if (!category.id || !category.name || names.has(key)) return false;
        names.add(key);
        return true;
      });
    } catch (_) { return []; }
  }

  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, LIMIT))); }
    catch (_) { /* a biblioteca continua disponível em memória */ }
    try { localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories.slice(0, CATEGORY_LIMIT))); }
    catch (_) { /* as categorias continuam disponíveis em memória */ }
  }

  function normalize(data = {}) {
    return {
      id: text(data.id) || uid(),
      title: text(data.title || data.fileName, 'Áudio sem título'),
      fileName: text(data.fileName || data.title, 'audio'),
      sourceType: data.sourceType === 'remote' ? 'remote' : 'local',
      sourceUrl: text(data.sourceUrl),
      sourceLabel: text(data.sourceLabel, data.sourceType === 'remote' ? 'LINK' : 'ARQUIVO LOCAL'),
      byline: text(data.byline),
      thumbnail: text(data.thumbnail),
      favorite: data.favorite === true,
      categoryId: text(data.categoryId),
      size: Math.max(0, finite(data.size)),
      lastModified: Math.max(0, finite(data.lastModified)),
      duration: Math.max(0, finite(data.duration)),
      sampleRate: Math.max(0, finite(data.sampleRate)),
      channels: Math.max(0, finite(data.channels)),
      rate: finite(data.rate, 100),
      position: Math.max(0, finite(data.position)),
      createdAt: finite(data.createdAt, now()),
      lastOpenedAt: finite(data.lastOpenedAt, now()),
    };
  }

  function sameMedia(a, b) {
    if (b.id && a.id === b.id) return true;
    if (b.sourceType === 'remote' && b.sourceUrl) return a.sourceType === 'remote' && a.sourceUrl === b.sourceUrl;
    const modified = Math.max(0, finite(b.lastModified));
    return a.sourceType === 'local' && b.sourceType !== 'remote' && modified > 0 &&
      a.fileName === text(b.fileName || b.title) && a.size === Math.max(0, finite(b.size)) &&
      a.lastModified === modified;
  }

  async function record(data = {}, blob = null) {
    await readyPromise;
    const previousIds = new Set(items.map((item) => item.id));
    const found = items.findIndex((item) => sameMedia(item, data));
    const previous = found >= 0 ? items[found] : null;
    const item = normalize({
      ...previous,
      ...data,
      lastModified: finite(data.lastModified, finite(blob && blob.lastModified, finite(previous && previous.lastModified))),
      id: previous ? previous.id : (data.id || uid()),
      createdAt: previous ? previous.createdAt : now(),
      lastOpenedAt: now(),
    });

    if (found >= 0) items.splice(found, 1);
    items.unshift(item);
    items = items.slice(0, LIMIT);
    activeId = item.id;
    if (mounted && !el.view.hidden) selectedId = item.id;
    if (blob instanceof Blob) cache.set(item.id, blob);
    write();
    refresh();
    notifyChange();

    if (blob instanceof Blob) {
      try {
        await storeMedia(item, blob);
        durable.add(item.id);
        refreshDetails();
      } catch (_) {
        durable.delete(item.id);
      }
    }

    const currentIds = new Set(items.map((entry) => entry.id));
    const evicted = [...previousIds].filter((id) => !currentIds.has(id));
    evicted.forEach((id) => { cache.delete(id); durable.delete(id); });
    if (evicted.length) deleteStoredMedia(evicted).catch(() => {});
    return item;
  }

  async function hydrate(savedItems) {
    cache.clear();
    durable.clear();
    let records = [];
    try { records = await storedMedia(); }
    catch (_) { /* sem IndexedDB, somente links recuperáveis permanecem */ }

    records.forEach((record) => {
      if (!record || !record.id || !(record.blob instanceof Blob)) return;
      cache.set(record.id, record.blob);
      durable.add(record.id);
    });

    const categoryIds = new Set(categories.map((category) => category.id));
    items = savedItems
      .filter((item) => cache.has(item.id) || (item.sourceType === 'remote' && item.sourceUrl))
      .map((item) => categoryIds.has(item.categoryId) ? item : normalize({ ...item, categoryId: '', id: item.id }));
    const retainedIds = new Set(items.map((item) => item.id));
    const orphans = records.map((record) => record && record.id).filter((id) => id && !retainedIds.has(id));
    orphans.forEach((id) => { cache.delete(id); durable.delete(id); });
    if (orphans.length) deleteStoredMedia(orphans).catch(() => {});
    write();
    refresh();
    notifyChange();
  }

  function updateActive(patch = {}) {
    if (!activeId) return null;
    const index = items.findIndex((item) => item.id === activeId);
    if (index < 0) return null;
    items[index] = normalize({ ...items[index], ...patch, id: activeId });
    write();
    refreshDetails();
    return items[index];
  }

  function captureActive() {
    if (!activeId || typeof options.captureState !== 'function') return;
    const snapshot = options.captureState() || {};
    updateActive(snapshot);
  }

  function formatTime(seconds) {
    const s = Math.max(0, finite(seconds));
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function filteredItems() {
    const query = text(el.search && el.search.value).toLocaleLowerCase('pt-BR');
    if (!query) return items;
    return items.filter((item) => {
      const category = categoryForId(item.categoryId);
      const searchable = `${item.title} ${item.byline} ${item.sourceLabel} ${category?.name || ''} ${item.favorite ? 'Favoritas' : ''}`;
      return searchable.toLocaleLowerCase('pt-BR').includes(query);
    });
  }

  function musicCountLabel(count) {
    return `${count} ${count === 1 ? 'MÚSICA' : 'MÚSICAS'}`;
  }

  function categoryForId(id) {
    if (id === ROOT_ID) return { id, name: 'Biblioteca', fixed: true, kind: 'principal' };
    if (id === FAVORITES_ID) return { id, name: 'Favoritas', fixed: true, kind: 'especial' };
    return categories.find((category) => category.id === id) || null;
  }

  function categoryItemCount(id, source = items) {
    if (id === ROOT_ID) return source.filter((item) => !categoryForId(item.categoryId) && !item.favorite).length;
    if (id === FAVORITES_ID) return source.filter((item) => item.favorite).length;
    return source.filter((item) => item.categoryId === id).length;
  }

  function graphData() {
    const visible = filteredItems();
    const query = text(el.search && el.search.value).toLocaleLowerCase('pt-BR');
    const favorites = visible.filter((item) => item.favorite);
    const visibleCategories = categories.filter((category) => !query ||
      category.name.toLocaleLowerCase('pt-BR').includes(query) ||
      visible.some((item) => item.categoryId === category.id));
    const showFavorites = favorites.length > 0;
    if (!visible.length && !visibleCategories.length) return { nodes: [], links: [] };
    const visibleCategoryIds = new Set(visibleCategories.map((category) => category.id));
    const categoryNodes = [
      ...(showFavorites ? [{
        id: FAVORITES_ID,
        title: 'Favoritas',
        label: 'Favoritas',
        countLabel: musicCountLabel(favorites.length),
        role: 'category',
        isCategory: true,
        fixed: true,
      }] : []),
      ...visibleCategories.map((category) => ({
        ...category,
        title: category.name,
        label: category.name,
        countLabel: musicCountLabel(categoryItemCount(category.id, visible)),
        role: 'category',
        isCategory: true,
      })),
    ];
    const categoryLinks = categoryNodes.map((category) => ({
      source: ROOT_ID,
      target: category.id,
      distance: CATEGORY_LINK_DISTANCE,
      strength: CATEGORY_LINK_STRENGTH,
      kind: 'hierarchy',
    }));
    const trackLinks = visible.flatMap((item) => {
      const customParent = visibleCategoryIds.has(item.categoryId) ? item.categoryId : '';
      const primaryParent = customParent || (item.favorite && showFavorites ? FAVORITES_ID : ROOT_ID);
      const links = [];
      if (customParent && item.favorite && showFavorites) {
        links.push({
          source: FAVORITES_ID,
          target: item.id,
          kind: 'affinity',
          layout: false,
          physics: false,
        });
      }
      links.push({
        source: primaryParent,
        target: item.id,
        distance: TRACK_LINK_DISTANCE,
        strength: TRACK_LINK_STRENGTH,
        kind: 'membership',
      });
      return links;
    });
    return {
      nodes: [
        {
          id: ROOT_ID,
          title: 'Biblioteca',
          label: 'Biblioteca',
          countLabel: musicCountLabel(visible.length),
          role: 'root',
          isCategory: true,
          fixed: true,
        },
        ...categoryNodes,
        ...visible.map((item) => ({
          ...item,
          label: item.title,
          countLabel: `${formatTime(item.duration)} · ${Math.round(item.rate)}%`,
          role: 'track',
        })),
      ],
      links: [
        ...categoryLinks,
        ...trackLinks,
      ],
    };
  }

  function graphViewportInsets() {
    if (!el.graph) return { left: 0, top: 0, right: 0, bottom: 0 };
    const host = el.graph.getBoundingClientRect();
    const insets = { left: 0, top: 0, right: 0, bottom: 0 };
    const blocks = el.view.querySelectorAll('[data-graph-viewport-block]:not([hidden])');

    blocks.forEach((block) => {
      const rect = block.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      let side = block.dataset.graphViewportBlock || 'right';
      if (side === 'auto') side = window.matchMedia?.('(max-width: 720px)').matches ? 'bottom' : 'right';
      const gap = 16;
      if (side === 'left') insets.left = Math.max(insets.left, rect.right - host.left + gap);
      if (side === 'right') insets.right = Math.max(insets.right, host.right - rect.left + gap);
      if (side === 'top') insets.top = Math.max(insets.top, rect.bottom - host.top + gap);
      if (side === 'bottom') insets.bottom = Math.max(insets.bottom, host.bottom - rect.top + gap);
    });

    return insets;
  }

  function cancelGraphCameraTasks() {
    cancelAnimationFrame(focusFrame);
    cancelAnimationFrame(focusSettleFrame);
    cancelAnimationFrame(fitFrame);
    focusFrame = 0;
    focusSettleFrame = 0;
    fitFrame = 0;
  }

  function scheduleGraphFit() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      fitFrame = 0;
      if (!engine || el.view.hidden) return;
      engine.fitGraph();
    });
  }

  function focusNodeInVisibleViewport(nodeId) {
    if (!engine || !nodeId || !engine.getNode(nodeId)) return;
    cancelAnimationFrame(focusFrame);
    cancelAnimationFrame(focusSettleFrame);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = 0;
      focusSettleFrame = requestAnimationFrame(() => {
        focusSettleFrame = 0;
        if (!engine || el.view.hidden || selectedId !== nodeId || !engine.getNode(nodeId)) return;
        const currentScale = engine.getCamera().scale;
        engine.focusNode(nodeId, {
          followViewport: true,
          followDuration: Infinity,
          scale: Math.max(currentScale, SELECTED_NODE_ZOOM),
        });
      });
    });
  }

  function ensureEngine() {
    if (engine || !window.GraphEngine || el.view.hidden) return;
    engine = new window.GraphEngine({
      host: el.graph,
      initialZoom: 1.05,
      minFitZoom: 0.68,
      cameraFollowMs: 900,
      compactBreakpoint: 0,
      categorySpawnRadius: 0.46,
      nodeSpawnRadius: 0.28,
      nodeRingGap: 0.13,
      initialRingCapacity: 12,
      spawnJitter: 14,
      nodeLabelMaxWidth: 156,
      reduceMotion: () => window.Motion?.reduced?.() ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      getNodeRole: (node) => node.role || 'track',
      getNodeLabel: (node) => node.label,
      getNodeCountLabel: (node) => node.countLabel,
      getNodeTitle: (node) => node.isCategory
        ? `${node.title} — ${node.countLabel.toLocaleLowerCase('pt-BR')}`
        : `${node.title} — ${node.sourceLabel}`,
      isNodePlaying: (node) => playbackPlaying && node.id === activeId,
      getViewportInsets: graphViewportInsets,
      onResize: () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!engine || el.view.hidden) return;
          if (selectedId && engine.getNode(selectedId)) focusNodeInVisibleViewport(selectedId);
          else scheduleGraphFit();
        }, 90);
      },
      shouldNodeOpenOnClick: () => true,
      onNodeClick: (node) => {
        selectedId = node.id;
        refreshDetails();
        focusNodeInVisibleViewport(node.id);
      },
      onSelectionChange: (id) => {
        selectedId = id || '';
        refreshDetails();
      },
    });

  }

  function refreshGraph({ fit = false, reset = false } = {}) {
    if (!engine) return;
    const data = graphData();
    engine.setData(data);
    if (reset) engine.resetLayout();
    if (selectedId && data.nodes.some((node) => node.id === selectedId)) {
      engine.setSelected(selectedId);
    } else if (selectedId) {
      selectedId = '';
      engine.clearSelection();
    }
    if (fit && data.nodes.length) scheduleGraphFit();
  }

  function populateCategorySelect(item) {
    el.categorySelect.replaceChildren();
    const rootOption = document.createElement('option');
    rootOption.value = '';
    rootOption.textContent = 'Biblioteca';
    el.categorySelect.appendChild(rootOption);
    categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      el.categorySelect.appendChild(option);
    });
    el.categorySelect.value = categories.some((category) => category.id === item.categoryId)
      ? item.categoryId
      : '';
  }

  function closeCategoryDialog({ restoreFocus = true } = {}) {
    if (el.categoryDialogLayer.hidden) return;
    el.categoryDialogLayer.hidden = true;
    categoryDialogId = '';
    categoryDialogAssignId = '';
    el.categoryError.hidden = true;
    if (restoreFocus && categoryDialogReturnFocus?.isConnected) {
      categoryDialogReturnFocus.focus({ preventScroll: true });
    }
    categoryDialogReturnFocus = null;
  }

  function openCategoryDialog({ categoryId = '', assignId = '' } = {}) {
    if (!categoryId && categories.length >= CATEGORY_LIMIT) {
      document.dispatchEvent(new CustomEvent('varispeed:status', {
        detail: { text: `Limite de ${CATEGORY_LIMIT} categorias alcançado` },
      }));
      return;
    }
    const category = categories.find((entry) => entry.id === categoryId) || null;
    categoryDialogId = category?.id || '';
    categoryDialogAssignId = category ? '' : assignId;
    categoryDialogReturnFocus = document.activeElement;
    el.categoryDialogTitle.textContent = category ? 'Renomear categoria' : 'Nova categoria';
    el.categoryName.value = category?.name || '';
    el.categoryError.hidden = true;
    el.categoryDialogLayer.hidden = false;
    requestAnimationFrame(() => {
      el.categoryName.focus({ preventScroll: true });
      el.categoryName.select();
    });
  }

  function validCategoryName(value) {
    const name = Array.from(text(value).replace(/\s+/g, ' ')).slice(0, 40).join('');
    if (!name) return { error: 'Digite um nome para a categoria.' };
    const key = name.toLocaleLowerCase('pt-BR');
    if (key === 'biblioteca' || key === 'favoritas') {
      return { error: 'Esse nome pertence a uma categoria fixa.' };
    }
    if (categories.some((category) => category.id !== categoryDialogId && category.name.toLocaleLowerCase('pt-BR') === key)) {
      return { error: 'Já existe uma categoria com esse nome.' };
    }
    return { name };
  }

  function saveCategory(event) {
    event.preventDefault();
    const result = validCategoryName(el.categoryName.value);
    if (result.error) {
      el.categoryError.textContent = result.error;
      el.categoryError.hidden = false;
      el.categoryName.focus({ preventScroll: true });
      return;
    }

    let category = categories.find((entry) => entry.id === categoryDialogId) || null;
    const renamed = Boolean(category);
    if (category) {
      category = normalizeCategory({ ...category, name: result.name, updatedAt: now() });
      categories = categories.map((entry) => entry.id === category.id ? category : entry);
    } else {
      category = normalizeCategory({ id: categoryUid(), name: result.name, createdAt: now(), updatedAt: now() });
      categories = [...categories, category].slice(0, CATEGORY_LIMIT);
    }

    const assignIndex = items.findIndex((item) => item.id === categoryDialogAssignId);
    if (assignIndex >= 0) {
      items[assignIndex] = normalize({ ...items[assignIndex], categoryId: category.id, id: items[assignIndex].id });
      selectedId = items[assignIndex].id;
    } else {
      selectedId = category.id;
    }

    write();
    closeCategoryDialog({ restoreFocus: false });
    refresh({ fit: !renamed });
    if (assignIndex >= 0) notifyChange();
    if (assignIndex >= 0) focusNodeInVisibleViewport(selectedId);
    document.dispatchEvent(new CustomEvent('varispeed:status', {
      detail: { text: renamed ? `Categoria renomeada · ${category.name}` : `Categoria criada · ${category.name}` },
    }));
  }

  function assignSelectedCategory() {
    const index = items.findIndex((item) => item.id === selectedId);
    if (index < 0) return;
    const categoryId = categories.some((category) => category.id === el.categorySelect.value)
      ? el.categorySelect.value
      : '';
    if (items[index].categoryId === categoryId) return;
    items[index] = normalize({ ...items[index], categoryId, id: items[index].id });
    const item = items[index];
    write();
    refreshGraph();
    refreshDetails();
    notifyChange();
    focusNodeInVisibleViewport(item.id);
    const category = categories.find((entry) => entry.id === categoryId);
    document.dispatchEvent(new CustomEvent('varispeed:status', {
      detail: { text: category ? `Movida para ${category.name} · ${item.title}` : `Movida para Biblioteca · ${item.title}` },
    }));
  }

  function refreshDetails() {
    if (!mounted) return;
    const item = items.find((entry) => entry.id === selectedId);
    const category = item ? null : categoryForId(selectedId);
    el.details.hidden = !item && !category;
    if (!item && !category) return;
    el.detailArtwork.hidden = !item || !item.thumbnail;
    el.detailRows.hidden = !item;
    el.organization.hidden = !item;
    el.categorySummary.hidden = !category;
    el.musicActions.hidden = !item;
    el.categoryActions.hidden = !category || category.fixed;

    if (category) {
      const count = category.id === ROOT_ID ? items.length : categoryItemCount(category.id);
      el.detailSource.textContent = category.fixed
        ? category.id === ROOT_ID ? 'CATEGORIA PRINCIPAL' : 'CATEGORIA FIXA'
        : 'CATEGORIA PERSONALIZADA';
      el.detailTitle.textContent = category.name;
      el.detailTitle.title = category.name;
      el.categoryKind.textContent = category.fixed ? 'Estrutura do grafo' : 'Organização pessoal';
      el.categoryCount.textContent = musicCountLabel(count).toLocaleLowerCase('pt-BR');
      el.categoryDescription.textContent = category.id === ROOT_ID
        ? 'Todas as categorias partem daqui e expandem a história visual da sua biblioteca.'
        : category.id === FAVORITES_ID
          ? 'A estrela mantém esta categoria sincronizada com suas músicas favoritas.'
          : count
            ? 'As músicas vinculadas formam um agrupamento próprio ao redor desta categoria.'
            : 'Categoria vazia. Vincule uma música pelo painel de detalhes para iniciar este agrupamento.';
      return;
    }

    el.detailTitle.textContent = item.title;
    el.detailTitle.title = item.title;
    window.Motion?.marquee?.(el.detailTitle, { speed: 24 });
    el.detailSource.textContent = item.sourceLabel;
    el.detailDuration.textContent = formatTime(item.duration);
    el.detailRate.textContent = `${Math.round(item.rate)}%`;
    el.detailChannels.textContent = item.channels === 1 ? 'Mono' : item.channels > 1 ? 'Estéreo' : 'Áudio';
    el.detailOrigin.textContent = item.sourceType === 'remote' ? item.sourceLabel : 'Arquivo local';
    populateCategorySelect(item);
    el.detailBylineRow.hidden = !item.byline;
    el.detailByline.textContent = item.byline || '—';
    el.detailArtwork.hidden = !item.thumbnail;
    if (item.thumbnail) {
      el.detailArtworkImage.alt = `Capa de ${item.title}`;
      if (el.detailArtworkImage.dataset.src !== item.thumbnail) {
        el.detailArtwork.classList.remove('has-image');
        el.detailArtworkImage.dataset.src = item.thumbnail;
        el.detailArtworkImage.src = item.thumbnail;
      }
    } else {
      el.detailArtworkImage.alt = '';
      el.detailArtworkImage.dataset.src = '';
      el.detailArtworkImage.removeAttribute('src');
      el.detailArtwork.classList.remove('has-image');
    }
    el.openLabel.textContent = item.sourceType === 'local' && !cache.has(item.id)
      ? 'Localizar e abrir'
      : item.id === activeId
        ? 'Voltar à música'
        : 'Abrir música';
    el.favorite.setAttribute('aria-pressed', String(item.favorite));
    el.favorite.setAttribute('aria-label', item.favorite ? 'Remover das Favoritas' : 'Adicionar às Favoritas');
    el.favorite.title = item.favorite ? 'Remover das Favoritas' : 'Adicionar às Favoritas';
  }

  function refresh({ fit = false, reset = false } = {}) {
    if (!mounted) return;
    const visible = filteredItems();
    const data = graphData();
    el.trigger.hidden = !el.view.hidden;
    el.empty.hidden = data.nodes.length !== 0;
    if (!el.empty.hidden) {
      const isEmpty = items.length === 0;
      el.emptyTitle.textContent = isEmpty ? 'Biblioteca vazia' : 'Nenhuma música encontrada';
      el.emptyHint.textContent = isEmpty
        ? 'IMPORTE UMA MÚSICA E ADICIONE À BIBLIOTECA'
        : 'TENTE OUTRO TERMO DE BUSCA';
    }
    if (engine) refreshGraph({ fit, reset });
    refreshDetails();
  }

  function notifyChange() {
    options.onChange?.(items.map((item) => ({ ...item })));
  }

  function tutorialWasSeen() {
    if (window.Settings?.get?.('library.alwaysShowGuide') === true) return false;
    if (tutorialDismissed) return true;
    try { return localStorage.getItem(TUTORIAL_KEY) === '1'; }
    catch (_) { return false; }
  }

  function rememberTutorial() {
    tutorialDismissed = true;
    try { localStorage.setItem(TUTORIAL_KEY, '1'); }
    catch (_) { /* a sessão atual ainda não repete o tutorial */ }
  }

  function renderTutorialStep(nextStep, { immediate = false } = {}) {
    tutorialStep = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, nextStep));
    const step = TUTORIAL_STEPS[tutorialStep];
    const token = ++tutorialToken;
    clearTimeout(tutorialTimer);
    el.tutorial.dataset.step = String(tutorialStep);
    el.tutorial.dataset.reduced = String(window.Motion?.reduced?.() === true);
    el.tutorialProgressCount.textContent = `${String(tutorialStep + 1).padStart(2, '0')} / ${String(TUTORIAL_STEPS.length).padStart(2, '0')}`;
    el.tutorialProgress.setAttribute('aria-label', `Etapa ${tutorialStep + 1} de ${TUTORIAL_STEPS.length}`);
    el.tutorialBack.hidden = tutorialStep === 0;
    el.tutorialNextLabel.textContent = tutorialStep === TUTORIAL_STEPS.length - 1
      ? 'Explorar biblioteca'
      : 'Continuar';

    const apply = () => {
      if (token !== tutorialToken || el.tutorial.hidden) return;
      el.tutorialKicker.textContent = step.kicker;
      el.tutorialTitle.setAttribute('aria-label', step.title);
      if (window.Motion?.status) {
        window.Motion.status(el.tutorialTitle, step.title, { persist: true, wrapWords: true });
      }
      else el.tutorialTitle.textContent = step.title;
      el.tutorialBody.textContent = step.body;
      el.tutorialSignal.textContent = step.signal;
      el.tutorialContent.classList.remove('is-changing');
    };

    if (immediate || window.Motion?.reduced?.()) {
      apply();
      return;
    }
    el.tutorialContent.classList.add('is-changing');
    tutorialTimer = setTimeout(apply, 150);
  }

  function openTutorial() {
    if (tutorialWasSeen() || !el.tutorial.hidden) return false;
    clearTimeout(tutorialCloseTimer);
    tutorialCloseTimer = 0;
    tutorialClosing = false;
    el.tutorial.classList.remove('is-leaving');
    el.tutorial.hidden = false;
    el.view.dataset.tutorial = 'true';
    renderTutorialStep(0, { immediate: true });
    requestAnimationFrame(() => el.tutorialNext.focus({ preventScroll: true }));
    return true;
  }

  function closeTutorial({ remember = true, restoreFocus = true, animate = false } = {}) {
    if (el.tutorial.hidden) return;
    if (tutorialClosing && animate) return;
    if (remember) rememberTutorial();
    tutorialToken++;
    clearTimeout(tutorialTimer);
    tutorialTimer = 0;
    window.Motion?.cancel?.(el.tutorialTitle);
    el.tutorialContent.classList.remove('is-changing');

    const finish = () => {
      clearTimeout(tutorialCloseTimer);
      tutorialCloseTimer = 0;
      tutorialClosing = false;
      el.tutorial.classList.remove('is-leaving');
      el.tutorial.hidden = true;
      delete el.view.dataset.tutorial;
      if (restoreFocus) el.search?.focus({ preventScroll: true });
    };

    if (animate && !window.Motion?.reduced?.()) {
      tutorialClosing = true;
      el.tutorial.classList.add('is-leaving');
      tutorialCloseTimer = setTimeout(finish, TUTORIAL_EXIT_MS);
      return;
    }
    finish();
  }

  function nextTutorialStep() {
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
      closeTutorial({ animate: true });
      return;
    }
    renderTutorialStep(tutorialStep + 1);
  }

  function previousTutorialStep() {
    if (tutorialStep > 0) renderTutorialStep(tutorialStep - 1);
  }

  function show() {
    if (!mounted) return;
    const token = ++viewToken;
    cancelAnimationFrame(showFrame);
    cancelGraphCameraTasks();
    captureActive();
    options.onViewChange?.(true);
    el.view.hidden = false;
    el.editor.hidden = true;
    el.trigger.hidden = true;
    el.trigger.setAttribute('aria-pressed', 'true');
    showFrame = requestAnimationFrame(() => {
      showFrame = 0;
      if (token !== viewToken || el.view.hidden) return;
      ensureEngine();
      engine?.resize();
      engine?.resume();
      refresh({ fit: true, reset: true });
      if (!openTutorial()) el.search.focus({ preventScroll: true });
    });
  }

  function hide() {
    if (!mounted) return;
    viewToken++;
    cancelAnimationFrame(showFrame);
    showFrame = 0;
    clearTimeout(resizeTimer);
    cancelGraphCameraTasks();
    closeTutorial({ remember: false, restoreFocus: false });
    closeCategoryDialog({ restoreFocus: false });
    engine?.pause();
    selectedId = '';
    if (engine) engine.clearSelection();
    else refreshDetails();
    el.view.hidden = true;
    el.editor.hidden = false;
    el.trigger.hidden = false;
    el.trigger.setAttribute('aria-pressed', 'false');
    options.onViewChange?.(false);
  }

  async function openSelected() {
    const item = items.find((entry) => entry.id === selectedId);
    if (!item || typeof options.onOpen !== 'function') return;

    if (item.sourceType === 'local' && !cache.has(item.id)) {
      el.relink.value = '';
      el.relink.dataset.itemId = item.id;
      el.relink.click();
      return;
    }

    const busyAt = performance.now();
    setOpenBusy(true, item.id === activeId ? 'Voltando…' : 'Abrindo…');
    try {
      if (item.id === activeId) {
        await holdBusyState(busyAt);
        hide();
        return;
      }
      const opened = await options.onOpen({ item, blob: cache.get(item.id) || null });
      await holdBusyState(busyAt);
      if (opened !== false) {
        activeId = item.id;
        items = items.map((entry) => entry.id === item.id ? { ...entry, lastOpenedAt: now() } : entry);
        write();
        hide();
      }
    } finally {
      setOpenBusy(false);
    }
  }

  function setOpenBusy(on, label = '') {
    el.open.disabled = on;
    const sweep = window.Settings?.get('motion.sweep') !== false && !window.Motion?.reduced?.();
    el.open.classList.toggle('is-busy', on && sweep);
    if (on) el.open.setAttribute('aria-busy', 'true');
    else el.open.removeAttribute('aria-busy');
    el.openLabel.classList.toggle('is-working', on);
    if (on && label) el.openLabel.textContent = label;
    if (!on) refreshDetails();
  }

  function holdBusyState(startedAt, minimum = 460) {
    const remaining = Math.max(0, minimum - (performance.now() - startedAt));
    return remaining ? new Promise((resolve) => setTimeout(resolve, remaining)) : Promise.resolve();
  }

  async function onRelink(event) {
    const file = event.target.files && event.target.files[0];
    const item = items.find((entry) => entry.id === event.target.dataset.itemId);
    event.target.value = '';
    if (!file || !item || typeof options.onOpen !== 'function') return;
    const sameFile = item.fileName === file.name && item.size === file.size &&
      (!item.lastModified || !file.lastModified || item.lastModified === file.lastModified);
    const openingItem = sameFile ? item : normalize({
      title: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      sourceType: 'local',
      sourceLabel: 'ARQUIVO LOCAL',
      size: file.size,
      lastModified: file.lastModified,
      rate: item.rate,
      position: 0,
      favorite: item.favorite,
      categoryId: item.categoryId,
    });
    const busyAt = performance.now();
    setOpenBusy(true, 'Abrindo…');
    try {
      const opened = await options.onOpen({ item: openingItem, blob: file, relinked: true });
      await holdBusyState(busyAt);
      if (opened !== false) {
        if (!sameFile) {
          items = items.filter((entry) => entry.id !== item.id);
          cache.delete(item.id);
          durable.delete(item.id);
          deleteStoredMedia(item.id).catch(() => {});
          write();
          refreshGraph({ fit: true });
          notifyChange();
        }
        activeId = openingItem.id;
        hide();
      }
    } finally { setOpenBusy(false); }
  }

  function removeSelected() {
    const item = items.find((entry) => entry.id === selectedId);
    if (!item || !confirm(`Remover “${item.title}” da biblioteca?`)) return;
    items = items.filter((entry) => entry.id !== item.id);
    cache.delete(item.id);
    durable.delete(item.id);
    deleteStoredMedia(item.id).catch(() => {});
    if (activeId === item.id) activeId = '';
    selectedId = '';
    write();
    refresh({ fit: true });
    notifyChange();
    document.dispatchEvent(new CustomEvent('varispeed:status', {
      detail: { text: `Removida da Biblioteca · ${item.title}` },
    }));
  }

  function removeSelectedCategory() {
    const category = categories.find((entry) => entry.id === selectedId);
    if (!category) return;
    const count = categoryItemCount(category.id);
    const impact = count
      ? `${musicCountLabel(count).toLocaleLowerCase('pt-BR')} voltarão para Biblioteca.`
      : 'A categoria está vazia.';
    if (!confirm(`Excluir a categoria “${category.name}”?\n\n${impact}\nNenhuma música será removida.`)) return;

    categories = categories.filter((entry) => entry.id !== category.id);
    items = items.map((item) => item.categoryId === category.id
      ? normalize({ ...item, categoryId: '', id: item.id })
      : item);
    selectedId = '';
    write();
    refresh({ fit: true });
    notifyChange();
    document.dispatchEvent(new CustomEvent('varispeed:status', {
      detail: { text: `Categoria excluída · ${category.name}` },
    }));
  }

  function toggleFavorite() {
    const index = items.findIndex((item) => item.id === selectedId);
    if (index < 0) return;
    const favorite = !items[index].favorite;
    items[index] = normalize({ ...items[index], favorite, id: items[index].id });
    const item = items[index];
    write();
    refreshGraph();
    refreshDetails();
    notifyChange();
    focusNodeInVisibleViewport(item.id);
    document.dispatchEvent(new CustomEvent('varispeed:status', {
      detail: { text: favorite ? `Adicionada às Favoritas · ${item.title}` : `Removida das Favoritas · ${item.title}` },
    }));
  }

  function closeDetails() {
    selectedId = '';
    if (engine) engine.clearSelection();
    else refreshDetails();
    scheduleGraphFit();
    el.search.focus({ preventScroll: true });
  }

  function mount(opts = {}) {
    if (mounted) return;
    options = opts;
    Object.assign(el, {
      view: $('libraryView'), editor: $('editorMain'), trigger: $('btnLibrary'),
      close: $('libraryClose'), graph: $('libraryGraph'), search: $('librarySearch'),
      empty: $('libraryEmpty'), emptyTitle: $('libraryEmptyTitle'), emptyHint: $('libraryEmptyHint'),
      details: $('libraryDetails'),
      detailTitle: $('libraryDetailTitle'), detailSource: $('libraryDetailSource'),
      detailDuration: $('libraryDetailDuration'), detailRate: $('libraryDetailRate'),
      detailChannels: $('libraryDetailChannels'), detailOrigin: $('libraryDetailOrigin'),
      detailClose: $('libraryDetailClose'),
      detailBylineRow: $('libraryDetailBylineRow'), detailByline: $('libraryDetailByline'),
      detailArtwork: $('libraryDetailArtwork'), detailArtworkImage: $('libraryDetailArtworkImage'),
      detailRows: $('libraryDetailRows'),
      organization: $('libraryOrganization'), categorySelect: $('libraryCategorySelect'),
      categorySummary: $('libraryCategorySummary'), categoryKind: $('libraryCategoryKind'),
      categoryCount: $('libraryCategoryCount'), categoryDescription: $('libraryCategoryDescription'),
      open: $('libraryOpen'), openLabel: $('libraryOpenLabel'),
      favorite: $('libraryFavorite'),
      remove: $('libraryRemove'), relink: $('libraryRelink'),
      musicActions: $('libraryMusicActions'), categoryActions: $('libraryCategoryActions'),
      categoryCreate: $('libraryCategoryCreate'), categoryCreateInline: $('libraryCategoryCreateInline'),
      categoryRename: $('libraryCategoryRename'), categoryRemove: $('libraryCategoryRemove'),
      categoryDialogLayer: $('libraryCategoryDialogLayer'), categoryDialog: $('libraryCategoryDialog'),
      categoryDialogTitle: $('libraryCategoryDialogTitle'), categoryDialogClose: $('libraryCategoryDialogClose'),
      categoryCancel: $('libraryCategoryCancel'), categoryName: $('libraryCategoryName'),
      categoryError: $('libraryCategoryError'),
      tutorial: $('libraryTutorial'), tutorialContent: $('libraryTutorialContent'),
      tutorialKicker: $('libraryTutorialKicker'), tutorialTitle: $('libraryTutorialTitle'),
      tutorialBody: $('libraryTutorialBody'), tutorialSignal: $('libraryTutorialSignal'),
      tutorialProgress: $('libraryTutorialProgress'), tutorialProgressCount: $('libraryTutorialProgressCount'),
      tutorialSkip: $('libraryTutorialSkip'), tutorialBack: $('libraryTutorialBack'),
      tutorialNext: $('libraryTutorialNext'), tutorialNextLabel: $('libraryTutorialNextLabel'),
    });
    if (!el.view || !el.editor || !el.trigger || !el.graph || !window.GraphEngine) return;
    categories = readCategories();
    const savedItems = read();
    items = [];
    selectedId = '';
    el.trigger.addEventListener('click', show);
    el.close.addEventListener('click', hide);
    el.search.addEventListener('input', () => {
      refresh({ fit: true });
    });
    el.open.addEventListener('click', openSelected);
    el.favorite.addEventListener('click', toggleFavorite);
    el.categorySelect.addEventListener('change', assignSelectedCategory);
    el.categoryCreate.addEventListener('click', () => openCategoryDialog());
    el.categoryCreateInline.addEventListener('click', () => openCategoryDialog({ assignId: selectedId }));
    el.categoryRename.addEventListener('click', () => openCategoryDialog({ categoryId: selectedId }));
    el.categoryRemove.addEventListener('click', removeSelectedCategory);
    el.categoryDialog.addEventListener('submit', saveCategory);
    el.categoryDialogClose.addEventListener('click', () => closeCategoryDialog());
    el.categoryCancel.addEventListener('click', () => closeCategoryDialog());
    el.categoryDialogLayer.addEventListener('pointerdown', (event) => {
      if (event.target === el.categoryDialogLayer) closeCategoryDialog();
    });
    el.tutorialSkip.addEventListener('click', () => closeTutorial());
    el.tutorialBack.addEventListener('click', previousTutorialStep);
    el.tutorialNext.addEventListener('click', nextTutorialStep);
    el.detailArtworkImage.addEventListener('load', () => el.detailArtwork.classList.add('has-image'));
    el.detailArtworkImage.addEventListener('error', () => el.detailArtwork.classList.remove('has-image'));
    el.detailClose.addEventListener('click', closeDetails);
    el.remove.addEventListener('click', removeSelected);
    el.relink.addEventListener('change', onRelink);
    document.addEventListener('keydown', (event) => {
      if (el.view.hidden) return;
      if (!el.tutorial.hidden) {
        if (event.key === 'Tab') {
          const focusable = [...el.tutorial.querySelectorAll('button:not([disabled]):not([hidden])')];
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus({ preventScroll: true });
          }
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          nextTutorialStep();
          return;
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          previousTutorialStep();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeTutorial();
        }
        return;
      }
      if (!el.categoryDialogLayer.hidden && event.key === 'Tab') {
        const focusable = [...el.categoryDialog.querySelectorAll('button:not([disabled]), input:not([disabled])')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
        return;
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (!el.categoryDialogLayer.hidden) {
        closeCategoryDialog();
        return;
      }
      hide();
      el.trigger.focus({ preventScroll: true });
    });
    mounted = true;
    refresh();
    readyPromise = hydrate(savedItems);
  }

  window.MediaLibrary = {
    mount, record, updateActive, show, hide,
    find(data = {}) {
      const item = items.find((entry) => sameMedia(entry, data));
      return item ? { ...item } : null;
    },
    setActive(id = '') {
      activeId = items.some((item) => item.id === id) ? id : '';
      engine?.refreshStyles();
      refreshDetails();
    },
    setPlaybackState(playing = false) {
      playbackPlaying = Boolean(playing);
      engine?.refreshStyles();
    },
    get ready() { return readyPromise; },
    get activeId() { return activeId; },
    get items() { return items.map((item) => ({ ...item })); },
    get categories() { return categories.map((category) => ({ ...category })); },
    get performance() { return engine?.getPerformanceSnapshot?.() || null; },
  };
})();
