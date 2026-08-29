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
          fmt: (v) => `${(+v).toFixed(2)}×`, bounds: true,
          help: 'Acelera ou desacelera apenas a duração das microanimações da interface.', off: (g) => g('motion.level') === 'off' },
        { k: 'motion.intensity', t: 'range', label: 'Intensidade', d: 100, min: 0, max: 100, step: 5,
          fmt: (v) => `${v}%`, bounds: true,
          help: 'Controla a presença visual dos efeitos sem alterar sua duração.', off: (g) => g('motion.level') === 'off' },
        { k: 'motion.status', t: 'bool', label: 'Animação padrão de status', d: true,
          off: (g) => g('motion.level') === 'off' },
        { k: 'motion.exportHold', t: 'range', label: 'Sustentação da exportação', d: 3.2, min: 1, max: 8, step: 0.2,
          fmt: (v) => `${(+v).toFixed(1)} s`, off: (g) => g('motion.level') === 'off' || !g('motion.status') },
        { k: 'motion.caret', t: 'bool', label: 'Cursor nos status temporários', d: true,
          off: (g) => g('motion.level') === 'off' || !g('motion.status') },
        { k: 'motion.rateTick', t: 'bool', label: 'Microanimação numérica', d: true,
          off: (g) => g('motion.level') === 'off' },
        { k: 'motion.sweep', t: 'bool', label: 'Varredura em operações', d: true,
          help: 'Exibe a linha animada durante exportação, abertura e inclusão de músicas na Biblioteca.',
          off: (g) => g('motion.level') === 'off' },
      ],
    },
    {
      id: 'scope', title: 'Visualização de áudio', test: 'scope',
      fields: [
        { k: 'scope.on', t: 'bool', label: 'Ativo', d: true },
        { k: 'scope.visualizer', t: 'select', label: 'Tipo de visualização', d: 'vectorscope',
          opts: [['vectorscope', 'Vectorscope de partículas'], ['waveform', 'Osciloscópio clássico']],
          off: (g) => !g('scope.on') },
        { k: 'scope.mode', t: 'select', label: 'Traço', d: 'columns',
          opts: [['columns', 'Colunas min/max'], ['line', 'Linha']],
          off: (g) => !g('scope.on') || g('scope.visualizer') !== 'waveform' },
        { k: 'scope.gain', t: 'range', label: 'Ganho', d: 1.12, min: 0.5, max: 3, step: 0.02,
          fmt: (v) => `${(+v).toFixed(2)}×`, bounds: true,
          help: 'Amplia somente o desenho do sinal; não altera o volume do áudio.', off: (g) => !g('scope.on') },
        { k: 'scope.window', t: 'range', label: 'Janela', d: 640, min: 128, max: 2048, step: 32,
          fmt: (v) => `${v} amostras`, bounds: true,
          help: 'Define quantas amostras formam cada quadro do visualizador.', off: (g) => !g('scope.on') },
        { k: 'scope.smooth', t: 'range', label: 'Suavização', d: 0.8, min: 0.15, max: 1, step: 0.05, reverse: true,
          fmt: (v) => `${Math.round((1 - v) * 100)}%`,
          help: 'Percentuais maiores estabilizam o envelope visual entre quadros. Disponível no traço por colunas.',
          off: (g) => !g('scope.on') || g('scope.visualizer') !== 'waveform' || g('scope.mode') === 'line' },
        { k: 'scope.trigger', t: 'bool', label: 'Trigger em cruzamento de zero', d: true,
          off: (g) => !g('scope.on') || g('scope.visualizer') !== 'waveform' },
        { k: 'scope.vectorTrail', t: 'range', label: 'Persistência das partículas', d: 0.88, min: 0.5, max: 0.97, step: 0.01,
          fmt: (v) => `${Math.round(v * 100)}%`, bounds: true,
          off: (g) => !g('scope.on') || g('scope.visualizer') !== 'vectorscope' },
        { k: 'scope.vectorSize', t: 'range', label: 'Tamanho das partículas', d: 1.15, min: 0.5, max: 2.5, step: 0.05,
          fmt: (v) => `${(+v).toFixed(2)}×`, bounds: true,
          off: (g) => !g('scope.on') || g('scope.visualizer') !== 'vectorscope' },
        { k: 'scope.vectorDensity', t: 'range', label: 'Densidade', d: 1, min: 0.5, max: 2, step: 0.1,
          fmt: (v) => `${(+v).toFixed(1)}×`, bounds: true,
          off: (g) => !g('scope.on') || g('scope.visualizer') !== 'vectorscope' },
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
          fmt: (v) => `${(+v).toFixed(1)} dBFS`, bounds: true,
          help: 'Pico máximo usado pela normalização. Valores abaixo de 0 dBFS deixam margem contra clipping.', off: (g) => !g('export.normalize') },
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
          opts: [['output', 'Tempo de saída'], ['source', 'Tempo da fonte']],
          help: 'Tempo de saída acompanha a velocidade; tempo da fonte mantém a duração original na régua.' },
        { k: 'tl.format', t: 'select', label: 'Formato', d: 'mmss',
          opts: [['mmss', 'm:ss.cc'], ['sec', 'Segundos'], ['samples', 'Amostras']] },
        { k: 'tl.seek', t: 'range', label: 'Passo das setas', d: 5, min: 1, max: 30, step: 1, fmt: (v) => `${v} s`,
          help: 'Define o passo normal de ←/→. Com Shift, o deslocamento permanece em 1 segundo.' },
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
      id: 'library', title: 'Biblioteca',
      fields: [
        { k: 'library.autoAdd', t: 'bool', label: 'Adicionar importações automaticamente', d: false,
          help: 'Quando desligado, a música permanece no editor até você usar “Adicionar à Biblioteca”.' },
        { k: 'library.alwaysShowGuide', t: 'bool', label: 'Sempre mostrar guia de apresentação', d: false,
          help: 'Reabre o guia cinematográfico sempre que você entra na Biblioteca. Desligado, ele aparece somente na primeira visita.' },
      ],
    },
    {
      id: 'remote', title: 'Importação por link',
      note: 'A autenticação permanece neste computador e só é usada quando o conteúdo exige uma sessão.',
      fields: [
        { k: 'remote.authBrowser', t: 'select', label: 'Conteúdo restrito', d: 'off',
          opts: [
            ['off', 'Não usar sessão'],
            ['auto', 'Usar cookies do navegador'],
            ['dedicated', 'Sessão dedicada (recomendado)'],
            ['chrome', 'Google Chrome'],
            ['edge', 'Microsoft Edge'],
            ['firefox', 'Mozilla Firefox'],
            ['brave', 'Brave'],
            ['vivaldi', 'Vivaldi'],
          ],
          help: '“Usar cookies do navegador” procura perfis compatíveis e só escolhe uma sessão que consiga abrir o link. Navegadores Chromium precisam estar fechados para permitir a leitura. A sessão dedicada é o fallback quando o navegador principal está em uso. Prefira uma conta secundária.' },
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
        ['graphFps', 'FPS do grafo'],
        ['graphPhysics', 'Física do grafo'],
        ['graphRender', 'Render do grafo'],
        ['graphZoomLatency', 'Latência do zoom'],
        ['graphZoomFrame', 'Intervalo do zoom'],
        ['graphZoomCamera', 'Custo da câmera'],
        ['graphZoomSettle', 'Resposta completa do zoom'],
        ['graphZoomDropped', 'Frames tardios no zoom'],
        ['motion', 'Animações efetivas'],
        ['store', 'Preferências'],
      ],
    },
  ];

  /* A navegação segue o fluxo de uso do produto. Ajustes cotidianos vêm
     primeiro; runtime, atalhos e diagnóstico permanecem disponíveis em uma
     área avançada recolhível, sem competir com as preferências principais. */
  const GROUP_ORDER = ['ui', 'rate', 'export', 'library', 'remote', 'timeline', 'scope', 'motion', 'load', 'system', 'keys', 'diag'];
  const ADVANCED_GROUPS = new Set(['system', 'keys', 'diag']);
  GROUPS.sort((a, b) => GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id));

  /* A ajuda de cada preferência fica centralizada aqui. O schema pode
     sobrescrever um texto com `help`, mas nenhum campo deve ficar sem a
     explicação acionada pelo mesmo botão semântico “?”. */
  const FIELD_HELP = {
    'ui.theme': 'Define as cores da interface. “Seguir sistema” acompanha automaticamente o tema claro ou escuro do dispositivo.',
    'ui.density': 'Ajusta o espaço entre elementos. Compacta mostra mais conteúdo; Confortável aumenta respiros e áreas de interação.',
    'ui.hints': 'Mostra ou oculta os lembretes de atalhos de teclado na barra inferior.',
    'rate.unit': 'Escolhe como a velocidade é exibida e editada: porcentagem, multiplicador ou diferença em semitons.',
    'rate.step': 'Define quanto os botões, colchetes e controles de incremento alteram a velocidade a cada ação.',
    'rate.min': 'Define a menor velocidade disponível no controle e filtra presets abaixo desse limite.',
    'rate.max': 'Define a maior velocidade disponível no controle e filtra presets acima desse limite.',
    'rate.presets': 'Configura até oito velocidades de acesso rápido. Os valores são armazenados internamente em porcentagem.',
    'load.rememberRate': 'Quando ativo, restaura na próxima abertura a última velocidade usada. Ao desligar, a velocidade memorizada é apagada.',
    'export.bits': 'Define a precisão das amostras no WAV exportado. Profundidades maiores produzem arquivos maiores.',
    'export.sampleRate': 'Define a frequência de amostragem do WAV. “Igual à fonte” evita uma reamostragem desnecessária.',
    'export.normalize': 'Ajusta o ganho do arquivo exportado para que o maior pico alcance o teto definido, sem alterar a dinâmica relativa.',
    'export.name': 'Define o modelo do nome do WAV. Os tokens abaixo são substituídos pelas informações atuais durante a exportação.',
    'load.confirmExit': 'Exibe um aviso ao tentar fechar ou recarregar a página enquanto uma exportação ainda está em andamento.',
    'library.autoAdd': 'Quando desligado, a música permanece no editor até você usar “Adicionar à Biblioteca”.',
    'library.alwaysShowGuide': 'Reabre o guia cinematográfico sempre que você entra na Biblioteca. Desligado, ele aparece somente na primeira visita.',
    'remote.authBrowser': 'O modo automático procura os navegadores instalados e valida cada sessão no link solicitado. Chromium precisa estar fechado para liberar o banco local. A sessão dedicada contorna esse bloqueio com uma janela isolada. Nenhum cookie é enviado ao frontend. Prefira uma conta secundária.',
    'tl.ruler': 'Tempo de saída acompanha a velocidade; tempo da fonte mantém a duração original na régua.',
    'tl.format': 'Escolhe como os tempos da timeline são escritos: relógio, segundos totais ou posição em amostras.',
    'tl.seek': 'Define o passo normal de ←/→. Com Shift, o deslocamento permanece em 1 segundo.',
    'tl.wheelZoom': 'Permite ampliar a timeline apenas com a roda do mouse. Desligado, o zoom exige Ctrl + roda.',
    'scope.on': 'Liga ou desliga a visualização de áudio em todas as áreas do VARISPEED sem afetar a reprodução.',
    'scope.visualizer': 'Alterna entre o vectorscope de partículas estéreo e o osciloscópio temporal existente.',
    'scope.mode': 'Escolhe o desenho do sinal: envelope por colunas de mínimo/máximo ou uma linha contínua.',
    'scope.gain': 'Amplia somente o desenho do sinal; não altera o volume do áudio.',
    'scope.window': 'Define quantas amostras formam cada quadro do visualizador.',
    'scope.smooth': 'Percentuais maiores estabilizam o envelope visual entre quadros. Disponível no traço por colunas.',
    'scope.trigger': 'Alinha o início do desenho a um cruzamento de zero para reduzir a oscilação horizontal do traço.',
    'scope.vectorTrail': 'Controla por quanto tempo os pontos anteriores permanecem visíveis, formando o rastro luminoso.',
    'scope.vectorSize': 'Ajusta o diâmetro visual dos pontos sem mudar a análise do áudio.',
    'scope.vectorDensity': 'Controla quantas amostras estéreo são desenhadas por quadro, com limite adaptativo de desempenho.',
    'scope.fps': 'Define quantas vezes por segundo o visualizador é redesenhado. 30 fps reduz o uso de processamento.',
    'motion.level': 'Controla globalmente as animações. Pode seguir a preferência do sistema, usar o efeito completo, discreto ou desligado.',
    'motion.scale': 'Acelera ou desacelera apenas a duração das microanimações da interface.',
    'motion.intensity': 'Controla a presença visual dos efeitos sem alterar sua duração.',
    'motion.status': 'Ativa a linguagem animada usada nas mensagens temporárias e confirmações do sistema.',
    'motion.exportHold': 'Define por quanto tempo a confirmação da exportação permanece totalmente legível antes de desaparecer.',
    'motion.caret': 'Mostra um cursor piscante ao final das mensagens temporárias animadas.',
    'motion.rateTick': 'Anima brevemente o valor numérico sempre que a velocidade é alterada.',
    'motion.sweep': 'Exibe a linha animada durante exportação, abertura e inclusão de músicas na Biblioteca.',
    'load.autoplay': 'Inicia automaticamente a reprodução assim que uma nova música termina de carregar.',
    'load.resetRate': 'Faz cada nova música começar em 100%, ignorando a velocidade que estava ativa no editor.',
    'load.keepZoom': 'Preserva somente a ampliação da timeline ao trocar de música; a nova faixa continua começando no início.',
    'export.ceiling': 'Pico máximo usado pela normalização. Valores abaixo de 0 dBFS deixam margem contra clipping.',
  };

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
    clearUndo();
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
  const on = (fn) => {
    listeners.push(fn);
    return () => {
      const index = listeners.indexOf(fn);
      if (index >= 0) listeners.splice(index, 1);
    };
  };

  function reset() {
    const before = Object.assign({}, values);
    Object.assign(values, DEFAULTS);
    persist();
    emit(Object.keys(values));
    syncControls();
    setUndo(before);
    panelFeedback('Configurações restauradas', { hold: 6500 });
  }

  function apply(obj, keys) {
    clearUndo();
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
  let panelStatus = null, panelStatusTimer = 0, cfgUndo = null, undoSnapshot = null, undoTimer = 0;
  const diagCells = new Map();
  const systemCells = new Map();
  const testButtons = new Map();
  let systemShutdownBtn = null, systemCopyBtn = null;
  let authSessionStatus = null, authSessionPrimary = null, authSessionSecondary = null, authSessionHint = null;
  let authSessionBusy = false;
  let authSessionState = { available: false, connected: false, login_open: false, validation: 'missing' };
  let authPoTokenState = { ready: false, message: '' };

  const compactPanel = () => window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  const focusableSelector = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])';

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

  const PANEL_STATUS_DEFAULT = 'Alterações salvas automaticamente';

  function panelFeedback(text, opts = {}) {
    if (!panelStatus) {
      document.dispatchEvent(new CustomEvent('varispeed:status', {
        detail: { text, hold: opts.hold || 1800, persist: !!opts.persist },
      }));
      return;
    }
    clearTimeout(panelStatusTimer);
    panelStatus.textContent = text;
    if (opts.kind) panelStatus.dataset.kind = opts.kind;
    else panelStatus.removeAttribute('data-kind');
    if (!opts.persist) {
      panelStatusTimer = setTimeout(() => {
        panelStatus.textContent = PANEL_STATUS_DEFAULT;
        panelStatus.removeAttribute('data-kind');
      }, opts.hold || 2200);
    }
  }

  function clearUndo() {
    clearTimeout(undoTimer);
    undoTimer = 0;
    undoSnapshot = null;
    if (cfgUndo) cfgUndo.hidden = true;
  }

  function setUndo(snapshot) {
    clearUndo();
    undoSnapshot = snapshot;
    if (cfgUndo) cfgUndo.hidden = false;
    undoTimer = setTimeout(clearUndo, 6500);
  }

  function undoReset() {
    if (!undoSnapshot) return;
    const snapshot = undoSnapshot;
    clearUndo();
    apply(snapshot);
    panelFeedback('Restauração desfeita');
  }

  function buildField(f) {
    const id = `cfg-${f.k.replace(/\./g, '-')}`;
    const row = h('div', 'cfg__row');
    const lab = h('label', 'cfg__label', f.label);
    const labelLine = h('div', 'cfg__label-line');
    labelLine.appendChild(lab);
    let helpText = null;
    const fieldHelp = f.help || FIELD_HELP[f.k];
    if (fieldHelp) {
      const helpBtn = h('button', 'cfg__help-toggle mono', '?');
      helpBtn.type = 'button';
      helpBtn.setAttribute('aria-label', `Sobre ${f.label}`);
      helpBtn.title = `Sobre ${f.label}`;
      helpBtn.setAttribute('aria-expanded', 'false');
      helpBtn.setAttribute('aria-controls', `${id}-help`);
      helpText = h('p', 'cfg__help-text', fieldHelp);
      helpText.id = `${id}-help`;
      helpText.hidden = true;
      helpBtn.addEventListener('click', () => {
        const open = helpText.hidden;
        helpText.hidden = !open;
        helpBtn.setAttribute('aria-expanded', String(open));
      });
      labelLine.appendChild(helpBtn);
    }
    row.appendChild(labelLine);

    let input, out = null, customSync = null;

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
      if (f.reverse) input.classList.add('slider--reverse');
      input.addEventListener('input', () => {
        values[f.k] = coerce(f.k, input.value);
        out.textContent = f.fmt ? f.fmt(values[f.k]) : String(values[f.k]);
        emit([f.k]);
      });
      input.addEventListener('change', () => set(f.k, input.value, { force: true }));
      row.appendChild(input);
      if (f.bounds) {
        const bounds = h('div', 'cfg__bounds mono');
        const first = f.reverse ? f.max : f.min;
        const last = f.reverse ? f.min : f.max;
        bounds.appendChild(h('span', null, f.fmt ? f.fmt(first) : String(first)));
        bounds.appendChild(h('span', null, f.fmt ? f.fmt(last) : String(last)));
        row.appendChild(bounds);
      }
      row.classList.add('cfg__row--stack');
    } else if (f.k === 'rate.presets') {
      row.classList.add('cfg__row--stack', 'cfg__row--presets');
      const editor = h('div', 'cfg__preset-editor');
      const chips = h('div', 'cfg__preset-chips');
      chips.setAttribute('role', 'group');
      chips.setAttribute('aria-label', 'Presets configurados');
      const addRow = h('div', 'cfg__preset-add');
      input = h('input', 'txt mono');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.placeholder = 'novo valor';
      input.maxLength = 12;
      input.spellcheck = false;
      const addBtn = h('button', 'btn cfg__preset-add-btn', '+');
      addBtn.type = 'button';
      addBtn.setAttribute('aria-label', 'Adicionar preset');

      const list = () => [...new Set(String(get(f.k))
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => Number.isFinite(n) && n >= get('rate.min') && n <= get('rate.max')))]
        .slice(0, 8);

      const render = () => {
        chips.textContent = '';
        const current = list();
        if (!current.length) chips.appendChild(h('span', 'cfg__preset-empty', 'Nenhum preset'));
        current.forEach((value) => {
          const chip = h('button', 'cfg__preset-chip mono');
          chip.type = 'button';
          chip.setAttribute('aria-label', `Remover preset ${value}%`);
          chip.appendChild(h('span', null, String(value)));
          chip.appendChild(h('span', 'cfg__preset-remove', '×'));
          chip.addEventListener('click', () => {
            set(f.k, current.filter((n) => n !== value).join(', '));
            panelFeedback(`Preset ${value}% removido`);
          });
          chips.appendChild(chip);
        });
      };

      const add = () => {
        const value = parseFloat(input.value.trim().replace(',', '.'));
        const current = list();
        if (!Number.isFinite(value) || value < get('rate.min') || value > get('rate.max')) {
          panelFeedback(`Use um valor entre ${get('rate.min')}% e ${get('rate.max')}%`, { kind: 'err', hold: 3000 });
          input.select();
          return;
        }
        if (current.includes(value)) {
          panelFeedback(`${value}% já está nos presets`, { kind: 'err' });
          input.select();
          return;
        }
        if (current.length >= 8) {
          panelFeedback('O limite é de 8 presets', { kind: 'err' });
          return;
        }
        set(f.k, current.concat(value).join(', '));
        input.value = '';
        panelFeedback(`Preset ${value}% adicionado`);
        input.focus();
      };

      addBtn.addEventListener('click', add);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); add(); }
      });
      addRow.append(input, addBtn);
      editor.append(chips, addRow);
      row.appendChild(editor);
      customSync = render;
    } else {
      input = h('input', 'txt mono');
      input.type = 'text';
      input.spellcheck = false;
      if (f.maxLength) input.maxLength = f.maxLength;
      input.addEventListener('change', () => set(f.k, input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      row.appendChild(input);
      row.classList.add('cfg__row--stack');
      if (f.k === 'export.name') {
        const tokens = h('div', 'cfg__tokens');
        tokens.setAttribute('role', 'group');
        tokens.setAttribute('aria-label', 'Tokens para o nome do arquivo');
        ['{nome}', '{rate}', '{mult}', '{st}', '{sr}', '{data}'].forEach((token) => {
          const button = h('button', 'cfg__token mono', token);
          button.type = 'button';
          button.title = `Inserir ${token}`;
          button.addEventListener('click', () => {
            const start = input.selectionStart == null ? input.value.length : input.selectionStart;
            const end = input.selectionEnd == null ? start : input.selectionEnd;
            input.setRangeText(token, start, end, 'end');
            set(f.k, input.value);
            input.focus();
          });
          tokens.appendChild(button);
        });
        row.appendChild(tokens);
      } else if (f.hint) {
        const hint = h('span', 'cfg__hint mono', f.hint);
        row.appendChild(hint);
      }
    }

    if (helpText) row.appendChild(helpText);

    input.id = id;
    lab.setAttribute('for', id);
    if (f.t === 'bool') input.setAttribute('aria-label', f.label);
    controls.set(f.k, { input, out, row, f, sync: customSync });
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
      panelFeedback(`Endereço copiado · ${value}`);
    } catch (_) {
      // Fallback simples para navegadores sem Clipboard API em HTTP local.
      const ta = document.createElement('textarea');
      ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      panelFeedback(copied ? `Endereço copiado · ${value}` : 'Não foi possível copiar o endereço', {
        kind: copied ? '' : 'err',
      });
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
    panelFeedback('Desligando VARISPEED...', { persist: true });
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
      panelFeedback(err && err.message ? err.message : 'Não foi possível desligar o VARISPEED.', {
        kind: 'err', hold: 3500,
      });
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
    const danger = h('div', 'cfg__system-danger');
    danger.appendChild(systemShutdownBtn);
    actions.append(systemCopyBtn, danger);
    sec.appendChild(actions);
    refreshSystemInfo();
    return sec;
  }

  function renderDedicatedAuth(state = authSessionState, poToken = authPoTokenState) {
    authSessionState = Object.assign({ available: false, connected: false, login_open: false, validation: 'missing' }, state || {});
    authPoTokenState = Object.assign({ ready: false, message: '' }, poToken || {});
    if (!authSessionStatus || !authSessionPrimary || !authSessionSecondary) return;

    const selected = get('remote.authBrowser') === 'dedicated';
    let label = 'Não conectado';
    let status = 'off';
    if (!authSessionState.available) {
      label = 'Microsoft Edge não encontrado';
      status = 'error';
    } else if (authSessionState.login_open) {
      label = 'Janela aberta · entre no YouTube';
      status = 'pending';
    } else if (authSessionState.connected && authSessionState.validation === 'playback_verification_required') {
      label = authPoTokenState.ready
        ? 'Sessão reconhecida · PO Token pronto'
        : 'Sessão reconhecida · reprodução bloqueada';
      status = authPoTokenState.ready ? 'connected' : 'warning';
    } else if (authSessionState.connected && authSessionState.validation === 'verified') {
      label = selected ? 'Conectado · sessão validada' : 'Sessão validada · inativa';
      status = 'connected';
    } else if (authSessionState.connected) {
      label = selected ? 'Sessão armazenada · aguardando validação' : 'Sessão armazenada · inativa';
      status = 'pending';
    }

    authSessionStatus.dataset.state = status;
    authSessionStatus.querySelector('span:last-child').textContent = label;
    authSessionPrimary.textContent = authSessionState.login_open
      ? 'Concluir conexão'
      : (authSessionState.validation === 'playback_verification_required'
        ? 'Renovar sessão'
        : (authSessionState.connected ? 'Renovar sessão' : 'Conectar YouTube'));
    authSessionPrimary.disabled = authSessionBusy || !authSessionState.available;
    authSessionSecondary.hidden = !authSessionState.login_open && !authSessionState.connected;
    authSessionSecondary.textContent = authSessionState.login_open ? 'Cancelar' : 'Desconectar';
    authSessionSecondary.disabled = authSessionBusy;
    if (authSessionHint) {
      authSessionHint.textContent = authSessionState.validation === 'playback_verification_required'
        ? (authPoTokenState.ready
          ? 'A compatibilidade por PO Token está pronta. Analise o link novamente; uma janela auxiliar minimizada pode aparecer por alguns segundos.'
          : (authPoTokenState.message || 'A conta foi reconhecida, mas a compatibilidade por PO Token ainda não está disponível.'))
        : 'A janela isolada evita o bloqueio do navegador principal. Ao concluir, o perfil temporário é apagado e somente a sessão do YouTube permanece neste computador.';
    }
  }

  async function refreshDedicatedAuth() {
    if (!authSessionStatus || !window.RemoteImport?.authStatus) return;
    try {
      const result = await window.RemoteImport.authStatus();
      renderDedicatedAuth(result.dedicated, result.po_token);
    } catch (_) {
      renderDedicatedAuth({ available: false, connected: false, login_open: false });
    }
  }

  async function runDedicatedPrimary() {
    if (authSessionBusy || !window.RemoteImport) return;
    authSessionBusy = true;
    renderDedicatedAuth();
    try {
      const finishing = authSessionState.login_open;
      const result = finishing
        ? await window.RemoteImport.finishDedicatedAuth()
        : await window.RemoteImport.startDedicatedAuth();
      set('remote.authBrowser', 'dedicated');
      renderDedicatedAuth(result.dedicated);
      panelFeedback(finishing
        ? 'Sessão dedicada conectada · perfil temporário removido'
        : 'Janela dedicada aberta · entre no YouTube e depois conclua', {
        hold: finishing ? 3200 : 5200,
      });
    } catch (error) {
      panelFeedback(error?.message || 'Não foi possível configurar a sessão dedicada.', {
        kind: 'err', hold: 5200,
      });
      await refreshDedicatedAuth();
    } finally {
      authSessionBusy = false;
      renderDedicatedAuth();
    }
  }

  async function runDedicatedSecondary() {
    if (authSessionBusy || !window.RemoteImport) return;
    authSessionBusy = true;
    renderDedicatedAuth();
    try {
      const cancelling = authSessionState.login_open;
      const result = cancelling
        ? await window.RemoteImport.cancelDedicatedAuth()
        : await window.RemoteImport.disconnectDedicatedAuth();
      if (!cancelling && get('remote.authBrowser') === 'dedicated') set('remote.authBrowser', 'off');
      renderDedicatedAuth(result.dedicated);
      panelFeedback(cancelling ? 'Conexão cancelada' : 'Sessão dedicada removida deste computador');
    } catch (error) {
      panelFeedback(error?.message || 'Não foi possível alterar a sessão dedicada.', {
        kind: 'err', hold: 4200,
      });
      await refreshDedicatedAuth();
    } finally {
      authSessionBusy = false;
      renderDedicatedAuth();
    }
  }

  function buildDedicatedAuthPanel() {
    const box = h('div', 'cfg__auth-session');
    authSessionStatus = h('div', 'cfg__auth-status mono');
    authSessionStatus.appendChild(h('i', 'cfg__auth-dot'));
    authSessionStatus.appendChild(h('span', null, 'Verificando sessão...'));
    authSessionHint = h('p', 'cfg__auth-hint',
      'Uma janela isolada será aberta. Ao concluir, o perfil temporário é apagado e apenas a sessão do YouTube permanece neste computador.');
    const actions = h('div', 'cfg__auth-actions');
    authSessionPrimary = h('button', 'btn btn--primary cfg__auth-primary', 'Conectar YouTube');
    authSessionPrimary.type = 'button';
    authSessionPrimary.addEventListener('click', runDedicatedPrimary);
    authSessionSecondary = h('button', 'btn btn--ghost cfg__auth-secondary', 'Desconectar');
    authSessionSecondary.type = 'button';
    authSessionSecondary.addEventListener('click', runDedicatedSecondary);
    actions.append(authSessionPrimary, authSessionSecondary);
    box.append(authSessionStatus, authSessionHint, actions);
    renderDedicatedAuth();
    return box;
  }

  function buildGroup(g) {
    const sec = h('section', 'cfg__group');
    const head = h('div', 'cfg__head');
    head.appendChild(h('h3', 'panel__title', g.title));
    if (g.test) {
      const b = h('button', 'btn btn--ghost cfg__test', 'Testar');
      b.type = 'button';
      b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('cfg:test', { detail: g.test })));
      testButtons.set(g.test, b);
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
    if (g.id === 'remote') sec.appendChild(buildDedicatedAuthPanel());
    return sec;
  }

  function buildCredits() {
    const sec = h('section', 'cfg__credits');
    sec.setAttribute('aria-label', 'Sobre o criador');

    const media = h('div', 'cfg__credits-media');
    media.setAttribute('aria-hidden', 'true');
    const portraitStates = new Map();
    const settlePortrait = (image, available) => {
      if (portraitStates.has(image)) return;
      portraitStates.set(image, available);
      image.hidden = !available;
      if (portraitStates.size < 2) return;
      const availableCount = [...portraitStates.values()].filter(Boolean).length;
      if (!availableCount) {
        media.hidden = true;
        sec.classList.add('is-text-only');
      } else if (availableCount === 1) {
        // Um único retrato local ainda funciona nos dois temas. Isso evita um
        // box vazio quando apenas uma variante pessoal está instalada.
        media.dataset.fallback = 'single';
      }
    };
    const portrait = (className, src) => {
      const image = document.createElement('img');
      image.className = `cfg__credits-photo ${className}`;
      image.alt = '';
      image.draggable = false;
      image.hidden = true;
      image.addEventListener('load', () => settlePortrait(image, image.naturalWidth > 0), { once: true });
      image.addEventListener('error', () => settlePortrait(image, false), { once: true });
      image.src = src;
      return image;
    };
    const light = portrait('cfg__credits-photo--light', 'assets/creator-light.png');
    const dark = portrait('cfg__credits-photo--dark', 'assets/creator-dark.png');
    media.appendChild(light);
    media.appendChild(dark);

    const copy = h('div', 'cfg__credits-copy');
    copy.appendChild(h('span', 'cfg__credits-eyebrow mono', 'CRIADOR DO VARISPEED'));
    copy.appendChild(h('strong', 'cfg__credits-title', 'Gaspar'));
    copy.appendChild(h('span', 'cfg__credits-line', 'Design e desenvolvimento'));

    const tech = h('div', 'cfg__credits-tech');
    const githubLink = h('a', 'cfg__credits-github mono', '');
    githubLink.href = 'https://github.com/nehalem-x/VARISPEED';
    githubLink.target = '_blank';
    githubLink.rel = 'noopener noreferrer';
    githubLink.setAttribute('aria-label', 'Abrir nehalem-x/VARISPEED no GitHub');
    const githubIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    githubIcon.setAttribute('viewBox', '0 0 24 24');
    githubIcon.setAttribute('aria-hidden', 'true');
    const githubPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    githubPath.setAttribute('fill', 'currentColor');
    githubPath.setAttribute('d', 'M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.2c-3.22.7-3.9-1.36-3.9-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.04 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.74-1.55-2.57-.29-5.27-1.28-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18a10.96 10.96 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.18c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z');
    githubIcon.appendChild(githubPath);
    githubLink.append(githubIcon, document.createTextNode('nehalem-x/VARISPEED'));
    tech.appendChild(githubLink);
    tech.appendChild(h('span', 'cfg__credits-separator', '·'));
    const ytDlpLink = h('a', 'cfg__credits-ytdlp', '');
    ytDlpLink.href = 'https://github.com/yt-dlp/yt-dlp';
    ytDlpLink.target = '_blank';
    ytDlpLink.rel = 'noopener noreferrer';
    ytDlpLink.setAttribute('aria-label', 'Abrir o projeto yt-dlp no GitHub');
    const ytDlpLogo = document.createElement('img');
    ytDlpLogo.src = 'assets/yt-dlp-logo.png';
    ytDlpLogo.alt = 'yt-dlp';
    ytDlpLogo.width = 38;
    ytDlpLogo.height = 15;
    ytDlpLogo.draggable = false;
    ytDlpLink.appendChild(ytDlpLogo);
    tech.appendChild(ytDlpLink);
    copy.appendChild(tech);

    sec.appendChild(media);
    sec.appendChild(copy);
    return sec;
  }

  function syncControls() {
    controls.forEach(({ input, out, row, f, sync }, k) => {
      const v = values[k];
      if (sync) {
        sync();
      } else if (f.t === 'bool') {
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
    const scopeTest = testButtons.get('scope');
    if (scopeTest) scopeTest.disabled = !get('scope.on');
    const motionTest = testButtons.get('motion');
    if (motionTest) motionTest.disabled = get('motion.level') === 'off';
    renderDedicatedAuth();
  }

  function pumpDiag() {
    if (!diagProvider || !panel || panel.hidden) return;
    const d = diagProvider() || {};
    d.store = storeOk ? 'localStorage' : 'memória temporária';
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
    panelFeedback('Preset salvo · varispeed-preset.json');
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
  let restoreFocusAfterClose = true;

  function open({ restoreFocus = true } = {}) {
    if (!panel || (!panel.hidden && panel.classList.contains('is-open'))) return;
    clearTimeout(panelTimer); panelTimer = 0;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    restoreFocusAfterClose = restoreFocus;
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
    refreshDedicatedAuth();
  }
  function close({ restoreFocus = restoreFocusAfterClose } = {}) {
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
    const restore = restoreFocus
      ? (lastFocus && lastFocus.isConnected ? lastFocus : trigger)
      : null;
    if (restore && typeof restore.focus === 'function') restore.focus({ preventScroll: true });
    lastFocus = null;
    restoreFocusAfterClose = true;
    const done = () => { panel.hidden = true; panelTimer = 0; };
    if (window.Motion && window.Motion.reduced()) done();
    else panelTimer = setTimeout(done, 190);
  }
  const isOpen = () => panel && !panel.hidden;
  const toggle = (options = {}) => (isOpen() ? close(options) : open(options));

  function mount(opts = {}) {
    panel = document.getElementById('cfg');
    body = document.getElementById('cfgBody');
    trigger = document.getElementById('btnConfig');
    panelStatus = document.getElementById('cfgStatus');
    cfgUndo = document.getElementById('cfgUndo');
    diagProvider = opts.diagnostics || null;
    if (!panel || !body) return;

    const appendGroups = (host, groups) => {
      groups.forEach((g, i) => {
        if (i) host.appendChild(h('div', 'hr'));
        host.appendChild(buildGroup(g));
      });
    };

    appendGroups(body, GROUPS.filter((g) => !ADVANCED_GROUPS.has(g.id)));

    const advanced = h('details', 'cfg__advanced');
    const advancedSummary = h('summary', 'cfg__advanced-summary');
    advancedSummary.appendChild(h('span', null, 'Avançado'));
    advancedSummary.appendChild(h('span', 'cfg__advanced-chevron mono', '+'));
    advanced.appendChild(advancedSummary);
    const advancedBody = h('div', 'cfg__advanced-body');
    appendGroups(advancedBody, GROUPS.filter((g) => ADVANCED_GROUPS.has(g.id)));
    advanced.appendChild(advancedBody);
    body.appendChild(h('div', 'hr'));
    body.appendChild(advanced);
    body.appendChild(h('div', 'hr'));
    body.appendChild(buildCredits());
    syncControls();

    document.getElementById('cfgClose').addEventListener('click', (event) => {
      close({ restoreFocus: event.detail === 0 });
    });
    panel.addEventListener('keydown', trapPanelTab);
    panel.addEventListener('focusin', (e) => keepFocusedVisible(e.target));
    document.getElementById('cfgReset').addEventListener('click', reset);
    if (cfgUndo) cfgUndo.addEventListener('click', undoReset);
    document.getElementById('cfgSave').addEventListener('click', downloadPreset);
    const fileIn = document.getElementById('cfgFile');
    document.getElementById('cfgLoad').addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const n = await importPresetFile(f);
      fileIn.value = '';
      if (n < 0) panelFeedback('Preset inválido — não foi possível ler o JSON', { kind: 'err', hold: 3500 });
      else if (n === 0) panelFeedback('Preset carregado · nenhum ajuste compatível mudou');
      else panelFeedback(`Preset aplicado · ${n} ajuste${n === 1 ? '' : 's'}`);
      document.dispatchEvent(new CustomEvent('cfg:imported', { detail: n }));
    });

    if (trigger) {
      trigger.addEventListener('click', (event) => {
        toggle({ restoreFocus: event.detail === 0 });
      });
    }
    document.addEventListener('pointerdown', (e) => {
      if (!isOpen()) return;
      if (panel.contains(e.target) || (trigger && trigger.contains(e.target))) return;
      close({ restoreFocus: false });
    });
    on(() => { if (isOpen()) syncControls(); });
  }

  return {
    mount, open, close, toggle, isOpen,
    get, set, all: () => Object.assign({}, values),
    on, reset, apply, exportPreset, feedback: panelFeedback,
    GROUPS,
  };
})();
