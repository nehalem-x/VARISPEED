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
      note: 'As mensagens usam a mesma animação da confirmação de exportação.',
      fields: [
        { k: 'motion.level', t: 'select', label: 'Nível', d: 'system',
          opts: [['system', 'Seguir sistema'], ['full', 'Completo'], ['discreet', 'Discreto'], ['off', 'Desligado']] },
        { k: 'motion.scale', t: 'range', label: 'Escala de tempo', d: 1, min: 0.5, max: 1.5, step: 0.05,
          fmt: (v) => `${(+v).toFixed(2)}×`, bounds: true, off: (g) => g('motion.level') === 'off' },
        { k: 'motion.intensity', t: 'range', label: 'Intensidade', d: 100, min: 0, max: 100, step: 5,
          fmt: (v) => `${v}%`, bounds: true, off: (g) => g('motion.level') === 'off' },
        { k: 'motion.status', t: 'bool', label: 'Animação padrão de status', d: true,
          off: (g) => g('motion.level') === 'off' },
        { k: 'motion.exportHold', t: 'range', label: 'Sustentação da exportação', d: 3.2, min: 1, max: 8, step: 0.2,
          fmt: (v) => `${(+v).toFixed(1)} s`, off: (g) => g('motion.level') === 'off' || !g('motion.status') },
        { k: 'motion.caret', t: 'bool', label: 'Cursor nos status temporários', d: true,
          off: (g) => g('motion.level') === 'off' || !g('motion.status') },
        { k: 'motion.rateTick', t: 'bool', label: 'Microanimação numérica', d: true,
          off: (g) => g('motion.level') === 'off' },
        { k: 'motion.sweep', t: 'bool', label: 'Varredura em operações', d: true,
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
          fmt: (v) => `${(+v).toFixed(2)}×`, bounds: true, off: (g) => !g('scope.on') },
        { k: 'scope.window', t: 'range', label: 'Janela', d: 640, min: 128, max: 2048, step: 32,
          fmt: (v) => `${v} amostras`, bounds: true, off: (g) => !g('scope.on') },
        { k: 'scope.smooth', t: 'range', label: 'Suavização', d: 0.8, min: 0.15, max: 1, step: 0.05, reverse: true,
          fmt: (v) => `${Math.round((1 - v) * 100)}%`,
          off: (g) => !g('scope.on') || g('scope.visualizer') !== 'waveform' || g('scope.mode') === 'line' },
        { k: 'scope.trigger', t: 'bool', label: 'Alinhar no cruzamento de zero', d: true,
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
        { k: 'export.sampleRate', t: 'select', label: 'Amostragem', d: 'source',
          opts: [['source', 'Igual à fonte'], ['44100', '44 100 Hz'], ['48000', '48 000 Hz'], ['96000', '96 000 Hz']] },
        { k: 'export.normalize', t: 'bool', label: 'Normalizar pico', d: false },
        { k: 'export.ceiling', t: 'range', label: 'Teto', d: -0.3, min: -6, max: 0, step: 0.1,
          fmt: (v) => `${(+v).toFixed(1)} dBFS`, bounds: true, off: (g) => !g('export.normalize') },
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
        { k: 'rate.smoothing', t: 'range', label: 'Suavização da mudança', d: 1200, min: 0, max: 1200, step: 40,
          fmt: (v) => +v === 0 ? 'Desligada' : `${v} ms`, bounds: true },
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
        { k: 'tl.wheelZoom', t: 'bool', label: 'Zoom com a roda, sem Ctrl', d: false },
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
        { k: 'library.autoAdd', t: 'bool', label: 'Adicionar importações automaticamente', d: false },
        { k: 'library.alwaysShowGuide', t: 'bool', label: 'Mostrar o guia sempre', d: false },
      ],
    },
    {
      id: 'remote', title: 'Importação por link',
      note: 'A autenticação permanece neste computador e só é usada quando o conteúdo exige uma sessão.',
      fields: [
        // Nas opções avançadas da Conta do YouTube. 'dedicated' saiu da lista:
        // um valor antigo vira 'off', e a conta conectada continua valendo.
        { k: 'remote.authBrowser', t: 'select', label: 'Usar cookies de', d: 'off', advanced: true,
          opts: [
            ['off', 'Nenhum navegador'],
            ['auto', 'Detectar automaticamente'],
            ['chrome', 'Google Chrome'],
            ['edge', 'Microsoft Edge'],
            ['firefox', 'Mozilla Firefox'],
            ['brave', 'Brave'],
            ['vivaldi', 'Vivaldi'],
          ] },
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
        ['graphInputDelay', 'Atraso de entrada do grafo'],
        ['graphMissedFrames', 'Quadros estimados perdidos'],
        ['graphLongTasks', 'Long tasks durante a captura'],
        ['motion', 'Animações efetivas'],
        ['store', 'Preferências'],
      ],
    },
  ];

  /* A navegação segue o fluxo de uso do produto. Ajustes cotidianos vêm
     primeiro; runtime, atalhos e diagnóstico permanecem disponíveis em uma
     área avançada recolhível, sem competir com as preferências principais. */
  const GROUP_ORDER = ['ui', 'rate', 'export', 'library', 'remote', 'timeline', 'scope', 'motion', 'load', 'system', 'keys', 'diag'];
  GROUPS.sort((a, b) => GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id));

  /* A ajuda de cada preferência fica centralizada aqui. O schema pode
     sobrescrever um texto com `help`, mas nenhum campo deve ficar sem a
     explicação acionada pelo mesmo botão semântico “?”. */
  const FIELD_HELP = {
    'ui.theme': 'Cores do app. “Seguir sistema” acompanha o tema claro ou escuro do dispositivo.',
    'ui.density': 'Espaço entre os elementos. Compacta mostra mais coisas na tela; Confortável deixa os controles maiores.',
    'ui.hints': 'Mostra os atalhos de teclado na barra de baixo.',
    'rate.unit': 'Como a velocidade aparece e é digitada: porcentagem, multiplicador (1.25×) ou diferença em semitons.',
    'rate.step': 'Quanto a velocidade muda a cada clique em − e +, ou a cada tecla [ e ].',
    'rate.smoothing': 'Tempo que o áudio leva para chegar à nova velocidade enquanto toca. Em 0 ms, a mudança é imediata.',
    'rate.min': 'Menor velocidade permitida. Presets abaixo desse valor deixam de aparecer.',
    'rate.max': 'Maior velocidade permitida. Presets acima desse valor deixam de aparecer.',
    'rate.presets': 'Até oito velocidades para escolher com um clique. Os valores ficam em porcentagem, qualquer que seja a unidade escolhida.',
    'load.rememberRate': 'Abre o app com a última velocidade usada. Ao desligar, a velocidade guardada é apagada.',
    'export.bits': 'Precisão de cada amostra no WAV. Mais bits geram arquivos maiores.',
    'export.sampleRate': 'Frequência de amostragem do WAV. “Igual à fonte” evita converter o áudio sem necessidade.',
    'export.normalize': 'Ajusta o volume do arquivo exportado para o pico mais alto chegar ao teto escolhido. A diferença entre as partes altas e baixas continua igual.',
    'export.ceiling': 'Nível máximo do pico depois da normalização. Abaixo de 0 dBFS sobra uma margem contra distorção (clipping).',
    'export.name': 'Modelo do nome do arquivo. Os códigos entre chaves, como {nome} e {rate}, viram os dados do áudio na hora de exportar.',
    'load.confirmExit': 'Pede confirmação se você tentar fechar ou recarregar a página durante uma exportação.',
    'library.autoAdd': 'Salva na Biblioteca todo áudio importado. Desligado, o áudio fica só no editor até você usar “Salvar na Biblioteca”.',
    'library.alwaysShowGuide': 'Mostra o guia toda vez que você abre a Biblioteca. Desligado, ele aparece só na primeira vez.',
    'remote.authBrowser': 'Lê os cookies de um navegador instalado em vez de usar a Conta do YouTube. “Detectar automaticamente” testa os perfis instalados e usa o que conseguir abrir o link. Chrome, Edge, Brave e Vivaldi precisam estar fechados. Os cookies ficam neste computador e nunca passam para a interface.',
    'tl.ruler': '“Tempo de saída” mostra a régua já com a velocidade aplicada. “Tempo da fonte” mostra a duração do arquivo original.',
    'tl.format': 'Como os tempos aparecem: minutos e segundos, total em segundos ou posição em amostras.',
    'tl.seek': 'Quanto ← e → avançam ou voltam. Com Shift, o passo é sempre de 1 segundo.',
    'tl.wheelZoom': 'Dá zoom na timeline só com a roda do mouse. Desligado, o zoom precisa de Ctrl + roda.',
    'scope.on': 'Liga ou desliga o visualizador em todas as telas. A reprodução não muda.',
    'scope.visualizer': 'O vectorscope mostra o estéreo como uma nuvem de pontos. O osciloscópio mostra a forma da onda ao longo do tempo.',
    'scope.mode': '“Colunas min/max” desenha o mínimo e o máximo de cada trecho. “Linha” desenha a onda como um traço contínuo.',
    'scope.gain': 'Aumenta só o tamanho do desenho. O volume do áudio não muda.',
    'scope.window': 'Quantidade de amostras em cada quadro. Valores maiores mostram um trecho mais longo do áudio.',
    'scope.smooth': 'Valores maiores deixam o desenho mais estável de um quadro para o outro. Só vale no traço em colunas.',
    'scope.trigger': 'Começa cada quadro no ponto em que a onda cruza o zero, para o traço tremer menos.',
    'scope.vectorTrail': 'Por quanto tempo os pontos anteriores continuam visíveis, formando o rastro.',
    'scope.vectorSize': 'Tamanho dos pontos na tela. A análise do áudio não muda.',
    'scope.vectorDensity': 'Quantos pontos são desenhados por quadro. O máximo cresce com o tamanho do visualizador.',
    'scope.fps': 'Quantas vezes por segundo o visualizador é redesenhado. 30 fps usa menos processamento.',
    'motion.level': 'Liga, reduz ou desliga as animações. “Seguir sistema” respeita a preferência de movimento do dispositivo.',
    'motion.scale': 'Deixa as animações mais rápidas ou mais lentas, sem mudar o que elas mostram.',
    'motion.intensity': 'Deixa os efeitos mais fortes ou mais discretos, sem mudar a duração.',
    'motion.status': 'Anima as mensagens de status letra por letra, como na confirmação de exportação. Desligado, elas aparecem de uma vez.',
    'motion.exportHold': 'Tempo em que a confirmação de exportação fica na tela antes de sumir.',
    'motion.caret': 'Mostra um cursor piscando no fim das mensagens temporárias.',
    'motion.rateTick': 'Anima o número da velocidade quando ele muda.',
    'motion.sweep': 'Mostra uma linha correndo no botão enquanto o app exporta, abre ou salva uma música na Biblioteca.',
    'load.autoplay': 'Começa a tocar assim que um novo áudio termina de carregar.',
    'load.resetRate': 'Cada novo áudio começa em 100%, sem herdar a velocidade anterior.',
    'load.keepZoom': 'Mantém o zoom da timeline ao trocar de áudio. O novo áudio sempre começa do início.',
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
  const ytdlp = { cells: new Map(), hint: null, action: null, auto: null, channel: null, state: null, busy: false };
  let graphCaptureProvider = null, graphCaptureButton = null, graphCaptureCopyButton = null;
  let graphCaptureOutput = null, graphCaptureReport = null;
  const sectionElements = new Map();
  let sectionNav = null;
  let activeSection = 'rate';
  let activeHelp = null;
  /* Conta do YouTube: um estado só para o usuário (conectado ou não). Quando e
     como usar a conta, o backend decide. */
  const account = {
    status: null, hint: null, actions: null, advanced: null, advancedToggle: null,
    cookiesLabel: null, cookiesButton: null, cookiesInput: null,
    state: null, poToken: { ready: false, message: '' }, busy: false, login: null,
  };

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

  function uiIcon(name, small = false) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', `ui-icon${small ? ' ui-icon--small' : ''}`);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#ui-icon-${name}`);
    svg.appendChild(use);
    return svg;
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

  function closeHelp() {
    if (!activeHelp) return;
    const { button, panel: helpPanel } = activeHelp;
    helpPanel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    activeHelp = null;
  }

  function buildField(f) {
    const id = `cfg-${f.k.replace(/\./g, '-')}`;
    const row = h('div', 'cfg__row');
    const lab = h('label', 'cfg__label', f.label);
    const labelLine = h('div', 'cfg__label-line');
    labelLine.appendChild(lab);
    let helpText = null, helpPanel = null;
    const fieldHelp = f.help || FIELD_HELP[f.k];
    if (fieldHelp) {
      const helpBtn = h('button', 'btn btn--ghost cfg__help-toggle');
      helpBtn.appendChild(uiIcon('help'));
      helpBtn.type = 'button';
      helpBtn.setAttribute('aria-label', `Sobre ${f.label}`);
      helpBtn.title = `Sobre ${f.label}`;
      helpBtn.setAttribute('aria-expanded', 'false');
      helpBtn.setAttribute('aria-controls', `${id}-help-panel`);
      helpPanel = h('div', 'cfg__help-panel');
      helpPanel.id = `${id}-help-panel`;
      helpPanel.hidden = true;
      helpPanel.setAttribute('role', 'region');
      helpPanel.setAttribute('aria-labelledby', `${id}-help-title`);
      const helpTitle = h('h4', 'cfg__help-title', `Sobre ${f.label}`);
      helpTitle.id = `${id}-help-title`;
      helpText = h('p', 'cfg__help-text', fieldHelp);
      helpText.id = `${id}-help`;
      helpPanel.append(helpTitle, helpText);
      helpBtn.addEventListener('click', () => {
        const open = helpPanel.hidden;
        closeHelp();
        if (open) {
          helpPanel.hidden = false;
          helpBtn.setAttribute('aria-expanded', 'true');
          activeHelp = { button: helpBtn, panel: helpPanel };
        }
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
      row.classList.add('cfg__row--inline', 'cfg__row--switch');
    } else if (f.t === 'select') {
      input = h('select', 'sel');
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
      const error = h('p', 'field-error');
      error.id = `${id}-error`;
      error.setAttribute('role', 'alert');
      error.hidden = true;
      input = h('input', 'txt mono');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.placeholder = 'novo valor';
      input.maxLength = 12;
      input.spellcheck = false;
      input.setAttribute('aria-describedby', `${helpText ? `${id}-help ` : ''}${error.id}`);
      const clearError = () => {
        input.removeAttribute('aria-invalid');
        error.hidden = true;
        error.textContent = '';
      };
      const showError = (message) => {
        input.setAttribute('aria-invalid', 'true');
        error.textContent = message;
        error.hidden = false;
        input.focus();
        input.select();
      };
      input.addEventListener('input', clearError);
      const addBtn = h('button', 'btn cfg__preset-add-btn');
      addBtn.appendChild(uiIcon('plus'));
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
          const chip = h('button', 'btn cfg__preset-chip mono');
          chip.type = 'button';
          chip.setAttribute('aria-label', `Remover preset ${value}%`);
          chip.appendChild(h('span', null, String(value)));
          const removeIcon = uiIcon('close', true);
          removeIcon.classList.add('cfg__preset-remove');
          chip.appendChild(removeIcon);
          chip.addEventListener('click', () => {
            set(f.k, current.filter((n) => n !== value).join(', '));
            clearError();
            panelFeedback(`Preset ${value}% removido`);
          });
          chips.appendChild(chip);
        });
      };

      const add = () => {
        const text = input.value.trim().replace(',', '.');
        const value = text ? Number(text) : NaN;
        const current = list();
        if (!Number.isFinite(value) || value < get('rate.min') || value > get('rate.max')) {
          showError(`Use um valor entre ${get('rate.min')}% e ${get('rate.max')}%.`);
          return;
        }
        if (current.includes(value)) {
          showError(`${value}% já está nos presets. Escolha outro valor.`);
          return;
        }
        if (current.length >= 8) {
          showError('Você já tem 8 presets. Remova um para adicionar outro.');
          return;
        }
        set(f.k, current.concat(value).join(', '));
        input.value = '';
        clearError();
        panelFeedback(`Preset ${value}% adicionado`);
        input.focus();
      };

      addBtn.addEventListener('click', add);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); add(); }
      });
      addRow.append(input, addBtn);
      editor.append(chips, addRow, error);
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
          const button = h('button', 'btn cfg__token mono', token);
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

    if (helpPanel) row.appendChild(helpPanel);
    if (helpText) {
      const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      describedBy.add(helpText.id);
      input.setAttribute('aria-describedby', [...describedBy].join(' '));
    }

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
          ? 'Encerra o servidor local do VARISPEED'
          : 'Só é possível desligar no computador em que o VARISPEED está rodando';
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
    document.title = 'VARISPEED · Desligado';
    document.body.innerHTML = `
      <main class="shutdown-screen" role="status" aria-live="polite">
        <img src="assets/favicon.png" width="56" height="56" alt="" draggable="false">
        <strong>VARISPEED desligado</strong>
        <span>Pode fechar esta aba.</span>
      </main>`;
  }

  async function shutdownVarispeed() {
    if (!systemShutdownBtn || systemShutdownBtn.disabled) return;
    if (!window.confirm('Desligar o VARISPEED neste computador?')) return;
    systemShutdownBtn.disabled = true;
    systemShutdownBtn.setAttribute('aria-busy', 'true');
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
      systemShutdownBtn.removeAttribute('aria-busy');
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
    systemCopyBtn = h('button', 'btn btn--outline cfg__system-action', 'Copiar endereço');
    systemCopyBtn.type = 'button';
    systemCopyBtn.disabled = true;
    systemCopyBtn.addEventListener('click', copySystemUrl);
    systemShutdownBtn = h('button', 'btn btn--outline cfg__system-action cfg__shutdown', 'Desligar VARISPEED');
    systemShutdownBtn.type = 'button';
    systemShutdownBtn.disabled = true;
    systemShutdownBtn.addEventListener('click', shutdownVarispeed);
    const danger = h('div', 'cfg__system-danger');
    danger.appendChild(systemShutdownBtn);
    actions.append(systemCopyBtn, buildYtDlpBlock(), danger);
    sec.appendChild(actions);
    refreshSystemInfo();
    refreshYtDlp();
    return sec;
  }

  // O sufixo .devN do PyPI some: o yt-dlp nightly se apresenta sem ele.
  const versionText = (v) => String(v || '').replace(/\.dev\d+$/, '');
  const sameVersion = (a, b) => versionText(a).match(/\d+/g)?.map(Number).join('.') === versionText(b).match(/\d+/g)?.map(Number).join('.');

  /* yt-dlp: o importador por link. O YouTube muda com frequência, e uma versão
     velha é a causa mais comum de links que param de abrir. */
  function buildYtDlpBlock() {
    const box = h('div', 'cfg__ytdlp');
    const list = h('dl', 'rows cfg__system-rows');
    [['version', 'yt-dlp'], ['latest', 'Mais recente']].forEach(([id, label]) => {
      const r = h('div', 'row');
      r.appendChild(h('dt', null, label));
      const dd = h('dd', 'mono cfg__system-value', '—');
      ytdlp.cells.set(id, dd);
      r.appendChild(dd);
      list.appendChild(r);
    });
    ytdlp.hint = h('p', 'cfg__system-hint', 'Verificando versão...');
    ytdlp.hint.setAttribute('aria-live', 'polite');

    const autoRow = h('div', 'cfg__row cfg__row--inline cfg__row--switch');
    const autoLine = h('div', 'cfg__label-line');
    autoLine.appendChild(h('label', 'cfg__label', 'Atualizar ao abrir'));
    ytdlp.auto = h('button', 'sw');
    ytdlp.auto.type = 'button';
    ytdlp.auto.setAttribute('role', 'switch');
    ytdlp.auto.setAttribute('aria-label', 'Atualizar o yt-dlp ao abrir o VARISPEED');
    ytdlp.auto.setAttribute('aria-checked', 'true');
    ytdlp.auto.appendChild(h('span', 'sw__knob'));
    ytdlp.auto.addEventListener('click', () => saveYtDlpPrefs({ auto: ytdlp.auto.getAttribute('aria-checked') !== 'true' }));
    autoRow.append(autoLine, ytdlp.auto);

    const channelRow = h('div', 'cfg__row cfg__row--inline');
    const channelLine = h('div', 'cfg__label-line');
    const channelLabel = h('label', 'cfg__label', 'Canal');
    channelLabel.htmlFor = 'cfg-ytdlp-channel';
    channelLine.appendChild(channelLabel);
    ytdlp.channel = h('select', 'sel');
    ytdlp.channel.id = 'cfg-ytdlp-channel';
    [['stable', 'Estável'], ['nightly', 'Nightly']].forEach(([value, label]) => {
      const o = h('option', null, label);
      o.value = value;
      ytdlp.channel.appendChild(o);
    });
    ytdlp.channel.addEventListener('change', () => saveYtDlpPrefs({ channel: ytdlp.channel.value }));
    channelRow.append(channelLine, ytdlp.channel);

    ytdlp.action = h('button', 'btn btn--outline cfg__system-action', 'Verificar atualização');
    ytdlp.action.type = 'button';
    ytdlp.action.disabled = true;
    ytdlp.action.addEventListener('click', runYtDlpAction);

    box.append(list, ytdlp.hint, autoRow, channelRow, ytdlp.action);
    return box;
  }

  function renderYtDlp(state = ytdlp.state) {
    if (!ytdlp.action) return;
    ytdlp.state = state;
    const version = ytdlp.cells.get('version');
    const latest = ytdlp.cells.get('latest');
    if (!state) {
      version.textContent = '—';
      latest.textContent = '—';
      ytdlp.hint.textContent = 'Sem conexão · o servidor local não respondeu';
      ytdlp.action.disabled = true;
      return;
    }
    version.textContent = versionText(state.version) || '—';
    latest.textContent = versionText(state.latest) || '—';
    ytdlp.auto.setAttribute('aria-checked', String(!!state.auto));
    ytdlp.channel.value = state.channel === 'nightly' ? 'nightly' : 'stable';
    [ytdlp.auto, ytdlp.channel].forEach((control) => { control.disabled = !state.can_update || ytdlp.busy; });

    let hint;
    if (!state.can_update) hint = 'A atualização só pode ser feita no computador em que o VARISPEED está rodando.';
    else if (state.restart_required) hint = `Atualizado · reinicie o VARISPEED para usar a versão ${versionText(state.installed)}`;
    else if (state.update_available) hint = `Nova versão · ${versionText(state.latest)} está disponível`;
    else if (state.error) hint = `Sem consulta · ${state.error.replace(/\.$/, '').toLocaleLowerCase('pt-BR')}`;
    else if (state.latest) hint = 'Atualizado · você já tem a versão mais recente';
    else hint = 'Ainda não verificado';
    ytdlp.hint.textContent = hint;

    ytdlp.action.textContent = ytdlp.busy
      ? (state.update_available ? 'Atualizando...' : 'Verificando...')
      : (state.update_available ? `Atualizar para ${versionText(state.latest)}` : 'Verificar atualização');
    ytdlp.action.disabled = ytdlp.busy || !state.can_update || state.restart_required;
    ytdlp.action.setAttribute('aria-busy', String(ytdlp.busy));
  }

  async function ytdlpRequest(path, options = {}) {
    const response = await fetch(path, { cache: 'no-store', ...options });
    if (!response.ok) {
      let message = 'O servidor local não respondeu.';
      try { const body = await response.json(); message = body.detail || message; } catch (_) {}
      throw new Error(message);
    }
    return response.json();
  }

  async function refreshYtDlp({ refresh = false } = {}) {
    try {
      renderYtDlp(await ytdlpRequest(`/api/system/ytdlp${refresh ? '?refresh=1' : ''}`));
    } catch (_) {
      renderYtDlp(null);
    }
  }

  async function saveYtDlpPrefs(changes) {
    try {
      renderYtDlp(await ytdlpRequest('/api/system/ytdlp/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      }));
    } catch (err) {
      panelFeedback(err.message || 'Não foi possível salvar a preferência.', { kind: 'err', hold: 4200 });
      refreshYtDlp();
    }
  }

  /* Depois do pip, o servidor se reinicia para carregar a versão nova. A página
     espera ele voltar já com essa versão antes de confirmar. */
  // O yt-dlp se apresenta como 2026.08.19 e o pip registra 2026.8.19.
  async function waitForYtDlp(version, timeoutMs = 45000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      try {
        const health = await ytdlpRequest('/api/health');
        if (sameVersion(health.yt_dlp, version)) return true;
      } catch (_) { /* servidor reiniciando */ }
    }
    return false;
  }

  async function runYtDlpAction() {
    if (ytdlp.busy || !ytdlp.state) return;
    const updating = ytdlp.state.update_available;
    ytdlp.busy = true;
    renderYtDlp();
    try {
      if (!updating) {
        const state = await ytdlpRequest('/api/system/ytdlp?refresh=1');
        ytdlp.busy = false;
        renderYtDlp(state);
        if (state.error) panelFeedback(state.error, { kind: 'err', hold: 4200 });
        return;
      }
      panelFeedback('Atualizando yt-dlp...', { persist: true });
      const result = await ytdlpRequest('/api/system/ytdlp/update', { method: 'POST' });
      if (result.restarting) {
        panelFeedback(`Reiniciando o servidor · yt-dlp ${versionText(result.version)}`, { persist: true });
        const back = await waitForYtDlp(result.version);
        panelFeedback(back
          ? `yt-dlp atualizado · ${versionText(result.version)}`
          : 'O servidor não voltou · abra o VARISPEED de novo', { kind: back ? '' : 'err', hold: 5200 });
      } else if (result.restart_required) {
        panelFeedback(`yt-dlp ${versionText(result.version)} instalado · reinicie o VARISPEED para usar`, { hold: 6200 });
      } else {
        panelFeedback(`Atualizado · yt-dlp ${versionText(result.version)} já era a versão mais recente`, { hold: 4200 });
      }
    } catch (err) {
      panelFeedback(err.message || 'Não foi possível atualizar o yt-dlp.', { kind: 'err', hold: 6200 });
    } finally {
      ytdlp.busy = false;
      refreshYtDlp();
    }
  }

  function accountButton(cls, label, onClick) {
    const button = h('button', `btn ${cls}`, label);
    button.type = 'button';
    button.disabled = account.busy;
    button.addEventListener('click', onClick);
    return button;
  }

  function accountView(state, poToken) {
    if (!state) {
      return { st: 'error', label: 'Sem conexão · servidor local não respondeu', hint: 'Abra o VARISPEED pelo atalho e tente de novo.', buttons: [] };
    }
    const browser = state.browser || 'navegador';
    if (state.login_open) {
      return {
        st: 'pending',
        label: `Aguardando login · janela do ${browser} aberta`,
        hint: 'Entre na sua conta na janela que abriu. O VARISPEED percebe quando você terminar e fecha a janela sozinho.',
        buttons: [['btn--outline cfg__auth-primary', 'Cancelar', cancelYoutubeLogin]],
      };
    }
    if (state.expired) {
      return {
        st: 'warning',
        label: 'Sessão expirada · entre de novo',
        hint: 'O YouTube não aceita mais a sessão salva. Entre de novo para continuar abrindo vídeos com login.',
        buttons: [['btn--primary cfg__auth-primary', 'Entrar de novo', startYoutubeLogin], ['btn--ghost cfg__auth-secondary', 'Sair da conta', logoutYoutube]],
      };
    }
    if (state.connected) {
      const logout = [['btn--ghost cfg__auth-primary', 'Sair da conta', logoutYoutube]];
      if (state.validation === 'playback_verification_required') {
        return {
          st: poToken.ready ? 'connected' : 'warning',
          label: poToken.ready ? 'Conectado · PO Token pronto' : 'Conectado · reprodução bloqueada',
          hint: poToken.ready
            ? 'A verificação de reprodução está pronta. Analise o link de novo; uma janela auxiliar minimizada pode aparecer por alguns segundos.'
            : (poToken.message || 'A conta foi reconhecida, mas a verificação de reprodução ainda não está disponível.'),
          buttons: logout,
        };
      }
      return {
        st: 'connected',
        label: state.validation === 'verified' ? 'Conectado · sessão válida' : 'Conectado · sessão salva',
        hint: 'O VARISPEED usa esta conta só quando um vídeo pede login. A sessão fica salva só neste computador.',
        buttons: logout,
      };
    }
    if (!state.available) {
      return {
        st: 'error',
        label: 'Indisponível · nenhum navegador compatível',
        hint: 'Para entrar, o VARISPEED abre uma janela do Chrome, Edge, Chromium, Brave ou Vivaldi. Instale um deles e volte aqui.',
        buttons: [],
      };
    }
    return {
      st: 'off',
      label: 'Não conectado',
      hint: state.error || 'Alguns vídeos só abrem com login, como os com restrição de idade. Conecte uma conta e o VARISPEED a usa só quando precisar. Prefira uma conta secundária.',
      buttons: [['btn--primary cfg__auth-primary', 'Entrar no YouTube', startYoutubeLogin]],
    };
  }

  function renderDedicatedAuth(state = account.state, poToken = account.poToken) {
    account.state = state;
    account.poToken = poToken || { ready: false, message: '' };
    if (!account.status) return;
    const view = accountView(state, account.poToken);
    account.status.dataset.state = view.st;
    account.status.querySelector('span:last-child').textContent = view.label;
    account.hint.textContent = view.hint;
    account.actions.replaceChildren(...view.buttons.map(([cls, label, onClick]) => accountButton(cls, label, onClick)));
    account.actions.hidden = !view.buttons.length;
    const manual = Boolean(state && state.manual_cookies);
    account.cookiesLabel.textContent = manual ? 'Arquivo carregado' : 'Arquivo de cookies';
    account.cookiesButton.textContent = manual ? 'Remover' : 'Escolher...';
    account.cookiesButton.disabled = account.busy || !state;
  }

  async function refreshDedicatedAuth() {
    if (!account.status || !window.RemoteImport?.authStatus) return;
    try {
      const result = await window.RemoteImport.authStatus();
      renderDedicatedAuth(result.dedicated, result.po_token);
    } catch (_) {
      renderDedicatedAuth(null);
    }
  }

  async function startYoutubeLogin() {
    if (account.busy || account.login || !window.RemoteImport) return;
    const ctrl = new AbortController();
    account.login = ctrl;
    try {
      const state = await window.RemoteImport.youtubeLogin({
        signal: ctrl.signal,
        onUpdate: (next) => renderDedicatedAuth(next),
      });
      if (state.connected) {
        // Entrar vale mais que um navegador escolhido nas opções avançadas.
        if (get('remote.authBrowser') !== 'off') set('remote.authBrowser', 'off');
        panelFeedback('Conta do YouTube conectada', { hold: 3200 });
      } else if (state.error) {
        panelFeedback(state.error, { kind: 'err', hold: 5200 });
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        panelFeedback(error?.message || 'Não foi possível abrir a janela de login.', { kind: 'err', hold: 5200 });
      }
    } finally {
      account.login = null;
      refreshDedicatedAuth();
    }
  }

  function cancelYoutubeLogin() {
    if (account.login) account.login.abort();
    else window.RemoteImport?.cancelDedicatedAuth().finally(refreshDedicatedAuth);
    panelFeedback('Login cancelado');
  }

  async function logoutYoutube() {
    if (account.busy || !window.RemoteImport) return;
    account.busy = true;
    renderDedicatedAuth();
    try {
      const result = await window.RemoteImport.disconnectDedicatedAuth();
      panelFeedback('Conta removida deste computador');
      account.busy = false;
      renderDedicatedAuth(result.dedicated);
    } catch (error) {
      panelFeedback(error?.message || 'Não foi possível sair da conta.', { kind: 'err', hold: 4200 });
    } finally {
      account.busy = false;
      refreshDedicatedAuth();
    }
  }

  async function chooseCookiesFile(file) {
    if (!file || account.busy) return;
    account.busy = true;
    renderDedicatedAuth();
    try {
      const result = await window.RemoteImport.saveCookiesFile(await file.text());
      panelFeedback('Arquivo de cookies carregado');
      account.busy = false;
      renderDedicatedAuth(result.dedicated);
    } catch (error) {
      panelFeedback(error?.message || 'Não foi possível usar esse arquivo.', { kind: 'err', hold: 5200 });
    } finally {
      account.busy = false;
      account.cookiesInput.value = '';
      refreshDedicatedAuth();
    }
  }

  async function onCookiesButton() {
    if (account.state?.manual_cookies) {
      account.busy = true;
      renderDedicatedAuth();
      try {
        await window.RemoteImport.removeCookiesFile();
        panelFeedback('Arquivo de cookies removido');
      } catch (error) {
        panelFeedback(error?.message || 'Não foi possível remover o arquivo.', { kind: 'err', hold: 4200 });
      } finally {
        account.busy = false;
        refreshDedicatedAuth();
      }
      return;
    }
    account.cookiesInput.click();
  }

  function buildDedicatedAuthPanel(advancedFields = []) {
    const box = h('div', 'cfg__auth-session');
    box.appendChild(h('h4', 'cfg__auth-title', 'Conta do YouTube'));
    account.status = h('div', 'cfg__auth-status mono');
    account.status.setAttribute('role', 'status');
    account.status.append(h('i', 'cfg__auth-dot'), h('span', null, 'Verificando conta...'));
    account.hint = h('p', 'cfg__auth-hint');
    account.actions = h('div', 'cfg__auth-actions');

    account.advancedToggle = h('button', 'btn btn--ghost cfg__auth-advanced-toggle');
    account.advancedToggle.type = 'button';
    account.advancedToggle.setAttribute('aria-expanded', 'false');
    account.advancedToggle.setAttribute('aria-controls', 'cfg-auth-advanced');
    account.advancedToggle.append(document.createTextNode('Opções avançadas'), uiIcon('chevron-down', true));
    account.advanced = h('div', 'cfg__auth-advanced');
    account.advanced.id = 'cfg-auth-advanced';
    account.advanced.hidden = true;
    account.advancedToggle.addEventListener('click', () => {
      const open = account.advanced.hidden;
      account.advanced.hidden = !open;
      account.advancedToggle.setAttribute('aria-expanded', String(open));
    });

    advancedFields.forEach((f) => account.advanced.appendChild(buildField(f)));
    const cookiesRow = h('div', 'cfg__row cfg__row--inline');
    const cookiesLine = h('div', 'cfg__label-line');
    account.cookiesLabel = h('span', 'cfg__label', 'Arquivo de cookies');
    cookiesLine.appendChild(account.cookiesLabel);
    account.cookiesButton = h('button', 'btn btn--outline cfg__auth-file', 'Escolher...');
    account.cookiesButton.type = 'button';
    account.cookiesButton.addEventListener('click', onCookiesButton);
    account.cookiesInput = h('input');
    account.cookiesInput.type = 'file';
    account.cookiesInput.accept = '.txt,text/plain';
    account.cookiesInput.hidden = true;
    account.cookiesInput.addEventListener('change', () => chooseCookiesFile(account.cookiesInput.files?.[0]));
    cookiesRow.append(cookiesLine, account.cookiesButton, account.cookiesInput);
    account.advanced.append(cookiesRow, h('p', 'cfg__auth-hint',
      'Use só se o login acima não funcionar. Chrome, Edge, Brave e Vivaldi precisam estar fechados para o VARISPEED ler os cookies deles. O arquivo precisa estar no formato cookies.txt (Netscape) e fica salvo só neste computador.'));

    box.append(account.status, account.hint, account.actions, account.advancedToggle, account.advanced);
    renderDedicatedAuth();
    return box;
  }

  const graphMetric = (metric = {}) => {
    const average = Number(metric.average) || 0;
    const p95 = Number(metric.p95) || 0;
    const max = Number(metric.max) || 0;
    return `${average.toFixed(2)} / ${p95.toFixed(2)} / ${max.toFixed(2)} ms`;
  };

  function formatGraphCapture(report) {
    const viewport = report.viewport || {};
    const zoom = report.zoom || {};
    const missed = report.missedFrameMultiples || {};
    const cadence = report.physicsCadence || {};
    const capturedAt = report.capturedAt
      ? new Date(report.capturedAt).toLocaleString('pt-BR')
      : '—';
    const zoomUsed = Number(zoom.latency?.samples) > 0;
    return [
      'VARISPEED · DIAGNÓSTICO DO GRAFO',
      `Captura: ${capturedAt}`,
      `Escala: ${report.nodes || 0} nós · ${report.links || 0} ligações`,
      `Viewport: ${Math.round(viewport.width || 0)}×${Math.round(viewport.height || 0)} · DPR ${(Number(viewport.pixelRatio) || 1).toFixed(2)}`,
      `Duração: ${(Number(report.durationMs || 0) / 1000).toFixed(1)} s`,
      `Cadência estimada: ${report.refreshHz || '—'} Hz · orçamento ${(Number(report.frameBudgetMs) || 0).toFixed(2)} ms`,
      `FPS observado: ${(Number(report.fps) || 0).toFixed(1)}`,
      `Frames tardios: ${report.lateFrames || 0} (${(Number(report.lateFramePercent) || 0).toFixed(1)}%)`,
      `Quadros estimados perdidos: ${missed.estimated || 0} · 2× ${missed.double || 0} · 3× ${missed.triple || 0} · 4×+ ${missed.fourPlus || 0}`,
      `Frame médio / p95 / máx: ${graphMetric(report.frame)}`,
      `Física ${cadence.activeHz || 60}/${cadence.restingHz || 30} Hz média / p95 / máx: ${graphMetric(report.physics)}`,
      `Render médio / p95 / máx: ${graphMetric(report.render)}`,
      `Atraso de entrada médio / p95 / máx: ${graphMetric(report.inputDelay)}`,
      `Long tasks: ${report.longTasks?.samples || 0} · ${(Number(report.longTasks?.total) || 0).toFixed(2)} ms no total · máx ${(Number(report.longTasks?.max) || 0).toFixed(2)} ms`,
      zoomUsed
        ? `Zoom entrada média / p95 / máx: ${graphMetric(zoom.latency)}`
        : 'Zoom: não exercitado durante a captura',
      ...(zoomUsed ? [
        `Zoom intervalo médio / p95 / máx: ${graphMetric(zoom.frame)}`,
        `Zoom câmera média / p95 / máx: ${graphMetric(zoom.camera)}`,
        `Zoom resposta média / p95 / máx: ${graphMetric(zoom.settle)}`,
      ] : []),
    ].join('\n');
  }

  function renderGraphCapture() {
    if (!graphCaptureOutput || !graphCaptureCopyButton) return;
    graphCaptureOutput.hidden = !graphCaptureReport;
    graphCaptureOutput.textContent = graphCaptureReport ? formatGraphCapture(graphCaptureReport) : '';
    graphCaptureCopyButton.disabled = !graphCaptureReport;
  }

  async function copyGraphCapture() {
    if (!graphCaptureReport) return;
    const value = formatGraphCapture(graphCaptureReport);
    try {
      await navigator.clipboard.writeText(value);
      panelFeedback('Relatório do grafo copiado');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const copied = document.execCommand('copy');
      ta.remove();
      panelFeedback(copied ? 'Relatório do grafo copiado' : 'Não foi possível copiar o relatório', {
        kind: copied ? '' : 'err',
      });
    }
  }

  async function runGraphCapture() {
    if (!graphCaptureProvider || graphCaptureButton?.disabled) return;
    graphCaptureButton.disabled = true;
    graphCaptureButton.setAttribute('aria-busy', 'true');
    graphCaptureButton.textContent = 'Preparando…';
    graphCaptureReport = null;
    renderGraphCapture();
    close({ restoreFocus: false });
    await new Promise(resolve => setTimeout(resolve, 240));

    let error = null;
    try {
      const report = await graphCaptureProvider({ durationMs: 8000 });
      if (!report || report.cancelled) throw new Error('A captura foi interrompida.');
      graphCaptureReport = report;
    } catch (cause) {
      error = cause;
    }

    graphCaptureButton.disabled = false;
    graphCaptureButton.removeAttribute('aria-busy');
    graphCaptureButton.textContent = 'Medir grafo · 8 s';
    showSection('diag');
    open({ restoreFocus: false });
    renderGraphCapture();
    requestAnimationFrame(() => {
      const target = graphCaptureReport ? graphCaptureOutput : graphCaptureButton;
      target?.scrollIntoView?.({ block: 'center', behavior: window.Motion?.reduced?.() ? 'auto' : 'smooth' });
      graphCaptureButton?.focus({ preventScroll: true });
    });
    panelFeedback(
      error ? (error.message || 'Não foi possível medir o grafo.') : 'Medição concluída · relatório pronto',
      { kind: error ? 'err' : '', hold: error ? 4000 : 2600 }
    );
  }

  function buildGroup(g) {
    const sec = h('section', 'cfg__group');
    sec.id = `settings-section-${g.id}`;
    sec.setAttribute('aria-labelledby', `settings-heading-${g.id}`);
    const head = h('div', 'cfg__head');
    const heading = h('h3', 'panel__title', g.title);
    heading.id = `settings-heading-${g.id}`;
    heading.tabIndex = -1;
    head.appendChild(heading);
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
      const hint = h('p', 'cfg__diag-hint', 'Ao iniciar, use a roda do mouse, arraste o grafo e mova uma categoria durante 8 segundos. Nenhum dado da Biblioteca é alterado.');
      const actions = h('div', 'cfg__diag-actions');
      graphCaptureButton = h('button', 'btn btn--outline cfg__diag-action', 'Medir grafo · 8 s');
      graphCaptureButton.type = 'button';
      graphCaptureButton.addEventListener('click', runGraphCapture);
      graphCaptureCopyButton = h('button', 'btn btn--outline cfg__diag-action', 'Copiar relatório');
      graphCaptureCopyButton.type = 'button';
      graphCaptureCopyButton.disabled = true;
      graphCaptureCopyButton.addEventListener('click', copyGraphCapture);
      graphCaptureOutput = h('pre', 'cfg__diag-report mono');
      graphCaptureOutput.hidden = true;
      graphCaptureOutput.setAttribute('aria-live', 'polite');
      actions.append(graphCaptureButton, graphCaptureCopyButton);
      sec.append(hint, actions, graphCaptureOutput);
      return sec;
    }

    const main = g.fields.filter((f) => !f.advanced);
    if (main.length) {
      const wrap = h('div', 'cfg__fields');
      main.forEach((f) => wrap.appendChild(buildField(f)));
      sec.appendChild(wrap);
    }
    if (g.id === 'remote') sec.appendChild(buildDedicatedAuthPanel(g.fields.filter((f) => f.advanced)));
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
    copy.appendChild(h('span', 'cfg__credits-eyebrow mono', 'Criador do VARISPEED'));
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
    githubIcon.setAttribute('class', 'ui-icon ui-icon--brand');
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

  function showSection(id, { focus = false } = {}) {
    if (!sectionElements.has(id)) return;
    closeHelp();
    activeSection = id;
    sectionElements.forEach((section, key) => { section.hidden = key !== id; });
    if (sectionNav) sectionNav.value = id;
    if (body) body.scrollTop = 0;
    if (focus) document.getElementById(`settings-heading-${id}`)?.focus({ preventScroll: true });
  }

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
    graphCaptureProvider = opts.captureGraphPerformance || null;
    if (!panel || !body) return;

    const navigation = [
      { label: 'Áudio', ids: ['rate', 'load', 'export'] },
      { label: 'Biblioteca', ids: ['library', 'remote'] },
      { label: 'Visual e interação', ids: ['ui', 'timeline', 'scope', 'motion'] },
      { label: 'Sistema', ids: ['keys', 'system', 'diag'] },
    ];
    const descriptions = {
      rate: 'Unidades, limites e ajustes rápidos da velocidade.',
      load: 'Defina como o editor recebe uma nova música.',
      export: 'Formato, qualidade e nome do arquivo de saída.',
      library: 'Organize as músicas que entram na sua Biblioteca.',
      remote: 'Preferências para importar músicas de plataformas externas.',
      ui: 'Aparência, densidade e informações da interface.',
      timeline: 'Leitura do tempo, navegação e zoom do áudio.',
      scope: 'Ajuste a representação visual do sinal.',
      motion: 'Controle o ritmo e a presença das animações.',
      keys: 'Comandos para usar o editor pelo teclado.',
      system: 'Endereço local, servidor e atualização do yt-dlp.',
      diag: 'Informações de desempenho e ferramentas de medição.',
    };
    const navigator = h('nav', 'cfg__navigator');
    navigator.setAttribute('aria-label', 'Seções de configurações');
    const navLabel = h('label', null, 'Seção');
    navLabel.htmlFor = 'cfgSectionNav';
    sectionNav = h('select', 'sel');
    sectionNav.id = 'cfgSectionNav';
    navigation.forEach(({ label, ids }) => {
      const group = h('optgroup');
      group.label = label;
      ids.forEach((id) => {
        const schema = GROUPS.find((entry) => entry.id === id);
        group.appendChild(new Option(schema.title, id));
        const section = buildGroup(schema);
        const description = h('p', 'cfg__description', descriptions[id]);
        section.querySelector('.cfg__head').after(description);
        sectionElements.set(id, section);
      });
      sectionNav.appendChild(group);
    });
    sectionNav.appendChild(new Option('Sobre o VARISPEED', 'about'));
    sectionNav.addEventListener('change', () => showSection(sectionNav.value, { focus: true }));
    navigator.append(navLabel, sectionNav);
    body.appendChild(navigator);
    sectionElements.forEach((section) => body.appendChild(section));
    const about = h('section', 'cfg__group cfg__about');
    about.id = 'settings-section-about';
    about.setAttribute('aria-labelledby', 'settings-heading-about');
    const aboutHeading = h('h3', 'panel__title', 'Sobre o VARISPEED');
    aboutHeading.id = 'settings-heading-about'; aboutHeading.tabIndex = -1;
    const aboutHead = h('div', 'cfg__head'); aboutHead.appendChild(aboutHeading);
    about.append(aboutHead, h('p', 'cfg__description', 'Créditos e projetos que fazem parte do VARISPEED.'), buildCredits());
    sectionElements.set('about', about);
    body.appendChild(about);
    showSection(activeSection);
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
      if (n < 0) panelFeedback('Preset inválido · não foi possível ler o JSON', { kind: 'err', hold: 3500 });
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
