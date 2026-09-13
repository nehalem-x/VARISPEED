/* ═════════════════════════════════════════════════════════
   VARISPEED — biblioteca visual de mídias
   Metadados ficam no localStorage e os bytes de áudio no IndexedDB. Na
   inicialização, apenas entradas que ainda possuem uma fonte válida voltam
   à lista. O grafo projeta somente categorias, nunca arquivos individuais.
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
  const model = window.LibraryModel;
  const SELECTED_NODE_ZOOM = 1.35;
  const TUTORIAL_EXIT_MS = 420;
  const TUTORIAL_STEPS = Object.freeze([
    {
      kicker: 'A memória da sua escuta',
      title: 'Sua biblioteca deixa rastros.',
      body: 'Suas músicas ficam neste computador. O mapa reúne as categorias; dentro de cada uma, uma lista guarda suas faixas e seus ajustes.',
      signal: 'UM MAPA · SUA ESCUTA',
    },
    {
      kicker: 'Cada categoria é um ponto',
      title: 'Um mapa para se encontrar.',
      body: 'Clique em uma categoria para abrir suas músicas. Biblioteca reúne todas as faixas, e Favoritas acompanha as que você marcou com uma estrela.',
      signal: 'CATEGORIA → LISTA DE FAIXAS',
    },
    {
      kicker: 'Categorias criam territórios',
      title: 'Organize sem apagar a complexidade.',
      body: 'Crie uma categoria e escolha as músicas que pertencem a ela pelo painel de detalhes. Sua organização muda sem duplicar arquivos.',
      signal: 'CATEGORIA → NOVO CENTRO',
    },
    {
      kicker: 'Um mapa impossível de copiar',
      title: 'Encontre. Escolha. Ouça.',
      body: 'Use a busca e a ordenação para encontrar uma faixa. As setas percorrem a lista; Enter abre a seleção no editor. Escape retorna um nível.',
      signal: 'MAPA → FAIXA → EDITOR',
    },
  ]);
  const cache = new Map();
  const durable = new Set();
  let items = [];
  let categories = [];
  let activeId = '';
  let playbackPlaying = false;
  let selectedId = '';
  let browseCategoryId = '';
  let listSignature = '';
  let opening = false;
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
  const compactList = window.matchMedia('(max-width: 720px)');
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
    if (mounted && !el.view.hidden) {
      selectedId = item.id;
      browseCategoryId = item.categoryId || ROOT_ID;
    }
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

  function musicCountLabel(count) {
    return `${count} ${count === 1 ? 'MÚSICA' : 'MÚSICAS'}`;
  }

  function categoryForId(id) {
    if (id === ROOT_ID) return { id, name: 'Biblioteca', fixed: true, kind: 'principal' };
    if (id === FAVORITES_ID) return { id, name: 'Favoritas', fixed: true, kind: 'especial' };
    return categories.find((category) => category.id === id) || null;
  }

  function categoryItemCount(id, source = items) {
    return source.filter((item) => model.belongs(item, id)).length;
  }

  function graphData() {
    return model.graph(items, categories, el.search?.value);
  }

  function currentTracks() {
    return model.tracks(items, categories, {
      categoryId: browseCategoryId || ROOT_ID, query: el.search.value, sort: el.sort.value,
    });
  }

  function openCategory(id, { focus = true } = {}) {
    if (!categoryForId(id)) return;
    if (browseCategoryId !== id) selectedId = '';
    browseCategoryId = id;
    refresh();
    engine?.resize();
    focusNodeInVisibleViewport(id);
    if (focus) (el.tracks.querySelector('[tabindex="0"]') || el.browserTitle).focus({ preventScroll: true });
  }

  function closeBrowser() {
    browseCategoryId = '';
    selectedId = '';
    refresh();
    engine?.resize();
    scheduleGraphFit();
    el.categoryNav.focus({ preventScroll: true });
  }

  function selectTrack(id, { focus = false } = {}) {
    if (opening || !currentTracks().some((item) => item.id === id)) return;
    selectedId = id;
    refreshBrowser();
    refreshDetails();
    if (compactList.matches) { el.detailClose.focus({ preventScroll: true }); return; }
    if (focus) {
      const row = [...el.tracks.children].find((entry) => entry.dataset.id === id);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: 'nearest' });
    }
  }

  function refreshBrowser() {
    if (!mounted) return;
    const category = categoryForId(browseCategoryId);
    el.browser.hidden = !category;
    el.view.classList.toggle('is-browsing', Boolean(category));
    el.total.textContent = `${musicCountLabel(items.length)} / ${categories.length + 2} CATEGORIAS`;
    // Native select keeps every category reachable by keyboard and on narrow screens.
    const groups = [categoryForId(ROOT_ID), categoryForId(FAVORITES_ID), ...categories];
    const navKey = JSON.stringify(groups.map((entry) => [entry.id, entry.name]));
    if (el.categoryNav.dataset.key !== navKey) {
      el.categoryNav.replaceChildren(new Option('Mapa de categorias', ''));
      groups.forEach((entry) => el.categoryNav.add(new Option(entry.name, entry.id)));
      el.categoryNav.dataset.key = navKey;
    }
    el.categoryNav.value = browseCategoryId;
    el.categoryActions.hidden = !category || category.fixed;
    if (!category) return;
    const rows = currentTracks();
    if (selectedId && !rows.some((item) => item.id === selectedId)) selectedId = '';
    el.browserTitle.textContent = category.name;
    el.browserCount.textContent = `${rows.length} de ${categoryItemCount(category.id)} faixas`;
    el.listEmpty.hidden = rows.length > 0;
    const searching = Boolean(text(el.search.value));
    el.listEmptyTitle.textContent = searching ? 'Nenhuma faixa encontrada.' : 'Este espaço está esperando sua música.';
    el.listEmptyHint.textContent = searching ? 'Tente outro termo ou explore todas as faixas.'
      : category.id === FAVORITES_ID ? 'Marque a estrela nos detalhes de uma faixa para encontrá-la aqui.'
        : category.id === ROOT_ID ? 'Abra um áudio no editor e use Adicionar à Biblioteca.'
          : 'Abra os detalhes de uma faixa em Biblioteca e escolha esta categoria.';
    el.listEmptyAction.textContent = searching ? 'Limpar busca' : category.id === ROOT_ID ? 'Ir ao editor' : 'Ver todas as faixas';
    const signature = JSON.stringify(rows.map((item) => [item.id, item.title, item.byline, item.sourceLabel, item.thumbnail, item.duration, item.rate, item.favorite]));
    if (signature !== listSignature) {
      const focusedId = document.activeElement?.dataset.id;
      const scrollTop = el.tracks.scrollTop;
      const fragment = document.createDocumentFragment();
      rows.forEach((item, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'library__track';
        row.dataset.id = item.id;
        row.setAttribute('role', 'option');
        const part = (className, value) => {
          const span = document.createElement('span');
          span.className = className;
          span.textContent = value;
          return span;
        };
        const number = part('library__track-number mono', String(index + 1).padStart(2, '0'));
        number.setAttribute('aria-hidden', 'true');
        const art = part('library__track-art', '');
        art.setAttribute('aria-hidden', 'true');
        if (item.thumbnail) {
          const img = document.createElement('img');
          img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
          img.src = item.thumbnail;
          img.addEventListener('error', () => img.remove(), { once: true });
          art.append(img);
        }
        const wash = part('library__track-wash', '');
        wash.setAttribute('aria-hidden', 'true');
        if (item.thumbnail) {
          const washImg = document.createElement('img');
          washImg.alt = ''; washImg.loading = 'lazy'; washImg.decoding = 'async'; washImg.referrerPolicy = 'no-referrer';
          washImg.src = item.thumbnail;
          washImg.addEventListener('error', () => wash.remove(), { once: true });
          wash.append(washImg);
        } else {
          wash.hidden = true;
        }
        const info = part('library__track-info', '');
        info.append(part('library__track-title', item.title), part('library__track-byline', item.byline || item.sourceLabel));
        const status = part('library__track-state mono', '');
        const meta = part('library__track-meta mono', `${formatTime(item.duration)} · ${Math.round(item.rate)}%`);
        row.append(wash, number, art, info, status, meta);
        row.title = `${item.title} — clique para detalhes; Enter ou duplo clique para abrir`;
        row.addEventListener('click', () => selectTrack(item.id));
        row.addEventListener('dblclick', () => { selectTrack(item.id); openSelected(); });
        fragment.append(row);
      });
      el.tracks.replaceChildren(fragment);
      listSignature = signature;
      el.tracks.scrollTop = scrollTop;
      if (focusedId) [...el.tracks.children].find((row) => row.dataset.id === focusedId)?.focus({ preventScroll: true });
    }
    [...el.tracks.children].forEach((row, index) => {
      const item = rows[index];
      const selected = item.id === selectedId;
      const active = item.id === activeId;
      row.setAttribute('aria-selected', String(selected));
      row.tabIndex = selected || (!selectedId && index === 0) ? 0 : -1;
      row.classList.toggle('is-active', active);
      row.querySelector('.library__track-state').textContent = active
        ? playbackPlaying ? 'TOCANDO' : 'NO EDITOR' : item.favorite ? '★' : '';
    });
  }

  function onTrackKey(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rows = currentTracks();
    const index = rows.findIndex((item) => item.id === event.target.dataset.id);
    if (index < 0) return;
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (delta || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + delta));
      selectTrack(rows[next].id, { focus: true });
    } else if (event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation();
      selectTrack(rows[index].id); openSelected();
    } else if (event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
    }
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
        if (!engine || el.view.hidden || browseCategoryId !== nodeId || !engine.getNode(nodeId)) return;
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
      isNodePlaying: (node) => playbackPlaying && items.some((item) => item.id === activeId && model.belongs(item, node.id)),
      getViewportInsets: graphViewportInsets,
      onResize: () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!engine || el.view.hidden) return;
          if (browseCategoryId && engine.getNode(browseCategoryId)) focusNodeInVisibleViewport(browseCategoryId);
          else scheduleGraphFit();
        }, 90);
      },
      shouldNodeOpenOnClick: () => true,
      onNodeClick: (node) => {
        openCategory(node.id);
      },
    });

  }

  function refreshGraph({ fit = false, reset = false } = {}) {
    if (!engine) return;
    const data = graphData();
    engine.setData(data);
    if (reset) engine.resetLayout();
    if (browseCategoryId && data.nodes.some((node) => node.id === browseCategoryId)) {
      engine.setSelected(browseCategoryId);
    } else {
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
      selectedId = '';
    }

    browseCategoryId = category.id;

    write();
    closeCategoryDialog({ restoreFocus: false });
    refresh({ fit: !renamed });
    if (assignIndex >= 0) notifyChange();
    engine?.resize();
    focusNodeInVisibleViewport(browseCategoryId);
    (assignIndex >= 0 ? el.categorySelect : el.browserTitle).focus({ preventScroll: true });
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
    browseCategoryId = categoryId || ROOT_ID;
    refresh();
    notifyChange();
    focusNodeInVisibleViewport(browseCategoryId);
    const category = categories.find((entry) => entry.id === categoryId);
    document.dispatchEvent(new CustomEvent('varispeed:status', {
      detail: { text: category ? `Movida para ${category.name} · ${item.title}` : `Movida para Biblioteca · ${item.title}` },
    }));
  }

  function refreshDetails() {
    if (!mounted) return;
    const item = items.find((entry) => entry.id === selectedId);
    el.details.hidden = !item;
    el.browser.inert = compactList.matches && Boolean(item);
    if (engine && !el.view.hidden) {
      if (item || (compactList.matches && browseCategoryId)) engine.pause();
      else engine.resume();
    }
    el.view.classList.toggle('has-track', Boolean(item));
    if (!item) return;
    el.detailArtwork.hidden = !item || !item.thumbnail;
    el.detailRows.hidden = !item;
    el.organization.hidden = !item;
    el.musicActions.hidden = !item;

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
    refreshBrowser();
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
    refreshDetails();
    el.view.hidden = true;
    el.editor.hidden = false;
    el.trigger.hidden = false;
    el.trigger.setAttribute('aria-pressed', 'false');
    options.onViewChange?.(false);
  }

  async function measurePerformance({ durationMs = 8000 } = {}) {
    if (!mounted) throw new Error('A Biblioteca ainda não está pronta.');
    if (el.view.hidden) show();

    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    ensureEngine();
    closeTutorial({ remember: false, restoreFocus: false });
    engine?.resize();
    engine?.resume();
    if (!engine?.startPerformanceCapture) {
      throw new Error('O diagnóstico do grafo não está disponível.');
    }

    return engine.startPerformanceCapture({ durationMs });
  }

  async function openSelected() {
    if (opening) return;
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
    } catch (_) {
      document.dispatchEvent(new CustomEvent('varispeed:status', { detail: { text: 'Não foi possível abrir esta faixa. Tente novamente.' } }));
    } finally {
      setOpenBusy(false);
    }
  }

  function setOpenBusy(on, label = '') {
    opening = Boolean(on);
    el.tracks.setAttribute('aria-busy', String(opening));
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
    const category = categories.find((entry) => entry.id === browseCategoryId);
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
    browseCategoryId = ROOT_ID;
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
    refresh();
    notifyChange();
    document.dispatchEvent(new CustomEvent('varispeed:status', {
      detail: { text: favorite ? `Adicionada às Favoritas · ${item.title}` : `Removida das Favoritas · ${item.title}` },
    }));
  }

  function closeDetails() {
    const previous = selectedId;
    selectedId = '';
    refreshBrowser();
    refreshDetails();
    ([...el.tracks.children].find((row) => row.dataset.id === previous) || el.tracks.querySelector('[tabindex="0"]') || el.browserTitle).focus({ preventScroll: true });
  }

  function mount(opts = {}) {
    if (mounted) return;
    options = opts;
    Object.assign(el, {
      view: $('libraryView'), editor: $('editorMain'), trigger: $('btnLibrary'),
      browser: $('libraryBrowser'), browserTitle: $('libraryBrowserTitle'), browserCount: $('libraryBrowserCount'),
      browserClose: $('libraryBrowserClose'), tracks: $('libraryTracks'), sort: $('librarySort'),
      total: $('librarySummary'), categoryNav: $('libraryCategoryNav'),
      listEmpty: $('libraryListEmpty'), listEmptyTitle: $('libraryListEmptyTitle'),
      listEmptyHint: $('libraryListEmptyHint'), listEmptyAction: $('libraryListEmptyAction'),
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
      if (text(el.search.value) && !browseCategoryId) browseCategoryId = ROOT_ID;
      refresh({ fit: true });
    });
    el.categoryNav.addEventListener('change', () => el.categoryNav.value ? openCategory(el.categoryNav.value) : closeBrowser());
    el.browserClose.addEventListener('click', closeBrowser);
    el.sort.addEventListener('change', () => { refreshBrowser(); refreshDetails(); });
    el.tracks.addEventListener('keydown', onTrackKey);
    compactList.addEventListener('change', () => {
      refreshDetails();
      if (compactList.matches && selectedId) el.detailClose.focus({ preventScroll: true });
      engine?.resize();
    });
    el.listEmptyAction.addEventListener('click', () => {
      if (text(el.search.value)) { el.search.value = ''; refresh({ fit: true }); el.search.focus(); }
      else if (browseCategoryId === ROOT_ID) { hide(); el.trigger.focus(); }
      else openCategory(ROOT_ID);
    });
    el.open.addEventListener('click', openSelected);
    el.favorite.addEventListener('click', toggleFavorite);
    el.categorySelect.addEventListener('change', assignSelectedCategory);
    el.categoryCreate.addEventListener('click', () => openCategoryDialog());
    el.categoryCreateInline.addEventListener('click', () => openCategoryDialog({ assignId: selectedId }));
    el.categoryRename.addEventListener('click', () => openCategoryDialog({ categoryId: browseCategoryId }));
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
      if (el.view.hidden || window.Settings?.isOpen?.()) return;
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
      if (selectedId) { closeDetails(); return; }
      if (browseCategoryId) { closeBrowser(); return; }
      hide();
      el.trigger.focus({ preventScroll: true });
    });
    mounted = true;
    refresh();
    readyPromise = hydrate(savedItems);
  }

  window.MediaLibrary = {
    mount, record, updateActive, show, hide, measurePerformance,
    refreshStyles() { engine?.refreshStyles(); },
    find(data = {}) {
      const item = items.find((entry) => sameMedia(entry, data));
      return item ? { ...item } : null;
    },
    setActive(id = '') {
      activeId = items.some((item) => item.id === id) ? id : '';
      engine?.refreshStyles();
      refreshBrowser();
      refreshDetails();
    },
    setPlaybackState(playing = false) {
      playbackPlaying = Boolean(playing);
      engine?.refreshStyles();
      refreshBrowser();
    },
    get ready() { return readyPromise; },
    get activeId() { return activeId; },
    get items() { return items.map((item) => ({ ...item })); },
    get categories() { return categories.map((category) => ({ ...category })); },
    get performance() { return engine?.getPerformanceSnapshot?.() || null; },
  };
})();
