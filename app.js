/* ═════════════════════════════════════════════════════════
   VARISPEED — velocidade de áudio sem preservação de pitch
   ═════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ── lógica pura ──────────────────────────────────────
     core.js concentra formatação, conversão de velocidade,
     geometria de canvas/view e nome de arquivo. É testado por
     `node --test tests/` contra uma cópia literal das
     implementações que viviam aqui (tests/legacy-snapshot.js),
     então as funções abaixo são só invólucros que injetam
     cfg()/state. Não reimplementar nada aqui: mudar a regra
     em core.js mantém teste e app em sincronia.
     core.js precisa vir antes de app.js no index.html e estar
     listado em PUBLIC_FILES (server/main.py). */
  const Core = window.VarispeedCore;
  if (!Core) throw new Error('VARISPEED: core.js não carregou antes de app.js');

  const $ = (id) => document.getElementById(id);
  /* Controles apresentados em mais de uma área nascem sempre do componente
     oficial. Assim marcação, classes, SVGs e atributos não são mantidos em
     cópias manuais que podem divergir. */
  function cloneControl(source, slotId, cloneId) {
    if (!source) throw new Error(`VARISPEED: fonte ausente para ${cloneId}`);
    const clone = source.cloneNode(true);
    clone.id = cloneId;
    $(slotId).replaceChildren(clone);
    return clone;
  }

  const libraryPlay = cloneControl($('btnPlay'), 'libraryPlaySlot', 'libraryPlay');
  const libraryStop = cloneControl($('btnStop'), 'libraryStopSlot', 'libraryStop');
  const libraryLoop = cloneControl($('btnLoop'), 'libraryLoopSlot', 'libraryLoop');
  const libraryScrubGroup = document.querySelector('.transport > .transport__scrub').cloneNode(true);
  libraryScrubGroup.classList.add('hdr-player__scrub');
  const libraryCurrent = libraryScrubGroup.querySelector('#tCur');
  const libraryScrub = libraryScrubGroup.querySelector('#scrub');
  const libraryTotal = libraryScrubGroup.querySelector('#tTot');
  libraryCurrent.id = 'libraryCurrent';
  libraryScrub.id = 'libraryScrub';
  libraryScrub.setAttribute('aria-label', 'Posição da música na Biblioteca');
  libraryTotal.id = 'libraryTotal';
  $('libraryScrubSlot').replaceChildren(libraryScrubGroup);
  const focusRateDown = cloneControl($('rateDown'), 'fRateDownSlot', 'fRateDown');
  const focusRateUp = cloneControl($('rateUp'), 'fRateUpSlot', 'fRateUp');
  const el = {
    root: document.documentElement, themeColor: $('themeColor'),
    file: $('file'), btnImport: $('btnImport'),
    importMenu: $('importMenu'), importFile: $('importFile'), importLink: $('importLink'),
    importMenuWrap: document.querySelector('.import-menu-wrap'),
    btnLibraryAdd: $('btnLibraryAdd'),
    fileName: $('fileName'), fileMeta: $('fileMeta'),
    libraryTransport: $('libraryTransport'), libraryPlay, libraryStop,
    libraryLoop, libraryScrub,
    libraryCurrent, libraryTotal,
    scopeWrap: $('scopeWrap'), scope: $('scope'), rateGhost: $('rateGhost'),
    ruler: $('ruler'), wave: $('wave'), waveHost: $('waveHost'),
    canvasWrap: $('canvasWrap'), playhead: $('playhead'),
    empty: $('empty'), loading: $('loading'),
    posTime: $('posTime'), outTime: $('outTime'), rateTag: $('rateTag'),
    zoomIn: $('btnZoomIn'), zoomOut: $('btnZoomOut'), zoomTag: $('zoomTag'),
    btnPlay: $('btnPlay'), btnStop: $('btnStop'), btnLoop: $('btnLoop'),
    scrub: $('scrub'), tCur: $('tCur'), tTot: $('tTot'),
    vol: $('vol'), volTag: $('volTag'),
    rateInput: $('rateInput'), rateSlider: $('rateSlider'),
    rateUp: $('rateUp'), rateDown: $('rateDown'),
    presets: Array.from(document.querySelectorAll('.btn--preset')),
    rPitch: $('rPitch'), rFreq: $('rFreq'), rDur: $('rDur'), rDelta: $('rDelta'),
    sName: $('sName'), sDur: $('sDur'), sRate: $('sRate'), sCh: $('sCh'), sSize: $('sSize'),
    sourceArtwork: $('sourceArtwork'), sourceArtworkImage: $('sourceArtworkImage'),
    btnExport: $('btnExport'), exportLabel: $('exportLabel'),
    statusMsg: $('statusMsg'), drop: $('drop'),
    rateUnit: document.querySelector('.rate__unit'),
    presetHost: document.querySelector('.presets'),
    ticks: document.querySelector('.ticks'),
    sbarItems: Array.from(document.querySelectorAll('.sbar__item')),
    /* apresentações do osciloscópio */
    focus: $('focus'), scopeFocus: $('scopeFocus'),
    fCur: $('fCur'), fTot: $('fTot'), fScrub: $('fScrub'), fRate: $('fRate'),
    fRateUp: focusRateUp, fRateDown: focusRateDown, fExit: $('fExit'),
    btnPop: $('btnPop'),
    /* importação por link */
    linkbar: $('linkbar'), url: $('url'),
    urlGo: $('btnUrlGo'), urlClose: $('btnUrlClose'),
    urlProg: $('urlProg'), urlStage: $('urlStage'), urlPct: $('urlPct'),
    urlTrack: $('urlTrack'), urlFill: $('urlFill'), urlMsg: $('urlMsg'),
    urlAuthWrap: $('urlAuthWrap'), urlAuth: $('btnUrlAuth'), urlAuthHint: $('urlAuthHint'),
    urlPreview: $('urlPreview'), urlThumbWrap: $('urlThumbWrap'), urlThumb: $('urlThumb'),
    urlSource: $('urlSource'), urlTitle: $('urlTitle'), urlByline: $('urlByline'),
    urlDuration: $('urlDuration'), urlImport: $('btnUrlImport'),
  };

  const BUCKETS = 16384;
  const cfg = (k) => window.Settings.get(k);
  const rateMin = () => cfg('rate.min');
  const rateMax = () => cfg('rate.max');

  /* última velocidade — guardada fora do preset, é sessão, não ajuste */
  const RATE_KEY = 'tempo.lastRate';
  const readLastRate = () => {
    try { const a = window[['local', 'Storage'].join('')]; return parseFloat(a.getItem(RATE_KEY)); } catch (e) { return NaN; }
  };
  const writeLastRate = (v) => {
    try { window[['local', 'Storage'].join('')].setItem(RATE_KEY, String(v)); } catch (e) { /* sem persistência */ }
  };
  const clearLastRate = () => {
    try { window[['local', 'Storage'].join('')].removeItem(RATE_KEY); } catch (e) { /* sem persistência */ }
  };

  const state = {
    audio: new Audio(),
    buffer: null,
    peaks: null,
    url: null,
    rate: 100,
    zoom: 1,
    view: 0,            // início da janela visível, em segundos de fonte
    loaded: false,
    playing: false,
    scrubbing: false,
    exporting: false,
    focus: false,
    fScrubbing: false,
    meta: { name: '', size: 0, sampleRate: 0, channels: 0, duration: 0, thumbnail: '' },
  };

  state.audio.preload = 'auto';
  state.audio.preservesPitch = false;
  state.audio.mozPreservesPitch = false;
  state.audio.webkitPreservesPitch = false;

  /* Desligamento solicitado em Configurações: encerra também a reprodução e
     o AudioContext antes de o backend local finalizar. */
  document.addEventListener('varispeed:shutdown', () => {
    try { state.audio.pause(); } catch (_) {}
    state.playing = false;
    window.MediaLibrary?.setPlaybackState(false);
    try { if (scope && scope.ac && scope.ac.state !== 'closed') scope.ac.close(); } catch (_) {}
  });

  /* ── formatação ─────────────────────────────────────── */
  const clamp = Core.clamp;

  /* formato conforme configuração: m:ss.cc, segundos ou amostras */
  const fmtTime = (s) => Core.fmtTime(s, {
    format: cfg('tl.format'),
    sampleRate: state.meta.sampleRate,
  });

  /* velocidade na unidade escolhida — o estado interno segue em % */
  const rateText = (v) => Core.rateText(v, cfg('rate.unit'));
  const rateSuffix = () => Core.rateSuffix(cfg('rate.unit'));
  const parseRate = (txt) => Core.parseRate(txt, cfg('rate.unit'));
  const fmtBytes = Core.fmtBytes;
  /* Status textual oficial do VARISPEED.
     A animação-base é a mesma da confirmação de exportação; estados
     persistentes usam a mesma entrada, mas ficam visíveis até a próxima
     atualização. Assim transporte, importação, erros/sucessos e eventos
     compartilham uma única linguagem de motion. */
  let tempTimer = 0;
  const status = (msg, opts = {}) => {
    clearTimeout(tempTimer);
    window.Motion.cancel(el.statusMsg);
    if (!cfg('motion.status')) {
      el.statusMsg.textContent = msg;
      return;
    }
    window.Motion.status(el.statusMsg, msg, Object.assign({
      persist: true,
      caret: false,
      intensity: 0.92,
    }, opts));
  };
  const afterTemp = () => { if (state.exporting) status('Renderizando saída offline'); };

  /* mesma mensagem sem animação: aparece, sustenta e some.
     Usado quando o efeito correspondente está desativado. */
  function plainTemp(text, lead, hold) {
    clearTimeout(tempTimer);
    window.Motion.cancel(el.statusMsg);
    el.statusMsg.textContent = `${lead || ''}${text}`;
    tempTimer = setTimeout(() => { el.statusMsg.textContent = ''; afterTemp(); }, hold);
  }

  /* Evento temporário padrão: mesma cadência da confirmação de exportação,
     variando apenas a sustentação quando o contexto pede mais/menos tempo. */
  const flash = (msg, opts = {}) => {
    if (!cfg('motion.status')) { plainTemp(msg, opts.lead || '', opts.hold || 1450); return; }
    clearTimeout(tempTimer);
    window.Motion.status(el.statusMsg, msg, Object.assign({
      onDone: afterTemp,
      hold: 1450,
      caret: cfg('motion.caret'),
    }, opts));
  };
  const motionSweep = () => cfg('motion.sweep') && !window.Motion.reduced();
  const dot = (s) => { el.scopeWrap.dataset.state = s; };

  /* REV 2 · uma faixa carregada no editor não é necessariamente uma faixa da
     Biblioteca. Este rascunho conserva sua origem e seu Blob até que o usuário
     decida salvá-la (ou a preferência de inclusão automática faça isso). */
  let libraryDraft = null;
  let libraryAddBusy = false;
  let libraryViewOpen = false;
  let libraryTransportScrubbing = false;

  function syncScrubPosition(input, current, duration, locked = false) {
    if (locked) return;
    const progress = duration > 0 ? clamp(current / duration, 0, 1) : 0;
    input.value = String(Math.round(progress * 1000));
  }

  function updateLibraryTransportPosition(current = state.audio.currentTime || 0) {
    if (!el.libraryScrub || libraryTransportScrubbing) return;
    const duration = state.meta.duration || 0;
    const progress = duration > 0 ? clamp(current / duration, 0, 1) : 0;
    syncScrubPosition(el.libraryScrub, current, duration);
    el.libraryScrub.style.setProperty('--seek-progress', `${(progress * 100).toFixed(3)}%`);
    el.libraryScrub.setAttribute('aria-valuetext', `${fmtTime(current)} de ${fmtTime(duration)}`);
    const rate = state.rate / 100;
    el.libraryCurrent.textContent = fmtTime(current / rate);
    el.libraryTotal.textContent = fmtTime(duration / rate);
  }

  function syncLibraryTransport() {
    if (!el.libraryTransport) return;
    const visible = state.loaded && libraryViewOpen;
    el.libraryTransport.hidden = !visible;
    el.libraryPlay.disabled = !state.loaded;
    el.libraryStop.disabled = !state.loaded;
    el.libraryLoop.disabled = !state.loaded;
    el.libraryScrub.disabled = !state.loaded;

    const looping = state.audio.loop;
    el.libraryLoop.setAttribute('aria-pressed', String(looping));
    el.libraryLoop.setAttribute('aria-label', looping ? 'Desativar repetição' : 'Ativar repetição');
    if (visible) updateLibraryTransportPosition();
  }

  function syncPlayControl(button, playing) {
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir');
    button.title = playing ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)';
  }

  const syncPlayback = () => {
    const playing = state.loaded && state.playing;
    [el.btnPlay, el.libraryPlay].forEach((button) => syncPlayControl(button, playing));
    window.MediaLibrary?.setPlaybackState(state.playing);
    syncLibraryTransport();
  };

  function libraryEntryNow() {
    if (!libraryDraft) return null;
    return {
      ...libraryDraft.entry,
      size: state.meta.size,
      duration: state.meta.duration,
      sampleRate: state.meta.sampleRate,
      channels: state.meta.channels,
      rate: state.rate,
      position: state.audio.currentTime || 0,
    };
  }

  function libraryMatch() {
    const entry = libraryEntryNow();
    return entry ? window.MediaLibrary?.find(entry) : null;
  }

  function syncLibraryAdd() {
    if (!el.btnLibraryAdd) return;
    const stored = libraryMatch();
    const canAdd = state.loaded && libraryDraft && !stored && !libraryViewOpen;
    el.btnLibraryAdd.hidden = !canAdd;
    el.btnLibraryAdd.disabled = libraryAddBusy;
    el.btnLibraryAdd.classList.toggle('is-busy', libraryAddBusy && motionSweep());
    if (libraryAddBusy) el.btnLibraryAdd.setAttribute('aria-busy', 'true');
    else el.btnLibraryAdd.removeAttribute('aria-busy');
    const label = libraryAddBusy ? 'Adicionando à Biblioteca' : 'Adicionar a música atual à Biblioteca';
    el.btnLibraryAdd.setAttribute('aria-label', label);
    el.btnLibraryAdd.title = label;
  }

  function setLibraryDraft(entry, blob) {
    libraryDraft = entry && blob instanceof Blob ? { entry: { ...entry }, blob } : null;
    const stored = libraryMatch();
    window.MediaLibrary?.setActive(stored ? stored.id : '');
    syncLibraryAdd();
  }

  function handleLibraryChange(currentItems = []) {
    if (libraryDraft?.entry?.id && !currentItems.some((item) => item.id === libraryDraft.entry.id)) {
      const { id, createdAt, lastOpenedAt, ...reAddable } = libraryDraft.entry;
      libraryDraft.entry = reAddable;
    }
    syncLibraryAdd();
  }

  async function addCurrentToLibrary({ automatic = false } = {}) {
    if (!libraryDraft || libraryAddBusy) return null;
    const existing = libraryMatch();
    if (existing) {
      window.MediaLibrary?.setActive(existing.id);
      syncLibraryAdd();
      return existing;
    }

    libraryAddBusy = true;
    syncLibraryAdd();
    try {
      const item = await window.MediaLibrary?.record(libraryEntryNow(), libraryDraft.blob);
      if (item) {
        libraryDraft.entry = { ...item };
        window.MediaLibrary?.setActive(item.id);
        if (!automatic) flash(`Adicionada à Biblioteca · ${item.title}`);
      }
      return item || null;
    } finally {
      libraryAddBusy = false;
      syncLibraryAdd();
    }
  }

  if (el.btnLibraryAdd) el.btnLibraryAdd.addEventListener('click', () => addCurrentToLibrary());

  /* ── tema ───────────────────────────────────────────── */
  let themeTimer = 0, themeFadeTimer = 0;
  function setTheme(t, animate = false) {
    const changing = animate && el.root.dataset.theme !== t;
    const soft = changing && !window.Motion.reduced();

    if (soft) {
      // interpolação das propriedades de cor + cross-dissolve dos canvases,
      // que não interpolam por serem pintados em pixels.
      el.root.classList.add('theme-anim');
      el.canvasWrap.classList.add('is-xfade');
      clearTimeout(themeTimer); clearTimeout(themeFadeTimer);
      themeFadeTimer = setTimeout(() => {
        el.canvasWrap.classList.remove('is-xfade');
      }, 130);
      themeTimer = setTimeout(() => el.root.classList.remove('theme-anim'), 320);
    }

    el.root.dataset.theme = t;
    if (el.themeColor) el.themeColor.content = t === 'light' ? '#ffffff' : '#000000';

    const repaint = () => { invalidateScopeColors(); draw(); repaintScope(); };
    requestAnimationFrame(repaint);
    if (soft) setTimeout(repaint, 120);   // repinta no meio do cross-dissolve
  }
  /* o tema é um ajuste persistido e é alterado exclusivamente em Configurações. */
  const sysLight = window.matchMedia('(prefers-color-scheme: light)');
  const sysReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const resolveTheme = () => {
    const t = cfg('ui.theme');
    return t === 'system' ? (sysLight.matches ? 'light' : 'dark') : t;
  };
  setTheme(resolveTheme());
  sysLight.addEventListener('change', () => {
    if (cfg('ui.theme') === 'system') setTheme(resolveTheme(), true);
  });
  sysReduced.addEventListener('change', () => {
    if (cfg('motion.level') === 'system') applyAll();
  });

  /* ── canvas / hidpi ─────────────────────────────────── */
  const ctxW = el.wave.getContext('2d');
  const ctxR = el.ruler.getContext('2d');
  let W = 0, H = 0, RH = 0, canvasDpr = 0;
  let waveScaleX = 1;
  let resizeRaf = 0, resizeSettle = 0, dprMedia = null;

  /* REV 6 — DPR/zoom fracionário
     - não arredondar a geometria CSS antes de criar o bitmap;
     - usar a razão REAL backing-store/CSS como transform do contexto;
     - aceitar DPR até 3 (Windows 150% + browser 150% pode chegar a 2.25);
     - rearmar um matchMedia quando o DPR muda, inclusive ao mover a janela
       entre monitores com escalas diferentes. */
  const canvasDprNow = () => Core.dprClamp(window.devicePixelRatio);
  const sizeChanged = Core.sizeChanged;
  function setCanvasBitmap(canvas, ctx, cssW, cssH, dpr) {
    const { bw, bh, sx, sy } = Core.canvasScale(cssW, cssH, dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    return { sx, sy };
  }
  const snapDeviceX = (x) => Core.snapToDevice(x, waveScaleX);

  /*
     REV 3 — resize real

     A janela temporal (state.view/state.zoom), currentTime e estado de
     reprodução NÃO pertencem ao canvas. Resize só recalcula a geometria
     física dos alvos e repinta o estado já existente. Isso evita reset de
     zoom/posição ao redimensionar a janela, girar o aparelho ou mudar DPR.
  */
  function resize(force = false) {
    const dpr = canvasDprNow();
    const wRect = el.wave.getBoundingClientRect();
    const rRect = el.ruler.getBoundingClientRect();
    const nW = Math.max(1, wRect.width);
    const nH = Math.max(1, wRect.height);
    const nRH = Math.max(1, rRect.height);
    const changed = force || sizeChanged(nW, W) || sizeChanged(nH, H) ||
      sizeChanged(nRH, RH) || Math.abs(dpr - canvasDpr) > 0.0001;

    if (!changed) return false;

    W = nW; H = nH; RH = nRH; canvasDpr = dpr;
    const ws = setCanvasBitmap(el.wave, ctxW, W, H, dpr);
    setCanvasBitmap(el.ruler, ctxR, W, RH, dpr);
    waveScaleX = ws.sx;

    scopeResize();
    draw();
    movePlayhead();
    return true;
  }

  function scheduleResize({ settle = false } = {}) {
    if (!resizeRaf) {
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        resize();
      });
    }
    if (settle) {
      clearTimeout(resizeSettle);
      resizeSettle = setTimeout(() => resize(), 140);
    }
  }

  /* Observar os alvos diretamente é intencional: em alguns breakpoints a
     altura da régua muda enquanto o container total permanece igual. */
  const canvasRO = new ResizeObserver(() => scheduleResize());
  canvasRO.observe(el.wave);
  canvasRO.observe(el.ruler);
  canvasRO.observe(el.canvasWrap);

  /* ResizeObserver cobre layout; estes eventos cobrem rotação, zoom/DPR e
     mudanças da visual viewport causadas por barras do navegador mobile. */
  window.addEventListener('resize', () => scheduleResize({ settle: true }), { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => scheduleResize({ settle: true }), { passive: true });
  }
  window.addEventListener('orientationchange', () => {
    scheduleResize({ settle: true });
    setTimeout(() => scheduleResize(), 260);
  }, { passive: true });

  /* window.resize costuma disparar no zoom, mas não é garantido em toda troca
     de monitor/escala. Um media query armado com o DPR atual dispara assim que
     aquela resolução deixa de corresponder; em seguida ele é rearmado. */
  function armDprWatcher() {
    if (!window.matchMedia) return;
    if (dprMedia) {
      try { dprMedia.removeEventListener('change', onDprChange); } catch (_) {
        try { dprMedia.removeListener(onDprChange); } catch (_) {}
      }
    }
    const raw = Number(window.devicePixelRatio) || 1;
    dprMedia = window.matchMedia(`(resolution: ${raw}dppx)`);
    try { dprMedia.addEventListener('change', onDprChange, { once: true }); } catch (_) {
      try { dprMedia.addListener(onDprChange); } catch (_) {}
    }
  }
  function onDprChange() {
    armDprWatcher();
    scheduleResize({ settle: true });
  }
  armDprWatcher();

  const css = (n) => getComputedStyle(el.root).getPropertyValue(n).trim();

  /* ═══ osciloscópio ═══════════════════════════════════
     Uma única leitura do sinal real (MediaElementSource →
     Analyser → destino) alimenta várias apresentações: o
     osciloscópio do header, o Focus Mode e a janela
     independente. Nenhuma delas duplica áudio ou análise —
     todas recebem o mesmo quadro e apenas o desenham na
     própria escala.                                        */
  const scope = {
    ac: null, an: null, buf: null,
    splitter: null, leftAn: null, rightAn: null,
    leftBuf: null, rightBuf: null, lastStereo: null,
    t0: 0, last: 0,
  };
  const views = {
    inline: window.ScopeView.create(el.scope, { compactHorizontal: true }),
    focus: window.ScopeView.create(el.scopeFocus, { compactHorizontal: true }),
  };
  const pop = { win: null, want: false };

  const scopeWin = () => clamp(cfg('scope.window'), 64, (scope.buf ? scope.buf.length : 2048) - 2);
  const scopeState = () => el.scopeWrap.dataset.state || 'idle';
  const scopeOpts = () => ({
    visualizer: cfg('scope.visualizer'),
    gain: cfg('scope.gain'), mode: cfg('scope.mode'), smooth: cfg('scope.smooth'),
    vectorTrail: cfg('scope.vectorTrail'), vectorSize: cfg('scope.vectorSize'),
    vectorDensity: cfg('scope.vectorDensity'),
  });

  function scopeResize() {
    views.inline.resize();
    if (state.focus) views.focus.resize();
    repaintScope();
  }

  function ensureGraph() {
    if (scope.an) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const src = ac.createMediaElementSource(state.audio);
      const an = ac.createAnalyser();
      const splitter = ac.createChannelSplitter(2);
      const leftAn = ac.createAnalyser();
      const rightAn = ac.createAnalyser();
      an.fftSize = 2048;
      leftAn.fftSize = 2048;
      rightAn.fftSize = 2048;
      src.connect(an);
      an.connect(ac.destination);
      src.connect(splitter);
      splitter.connect(leftAn, 0);
      splitter.connect(rightAn, 1);
      scope.ac = ac; scope.an = an;
      scope.buf = new Float32Array(an.fftSize);
      scope.splitter = splitter; scope.leftAn = leftAn; scope.rightAn = rightAn;
      scope.leftBuf = new Float32Array(leftAn.fftSize);
      scope.rightBuf = new Float32Array(rightAn.fftSize);
      return true;
    } catch (e) { return false; }
  }

  /* recorte da janela visível, alinhado por cruzamento de zero */
  function analyse() {
    if (!scope.an) return null;
    if (cfg('scope.visualizer') === 'vectorscope' && scope.leftAn && scope.rightAn) {
      scope.leftAn.getFloatTimeDomainData(scope.leftBuf);
      scope.rightAn.getFloatTimeDomainData(scope.rightBuf);
      const win = scopeWin();
      const start = Math.max(0, Math.floor((scope.leftBuf.length - win) / 2));
      const stereo = {
        left: scope.leftBuf.subarray(start, start + win),
        right: scope.rightBuf.subarray(start, start + win),
      };
      scope.lastStereo = stereo;
      return { samples: null, stereo };
    }
    const buf = scope.buf;
    scope.an.getFloatTimeDomainData(buf);
    const N = buf.length;
    const win = scopeWin();
    const limit = Math.max(0, N - win - 1);
    let trig = 0;
    if (cfg('scope.trigger')) {
      for (let i = 1; i < Math.min(limit || N, N >> 1); i++) {
        if (buf[i - 1] <= 0 && buf[i] > 0) { trig = i; break; }
      }
    }
    trig = clamp(trig, 0, limit);
    return { samples: buf.subarray(trig, trig + win), stereo: null };
  }

  /* um quadro, três destinos */
  function pumpScope(ts) {
    const st = scopeState();
    const on = cfg('scope.on');
    const analysed = (on && st === 'live') ? analyse() : null;
    const samples = analysed ? analysed.samples : null;
    const stereo = analysed ? analysed.stereo
      : (cfg('scope.visualizer') === 'vectorscope' ? scope.lastStereo : null);
    const frame = { state: st, samples, stereo, ts, t0: scope.t0, mediaKey: state.url || '' };
    const o = scopeOpts();
    if (on && !el.scopeWrap.hidden) views.inline.render(frame, o);
    if (state.focus) views.focus.render(frame, o);
    if (pop.want && pop.win && !pop.win.closed) {
      pop.want = false;
      try {
        pop.win.postMessage({
          type: 'tempo:frame',
          state: st,
          samples: samples ? new Float32Array(samples) : null,
          stereo: stereo ? {
            left: new Float32Array(stereo.left),
            right: new Float32Array(stereo.right),
          } : null,
          mediaKey: state.url || '',
          ts, t0: scope.t0,
          gain: o.gain, mode: o.mode, smooth: o.smooth,
          visualizer: o.visualizer,
          vectorTrail: o.vectorTrail, vectorSize: o.vectorSize,
          vectorDensity: o.vectorDensity,
          theme: el.root.dataset.theme,
          title: state.meta.name || '',
        }, '*');
      } catch (e) { pop.want = false; }
    }
  }
  const repaintScope = () => pumpScope(performance.now());
  const invalidateScopeColors = () => {
    views.inline.invalidateColors();
    views.focus.invalidateColors();
  };

  /* ── peaks ──────────────────────────────────────────── */
  function computePeaks(buf) {
    const n = Math.min(BUCKETS, Math.max(512, buf.length));
    const step = buf.length / n;
    const chans = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
    const min = new Float32Array(n), max = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s0 = Math.floor(i * step), s1 = Math.min(buf.length, Math.floor((i + 1) * step));
      let lo = 1, hi = -1;
      for (let s = s0; s < s1; s++) {
        let v = 0;
        for (let c = 0; c < chans.length; c++) v += chans[c][s];
        v /= chans.length;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (s1 <= s0) { lo = 0; hi = 0; }
      min[i] = lo; max[i] = hi;
    }
    return { min, max, n };
  }

  /* ── view helpers ───────────────────────────────────── */
  const viewDur = () => Core.viewDuration(state.meta.duration, state.zoom);
  function clampView() {
    state.view = Core.clampView(state.view, state.meta.duration, viewDur());
  }
  function centerOn(t) {
    state.view = t - viewDur() / 2;
    clampView();
  }
  /* régua em tempo de saída (padrão) ou em tempo da fonte */
  const rulerRate = () => (cfg('tl.ruler') === 'source' ? 1 : state.rate / 100);
  const srcToX = (t) => Core.srcToX(t, state.view, viewDur(), W);
  const xToSrc = (x) => Core.xToSrc(x, state.view, viewDur(), W);

  /* ── desenho ────────────────────────────────────────── */
  function draw() {
    drawRuler();
    drawWave();
  }

  const niceStep = Core.niceStep;

  function drawRuler() {
    ctxR.clearRect(0, 0, W, RH);
    if (!state.loaded) return;
    const r = rulerRate();
    const outStart = state.view / r;
    const outSpan = viewDur() / r;
    const step = niceStep(outSpan / Math.max(3, Math.floor(W / 88)));
    const cText3 = css('--text-3'), cGrid = css('--grid-major'), cAxis = css('--wave-axis');

    ctxR.fillStyle = cAxis;
    ctxR.fillRect(0, RH - 1, W, 1);

    ctxR.font = `500 11px ${css('--font-mono') || 'monospace'}`;
    ctxR.textBaseline = 'middle';

    let t = Math.ceil(outStart / step) * step;
    let lastRight = -Infinity;
    const sub = step / 5;
    let ts = Math.ceil(outStart / sub) * sub;
    ctxR.fillStyle = cGrid;
    for (; ts < outStart + outSpan; ts += sub) {
      const x = Math.round(((ts - outStart) / outSpan) * W);
      ctxR.fillRect(x, RH - 5, 1, 4);
    }
    for (; t < outStart + outSpan + 1e-9; t += step) {
      const x = Math.round(((t - outStart) / outSpan) * W);
      ctxR.fillStyle = cAxis;
      ctxR.fillRect(x, RH - 9, 1, 8);
      const label = fmtTime(Math.max(0, t));
      const wTxt = ctxR.measureText(label).width;
      const lx = Math.max(2, x + 5);
      if (lx + wTxt <= W - 3 && lx >= lastRight + 12) {
        ctxR.fillStyle = cText3;
        ctxR.fillText(label, lx, RH / 2 - 1);
        lastRight = lx + wTxt;
      }
    }
  }

  function drawWave() {
    ctxW.clearRect(0, 0, W, H);
    if (!state.loaded || !state.peaks) return;

    const mid = Math.round(H / 2) + 0.5;
    const amp = (H / 2) - 10;
    const r = rulerRate();
    const outStart = state.view / r;
    const outSpan = viewDur() / r;

    // grade vertical alinhada ao ruler
    const step = niceStep(outSpan / Math.max(3, Math.floor(W / 88)));
    ctxW.fillStyle = css('--grid');
    for (let t = Math.ceil(outStart / step) * step; t < outStart + outSpan; t += step) {
      const x = Math.round(((t - outStart) / outSpan) * W);
      ctxW.fillRect(x, 0, 1, H);
    }

    // eixo central
    ctxW.fillStyle = css('--wave-axis');
    ctxW.fillRect(0, mid - 0.5, W, 1);

    const { min, max, n } = state.peaks;
    const d = state.meta.duration;
    const playedX = srcToX(state.audio.currentTime || 0);
    const cWave = css('--wave'), cPlayed = css('--wave-played');

    for (let x = 0; x < W; x++) {
      const t0 = xToSrc(x), t1 = xToSrc(x + 1);
      let i0 = Math.floor((t0 / d) * n), i1 = Math.ceil((t1 / d) * n);
      i0 = clamp(i0, 0, n - 1); i1 = clamp(i1, i0 + 1, n);
      let lo = 1, hi = -1;
      for (let i = i0; i < i1; i++) { if (min[i] < lo) lo = min[i]; if (max[i] > hi) hi = max[i]; }
      if (hi < lo) { lo = 0; hi = 0; }
      const yTop = mid - hi * amp;
      const yBot = mid - lo * amp;
      const h = Math.max(1, yBot - yTop);
      ctxW.fillStyle = x < playedX ? cPlayed : cWave;
      ctxW.fillRect(x, yTop, 1, h);
    }
  }

  /* ── playhead ───────────────────────────────────────── */
  function movePlayhead() {
    if (!state.loaded) return;
    const x = srcToX(state.audio.currentTime || 0);
    const visible = x >= -1 && x <= W + 1;
    el.playhead.hidden = !visible;
    if (visible) el.playhead.style.transform = `translateX(${snapDeviceX(x)}px)`;
  }

  /* ── leituras numéricas ─────────────────────────────── */
  function renderReadouts() {
    const r = state.rate / 100;
    const src = state.meta.duration || 0;
    const out = src / r;
    const st = 12 * Math.log2(r);
    el.rateTag.textContent = `${rateText(state.rate)}${cfg('rate.unit') === 'pct' ? '%' : ` ${rateSuffix()}`}`;
    el.rPitch.textContent = `${st >= 0 ? '+' : '−'}${Math.abs(st).toFixed(2)} st`;
    el.rFreq.textContent = `${r.toFixed(3)}×`;
    el.rDur.textContent = fmtTime(out);
    const delta = out - src;
    el.rDelta.textContent = `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)} s`;
    el.outTime.textContent = fmtTime(out);
    el.tTot.textContent = fmtTime(out);
    el.posTime.textContent = fmtTime((state.audio.currentTime || 0) / r);
    el.tCur.textContent = fmtTime((state.audio.currentTime || 0) / r);
    el.zoomTag.textContent = `${state.zoom.toFixed(1)}×`;
    /* o Focus Mode lê os mesmos valores, em escala reduzida */
    el.fRate.textContent = el.rateTag.textContent;
    el.fTot.textContent = fmtTime(out);
    el.fCur.textContent = fmtTime((state.audio.currentTime || 0) / r);
    el.presets.forEach((b) => b.classList.toggle('is-on', Math.abs(+b.dataset.rate - state.rate) < 0.001));
    syncLibraryTransport();
  }

  /* contador de quadros — exposto no diagnóstico do painel */
  const perf = { fps: 0, frames: 0, mark: 0 };

  function tick(ts) {
    ts = ts || performance.now();
    perf.frames++;
    if (ts - perf.mark >= 500) {
      perf.fps = Math.round((perf.frames * 1000) / (ts - perf.mark));
      perf.frames = 0; perf.mark = ts;
    }
    const sSt = el.scopeWrap.dataset.state;
    const minGap = cfg('scope.fps') === '30' ? 32 : 0;
    const pumping = sSt === 'live' || sSt === 'busy' || pop.want;
    if (pumping && cfg('scope.on') && ts - scope.last >= minGap) {
      scope.last = ts;
      pumpScope(ts);
    }
    if (state.loaded) {
      const r = state.rate / 100;
      const cur = state.audio.currentTime || 0;
      el.posTime.textContent = fmtTime(cur / r);
      el.tCur.textContent = fmtTime(cur / r);
      syncScrubPosition(el.scrub, cur, state.meta.duration, state.scrubbing);
      if (libraryViewOpen) updateLibraryTransportPosition(cur);
      if (state.playing && state.zoom > 1) {
        const x = srcToX(cur);
        if (x > W * 0.82 || x < W * 0.12) { centerOn(cur); draw(); }
      }
      movePlayhead();
      if (state.playing) drawWave();
      if (state.focus) syncFocus(cur, r);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ── rate ───────────────────────────────────────────── */
  function setRate(v, opts = {}) {
    const val = clamp(Math.round(v * 10) / 10, rateMin(), rateMax());
    const prev = state.rate;
    state.rate = val;
    if (cfg('load.rememberRate')) writeLastRate(val);
    state.audio.preservesPitch = false;
    state.audio.mozPreservesPitch = false;
    state.audio.webkitPreservesPitch = false;
    try { state.audio.playbackRate = val / 100; } catch (e) { /* noop */ }
    if (!opts.fromInput) el.rateInput.value = rateText(val);
    el.rateSlider.value = String(val);
    // microinteração: só em passos discretos, nunca em arraste contínuo
    if (opts.step && val !== prev && cfg('motion.rateTick')) {
      tickRateValue(rateText(prev), rateText(val), val - prev);
    }
    renderReadouts();
    draw();
  }

  function tickRateValue(prev, next, delta) {
    el.rateGhost.hidden = false;
    el.rateInput.classList.add('is-ghosted');
    window.Motion.digitTick(el.rateGhost, prev, next, delta, () => {
      el.rateInput.classList.remove('is-ghosted');
      el.rateGhost.hidden = true;
      el.rateGhost.textContent = '';
    });
  }

  /* passo dos botões e teclas; Shift multiplica por cinco */
  const rateStep = (big) => parseFloat(cfg('rate.step')) * (big ? 5 : 1);

  el.rateSlider.addEventListener('input', () => setRate(+el.rateSlider.value));
  el.rateInput.addEventListener('input', () => {
    const num = parseRate(el.rateInput.value);
    if (!isNaN(num) && num >= rateMin() && num <= rateMax()) setRate(num, { fromInput: true });
  });
  el.rateInput.addEventListener('blur', () => {
    const num = parseRate(el.rateInput.value);
    if (!isNaN(num)) setRate(num);
    el.rateInput.value = rateText(state.rate);
  });
  el.rateInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { el.rateInput.blur(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setRate(state.rate + rateStep(e.shiftKey)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setRate(state.rate - rateStep(e.shiftKey)); }
  });
  function bindRateStep(button, direction) {
    button.addEventListener('click', () => setRate(
      state.rate + direction * rateStep(false),
      { step: true },
    ));
  }
  [[el.rateUp, 1], [el.rateDown, -1], [el.fRateUp, 1], [el.fRateDown, -1]]
    .forEach(([button, direction]) => bindRateStep(button, direction));

  /* limites, marcas e presets vêm da configuração — reconstruídos ao mudar */
  const presetLabel = (v) => Core.presetLabel(v, cfg('rate.unit'));

  function buildPresets() {
    const list = Core.parsePresets(cfg('rate.presets'), rateMin(), rateMax());
    el.presetHost.textContent = '';
    el.presets = list.map((v) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn--preset mono';
      b.dataset.rate = String(v);
      b.textContent = presetLabel(v);
      b.title = `${v}%`;
      b.addEventListener('click', () => setRate(v, { step: true }));
      el.presetHost.appendChild(b);
      return b;
    });
  }

  function applyRateBounds() {
    const lo = rateMin(), hi = rateMax();
    el.rateSlider.min = String(lo);
    el.rateSlider.max = String(hi);
    el.rateUnit.textContent = rateSuffix();
    el.rateInput.setAttribute('aria-label', `Velocidade em ${{ pct: 'porcentagem', mult: 'multiplicador', st: 'semitons' }[cfg('rate.unit')]}`);
    // marcas em valores redondos, posicionadas onde realmente caem
    const marks = Core.rateMarks(lo, hi);
    el.ticks.textContent = '';
    marks.forEach((m) => {
      const s = document.createElement('span');
      s.textContent = presetLabel(m);
      s.style.left = `${Core.markOffset(m, lo, hi)}%`;
      el.ticks.appendChild(s);
    });
    buildPresets();
    setRate(clamp(state.rate, lo, hi));
  }

  /* ── volume ─────────────────────────────────────────── */
  el.vol.addEventListener('input', () => {
    state.audio.volume = +el.vol.value / 100;
    el.volTag.textContent = el.vol.value;
  });

  /* ── transporte ─────────────────────────────────────── */
  function play() {
    if (!state.loaded) return;
    ensureGraph();
    if (scope.ac && scope.ac.state === 'suspended') scope.ac.resume();
    state.audio.play().then(() => {
      state.playing = true;
      syncPlayback();
      dot('live');
      flash('Reproduzindo');
    }).catch(() => status('Falha na reprodução'));
  }
  function pause() {
    state.audio.pause();
    state.playing = false;
    syncPlayback();
    dot('ready');
    flash('Pausado');
    drawWave();
    repaintScope();
  }
  const toggle = () => (state.playing ? pause() : play());

  [el.btnPlay, el.libraryPlay].forEach((button) => button.addEventListener('click', toggle));
  const stop = () => {
    pause();
    state.audio.currentTime = 0;
    state.view = 0;
    draw(); movePlayhead(); renderReadouts();
    flash('Parado');
  };
  [el.btnStop, el.libraryStop].forEach((button) => button.addEventListener('click', stop));
  const toggleLoop = () => {
    const on = state.audio.loop;
    [el.btnLoop, el.libraryLoop].forEach((button) => {
      button.setAttribute('aria-pressed', String(!on));
      button.setAttribute('aria-label', !on ? 'Desativar repetição' : 'Ativar repetição');
    });
    state.audio.loop = !on;
    flash(!on ? 'Repetição ativa' : 'Repetição inativa');
  };
  [el.btnLoop, el.libraryLoop].forEach((button) => button.addEventListener('click', toggleLoop));
  state.audio.addEventListener('ended', () => { if (!state.audio.loop) pause(); });

  /* ── scrub ──────────────────────────────────────────── */
  const seek = (t) => {
    state.audio.currentTime = clamp(t, 0, state.meta.duration);
    if (state.zoom > 1) centerOn(state.audio.currentTime);
    draw(); movePlayhead(); renderReadouts();
  };
  function bindScrub(input, { onStart, onEnd, onInput }) {
    if (onStart) input.addEventListener('pointerdown', onStart);
    if (onEnd) {
      ['pointerup', 'pointercancel', 'lostpointercapture', 'change', 'blur']
        .forEach((type) => input.addEventListener(type, onEnd));
    }
    input.addEventListener('input', () => onInput(+input.value / 1000));
  }
  bindScrub(el.scrub, {
    onStart: () => { state.scrubbing = true; },
    onEnd: () => { state.scrubbing = false; },
    onInput: (progress) => seek(progress * state.meta.duration),
  });
  bindScrub(el.libraryScrub, {
    onStart: () => { libraryTransportScrubbing = true; },
    onEnd: () => {
      libraryTransportScrubbing = false;
      updateLibraryTransportPosition();
    },
    onInput: (rawProgress) => {
      const progress = clamp(rawProgress, 0, 1);
      el.libraryScrub.style.setProperty('--seek-progress', `${(progress * 100).toFixed(3)}%`);
      seek(progress * state.meta.duration);
    },
  });
  bindScrub(el.fScrub, {
    onStart: () => { state.fScrubbing = true; },
    onEnd: () => { state.fScrubbing = false; },
    onInput: (progress) => { if (state.loaded) seek(progress * state.meta.duration); },
  });

  /* ── clique / arraste na waveform ─────────────────────
     Mouse continua imediato. Em touch/pen, um toque curto busca a posição;
     arraste horizontal entra em scrub depois de um pequeno limiar. Movimento
     vertical fica livre para o scroll da página (touch-action: pan-y), evitando
     seeks acidentais quando o usuário só queria rolar a interface. */
  function pointerSeek(e) {
    const rect = el.wave.getBoundingClientRect();
    if (!rect.width) return;
    /* W pode ser fracionário em zoom/Windows scaling. Converter do espaço CSS
       observado pelo PointerEvent para o espaço lógico usado pelo canvas evita
       erro acumulado de seek perto do fim da waveform. */
    seek(xToSrc(Core.pointerToLogical(e.clientX, rect.left, rect.width, W)));
  }

  const waveGesture = {
    id: null, pointerType: '', startX: 0, startY: 0,
    lastX: 0, lastY: 0, dragging: false, target: null,
  };
  const TOUCH_SLOP = 8;

  function waveGestureReset() {
    const target = waveGesture.target;
    const id = waveGesture.id;
    waveGesture.id = null;
    waveGesture.pointerType = '';
    waveGesture.dragging = false;
    waveGesture.target = null;
    if (target && id != null && target.hasPointerCapture && target.hasPointerCapture(id)) {
      try { target.releasePointerCapture(id); } catch (_) {}
    }
  }

  function wavePointerDown(e) {
    if (!state.loaded || waveGesture.id != null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    waveGesture.id = e.pointerId;
    waveGesture.pointerType = e.pointerType || 'mouse';
    waveGesture.startX = waveGesture.lastX = e.clientX;
    waveGesture.startY = waveGesture.lastY = e.clientY;
    waveGesture.dragging = waveGesture.pointerType === 'mouse';
    waveGesture.target = e.currentTarget;

    if (waveGesture.dragging) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      pointerSeek(e);
    }
  }

  function wavePointerMove(e) {
    if (e.pointerId !== waveGesture.id) return;
    waveGesture.lastX = e.clientX;
    waveGesture.lastY = e.clientY;

    if (!waveGesture.dragging) {
      const dx = e.clientX - waveGesture.startX;
      const dy = e.clientY - waveGesture.startY;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < TOUCH_SLOP && ay < TOUCH_SLOP) return;
      if (ay > ax) return; // gesto vertical pertence ao scroll nativo
      waveGesture.dragging = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    }

    if (e.cancelable) e.preventDefault();
    pointerSeek(e);
  }

  function wavePointerUp(e) {
    if (e.pointerId !== waveGesture.id) return;
    const dx = e.clientX - waveGesture.startX;
    const dy = e.clientY - waveGesture.startY;
    const wasTap = !waveGesture.dragging && Math.hypot(dx, dy) <= TOUCH_SLOP;
    if (wasTap) pointerSeek(e);
    waveGestureReset();
  }

  function wavePointerCancel(e) {
    if (e.pointerId === waveGesture.id) waveGestureReset();
  }

  [el.wave, el.ruler].forEach((target) => {
    target.addEventListener('pointerdown', wavePointerDown);
    target.addEventListener('pointermove', wavePointerMove);
    target.addEventListener('pointerup', wavePointerUp);
    target.addEventListener('pointercancel', wavePointerCancel);
    target.addEventListener('lostpointercapture', (e) => {
      if (e.pointerId === waveGesture.id && waveGesture.dragging) waveGestureReset();
    });
  });

  /* ── zoom ───────────────────────────────────────────── */
  function setZoom(z) {
    const cur = state.audio.currentTime || 0;
    state.zoom = clamp(z, 1, 64);
    if (state.zoom === 1) state.view = 0; else centerOn(cur);
    clampView();
    draw(); movePlayhead(); renderReadouts();
  }
  el.zoomIn.addEventListener('click', () => setZoom(state.zoom * 2));
  el.zoomOut.addEventListener('click', () => setZoom(state.zoom / 2));
  el.wave.addEventListener('wheel', (e) => {
    if (!state.loaded) return;
    if (e.ctrlKey || e.metaKey || cfg('tl.wheelZoom')) {
      e.preventDefault();
      setZoom(state.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
    } else if (state.zoom > 1) {
      e.preventDefault();
      state.view += (e.deltaX || e.deltaY) * (viewDur() / W);
      clampView(); draw(); movePlayhead();
    }
  }, { passive: false });

  /* ── carregamento ───────────────────────────────────── */
  el.file.addEventListener('change', (e) => {
    const f = e.target.files[0];
    /* Limpar imediatamente permite escolher o mesmo arquivo novamente — útil
       após falha de decode ou quando o usuário quer recarregar a mesma faixa. */
    e.target.value = '';
    if (f) load(f);
  });

  let dragDepth = 0;
  const dragHasFiles = (e) => Array.from((e.dataTransfer && e.dataTransfer.types) || []).includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault(); dragDepth++; el.drop.hidden = false;
  });
  window.addEventListener('dragover', (e) => { if (dragHasFiles(e)) e.preventDefault(); });
  window.addEventListener('dragleave', (e) => {
    if (!dragHasFiles(e) && dragDepth === 0) return;
    if (--dragDepth <= 0) { dragDepth = 0; el.drop.hidden = true; }
  });
  window.addEventListener('drop', (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; el.drop.hidden = true;
    const f = e.dataTransfer.files[0];
    if (f) load(f);
  });

  /* um arquivo local e um link resolvido chegam aqui do mesmo jeito:
     bytes, um nome e um tamanho. Nada além disso é diferente.

     REV 5: a troca de mídia é transacional. Uma importação nova recebe um
     token de intenção; decodificações antigas não podem sobrescrever uma ação
     mais recente e um arquivo inválido nunca desmonta a faixa já carregada. */
  let mediaIntent = 0;
  let activeDecodeIntent = 0;
  const nextMediaIntent = () => ++mediaIntent;

  function syncSourceArtwork(thumbnail = '', title = '') {
    const src = String(thumbnail || '').trim();
    el.sourceArtwork.hidden = !src;
    el.sourceArtwork.classList.remove('has-image');

    if (!src) {
      el.sourceArtworkImage.alt = '';
      el.sourceArtworkImage.dataset.src = '';
      el.sourceArtworkImage.removeAttribute('src');
      return;
    }

    el.sourceArtworkImage.alt = `Capa de ${title || 'música'}`;
    if (el.sourceArtworkImage.dataset.src !== src) {
      el.sourceArtworkImage.dataset.src = src;
      el.sourceArtworkImage.src = src;
    } else if (el.sourceArtworkImage.complete && el.sourceArtworkImage.naturalWidth > 0) {
      el.sourceArtwork.classList.add('has-image');
    }
  }

  el.sourceArtworkImage.addEventListener('load', () => {
    el.sourceArtwork.classList.add('has-image');
  });
  el.sourceArtworkImage.addEventListener('error', () => {
    el.sourceArtwork.classList.remove('has-image');
    el.sourceArtwork.hidden = true;
  });

  async function load(file, libraryEntry = null) {
    if (!/^audio\//.test(file.type) && !/\.(wav|mp3|flac|ogg|m4a|aac|opus|webm)$/i.test(file.name)) {
      status('Formato não suportado'); return false;
    }
    /* Drag/drop também pode acontecer enquanto yt-dlp está trabalhando. A nova
       escolha local é explícita, então cancela a aquisição remota anterior. */
    if (linkUI.busy) linkAbort();
    const done = await ingest(file, file.name, file.size, nextMediaIntent());
    if (done === true) {
      /* O estado “Importado” pertence à mídia remota atualmente carregada, não
         ao histórico da sessão. Ao trocar para arquivo local, a URL anterior
         volta a poder ser importada. */
      linkUI.importedUrl = null;
      linkSyncImportButton();
      const entry = {
        ...(libraryEntry || {}),
        title: libraryEntry?.title || file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        sourceType: 'local',
        sourceLabel: 'ARQUIVO LOCAL',
        size: state.meta.size,
        lastModified: file.lastModified,
        duration: state.meta.duration,
        sampleRate: state.meta.sampleRate,
        channels: state.meta.channels,
        rate: state.rate,
        position: state.audio.currentTime || 0,
      };
      setLibraryDraft(entry, file);
      if (cfg('library.autoAdd')) await addCurrentToLibrary({ automatic: true });
    }
    return done;
  }

  async function ingest(blob, srcName, srcSize, intent = nextMediaIntent(), uiOpts = {}) {
    const file = { name: srcName, size: srcSize || blob.size };
    const hadLoaded = state.loaded;
    activeDecodeIntent = intent;
    syncStatusPriority();
    el.loading.hidden = false;
    scope.t0 = performance.now();
    dot('busy');
    if (!uiOpts.silentBusy) status(`Decodificando ${file.name}`);
    if (!hadLoaded) el.empty.hidden = true;

    let ac = null;
    try {
      const bytes = await blob.arrayBuffer();
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC();
      const buf = await ac.decodeAudioData(bytes.slice(0));
      ac.close(); ac = null;

      /* Uma ação mais nova começou enquanto esta decodificava: descartar o
         resultado silenciosamente em vez de substituir a escolha mais recente. */
      if (intent !== mediaIntent) return null;

      const nextUrl = URL.createObjectURL(blob);
      const nextPeaks = computePeaks(buf);

      /* Trocar src interrompe a mídia anterior. Sincronizar o estado manual
         antes da troca evita botão Play/estado live presos na faixa antiga. */
      state.audio.pause();
      state.playing = false;
      syncPlayback();

      if (state.url) URL.revokeObjectURL(state.url);
      state.url = nextUrl;
      state.audio.src = state.url;
      state.audio.load();

      state.buffer = buf;
      state.peaks = nextPeaks;
      state.meta = {
        name: file.name, size: file.size,
        sampleRate: buf.sampleRate, channels: buf.numberOfChannels,
        duration: buf.duration,
        thumbnail: String(uiOpts.thumbnail || '').trim(),
      };
      state.loaded = true;
      el.root.dataset.media = 'loaded';
      if (!cfg('load.keepZoom')) state.zoom = 1;
      /* “Manter zoom” preserva a escala, não a posição temporal da mídia
         anterior. Toda nova faixa começa no início da própria timeline. */
      state.view = 0;
      clampView();

      setRate(cfg('load.resetRate') ? 100 : state.rate);
      state.audio.volume = +el.vol.value / 100;

      [el.btnPlay, el.btnStop, el.btnLoop, el.scrub, el.zoomIn, el.zoomOut, el.btnExport, el.fScrub]
        .forEach((b) => { b.disabled = false; });
      el.waveHost.classList.remove('is-empty');
      el.empty.hidden = true;

      // L2 · troca de estado: digitação rápida, sem cursor nem desfoque
      el.fileName.title = file.name;
      window.Motion.typeOut(el.fileName, file.name, {
        speed: window.Motion.T.charState,
        jitter: window.Motion.T.charStateJitter,
        charDur: 130, dy: 1, blur: 0,
        onDone: () => window.Motion.marquee(el.fileName),
      });
      el.fileMeta.textContent = `${(buf.sampleRate / 1000).toFixed(1)} kHz · ${buf.numberOfChannels === 1 ? 'mono' : 'estéreo'} · ${fmtTime(buf.duration)}`;
      el.sName.textContent = file.name;
      el.sName.title = file.name;
      window.Motion.marquee(el.sName, { speed: 24 });
      el.sDur.textContent = fmtTime(buf.duration);
      el.sRate.textContent = `${buf.sampleRate} Hz`;
      el.sCh.textContent = String(buf.numberOfChannels);
      el.sSize.textContent = fmtBytes(file.size);
      syncSourceArtwork(state.meta.thumbnail, file.name);

      resize();
      renderReadouts();
      dot('ready');
      status(`Carregado · ${file.name}`);
      if (cfg('load.autoplay')) play();
      return true;
    } catch (err) {
      if (ac) { try { ac.close(); } catch (_) {} }
      if (intent !== mediaIntent) return null;

      /* Falha é não destrutiva: se já havia uma faixa, ela continua sendo a
         sessão ativa. Sem faixa anterior, voltamos ao empty-state normal. */
      if (hadLoaded) {
        state.loaded = true;
        el.empty.hidden = true;
        el.waveHost.classList.remove('is-empty');
        dot(state.playing ? 'live' : 'ready');
      } else {
        state.loaded = false;
        el.empty.hidden = false;
        el.waveHost.classList.add('is-empty');
        dot('idle');
      }
      status('Não foi possível decodificar o áudio');
      return false;
    } finally {
      if (activeDecodeIntent === intent) {
        activeDecodeIntent = 0;
        syncStatusPriority();
        el.loading.hidden = true;
      }
    }
  }

  /* ══ export WAV (offline render, sem pitch shift) ═════
     wavGen é um gerador: cede o controle a cada bloco de amostras.
     A mesma função serve ao Worker (drenada em laço fechado) e ao
     fallback na thread principal (drenada com yields reais), sem
     duplicar o codificador em dois lugares.                        */
  function* wavGen(chans, sampleRate, depth, opts) {
    const ch = chans.length, len = chans[0].length;
    const float = depth === '32f';
    const bytes = float ? 4 : depth === '24' ? 3 : 2;
    const YIELD = 0xFFFFF;   // ~1 M amostras entre pausas

    let gain = 1;
    if (opts && opts.normalize) {
      let peak = 0;
      for (let c = 0; c < ch; c++) {
        const a = chans[c];
        for (let i = 0; i < len; i++) {
          const v = a[i] < 0 ? -a[i] : a[i];
          if (v > peak) peak = v;
          if ((i & YIELD) === 0) yield;
        }
      }
      const ceiling = Math.pow(10, (opts.ceiling || 0) / 20);
      gain = peak > 1e-6 ? ceiling / peak : 1;
    }

    const blockAlign = ch * bytes;
    const dataLen = len * blockAlign;
    const out = new ArrayBuffer(44 + dataLen);
    const v = new DataView(out);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, float ? 3 : 1, true);
    v.setUint16(22, ch, true); v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * blockAlign, true);
    v.setUint16(32, blockAlign, true); v.setUint16(34, bytes * 8, true);
    str(36, 'data'); v.setUint32(40, dataLen, true);

    let o = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        let s = chans[c][i] * gain;
        s = s < -1 ? -1 : s > 1 ? 1 : s;
        if (float) {
          v.setFloat32(o, s, true);
        } else if (bytes === 3) {
          const n = Math.round(s < 0 ? s * 0x800000 : s * 0x7FFFFF);
          v.setUint8(o, n & 0xFF);
          v.setUint8(o + 1, (n >> 8) & 0xFF);
          v.setUint8(o + 2, (n >> 16) & 0xFF);
        } else {
          v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        o += bytes;
      }
      if ((i & YIELD) === 0) yield;
    }
    return out;
  }

  const WAV_WORKER_SRC = `
    ${wavGen.toString()}
    self.onmessage = (e) => {
      const g = wavGen(e.data.chans, e.data.sampleRate, e.data.depth, e.data.opts);
      let r = g.next();
      while (!r.done) r = g.next();
      self.postMessage(r.value, [r.value]);
    };
  `;
  let wavWorkerURL = null;
  const workerURL = () => {
    if (!wavWorkerURL) {
      wavWorkerURL = URL.createObjectURL(new Blob([WAV_WORKER_SRC], { type: 'text/javascript' }));
    }
    return wavWorkerURL;
  };

  const takeChannels = (buf) => {
    const chans = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c).slice());
    return chans;
  };

  function encodeOffThread(buf, depth, opts) {
    return new Promise((resolve, reject) => {
      let w;
      try { w = new Worker(workerURL()); } catch (err) { reject(err); return; }
      const chans = takeChannels(buf);
      w.onmessage = (e) => { w.terminate(); resolve(new Blob([e.data], { type: 'audio/wav' })); };
      w.onerror = (err) => { w.terminate(); reject(err); };
      w.postMessage({ chans, sampleRate: buf.sampleRate, depth, opts }, chans.map((a) => a.buffer));
    });
  }

  /* fallback (Worker indisponível): mesmo gerador, cedendo a thread
     entre blocos para não travar a interface. */
  async function encodeOnThread(buf, depth, opts) {
    const g = wavGen(takeChannels(buf), buf.sampleRate, depth, opts);
    let r = g.next();
    while (!r.done) {
      await new Promise((res) => setTimeout(res, 0));
      r = g.next();
    }
    return new Blob([r.value], { type: 'audio/wav' });
  }

  /* ── nome do arquivo por template ───────────────────── */
  const outSampleRate = () => Core.outSampleRate(cfg('export.sampleRate'), state.meta.sampleRate);

  /* Tokens, saneamento, teto de 176 code points e nomes de
     dispositivo reservados do Windows vivem em core.js e têm
     cobertura em tests/core.test.js. */
  const outName = (sr) => Core.outName(cfg('export.name'), {
    name: state.meta.name,
    rate: state.rate,
    sampleRate: sr,
  });

  el.btnExport.addEventListener('click', async () => {
    if (!state.buffer || state.exporting) return;
    state.exporting = true;
    syncStatusPriority();
    el.btnExport.disabled = true;
    if (motionSweep()) {
      el.btnExport.classList.add('is-busy');
      el.btnExport.setAttribute('aria-busy', 'true');
      el.exportLabel.classList.add('is-working');
    }
    window.Motion.cancel(el.exportLabel);
    el.exportLabel.textContent = 'Renderizando…';
    scope.t0 = performance.now();
    dot('busy');
    status('Renderizando saída offline');
    let done = null;
    try {
      const r = state.rate / 100;
      const src = state.buffer;
      const sr = outSampleRate();
      const frames = Math.max(1, Math.ceil((src.duration / r) * sr));
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const oac = new OAC(src.numberOfChannels, frames, sr);
      const node = oac.createBufferSource();
      node.buffer = src;
      node.playbackRate.value = r;   // resample: altera duração e pitch juntos
      node.connect(oac.destination);
      node.start(0);
      const out = await oac.startRendering();
      el.exportLabel.textContent = 'Codificando…';
      const depth = cfg('export.bits');
      const opts = { normalize: cfg('export.normalize'), ceiling: cfg('export.ceiling') };
      let blob;
      try {
        blob = await encodeOffThread(out, depth, opts);
      } catch (e) {
        blob = await encodeOnThread(out, depth, opts);
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = outName(sr);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      done = { name: a.download, size: blob.size };
    } catch (err) {
      status('Falha ao renderizar a saída');
    } finally {
      state.exporting = false;
      syncStatusPriority();
      el.btnExport.disabled = false;
      el.btnExport.classList.remove('is-busy');
      el.btnExport.removeAttribute('aria-busy');
      el.exportLabel.classList.remove('is-working');
      el.exportLabel.textContent = 'Exportar WAV';
      dot(state.playing ? 'live' : 'ready');
      repaintScope();
    }
    if (done) announceExport(done.name, done.size);
  });

  /* aviso ao sair com exportação em curso */
  window.addEventListener('beforeunload', (e) => {
    if (state.exporting && cfg('load.confirmExit')) { e.preventDefault(); e.returnValue = ''; }
  });

  /* Exportação é a referência visual do status padrão. A única diferença
     é a sustentação maior para dar tempo de ler nome e tamanho do arquivo. */
  function announceExport(name, size) {
    const text = `${name} · ${fmtBytes(size)}`;
    const hold = Math.round(cfg('motion.exportHold') * 1000);
    if (!cfg('motion.status')) { plainTemp(text, 'Exportado · ', hold); return; }
    clearTimeout(tempTimer);
    window.Motion.status(el.statusMsg, text, {
      lead: 'Exportado · ',
      hold,
      caret: cfg('motion.caret'),
    });
    // O feedback principal é o status padrão; o botão só retorna ao rótulo base.
    el.exportLabel.textContent = 'Exportar WAV';
  }

  /* ═══ Focus Mode ═════════════════════════════════════════
     A mesma apresentação do osciloscópio em escala de tela.
     A interface normal se recolhe; no rodapé permanecem só a
     timeline e a velocidade, discretas mas operáveis.       */
  let focusTimer = 0;

  function syncFocus(cur, r) {
    el.fCur.textContent = fmtTime(cur / r);
    syncScrubPosition(el.fScrub, cur, state.meta.duration, state.fScrubbing);
  }

  function focusOn() {
    if (state.focus) return;
    state.focus = true;
    clearTimeout(focusTimer);
    el.focus.hidden = false;
    el.root.dataset.focus = '1';
    el.scopeWrap.setAttribute('aria-expanded', 'true');
    const settle = () => {
      el.focus.classList.add('is-on');
      views.focus.resize();
      repaintScope();
    };
    if (window.Motion.reduced()) settle(); else requestAnimationFrame(settle);
    el.fScrub.disabled = !state.loaded;
    renderReadouts();
    syncFocus(state.audio.currentTime || 0, state.rate / 100);
    el.fExit.focus({ preventScroll: true });
    flash('Modo foco');
  }

  function focusOff() {
    if (!state.focus) return;
    state.focus = false;
    el.focus.classList.remove('is-on');
    el.scopeWrap.setAttribute('aria-expanded', 'false');
    delete el.root.dataset.focus;
    clearTimeout(focusTimer);
    const close = () => { el.focus.hidden = true; };
    if (window.Motion.reduced()) close(); else focusTimer = setTimeout(close, 240);
    el.scopeWrap.focus({ preventScroll: true });
    resize();
  }

  el.scopeWrap.addEventListener('click', () => (state.focus ? focusOff() : focusOn()));
  el.fExit.addEventListener('click', focusOff);
  let focusResizeRaf = 0;
  new ResizeObserver(() => {
    if (!state.focus || focusResizeRaf) return;
    focusResizeRaf = requestAnimationFrame(() => {
      focusResizeRaf = 0;
      if (!state.focus) return;
      if (views.focus.resize()) repaintScope();
    });
  }).observe(el.scopeFocus);

  /* ═══ janela independente ════════════════════════════════
     Espelho visual da mesma sessão: sem timeline, sem
     controles e sem segunda fonte de áudio. A janela pede um
     quadro por ciclo de vídeo e recebe o quadro corrente.   */
  const popState = (on) => {
    const name = cfg('scope.visualizer') === 'vectorscope' ? 'Vectorscope de partículas' : 'Osciloscópio';
    const label = on ? `Fechar a janela do ${name.toLowerCase()}` : `${name} em janela separada`;
    el.btnPop.setAttribute('aria-pressed', String(on));
    el.btnPop.title = label;
    el.btnPop.setAttribute('aria-label', label);
  };

  function popToggle() {
    if (pop.win && !pop.win.closed) {
      try { pop.win.close(); } catch (e) { /* já fechada */ }
      pop.win = null; pop.want = false; popState(false);
      flash('Janela fechada');
      return;
    }
    let w = null;
    try { w = window.open('scope.html', 'tempo-scope', 'width=760,height=280'); } catch (e) { w = null; }
    if (!w) {
      status('A janela do visualizador foi bloqueada pelo navegador — libere janelas para este endereço');
      return;
    }
    pop.win = w;
    popState(true);
    flash('Osciloscópio em janela');
  }
  el.btnPop.addEventListener('click', popToggle);

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'tempo:hello') { pop.win = e.source || pop.win; popState(true); }
    else if (d.type === 'tempo:need') { if (e.source) pop.win = e.source; pop.want = true; }
    else if (d.type === 'tempo:closed') { pop.win = null; pop.want = false; popState(false); }
  });
  setInterval(() => {
    if (pop.win && pop.win.closed) { pop.win = null; pop.want = false; popState(false); }
  }, 1500);
  window.addEventListener('beforeunload', () => {
    window.MediaLibrary?.updateActive({
      rate: state.rate,
      position: state.audio.currentTime || 0,
    });
    if (pop.win && !pop.win.closed) {
      try { pop.win.postMessage({ type: 'tempo:bye' }, '*'); } catch (e) { /* noop */ }
    }
  });

  /* ═══ importação por link / yt-dlp ═════════════════════
     Fluxo em duas etapas:
       1. URL -> backend -> metadados (sem download)
       2. confirmação -> backend -> áudio -> decodeAudioData
     O yt-dlp nunca entra no motor de áudio. A partir do Blob,
     o caminho é exatamente o mesmo de um arquivo local.       */
  const linkUI = {
    busy: false,
    ctrl: null,
    meta: null,
    importedUrl: null,
    pctShown: -1,
    pctAt: 0,
    pasteTimer: 0,
    pastePending: false,
    op: 0,
    phase: 'idle',
    authSyncToken: 0,
    authErrorCode: '',
  };

  async function syncRemoteAuth({ notify = false } = {}) {
    const token = ++linkUI.authSyncToken;
    const browser = cfg('remote.authBrowser');
    try {
      const result = await window.RemoteImport.configureAuth(browser);
      if (token !== linkUI.authSyncToken) return false;
      if (notify) {
        const names = { chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', brave: 'Brave', vivaldi: 'Vivaldi' };
        const message = result.mode === 'auto'
          ? (result.auto?.active
            ? `Sessão validada do ${result.auto.active.browser_label}`
            : 'Detecção automática ativada · a sessão será validada no próximo link restrito')
          : result.mode === 'dedicated'
          ? (result.dedicated?.connected
            ? 'Sessão dedicada do YouTube ativada'
            : 'Sessão dedicada selecionada · conecte a conta nas Configurações')
          : (result.mode === 'browser'
            ? `Sessão do ${names[browser] || browser} ativada somente para conteúdo restrito`
            : 'Autenticação por navegador desativada');
        window.Settings.feedback?.(message, { hold: 4200 });
      }
      return true;
    } catch (error) {
      if (token !== linkUI.authSyncToken) return false;
      window.Settings.feedback?.(netFail(error), { kind: 'err', hold: 5200 });
      return false;
    }
  }

  function syncStatusPriority() {
    const on = state.exporting || activeDecodeIntent !== 0 || linkUI.busy;
    if (on) el.root.dataset.statusPriority = '1';
    else delete el.root.dataset.statusPriority;
  }

  function linkSyncImportButton() {
    const currentUrl = linkUI.meta && linkUI.meta.requestUrl ? linkUI.meta.requestUrl : '';
    const imported = Boolean(currentUrl && linkUI.importedUrl === currentUrl);
    el.urlImport.disabled = linkUI.busy || imported || !currentUrl;
    el.urlImport.textContent = imported ? 'Importado' : 'Importar áudio';
    el.urlImport.setAttribute('aria-busy', String(linkUI.busy && linkUI.phase === 'import'));
    if (imported) {
      el.urlImport.title = 'Este áudio já foi importado.';
      el.urlImport.setAttribute('aria-label', 'Áudio já importado');
    } else {
      el.urlImport.removeAttribute('title');
      el.urlImport.removeAttribute('aria-label');
    }
  }

  function linkSetBusy(on, phase = 'idle') {
    linkUI.busy = Boolean(on);
    linkUI.phase = on ? phase : 'idle';
    if (on) el.linkbar.dataset.phase = phase;
    else el.linkbar.removeAttribute('data-phase');
    el.linkbar.setAttribute('aria-busy', String(linkUI.busy));
    el.url.disabled = linkUI.busy;
    el.urlGo.disabled = linkUI.busy;
    el.urlGo.setAttribute('aria-busy', String(linkUI.busy && phase === 'analyze'));
    if (el.urlAuth) el.urlAuth.disabled = linkUI.busy;
    linkSyncImportButton();
    syncStatusPriority();
  }

  function linkBegin(phase) {
    const op = ++linkUI.op;
    const ctrl = new AbortController();
    linkUI.ctrl = ctrl;
    linkSetBusy(true, phase);
    clearTimeout(tempTimer);
    window.Motion.cancel(el.statusMsg);
    el.statusMsg.textContent = '';
    return { op, ctrl };
  }

  const linkIsCurrent = (op) => op === linkUI.op;

  function linkOpen(on) {
    el.linkbar.hidden = !on;
    if (on) importMenuOpen(false);
    if (on) {
      el.url.focus();
      el.url.select();
    } else {
      linkMsg('');
      linkAbort();
    }
  }

  function linkMsg(text, kind) {
    el.urlMsg.hidden = !text;
    window.Motion.cancel(el.urlMsg);
    if (!text) el.urlMsg.textContent = '';
    else if (cfg('motion.status')) {
      window.Motion.status(el.urlMsg, text, { persist: true, caret: false, intensity: 0.9 });
    } else {
      el.urlMsg.textContent = text;
    }
    if (kind) el.urlMsg.dataset.kind = kind; else el.urlMsg.removeAttribute('data-kind');
  }

  const AUTH_ACTION_CODES = new Set([
    'authentication_required',
    'youtube_playback_verification_required',
    'youtube_po_token_unavailable',
    'youtube_po_token_failed',
    'browser_locked',
    'browser_not_found',
    'youtube_session_not_found',
  ]);

  function linkAuthAction(error = null) {
    if (!el.urlAuthWrap || !el.urlAuth) return;
    const visible = Boolean(error && AUTH_ACTION_CODES.has(error.code));
    linkUI.authErrorCode = visible ? error.code : '';
    el.urlAuthWrap.hidden = !visible;
    if (!visible) return;
    const poTokenError = error.code === 'youtube_playback_verification_required'
      || error.code === 'youtube_po_token_unavailable'
      || error.code === 'youtube_po_token_failed';
    el.urlAuth.textContent = error.code === 'browser_locked'
      ? 'Abrir sessão dedicada'
      : poTokenError
      ? 'Tentar novamente'
      : 'Usar cookies do navegador';
    if (el.urlAuthHint) {
      el.urlAuthHint.textContent = error.code === 'browser_locked'
        ? 'O navegador principal está em uso. Feche-o por completo ou use a Sessão dedicada nas Configurações.'
        : poTokenError
        ? 'O VARISPEED tentará novamente com o provedor local de PO Token; uma janela auxiliar minimizada pode aparecer por alguns segundos.'
        : 'O VARISPEED verificará os perfis instalados e só usará uma sessão que consiga abrir este link.';
    }
  }

  function linkStage(label, mode) {
    el.urlProg.hidden = false;
    el.urlProg.removeAttribute('data-out');
    el.urlTrack.dataset.mode = mode || 'indet';
    el.urlTrack.setAttribute('aria-valuetext', label);
    if (mode === 'det') el.urlTrack.setAttribute('aria-valuenow', '0');
    else el.urlTrack.removeAttribute('aria-valuenow');
    if (mode !== 'det') {
      el.urlFill.style.width = '';
      el.urlPct.textContent = '';
      linkUI.pctShown = -1;
    }
    window.Motion.cancel(el.urlStage);
    if (cfg('motion.status')) {
      window.Motion.status(el.urlStage, label, { persist: true, caret: false, intensity: 0.9 });
    } else {
      el.urlStage.textContent = label;
    }
  }

  function linkPct(p) {
    const v = clamp(Math.round(p), 0, 100);
    el.urlTrack.dataset.mode = 'det';
    el.urlFill.style.width = `${v}%`;
    el.urlTrack.setAttribute('aria-valuenow', String(v));
    el.urlTrack.setAttribute('aria-valuetext', `${el.urlStage.textContent || 'Importando'} · ${v}%`);
    if (v === linkUI.pctShown) return;
    const prev = linkUI.pctShown < 0 ? '' : `${linkUI.pctShown}%`;
    const next = `${v}%`;
    const now = performance.now();
    if (cfg('motion.rateTick') && !window.Motion.reduced() && now - linkUI.pctAt > 110) {
      linkUI.pctAt = now;
      window.Motion.digitTick(el.urlPct, prev, next, 1);
    } else if (now - linkUI.pctAt > 60 || v === 100) {
      linkUI.pctAt = now;
      window.Motion.cancel(el.urlPct);
      el.urlPct.textContent = next;
    }
    linkUI.pctShown = v;
  }

  function linkClear() {
    el.urlProg.hidden = true;
    el.urlProg.removeAttribute('data-out');
    window.Motion.cancel(el.urlStage);
    el.urlStage.textContent = '';
    el.urlPct.textContent = '';
    el.urlFill.style.width = '0%';
    el.urlTrack.removeAttribute('aria-valuenow');
    el.urlTrack.removeAttribute('aria-valuetext');
    linkUI.pctShown = -1;
  }

  function linkResetPreview() {
    linkUI.meta = null;
    linkAuthAction();
    el.urlPreview.hidden = true;
    linkSyncImportButton();
    el.urlTitle.textContent = '—';
    el.urlTitle.removeAttribute('title');
    el.urlByline.textContent = '—';
    el.urlByline.removeAttribute('title');
    el.urlDuration.textContent = '—';
    el.urlDuration.removeAttribute('title');
    el.urlSource.textContent = 'yt-dlp';
    el.urlSource.removeAttribute('title');
    el.urlThumb.removeAttribute('src');
    el.urlThumbWrap.classList.remove('has-image');
  }

  function linkShowPreview(meta) {
    linkUI.meta = meta;
    el.urlPreview.hidden = false;
    linkSyncImportButton();
    el.urlTitle.textContent = meta.title || 'Áudio sem título';
    el.urlTitle.title = meta.title || '';
    const byline = meta.uploader || meta.channel || 'Autor/canal não informado';
    const source = meta.extractor || meta.site || 'yt-dlp';
    el.urlByline.textContent = byline;
    el.urlByline.title = byline;
    el.urlSource.textContent = source;
    el.urlSource.title = source;
    el.urlDuration.textContent = meta.duration != null ? fmtClock(meta.duration) : '—';
    el.urlDuration.title = meta.duration != null ? `Duração: ${fmtClock(meta.duration)}` : 'Duração desconhecida';
    if (meta.thumbnail) {
      el.urlThumb.src = meta.thumbnail;
      el.urlThumbWrap.classList.add('has-image');
    } else {
      el.urlThumb.removeAttribute('src');
      el.urlThumbWrap.classList.remove('has-image');
    }
  }

  /* duração de mídia remota: independente da preferência de régua/timeline */
  const fmtClock = Core.fmtClock;

  function linkSettle(op) {
    /* Timers/animations de um resultado antigo não podem limpar o progresso de
       uma nova análise iniciada logo em seguida. Todos os callbacks conferem op. */
    if (window.Motion.reduced() || !cfg('motion.status')) {
      el.urlStage.textContent = 'Pronto';
      setTimeout(() => { if (linkIsCurrent(op)) linkClear(); }, 700);
      return;
    }
    window.Motion.status(el.urlStage, 'Pronto', {
      hold: 1100,
      caret: false,
      intensity: 0.9,
      onDone: () => { if (linkIsCurrent(op)) linkClear(); },
    });
    setTimeout(() => { if (linkIsCurrent(op)) el.urlProg.dataset.out = '1'; }, 1250);
  }

  function linkIdle(op = null) {
    if (op != null && !linkIsCurrent(op)) return false;
    linkUI.ctrl = null;
    linkSetBusy(false);
    return true;
  }

  function linkFail(msg, keepPreview = true, op = null) {
    if (op != null && !linkIsCurrent(op)) return false;
    linkIdle(op);
    linkClear();
    if (!keepPreview) linkResetPreview();
    linkMsg(msg, 'err');
    status('Importação por link interrompida');
    if (!state.loaded) dot('idle');
    return true;
  }

  const netFail = (err) => {
    const m = String((err && err.message) || err);
    if (err && err.name === 'AbortError') return 'Importação cancelada.';
    if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(m)) {
      return 'Não foi possível acessar o backend do VARISPEED. Inicie o projeto pelo servidor local (start-tempo.bat ou start-tempo.sh) e tente novamente.';
    }
    return m;
  };

  async function analyzeUrl(raw, opts = {}) {
    if (linkUI.busy) return false;
    const parsed = window.RemoteImport.parse(raw);
    if (!parsed.ok) {
      if (!opts.silent) linkFail(parsed.error, false);
      return false;
    }

    linkMsg('');
    linkResetPreview();
    const { op, ctrl } = linkBegin('analyze');
    if (!state.loaded) dot('busy');
    linkStage('Obtendo informações', 'indet');

    try {
      const meta = await window.RemoteImport.info(parsed.url, ctrl.signal);
      if (!linkIsCurrent(op)) return false;
      linkShowPreview({ ...meta, requestUrl: parsed.url });
      linkMsg('');
      linkClear();
      status('Link analisado — confirme para importar');
      if (!state.loaded) dot('idle');
      linkIdle(op);
      return true;
    } catch (err) {
      if (!linkIsCurrent(op)) return false;
      linkFail(netFail(err), false, op);
      linkAuthAction(err);
      return false;
    }
  }

  async function useBrowserSession() {
    if (linkUI.busy) return;
    if (linkUI.authErrorCode === 'browser_locked') {
      window.Settings.set('remote.authBrowser', 'dedicated');
      window.Settings.open();
      return;
    }
    if (linkUI.authErrorCode === 'youtube_playback_verification_required'
      || linkUI.authErrorCode === 'youtube_po_token_unavailable'
      || linkUI.authErrorCode === 'youtube_po_token_failed') {
      linkAuthAction();
      await analyzeUrl(el.url.value);
      return;
    }
    const parsed = window.RemoteImport.parse(el.url.value);
    if (!parsed.ok) {
      linkFail(parsed.error, false);
      return;
    }
    linkAuthAction();
    linkMsg('');
    const { op, ctrl } = linkBegin('auth');
    if (!state.loaded) dot('busy');
    linkStage('Procurando sessão válida', 'indet');
    try {
      const result = await window.RemoteImport.useBrowserCookies(parsed.url, ctrl.signal);
      if (!linkIsCurrent(op)) return;
      window.Settings.set('remote.authBrowser', 'auto');
      const meta = { ...(result.media || {}), requestUrl: parsed.url };
      linkShowPreview(meta);
      linkMsg(`Sessão validada · ${result.source?.browser_label || 'navegador'}`);
      linkClear();
      linkIdle(op);
      status('Sessão do YouTube validada — confirme para importar');
      if (!state.loaded) dot('idle');
    } catch (error) {
      if (!linkIsCurrent(op)) return;
      linkFail(netFail(error), false, op);
      linkAuthAction(error);
    }
  }

  async function importRemoteAudio() {
    if (linkUI.busy) return;
    if (!linkUI.meta || !linkUI.meta.requestUrl) {
      const ok = await analyzeUrl(el.url.value);
      if (!ok || !linkUI.meta) return;
    }

    const requestUrl = linkUI.meta.requestUrl;
    if (linkUI.importedUrl === requestUrl) {
      status('Este áudio já foi importado');
      linkSyncImportButton();
      return;
    }

    /* O token nasce no início da aquisição remota, não só na decodificação.
       Assim, um arquivo local escolhido enquanto o download está em curso tem
       prioridade e o resultado remoto antigo não pode sobrescrevê-lo. */
    const mediaToken = nextMediaIntent();
    linkMsg('');
    const { op, ctrl } = linkBegin('import');
    scope.t0 = performance.now();
    if (!state.loaded) dot('busy');
    linkStage('Baixando áudio', 'indet');

    try {
      const result = await window.RemoteImport.audio(requestUrl, {
        signal: ctrl.signal,
        authenticated: Boolean(linkUI.meta?.auth_required),
        onStart: ({ total }) => { if (linkIsCurrent(op)) linkStage('Baixando áudio', total > 0 ? 'det' : 'indet'); },
        onProgress: ({ received, total }) => {
          if (linkIsCurrent(op) && total > 0) linkPct((received / total) * 100);
        },
      });
      if (!linkIsCurrent(op)) return;

      linkStage('Decodificando', 'indet');
      await new Promise((ok) => requestAnimationFrame(ok));
      if (!linkIsCurrent(op)) return;

      const meta = linkUI.meta || {};
      const fallback = `${meta.title || 'audio'}.${(result.filename.split('.').pop() || 'audio')}`;
      const name = result.filename || fallback;
      const done = await ingest(result.blob, name, result.size, mediaToken, {
        silentBusy: true,
        thumbnail: meta.thumbnail || '',
      });
      if (!linkIsCurrent(op)) return;
      if (done === null) {
        linkIdle(op);
        linkClear();
        return;
      }
      if (!done) throw new Error('O áudio foi obtido, mas o navegador não conseguiu decodificar esse formato.');

      const entry = {
        title: meta.title || name.replace(/\.[^.]+$/, ''),
        fileName: name,
        sourceType: 'remote',
        sourceUrl: requestUrl,
        sourceLabel: meta.extractor || meta.extractorKey || 'LINK',
        sourceAuthRequired: Boolean(meta.auth_required),
        byline: meta.uploader || meta.channel || meta.artist || '',
        thumbnail: meta.thumbnail || '',
        size: state.meta.size,
        duration: state.meta.duration,
        sampleRate: state.meta.sampleRate,
        channels: state.meta.channels,
        rate: state.rate,
        position: 0,
      };
      setLibraryDraft(entry, result.blob);
      if (cfg('library.autoAdd')) await addCurrentToLibrary({ automatic: true });

      linkUI.importedUrl = requestUrl;
      linkIdle(op);
      linkMsg('');
      linkSettle(op);
    } catch (err) {
      if (!linkIsCurrent(op)) return;
      linkFail(netFail(err), true, op);
      linkAuthAction(err);
    }
  }

  /* Reabertura a partir da biblioteca. Arquivos mantidos na sessão reutilizam
     o Blob; links são obtidos novamente pelo mesmo cliente remoto. A física e
     a apresentação do grafo não participam do motor de áudio. */
  async function openLibraryMedia({ item, blob }) {
    if (!item) return false;
    if (linkUI.busy) linkAbort();

    const intent = nextMediaIntent();
    let mediaBlob = blob;
    let fileName = blob && blob.name ? blob.name : item.fileName;
    let fileSize = blob ? blob.size : item.size;

    try {
      if (!mediaBlob && item.sourceType === 'remote' && item.sourceUrl) {
        status(`Baixando · ${item.title}`);
        const result = await window.RemoteImport.audio(item.sourceUrl, {
          authenticated: Boolean(item.sourceAuthRequired),
        });
        if (intent !== mediaIntent) return false;
        mediaBlob = result.blob;
        fileName = result.filename || fileName;
        fileSize = result.size;
      }

      if (!mediaBlob) {
        status('Localize o arquivo para abrir esta música');
        return false;
      }

      const done = await ingest(mediaBlob, fileName || item.title, fileSize, intent, {
        thumbnail: item.thumbnail || '',
      });
      if (done !== true) return false;

      setRate(Number.isFinite(item.rate) ? item.rate : state.rate);
      const restorePosition = clamp(Number(item.position) || 0, 0, state.meta.duration);
      if (restorePosition > 0) requestAnimationFrame(() => seek(restorePosition));

      const storedItem = await window.MediaLibrary.record({
        ...item,
        fileName: fileName || item.fileName,
        size: state.meta.size,
        duration: state.meta.duration,
        sampleRate: state.meta.sampleRate,
        channels: state.meta.channels,
        rate: state.rate,
        position: restorePosition,
      }, mediaBlob);
      setLibraryDraft(storedItem || item, mediaBlob);

      linkUI.importedUrl = item.sourceType === 'remote' ? item.sourceUrl : null;
      linkSyncImportButton();
      status(`Aberto da biblioteca · ${item.title}`);
      return true;
    } catch (err) {
      status(err && err.message ? err.message : 'Não foi possível abrir esta música');
      return false;
    }
  }

  const linkAbort = () => {
    clearTimeout(linkUI.pasteTimer);
    linkUI.pasteTimer = 0;
    linkUI.pastePending = false;
    const ctrl = linkUI.ctrl;
    const wasBusy = linkUI.busy;
    const wasImporting = wasBusy && linkUI.phase === 'import';
    ++linkUI.op;
    /* AbortController cancela fetch/stream, mas não decodeAudioData já iniciado.
       Invalidar também a intenção de mídia impede commit depois de um cancelamento. */
    if (wasImporting) nextMediaIntent();
    if (ctrl) ctrl.abort();
    linkUI.ctrl = null;
    linkSetBusy(false);
    linkClear();
    if (wasBusy) {
      if (!state.loaded) dot('idle');
      status('Importação por link cancelada');
    }
  };

  /* ── menu unificado de importação ──────────────────────
     O header expõe apenas uma entrada. Arquivo local e URL
     são escolhas do mesmo fluxo de aquisição, não ações globais
     independentes. O menu não altera a linkbar nem o motor de áudio. */
  function importMenuOpen(on, focusFirst = false) {
    el.importMenu.hidden = !on;
    el.btnImport.setAttribute('aria-expanded', String(on));
    if (on && focusFirst) requestAnimationFrame(() => el.importFile.focus());
  }

  el.btnImport.addEventListener('click', () => importMenuOpen(el.importMenu.hidden));
  el.btnImport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      importMenuOpen(true, true);
      if (e.key === 'ArrowUp') requestAnimationFrame(() => el.importLink.focus());
    }
  });
  el.importFile.addEventListener('click', () => {
    importMenuOpen(false);
    window.MediaLibrary?.hide();
    if (!el.linkbar.hidden) linkOpen(false);
    el.file.click();
  });
  el.importLink.addEventListener('click', () => {
    importMenuOpen(false);
    window.MediaLibrary?.hide();
    linkOpen(true);
  });
  el.importMenu.addEventListener('keydown', (e) => {
    const items = [el.importFile, el.importLink];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      importMenuOpen(false);
      el.btnImport.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(i + step + items.length) % items.length].focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!el.importMenu.hidden && !el.importMenuWrap.contains(e.target)) importMenuOpen(false);
  });

  el.urlThumb.addEventListener('load', () => el.urlThumbWrap.classList.add('has-image'));
  el.urlThumb.addEventListener('error', () => el.urlThumbWrap.classList.remove('has-image'));
  el.urlClose.addEventListener('click', () => linkOpen(false));
  el.urlGo.addEventListener('click', () => analyzeUrl(el.url.value));
  el.urlAuth?.addEventListener('click', useBrowserSession);
  el.urlImport.addEventListener('click', importRemoteAudio);
  el.url.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (linkUI.meta) importRemoteAudio(); else analyzeUrl(el.url.value);
    }
  });
  el.url.addEventListener('paste', () => {
    linkUI.pastePending = true;
  });
  el.url.addEventListener('input', (e) => {
    /* Qualquer edição invalida o preview anterior. A autoanálise é agendada
       somente para o input que veio do paste; se o usuário continuar digitando
       antes dos 180 ms, o timer é cancelado e não analisa uma URL intermediária. */
    clearTimeout(linkUI.pasteTimer);
    linkUI.pasteTimer = 0;
    linkResetPreview();
    linkMsg('');
    const fromPaste = e.inputType === 'insertFromPaste' || linkUI.pastePending;
    linkUI.pastePending = false;
    if (fromPaste) {
      linkUI.pasteTimer = setTimeout(() => {
        linkUI.pasteTimer = 0;
        analyzeUrl(el.url.value, { silent: true });
      }, 180);
    }
  });
  el.url.addEventListener('focus', () => {
    if (!window.matchMedia || !window.matchMedia('(max-width: 640px)').matches) return;
    setTimeout(() => {
      if (document.activeElement === el.url) el.url.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, 90);
  });

  /* ── atalhos ────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    /* Clique de ponteiro não deve deixar um botão armado para o próximo Espaço.
       `detail === 0` identifica ativações de teclado/programáticas: nelas o foco
       permanece, preservando a navegação acessível e o comportamento nativo. */
    if (e.detail === 0 || !(e.target instanceof Element)) return;
    const control = e.target.closest('button, [role="button"]');
    if (control && document.activeElement === control) control.blur();
  });

  document.addEventListener('keydown', (e) => {
    const target = e.target instanceof Element ? e.target : document.activeElement;
    if (e.key === 'Escape') {
      if (!el.importMenu.hidden) { importMenuOpen(false); el.btnImport.focus(); return; }
      if (window.Settings.isOpen()) { window.Settings.close(); return; }
      if (state.focus) { focusOff(); return; }
      if (!el.linkbar.hidden) { linkOpen(false); return; }
    }
    if (e.defaultPrevented) return;
    const interactive = target?.closest?.(
      'input, textarea, select, button, a[href], [contenteditable="true"], [role="button"], [role="slider"]'
    );
    if (interactive) return;
    const sk = (seconds = cfg('tl.seek')) => Math.max(0.1, seconds) * (state.rate / 100);
    switch (e.key) {
      case ' ': e.preventDefault(); if (!e.repeat && state.loaded) toggle(); break;
      case 'ArrowLeft': if (state.loaded) { e.preventDefault(); seek(state.audio.currentTime - sk(e.shiftKey ? 1 : undefined)); } break;
      case 'ArrowRight': if (state.loaded) { e.preventDefault(); seek(state.audio.currentTime + sk(e.shiftKey ? 1 : undefined)); } break;
      case '[': setRate(state.rate - rateStep(e.shiftKey), { step: true }); break;
      case ']': setRate(state.rate + rateStep(e.shiftKey), { step: true }); break;
      case '0': setRate(100, { step: true }); break;
      case ',': e.preventDefault(); window.Settings.toggle(); break;
      default: break;
    }
  });

  /* ── aplicação das configurações ─────────────────────── */
  function applyAll() {
    setTheme(resolveTheme(), true);
    el.root.dataset.density = cfg('ui.density');
    el.sbarItems.forEach((n) => { n.hidden = !cfg('ui.hints'); });
    window.Motion.configure({
      level: cfg('motion.level'),
      scale: cfg('motion.scale'),
      intensity: cfg('motion.intensity') / 100,
    });
    el.root.dataset.motion = window.Motion.reduced() ? 'reduced' : 'full';
    el.scopeWrap.hidden = !cfg('scope.on');
    const scopeName = cfg('scope.visualizer') === 'vectorscope' ? 'vectorscope de partículas' : 'osciloscópio';
    el.scopeWrap.title = `Ampliar ${scopeName}`;
    el.scopeWrap.setAttribute('aria-label', `Ampliar ${scopeName}`);
    popState(!!(pop.win && !pop.win.closed));
    if (!cfg('scope.on') && state.focus) focusOff();
    el.fScrub.disabled = !state.loaded;
    applyRateBounds();
    renderReadouts();
    resize();
  }

  /* Outras áreas (Configurações, Sistema etc.) podem pedir o mesmo
     feedback sem conhecer a status bar nem duplicar a engine de motion. */
  document.addEventListener('varispeed:status', (e) => {
    const d = e.detail || {};
    const text = String(d.text || '');
    if (!text) return;
    if (d.persist) status(text, d.motion || {});
    else flash(text, Object.assign({}, d.motion || {}, {
      lead: d.lead || '',
      hold: Number.isFinite(d.hold) ? d.hold : 1450,
    }));
  });

  /* “Testar” de cada grupo: demonstra o efeito no próprio contexto */
  document.addEventListener('cfg:test', (e) => {
    if (e.detail === 'motion') {
      flash('Amostra de movimento', { lead: 'Teste · ', hold: 1600 });
      if (cfg('motion.rateTick')) {
        const nx = clamp(state.rate + rateStep(false), rateMin(), rateMax());
        if (nx !== state.rate) tickRateValue(rateText(state.rate), rateText(nx), nx - state.rate);
      }
    }
    if (e.detail === 'scope') {
      const back = el.scopeWrap.dataset.state || 'idle';
      dot('busy');
      scope.t0 = performance.now();
      setTimeout(() => { dot(back); repaintScope(); }, 1200);
    }
  });

  document.addEventListener('cfg:imported', (e) => {
    const n = Number(e.detail);
    if (n < 0) status('Preset inválido — o JSON não pôde ser lido');
    else if (n === 0) status('Preset carregado — nenhum ajuste compatível mudou');
    else status(`Preset aplicado · ${n} ajuste${n === 1 ? '' : 's'}`);
  });

  /* ── init ───────────────────────────────────────────── */
  el.waveHost.classList.add('is-empty');
  el.root.dataset.media = 'empty';
  const remembered = readLastRate();
  if (Number.isFinite(remembered) && cfg('load.rememberRate')) state.rate = remembered;
  applyAll();
  window.Settings.mount({
    diagnostics: () => {
      const graphPerf = window.MediaLibrary?.performance;
      return {
        ctxRate: scope.ac ? `${(scope.ac.sampleRate / 1000).toFixed(1)} kHz` : '—',
        latency: scope.ac && scope.ac.baseLatency ? `${(scope.ac.baseLatency * 1000).toFixed(1)} ms` : '—',
        fftSize: scope.an ? String(scope.an.fftSize) : '—',
        fps: perf.fps ? `${perf.fps}/s` : '—',
        graphFps: graphPerf?.fps ? `${graphPerf.fps}/s` : '—',
        graphPhysics: graphPerf ? `${graphPerf.physicsMs.toFixed(2)} ms` : '—',
        graphRender: graphPerf ? `${graphPerf.renderMs.toFixed(2)} ms` : '—',
        motion: window.Motion.reduced() ? 'reduzido' : cfg('motion.level') === 'discreet' ? 'discreto' : 'completo',
      };
    },
  });
  syncRemoteAuth();
  window.MediaLibrary?.mount({
    captureState: () => ({
      rate: state.rate,
      position: state.audio.currentTime || 0,
    }),
    onViewChange: (open) => {
      libraryViewOpen = open;
      if (open) {
        if (!el.linkbar.hidden) linkOpen(false);
        importMenuOpen(false);
        window.Settings.close();
        el.root.dataset.view = 'library';
      } else {
        delete el.root.dataset.view;
      }
      syncLibraryAdd();
      syncLibraryTransport();
    },
    onChange: handleLibraryChange,
    onOpen: openLibraryMedia,
  });
  window.Settings.on((keys = []) => {
    if (keys.includes('load.rememberRate')) {
      if (cfg('load.rememberRate')) writeLastRate(state.rate);
      else clearLastRate();
    }
    if (keys.includes('remote.authBrowser')) syncRemoteAuth({ notify: true });
    applyAll();
    syncLibraryAdd();
  });
  status('Pronto — importe um arquivo de áudio');
})();
