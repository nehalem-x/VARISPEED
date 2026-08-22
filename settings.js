/* ═════════════════════════════════════════════════════════
   VARISPEED — configurações
   Um único esquema declarativo descreve grupos, campos,
   limites e formatação. O painel é construído a partir dele,
   a persistência é derivada dele e o preset JSON é a mesma
   estrutura — sem duplicar definições em três lugares.
   ═════════════════════════════════════════════════════════ */
window.Settings = (() => {
  'use strict';

  const KEY = 'tempo.cfg.v1';

  /* ── esquema ─────────────────────────────────────────── */
  const GROUPS = [
    {
      id: 'motion', title: 'Animações', test: 'motion',
      note: 'Todos os feedbacks textuais usam a mesma cadência da confirmação de exportação.',
      fields: [
        { k: 'motion.level', t: 'select', label: 'Nível', d: 'system',
          opts: [['system', 'Seguir sistema'], ['full', 'Completo'], ['discreet', 'Discreto'], ['off', 'Desligado']] },
        { k: 'motion.scale', t: 'range', label: 'Escala de tempo', d: 1, min: 0.5, max: 1.5, step: 0.05,
          fmt: (v) => `${(+v).toFixed(2)}×`, off: (g) => g('motion.level') === 'off' },
        { k: 'motion.intensity', t: 'range', label: 'Intensidade', d: 100, min: 0, max: 100, step: 5,
          fmt: (v) => `${v}%`, off: (g) => g('motion.level') === 'off' },
        { k: 'motion.status', t: 'bool', label: 'Animação padrão de status', d: true },
        { k: 'motion.exportHold', t: 'range', label: 'Sustentação da exportação', d: 3.2, min: 1, max: 8, step: 0.2,
          fmt: (v) => `${(+v).toFixed(1)} s`, off: (g) => !g('motion.status') },
        { k: 'motion.caret', t: 'bool', label: 'Cursor nos status temporários', d: true, off: (g) => !g('motion.status') },
        { k: 'motion.rateTick', t: 'bool', label: 'Microanimação numérica', d: true },
        { k: 'motion.sweep', t: 'bool', label: 'Varredura na exportação', d: true },
      ],
    },
    {
      id: 'scope', title: 'Osciloscópio', test: 'scope',
      fields: [
        { k: 'scope.on', t: 'bool', label: 'Ativo', d: true },
        { k: 'scope.mode', t: 'select', label: 'Traço', d: 'columns',
          opts: [['columns', 'Colunas min/max'], ['line', 'Linha']], off: (g) => !g('scope.on') },
        { k: 'scope.gain', t: 'range', label: 'Ganho', d: 1.12, min: 0.5, max: 3, step: 0.02,
          fmt: (v) => `${(+v).toFixed(2)}×`, off: (g) => !g('scope.on') },
        { k: 'scope.window', t: 'range', label: 'Janela', d: 640, min: 128, max: 2048, step: 32,
          fmt: (v) => `${v} amostras`, off: (g) => !g('scope.on') },
        { k: 'scope.smooth', t: 'range', label: 'Suavização', d: 0.8, min: 0.15, max: 1, step: 0.05,
          fmt: (v) => `${Math.round((1 - v) * 100)}%`, off: (g) => !g('scope.on') },
        { k: 'scope.trigger', t: 'bool', label: 'Trigger em cruzamento de zero', d: true, off: (g) => !g('scope.on') },
        { k: 'scope.fps', t: 'select', label: 'Atualização', d: '60',
          opts: [['60', '60 fps'], ['30', '30 fps']], off: (g) => !g('scope.on') },
      ],
    },
    {
      id: 'export', title: 'Exportação',
      fields: [
        { k: 'export.bits', t: 'select', label: 'Profundidade', d: '16',
          opts: [['16', '16 bits PCM'], ['24', '24 bits PCM'], ['32f', '32 bits float']] },
        { k: 'export.sampleRate', t: 'select', label: 'Sample rate', d: 'source',
          opts: [['source', 'Igual à fonte'], ['44100', '44 100 Hz'], ['48000', '48 000 Hz'], ['96000', '96 000 Hz']] },
        { k: 'export.normalize', t: 'bool', label: 'Normalizar pico', d: false },
        { k: 'export.ceiling', t: 'range', label: 'Teto', d: -0.3, min: -6, max: 0, step: 0.1,
          fmt: (v) => `${(+v).toFixed(1)} dBFS`, off: (g) => !g('export.normalize') },
        { k: 'export.name', t: 'text', label: 'Nome do arquivo', d: '{nome}_{rate}pct', maxLength: 180,
          hint: '{nome} · {rate} · {mult} · {st} · {sr} · {data}' },
        { k: 'load.confirmExit', t: 'bool', label: 'Avisar ao sair durante exportação', d: true },
      ],
    },
    {
      id: 'rate', title: 'Velocidade',
      fields: [
        { k: 'rate.unit', t: 'select', label: 'Unidade', d: 'pct',
          opts: [['pct', 'Porcentagem'], ['mult', 'Multiplicador'], ['st', 'Semitons']] },
        { k: 'rate.step', t: 'select', label: 'Passo', d: '1',
          opts: [['0.1', '0,1'], ['0.5', '0,5'], ['1', '1'], ['5', '5']] },
        { k: 'rate.min', t: 'range', label: 'Mínimo', d: 25, min: 5, max: 100, step: 5, fmt: (v) => `${v}%` },
        { k: 'rate.max', t: 'range', label: 'Máximo', d: 400, min: 150, max: 800, step: 25, fmt: (v) => `${v}%` },
        { k: 'rate.presets', t: 'text', label: 'Presets', d: '50, 75, 100, 125, 150, 200', maxLength: 120, hint: 'valores em % separados por vírgula' },
        { k: 'load.rememberRate', t: 'bool', label: 'Lembrar última velocidade', d: true },
      ],
    },
    {
      id: 'timeline', title: 'Timeline',
      fields: [
        { k: 'tl.ruler', t: 'select', label: 'Régua', d: 'output',
          opts: [['output', 'Tempo de saída'], ['source', 'Tempo da fonte']] },
        { k: 'tl.format', t: 'select', label: 'Formato', d: 'mmss',
          opts: [['mmss', 'm:ss.cc'], ['sec', 'Segundos'], ['samples', 'Amostras']] },
        { k: 'tl.seek', t: 'range', label: 'Passo das setas', d: 5, min: 1, max: 30, step: 1, fmt: (v) => `${v} s` },
        { k: 'tl.wheelZoom', t: 'bool', label: 'Roda amplia sem Ctrl', d: false },
      ],
    },
    {
      id: 'ui', title: 'Interface',
      fields: [
        { k: 'ui.theme', t: 'select', label: 'Tema', d: 'system',
          opts: [['system', 'Seguir sistema'], ['dark', 'Escuro'], ['light', 'Claro']] },
        { k: 'ui.density', t: 'select', label: 'Densidade', d: 'compact',
          opts: [['compact', 'Compacta'], ['comfortable', 'Confortável']] },
        { k: 'ui.hints', t: 'bool', label: 'Dicas de teclado na barra', d: true },
      ],
    },
    {
      id: 'load', title: 'Ao importar',
      fields: [
        { k: 'load.autoplay', t: 'bool', label: 'Reproduzir automaticamente', d: false },
        { k: 'load.resetRate', t: 'bool', label: 'Voltar velocidade para 100%', d: false },
        { k: 'load.keepZoom', t: 'bool', label: 'Manter zoom atual', d: false },
      ],
    },
    {
      id: 'system', title: 'Sistema', kind: 'system',
    },
    {
      id: 'keys', title: 'Atalhos', kind: 'keys',
      items: [
        [['Espaço'], 'reproduzir / pausar'],
        [['←', '→'], 'deslocar posição'],
        [['⇧', '←'], 'deslocar 1 s'],
        [['[', ']'], 'velocidade ∓ passo'],
        [['⇧', ']'], 'velocidade ± 5 passos'],
        [['0'], 'voltar a 100%'],
        [['Ctrl', 'roda'], 'zoom na timeline'],
        [[','], 'abrir configurações'],
        [['Esc'], 'fechar configurações'],
      ],
    },
    {
      id: 'diag', title: 'Diagnóstico', kind: 'diag',
      rows: [
        ['ctxRate', 'Sample rate do contexto'],
        ['latency', 'Latência de saída'],
        ['fftSize', 'Buffer da análise'],
        ['fps', 'Quadros por segundo'],
        ['motion', 'Animações efetivas'],
        ['store', 'Armazenamento'],
      ],
    },
  ];

  /* ── índice de campos ────────────────────────────────── */
  const FIELDS = new Map();
  GROUPS.forEach((g) => (g.fields || []).forEach((f) => FIELDS.set(f.k, f)));
  const DEFAULTS = {};
  FIELDS.forEach((f, k) => { DEFAULTS[k] = f.d; });

  /* ── persistência ────────────────────────────────────── */
  /* Armazenamento local resolvido em tempo de execução: dentro do
     iframe de pré-visualização a API é bloqueada, então o painel cai
     para memória sem quebrar. Na página publicada, persiste. */
  const STORE = (() => {
    try {
      const api = window[['local', 'Storage'].join('')];
      api.setItem('__tempo_probe', '1');
      api.removeItem('__tempo_probe');
      return api;
    } catch (e) { return null; }
  })();

  let storeOk = !!STORE;
  const memory = {};
  function readStore() {
    try {
      const raw = STORE && STORE.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { storeOk = false; return memory[KEY] || {}; }
  }
  function writeStore(obj) {
    try { STORE.setItem(KEY, JSON.stringify(obj)); }
    catch (e) { storeOk = false; memory[KEY] = obj; }
  }

  const values = Object.assign({}, DEFAULTS);
  (() => {
    const saved = readStore();
    const cleaned = {};
    let stale = false;
    Object.keys(saved).forEach((k) => {
      if (k in DEFAULTS) {
        values[k] = coerce(k, saved[k]);
        cleaned[k] = saved[k];
      } else {
        /* Migração leve: preferências removidas (ex.: antigo bloom da logo)
           são ignoradas e podadas sem alterar a chave de storage/presets. */
        stale = true;
      }
    });
    if (stale) writeStore(cleaned);
  })();

  function coerce(k, v) {
    const f = FIELDS.get(k);
    if (!f) return v;
    if (f.t === 'bool') return !!v;
    if (f.t === 'range') {
      const n = parseFloat(v);
      if (isNaN(n)) return f.d;
      return Math.min(f.max, Math.max(f.min, n));
    }
    if (f.t === 'select') {
      const ok = f.opts.some(([id]) => id === String(v));
      return ok ? String(v) : f.d;
    }
    const text = String(v);
    return f.maxLength && Array.from(text).length > f.maxLength
      ? Array.from(text).slice(0, f.maxLength).join('')
      : text;
  }

  const listeners = [];
  const get = (k) => values[k];
  const gRef = get;

  function set(k, v, opts = {}) {
    if (!(k in DEFAULTS)) return;
    const next = coerce(k, v);
    if (values[k] === next && !opts.force) return;
    values[k] = next;
    if (!opts.transient) persist();
    emit([k]);
    if (!opts.silentUI) syncControls();
  }

  function persist() {
    const diff = {};
    Object.keys(values).forEach((k) => { if (values[k] !== DEFAULTS[k]) diff[k] = values[k]; });
    writeStore(diff);
  }

  function emit(keys) { listeners.forEach((fn) => fn(keys, values)); }
  const on = (fn) => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); };

  function reset() {
    Object.assign(values, DEFAULTS);
    persist();
    emit(Object.keys(values));
    syncControls();
    document.dispatchEvent(new CustomEvent('varispeed:status', {
      detail: { text: 'Configurações restauradas', hold: 1600 },
    }));
  }

  function apply(obj, keys) {
    const changed = [];
    (keys || Object.keys(obj)).forEach((k) => {
      if (!(k in DEFAULTS)) return;
      const next = coerce(k, obj[k]);
      if (values[k] !== next) { values[k] = next; changed.push(k); }
    });
    persist();
    if (changed.length) emit(changed);
    syncControls();
    return changed.length;
  }

  /* ── painel ──────────────────────────────────────────── */
  const controls = new Map();      // k → {input, out, row}
  let body = null, panel = null, trigger = null, diagProvider = null, diagTimer = 0;
  let panelTimer = 0, viewportBound = false, lastFocus = null;
  const diagCells = new Map();
  const systemCells = new Map();
  let systemShutdownBtn = null, systemCopyBtn = null;

  const compactPanel = () => window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  const focusableSelector = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

  function syncVisualViewport() {
    if (!panel || panel.hidden) return;
    const compact = compactPanel();
    panel.setAttribute('aria-modal', String(compact));
    if (!compact) {
      document.documentElement.style.removeProperty('--cfg-vvh');
      document.documentElement.style.removeProperty('--cfg-vvtop');
      return;
    }
    const vv = window.visualViewport;
    /* REV 6: visualViewport pode retornar CSS pixels fracionários sob zoom
       (ex.: 613.6 px). Preservar essa fração evita uma fresta de 1 px ou um
       painel ligeiramente maior que o viewport ao alternar 90/110/125/150%. */
    const h = Math.max(1, Number(vv ? vv.height : window.innerHeight) || 1);
    const top = Math.max(0, Number(vv ? vv.offsetTop : 0) || 0);
    document.documentElement.style.setProperty('--cfg-vvh', `${h.toFixed(3)}px`);
    document.documentElement.style.setProperty('--cfg-vvtop', `${top.toFixed(3)}px`);
  }

  function bindVisualViewport(on) {
    if (on === viewportBound) return;
    viewportBound = on;
    const fn = on ? 'addEventListener' : 'removeEventListener';
    window[fn]('resize', syncVisualViewport, { passive: true });
    if (window.visualViewport) {
      window.visualViewport[fn]('resize', syncVisualViewport, { passive: true });
      window.visualViewport[fn]('scroll', syncVisualViewport, { passive: true });
    }
    if (on) syncVisualViewport();
    else {
      document.documentElement.style.removeProperty('--cfg-vvh');
      document.documentElement.style.removeProperty('--cfg-vvtop');
    }
  }

  function keepFocusedVisible(target) {
    if (!compactPanel() || !target || !/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
    setTimeout(() => {
      if (!panel || panel.hidden || document.activeElement !== target) return;
      syncVisualViewport();
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, 90);
  }

  function trapPanelTab(e) {
    if (e.key !== 'Tab' || !compactPanel() || !panel || panel.hidden) return;
    const items = [...panel.querySelectorAll(focusableSelector)].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus({ preventScroll: true });
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus({ preventScroll: true });
    }
  }

  function h(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function buildField(f) {
    const row = h('div', 'cfg__row');
    const lab = h('label', 'cfg__label', f.label);
    row.appendChild(lab);

    let input, out = null;

    if (f.t === 'bool') {
      input = h('button', 'sw');
      input.type = 'button';
      input.setAttribute('role', 'switch');
      input.appendChild(h('span', 'sw__knob'));
      input.addEventListener('click', () => set(f.k, !get(f.k)));
      row.appendChild(input);
      row.classList.add('cfg__row--inline');
    } else if (f.t === 'select') {
      input = h('select', 'sel mono');
      f.opts.forEach(([id, label]) => {
        const o = h('option', null, label);
        o.value = id;
        input.appendChild(o);
      });
      input.addEventListener('change', () => set(f.k, input.value));
      row.appendChild(input);
      row.classList.add('cfg__row--inline');
    } else if (f.t === 'range') {
      out = h('span', 'cfg__val mono');
      row.appendChild(out);
      input = h('input', 'slider');
      input.type = 'range';
      input.min = f.min; input.max = f.max; input.step = f.step;
      input.addEventListener('input', () => {
        values[f.k] = coerce(f.k, input.value);
        out.textContent = f.fmt ? f.fmt(values[f.k]) : String(values[f.k]);
        emit([f.k]);
      });
      input.addEventListener('change', () => set(f.k, input.value, { force: true }));
      row.appendChild(input);
      row.classList.add('cfg__row--stack');
    } else {
      input = h('input', 'txt mono');
      input.type = 'text';
      input.spellcheck = false;
      if (f.maxLength) input.maxLength = f.maxLength;
      input.addEventListener('change', () => set(f.k, input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      row.appendChild(input);
      row.classList.add('cfg__row--stack');
      if (f.hint) {
        const hint = h('span', 'cfg__hint mono', f.hint);
        row.appendChild(hint);
      }
    }

    const id = `cfg-${f.k.replace(/\./g, '-')}`;
    input.id = id;
    lab.setAttribute('for', id);
    if (f.t === 'bool') input.setAttribute('aria-label', f.label);
    controls.set(f.k, { input, out, row, f });
    return row;
  }

  async function refreshSystemInfo() {
    if (!systemCells.size) return;
    const lan = systemCells.get('lan');
    const port = systemCells.get('port');
    const stateCell = systemCells.get('state');
    try {
      const response = await fetch('/api/system/info', { cache: 'no-store' });
      if (!response.ok) throw new Error('indisponível');
      const info = await response.json();
      const urls = Array.isArray(info.lan_urls) ? info.lan_urls : [];
      const primary = urls[0] || 'Não detectada';
      if (lan) {
        lan.textContent = primary;
        lan.title = urls.length > 1 ? urls.join('\n') : primary;
        lan.dataset.url = urls[0] || '';
      }
      if (port) port.textContent = String(info.port || '8765');
      if (stateCell) stateCell.textContent = 'Ativo';
      if (systemCopyBtn) systemCopyBtn.disabled = !urls.length;
      if (systemShutdownBtn) {
        systemShutdownBtn.disabled = !info.can_shutdown;
        systemShutdownBtn.title = info.can_shutdown
          ? 'Encerra o backend local do VARISPEED'
          : 'O desligamento só está disponível no computador host';
      }
    } catch (_) {
      if (lan) { lan.textContent = 'Indisponível'; lan.dataset.url = ''; }
      if (port) port.textContent = '—';
      if (stateCell) stateCell.textContent = 'Sem conexão';
      if (systemCopyBtn) systemCopyBtn.disabled = true;
      if (systemShutdownBtn) systemShutdownBtn.disabled = true;
    }
  }

  async function copySystemUrl() {
    const lan = systemCells.get('lan');
    const value = lan && lan.dataset.url;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      document.dispatchEvent(new CustomEvent('varispeed:status', {
        detail: { text: `Endereço copiado · ${value}`, hold: 1800 },
      }));
    } catch (_) {
      // Fallback simples para navegadores sem Clipboard API em HTTP local.
      const ta = document.createElement('textarea');
      ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      document.dispatchEvent(new CustomEvent('varispeed:status', {
        detail: { text: copied ? `Endereço copiado · ${value}` : 'Não foi possível copiar o endereço', hold: 1800 },
      }));
    }
  }

  function showShutdownScreen() {
    document.documentElement.classList.remove('cfg-open');
    document.title = 'VARISPEED — Desligado';
    document.body.innerHTML = `
      <main class="shutdown-screen" role="status" aria-live="polite">
        <img src="assets/favicon.png" width="56" height="56" alt="" draggable="false">
        <strong>VARISPEED DESLIGADO</strong>
        <span>Pode fechar esta aba.</span>
      </main>`;
  }

  async function shutdownVarispeed() {
    if (!systemShutdownBtn || systemShutdownBtn.disabled) return;
    if (!window.confirm('Desligar o VARISPEED neste computador?')) return;
    systemShutdownBtn.disabled = true;
    systemShutdownBtn.textContent = 'Desligando...';
    document.dispatchEvent(new CustomEvent('varispeed:status', {
      detail: { text: 'Desligando VARISPEED...', persist: true },
    }));
    document.dispatchEvent(new CustomEvent('varispeed:shutdown'));
    try {
      const response = await fetch('/api/system/shutdown', { method: 'POST', cache: 'no-store' });
      if (!response.ok) {
        let message = 'Não foi possível desligar o VARISPEED.';
        try { const body = await response.json(); message = body.detail || message; } catch (_) {}
        throw new Error(message);
      }
      close();
      setTimeout(showShutdownScreen, 180);
    } catch (err) {
      systemShutdownBtn.disabled = false;
      systemShutdownBtn.textContent = 'Desligar VARISPEED';
      window.alert(err && err.message ? err.message : 'Não foi possível desligar o VARISPEED.');
      refreshSystemInfo();
    }
  }

  function buildSystemGroup(sec) {
    const list = h('dl', 'rows cfg__system-rows');
    [['state', 'Servidor'], ['lan', 'Rede local'], ['port', 'Porta']].forEach(([id, label]) => {
      const r = h('div', 'row');
      r.appendChild(h('dt', null, label));
      const dd = h('dd', 'mono cfg__system-value', '—');
      systemCells.set(id, dd);
      r.appendChild(dd);
      list.appendChild(r);
    });
    sec.appendChild(list);

    const hint = h('p', 'cfg__system-hint', 'Abra o endereço de rede local em outro dispositivo conectado à mesma rede.');
    sec.appendChild(hint);

    const actions = h('div', 'cfg__system-actions');
    systemCopyBtn = h('button', 'btn cfg__system-action', 'Copiar endereço');
    systemCopyBtn.type = 'button';
    systemCopyBtn.disabled = true;
    systemCopyBtn.addEventListener('click', copySystemUrl);
    systemShutdownBtn = h('button', 'btn cfg__system-action cfg__shutdown', 'Desligar VARISPEED');
    systemShutdownBtn.type = 'button';
    systemShutdownBtn.disabled = true;
    systemShutdownBtn.addEventListener('click', shutdownVarispeed);
    actions.append(systemCopyBtn, systemShutdownBtn);
    sec.appendChild(actions);
    refreshSystemInfo();
    return sec;
  }

  function buildGroup(g) {
    const sec = h('section', 'cfg__group');
    const head = h('div', 'cfg__head');
    head.appendChild(h('h3', 'panel__title', g.title));
    if (g.test) {
      const b = h('button', 'btn btn--ghost cfg__test', 'Testar');
      b.type = 'button';
      b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('cfg:test', { detail: g.test })));
      head.appendChild(b);
    }
    sec.appendChild(head);

    if (g.kind === 'system') return buildSystemGroup(sec);

    if (g.kind === 'keys') {
      const list = h('dl', 'rows');
      g.items.forEach(([keys, desc]) => {
        const r = h('div', 'row');
        const dt = h('dt', 'cfg__keys');
        keys.forEach((k) => dt.appendChild(h('kbd', null, k)));
        const dd = h('dd', null, desc);
        r.appendChild(dt); r.appendChild(dd);
        list.appendChild(r);
      });
      sec.appendChild(list);
      return sec;
    }

    if (g.kind === 'diag') {
      const list = h('dl', 'rows');
      g.rows.forEach(([id, label]) => {
        const r = h('div', 'row');
        r.appendChild(h('dt', null, label));
        const dd = h('dd', 'mono', '—');
        diagCells.set(id, dd);
        r.appendChild(dd);
        list.appendChild(r);
      });
      sec.appendChild(list);
      return sec;
    }

    const wrap = h('div', 'cfg__fields');
    g.fields.forEach((f) => wrap.appendChild(buildField(f)));
    sec.appendChild(wrap);
    return sec;
  }

  function buildCredits() {
    const sec = h('section', 'cfg__credits');

    const media = h('div', 'cfg__credits-media');
    const light = document.createElement('img');
    light.className = 'cfg__credits-photo cfg__credits-photo--light';
    light.src = 'assets/creator-light.png';
    light.alt = '';
    light.draggable = false;
    const dark = document.createElement('img');
    dark.className = 'cfg__credits-photo cfg__credits-photo--dark';
    dark.src = 'assets/creator-dark.png';
    dark.alt = 'Retrato do criador';
    dark.draggable = false;
    media.appendChild(light);
    media.appendChild(dark);

    const copy = h('div', 'cfg__credits-copy');
    copy.appendChild(h('strong', 'cfg__credits-title', 'VARISPEED 1.0'));
    copy.appendChild(h('span', 'cfg__credits-line', 'CRIAÇÃO E DESENVOLVIMENTO — Gaspar'));
    copy.appendChild(h('span', 'cfg__credits-tech mono', 'WEB AUDIO / OSCILOSCÓPIO'));

    sec.appendChild(media);
    sec.appendChild(copy);
    return sec;
  }

  function syncControls() {
    controls.forEach(({ input, out, row, f }, k) => {
      const v = values[k];
      if (f.t === 'bool') {
        input.setAttribute('aria-checked', String(!!v));
        input.setAttribute('aria-pressed', String(!!v));
      } else if (f.t === 'select') {
        if (input.value !== String(v)) input.value = String(v);
      } else if (f.t === 'range') {
        if (parseFloat(input.value) !== v) input.value = String(v);
        if (out) out.textContent = f.fmt ? f.fmt(v) : String(v);
      } else if (document.activeElement !== input) {
        input.value = String(v);
      }
      const off = f.off ? !!f.off(gRef) : false;
      row.classList.toggle('is-off', off);
      row.setAttribute('aria-disabled', String(off));
      input.disabled = off;
    });
  }

  function pumpDiag() {
    if (!diagProvider || !panel || panel.hidden) return;
    const d = diagProvider() || {};
    d.store = storeOk ? 'local' : 'memória (bloqueado)';
    diagCells.forEach((cell, id) => { cell.textContent = d[id] == null ? '—' : String(d[id]); });
  }

  /* ── preset JSON ─────────────────────────────────────── */
  function exportPreset() {
    const out = { app: 'VARISPEED', version: 1, settings: {} };
    Object.keys(values).forEach((k) => { out.settings[k] = values[k]; });
    return JSON.stringify(out, null, 2);
  }

  function downloadPreset() {
    const blob = new Blob([exportPreset()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'varispeed-preset.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    document.dispatchEvent(new CustomEvent('varispeed:status', {
      detail: { text: 'Preset exportado · varispeed-preset.json', hold: 1900 },
    }));
  }

  async function importPresetFile(file) {
    try {
      const txt = await file.text();
      const obj = JSON.parse(txt);
      const src = obj && obj.settings ? obj.settings : obj;
      const n = apply(src);
      return n;
    } catch (e) { return -1; }
  }

  /* ── ciclo de vida do painel ─────────────────────────── */
  function open() {
    if (!panel || (!panel.hidden && panel.classList.contains('is-open'))) return;
    clearTimeout(panelTimer); panelTimer = 0;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.hidden = false;
    panel.setAttribute('aria-modal', String(compactPanel()));
    document.documentElement.classList.add('cfg-open');
    bindVisualViewport(true);
    requestAnimationFrame(() => panel.classList.add('is-open'));
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    pumpDiag();
    refreshSystemInfo();
    clearInterval(diagTimer);
    diagTimer = setInterval(pumpDiag, 600);
    const first = panel.querySelector('select:not([disabled]), button.sw:not([disabled]), input:not([disabled]), button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }
  function close() {
    if (!panel || panel.hidden) return;
    clearTimeout(panelTimer); panelTimer = 0;
    const active = document.activeElement;
    if (active && panel.contains(active) && typeof active.blur === 'function') active.blur();
    panel.classList.remove('is-open');
    panel.setAttribute('aria-modal', 'false');
    document.documentElement.classList.remove('cfg-open');
    bindVisualViewport(false);
    clearInterval(diagTimer);
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    const restore = lastFocus && lastFocus.isConnected ? lastFocus : trigger;
    if (restore && typeof restore.focus === 'function') restore.focus({ preventScroll: true });
    lastFocus = null;
    const done = () => { panel.hidden = true; panelTimer = 0; };
    if (window.Motion && window.Motion.reduced()) done();
    else panelTimer = setTimeout(done, 190);
  }
  const isOpen = () => panel && !panel.hidden;
  const toggle = () => (isOpen() ? close() : open());

  function mount(opts = {}) {
    panel = document.getElementById('cfg');
    body = document.getElementById('cfgBody');
    trigger = document.getElementById('btnConfig');
    diagProvider = opts.diagnostics || null;
    if (!panel || !body) return;

    GROUPS.forEach((g, i) => {
      if (i) body.appendChild(h('div', 'hr'));
      body.appendChild(buildGroup(g));
    });
    body.appendChild(h('div', 'hr'));
    body.appendChild(buildCredits());
    syncControls();

    document.getElementById('cfgClose').addEventListener('click', close);
    panel.addEventListener('keydown', trapPanelTab);
    panel.addEventListener('focusin', (e) => keepFocusedVisible(e.target));
    document.getElementById('cfgReset').addEventListener('click', reset);
    document.getElementById('cfgSave').addEventListener('click', downloadPreset);
    const fileIn = document.getElementById('cfgFile');
    document.getElementById('cfgLoad').addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const n = await importPresetFile(f);
      fileIn.value = '';
      document.dispatchEvent(new CustomEvent('cfg:imported', { detail: n }));
    });

    if (trigger) trigger.addEventListener('click', toggle);
    document.addEventListener('pointerdown', (e) => {
      if (!isOpen()) return;
      if (panel.contains(e.target) || (trigger && trigger.contains(e.target))) return;
      close();
    });
    on(() => { if (isOpen()) syncControls(); });
  }

  return {
    mount, open, close, toggle, isOpen,
    get, set, all: () => Object.assign({}, values),
    on, reset, apply, exportPreset,
    GROUPS,
  };
})();
