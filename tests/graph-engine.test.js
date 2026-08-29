const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

function loadGraphEngine(overrides = {}) {
  const context = {
    window: {},
    performance,
    ResizeObserver: class {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout,
    clearTimeout,
    ...overrides,
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', 'graph-engine.js'), 'utf8'),
    context
  );
  return context.window.GraphEngine;
}

const GraphEngine = loadGraphEngine();

function performanceState() {
  return {
    fps: 0,
    physicsMs: 0,
    renderMs: 0,
    buildMs: 0,
    marqueeMs: 0,
    zoomLatencyMs: 0,
    zoomFrameMs: 0,
    zoomCameraMs: 0,
    zoomSettleMs: 0,
    zoomDroppedFrames: 0,
    skippedDataUpdates: 0,
    sampleFrames: 0,
    sampleStartedAt: performance.now(),
  };
}

test('setData reutiliza o SVG quando o grafo é idêntico', () => {
  let builds = 0;
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    nodes: [], links: [], dragging: null, _pendingData: null,
    _dataSignature: '', _performance: performanceState(),
    selected: '', hovered: '', alpha: 0.1, _cameraInitialized: true,
    _reindex() { this.byId = new Map(this.nodes.map(node => [node.id, node])); },
    _initializeNodePositions() {},
    _renderGraphDOM() { builds++; },
  });
  const data = {
    nodes: [{ id: 'root', role: 'root', label: 'Biblioteca' }],
    links: [],
  };

  graph.setData(data);
  graph.setData(data);

  assert.equal(builds, 1);
  assert.equal(graph._performance.skippedDataUpdates, 1);
  assert.equal(graph.alpha, 1);
});

test('cache físico mantém exatamente os valores fornecidos pelos callbacks', () => {
  const graph = Object.create(GraphEngine.prototype);
  const nodes = [
    { id: 'a', role: 'root', x: 10, y: 20, vx: 0, vy: 0 },
    { id: 'b', role: 'track', x: 40, y: 50, vx: 0, vy: 0 },
  ];
  const links = [{ source: 'a', target: 'b', distance: 137, strength: 0.37 }];
  Object.assign(graph, {
    nodes, links, byId: new Map(), degree: {},
    options: {
      getNodeRole: node => node.role,
      getNodeRadius: node => node.role === 'root' ? 21 : 7,
      getNodeCharge: node => node.role === 'root' ? 333 : 144,
      getCenterStrength: node => node.role === 'root' ? { x: 0.2, y: 0.21 } : { x: 0.01, y: 0.02 },
      getLinkDistance: link => link.distance,
      getLinkStrength: link => link.strength,
    },
  });

  graph._reindex();

  assert.deepEqual(
    { ...nodes[0]._graphPhysics },
    { role: 'root', radius: 21, charge: 333, centerX: 0.2, centerY: 0.21, phase: 0, floatMultiplier: 0.25 }
  );
  assert.equal(links[0]._graphPhysics.distance, 137);
  assert.equal(links[0]._graphPhysics.strength, 0.37);
});

test('ligação somente visual não participa do grau nem recebe mola física', () => {
  const graph = Object.create(GraphEngine.prototype);
  const nodes = [
    { id: 'favorites', role: 'category', x: 10, y: 20, vx: 0, vy: 0 },
    { id: 'track', role: 'track', x: 40, y: 50, vx: 0, vy: 0 },
  ];
  const links = [{ source: 'favorites', target: 'track', physics: false }];
  Object.assign(graph, {
    nodes, links, byId: new Map(), degree: {},
    options: {
      getNodeRole: node => node.role,
      getNodeRadius: () => 7,
      getNodeCharge: () => 144,
      getCenterStrength: () => ({ x: 0.01, y: 0.02 }),
      getLinkDistance: () => { throw new Error('link visual não deve calcular distância física'); },
      getLinkStrength: () => { throw new Error('link visual não deve calcular força física'); },
    },
  });

  graph._reindex();

  assert.equal(nodes[0].degree, 0);
  assert.equal(nodes[1].degree, 0);
  assert.equal(links[0]._graphPhysics, null);
});

test('grade espacial reduz pares de colisão sem perder candidatos nem mudar sua ordem', () => {
  const nodes = [
    { id: 'a', x: -4, y: 0, _graphPhysics: { radius: 21 } },
    { id: 'b', x: 20, y: 10, _graphPhysics: { radius: 8.6 } },
    { id: 'c', x: 82, y: 8, _graphPhysics: { radius: 13.6 } },
    { id: 'd', x: 410, y: 390, _graphPhysics: { radius: 8.6 } },
    { id: 'e', x: 430, y: 405, _graphPhysics: { radius: 8.6 } },
    { id: 'f', x: 920, y: -700, _graphPhysics: { radius: 21 } },
  ];
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    nodes,
    _collisionCellSize: 86,
  });

  const grid = graph._buildCollisionGrid();
  const candidatePairs = [];
  nodes.forEach((_, index) => {
    graph._collisionCandidateIndices(index, grid).forEach(candidate => {
      candidatePairs.push([index, candidate]);
    });
  });
  const pairKeys = new Set(candidatePairs.map(pair => pair.join(':')));
  const geometricallyPossible = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const min = nodes[i]._graphPhysics.radius + nodes[j]._graphPhysics.radius + 44;
      if (Math.abs(nodes[j].x - nodes[i].x) < min && Math.abs(nodes[j].y - nodes[i].y) < min) {
        geometricallyPossible.push(`${i}:${j}`);
      }
    }
  }

  geometricallyPossible.forEach(pair => assert.ok(pairKeys.has(pair), `par ausente: ${pair}`));
  assert.equal(pairKeys.size, candidatePairs.length);
  assert.ok(candidatePairs.length < nodes.length * (nodes.length - 1) / 2);
  candidatePairs.forEach(([i, j], index) => {
    if (!index || candidatePairs[index - 1][0] !== i) return;
    assert.ok(j > candidatePairs[index - 1][1]);
  });
});

test('renderização ignora escritas SVG sem mudança visual', () => {
  const calls = [];
  const element = () => ({ setAttribute: (name, value) => calls.push([name, value]) });
  const a = { id: 'a', x: 10, y: 20 };
  const b = { id: 'b', x: 40, y: 50 };
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    nodes: [a, b], links: [{ source: 'a', target: 'b' }],
    byId: new Map([['a', a], ['b', b]]),
    linkEls: [element()], nodeEls: [element(), element()],
  });

  graph._renderPositions();
  const initialWrites = calls.length;
  graph._renderPositions();
  assert.equal(calls.length, initialWrites);

  a.x += 0.02;
  graph._renderPositions();
  assert.ok(calls.length > initialWrites);
});

test('snapshot de desempenho não expõe o estado interno para mutação', () => {
  const graph = Object.create(GraphEngine.prototype);
  graph._performance = performanceState();
  graph._performance.fps = 60;
  const snapshot = graph.getPerformanceSnapshot();
  snapshot.fps = 1;
  assert.equal(graph._performance.fps, 60);
});

test('zoom ancorado não mede o viewport lateral', () => {
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    dragging: null,
    cameraFollow: null,
    zoomTarget: { x: 10, y: 20, scale: 1 },
    options: { minZoom: 0.5, maxZoom: 2 },
    getVisibleViewport() { throw new Error('viewport não deveria ser medido'); },
    _startSmoothCamera() {},
  });

  graph.zoomBy(1.25, { x: 100, y: 80 });

  assert.equal(graph.zoomTarget.scale, 1.25);
  assert.equal(graph.zoomTarget.x, -12.5);
  assert.equal(graph.zoomTarget.y, 5);
});

test('fit automático preserva escala legível sem alterar o zoom mínimo manual', () => {
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    dragging: null,
    nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1000, y: 800 }],
    byId: new Map(),
    cameraFollow: null,
    zoomTarget: { x: 0, y: 0, scale: 1 },
    options: { fitPadding: 0, minZoom: 0.48, minFitZoom: 0.68, maxZoom: 2 },
    getVisibleViewport: () => ({ width: 400, height: 320, centerX: 200, centerY: 160 }),
    _startSmoothCamera() {},
  });

  graph.fitGraph();

  assert.equal(graph.zoomTarget.scale, 0.68);
  assert.equal(graph.options.minZoom, 0.48);
});

test('foco combina zoom solicitado com o centro do viewport útil', () => {
  const node = { id: 'track', x: 300, y: 200 };
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    dragging: null,
    byId: new Map([[node.id, node]]),
    zoomTarget: { x: 0, y: 0, scale: 0.68 },
    cameraFollow: null,
    options: { cameraFollowMs: 900 },
    getVisibleViewport: () => ({ centerX: 420, centerY: 300 }),
    _startSmoothCamera() {},
  });

  graph.focusNode(node.id, { followViewport: true, followDuration: Infinity, scale: 1.35 });

  assert.deepEqual({ ...graph.zoomTarget }, { x: 15, y: 30, scale: 1.35 });
  assert.equal(graph.cameraFollow.nodeId, node.id);
  assert.equal(graph.cameraFollow.until, Infinity);
});

test('eventos de roda compartilham o frame da câmera e fazem uma única escrita', () => {
  let frameCallback = null;
  let frameRequests = 0;
  const WheelGraphEngine = loadGraphEngine({
    requestAnimationFrame(callback) {
      frameRequests++;
      frameCallback = callback;
      return 7;
    },
  });
  let rectReads = 0;
  let cameraWrites = 0;
  const world = {
    style: {
      set transform(value) {
        cameraWrites++;
        this.value = value;
      },
    },
  };
  const graph = Object.create(WheelGraphEngine.prototype);
  Object.assign(graph, {
    dragging: null,
    zoomFrame: 0,
    zoomLastTime: 0,
    wheelDelta: 0,
    wheelClientX: 0,
    wheelClientY: 0,
    cameraFollow: null,
    camera: { x: 0, y: 0, scale: 1 },
    zoomTarget: { x: 0, y: 0, scale: 1 },
    options: {
      cameraEaseMs: 82,
      wheelResponse: 0.42,
      minZoom: 0.48,
      maxZoom: 2.35,
      initialZoom: 1,
    },
    world,
    hostOrigin: { left: 10, top: 20 },
    host: {
      getBoundingClientRect() {
        rectReads++;
        return { left: 10, top: 20 };
      },
    },
  });

  graph._queueWheelZoom(10, 110, 220);
  graph._queueWheelZoom(20, 130, 260);
  assert.equal(frameRequests, 1);
  assert.equal(rectReads, 0);

  frameCallback(graph.zoomLastTime + 16);
  assert.equal(rectReads, 0);
  const scale = Math.exp(-0.03);
  assert.ok(Math.abs(graph.zoomTarget.scale - scale) < 1e-12);
  assert.ok(Math.abs(graph.zoomTarget.x - 120 * (1 - scale)) < 1e-12);
  assert.ok(Math.abs(graph.zoomTarget.y - 240 * (1 - scale)) < 1e-12);
  assert.equal(cameraWrites, 1);
  assert.equal(frameRequests, 2);
});

test('zoom pela roda encerra a cauda no primeiro quadro sem nova entrada', () => {
  let frameCallback = null;
  let frameRequests = 0;
  let cameraWrites = 0;
  const WheelGraphEngine = loadGraphEngine({
    requestAnimationFrame(callback) {
      frameRequests++;
      frameCallback = callback;
      return frameRequests;
    },
  });
  const graph = Object.create(WheelGraphEngine.prototype);
  Object.assign(graph, {
    dragging: null,
    zoomFrame: 0,
    zoomLastTime: 0,
    wheelDelta: 0,
    wheelClientX: 0,
    wheelClientY: 0,
    wheelQueuedAt: 0,
    wheelInteractionStartedAt: 0,
    wheelLastFrameAt: 0,
    wheelSettlePending: false,
    cameraFollow: null,
    camera: { x: 0, y: 0, scale: 1 },
    zoomTarget: { x: 0, y: 0, scale: 1 },
    _performance: performanceState(),
    options: {
      cameraEaseMs: 82,
      wheelResponse: 0.62,
      minZoom: 0.48,
      maxZoom: 2.35,
      initialZoom: 1,
    },
    world: {
      style: {
        set transform(value) {
          cameraWrites++;
          this.value = value;
        },
      },
    },
    hostOrigin: { left: 0, top: 0 },
    host: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
  });

  graph._queueWheelZoom(120, 100, 100);
  const startedAt = graph.zoomLastTime;
  frameCallback(startedAt + 16);
  assert.notEqual(graph.camera.scale, graph.zoomTarget.scale);
  assert.equal(cameraWrites, 1);

  frameCallback(startedAt + 32);
  assert.equal(graph.camera.scale, graph.zoomTarget.scale);
  assert.equal(graph.camera.x, graph.zoomTarget.x);
  assert.equal(graph.camera.y, graph.zoomTarget.y);
  assert.equal(graph.zoomFrame, 0);
  assert.equal(cameraWrites, 2);
  assert.ok(graph._performance.zoomLatencyMs >= 0);
  assert.equal(graph._performance.zoomFrameMs, 16);
  assert.ok(graph._performance.zoomCameraMs >= 0);
  assert.ok(graph._performance.zoomSettleMs >= 0);
});

test('resize atualiza a origem reutilizada pelo zoom', () => {
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    W: 0,
    H: 0,
    nodes: [],
    hostOrigin: null,
    host: {
      clientWidth: 800,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 24, top: 72 }),
    },
    svg: { setAttribute() {} },
    options: { onResize: null },
  });

  graph.resize();

  assert.deepEqual({ ...graph.hostOrigin }, { left: 24, top: 72 });
  assert.equal(graph.W, 800);
  assert.equal(graph.H, 600);
});

test('layout inicial distribui músicas em anéis e separa categorias', () => {
  const nodes = [
    { id: 'root', role: 'root' },
    { id: 'favorites', role: 'category' },
    ...Array.from({ length: 21 }, (_, index) => ({ id: `track-${index}`, role: 'track' })),
  ];
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    W: 1200,
    H: 700,
    alpha: 0,
    nodes,
    options: {
      getNodeRole: node => node.role,
      categorySpawnRadius: 0.20,
      nodeSpawnRadius: 0.28,
      nodeRingGap: 0.13,
      initialRingCapacity: 12,
      spawnJitter: 0,
    },
  });

  graph._initializeNodePositions(new Map());

  const center = { x: 1200 * 0.52, y: 700 * 0.5 };
  const distance = node => Math.hypot(node.x - center.x, node.y - center.y);
  const categoryDistance = distance(nodes[1]);
  const firstRing = nodes.slice(2, 14).map(distance);
  const secondRing = nodes.slice(14).map(distance);
  assert.ok(Math.abs(categoryDistance - 140) < 1e-9);
  firstRing.forEach(value => assert.ok(Math.abs(value - 196) < 1e-9));
  secondRing.forEach(value => assert.ok(Math.abs(value - 287) < 1e-9));
});

test('layout topológico nasce nas distâncias físicas ao redor de cada categoria', () => {
  const nodes = [
    { id: 'root', role: 'root' },
    { id: 'favorites', role: 'category' },
    { id: 'regular', role: 'track' },
    { id: 'favorite', role: 'track' },
  ];
  const links = [
    { source: 'root', target: 'favorites', _graphPhysics: { distance: 440 } },
    { source: 'root', target: 'regular', _graphPhysics: { distance: 128 } },
    { source: 'favorites', target: 'favorite', _graphPhysics: { distance: 128 } },
  ];
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    W: 1200,
    H: 800,
    alpha: 0,
    nodes,
    links,
    byId: new Map(nodes.map(node => [node.id, node])),
    options: {
      getNodeRole: node => node.role,
      categorySpawnRadius: 0.20,
      nodeSpawnRadius: 0.28,
      nodeRingGap: 0.13,
      initialRingCapacity: 12,
      spawnJitter: 0,
    },
  });

  graph._initializeNodePositions(new Map());

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(Math.abs(distance(nodes[0], nodes[1]) - 440) < 1e-9);
  assert.ok(Math.abs(distance(nodes[0], nodes[2]) - 128) < 1e-9);
  assert.ok(Math.abs(distance(nodes[1], nodes[3]) - 128) < 1e-9);
});

test('conexão secundária não substitui a categoria principal no spawn', () => {
  const nodes = [
    { id: 'root', role: 'root' },
    { id: 'favorites', role: 'category' },
    { id: 'custom', role: 'category' },
    { id: 'track', role: 'track' },
  ];
  const links = [
    { source: 'root', target: 'favorites', _graphPhysics: { distance: 440 } },
    { source: 'root', target: 'custom', _graphPhysics: { distance: 440 } },
    { source: 'favorites', target: 'track', layout: false, _graphPhysics: { distance: 220 } },
    { source: 'custom', target: 'track', _graphPhysics: { distance: 128 } },
  ];
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    W: 1200,
    H: 800,
    alpha: 0,
    nodes,
    links,
    byId: new Map(nodes.map(node => [node.id, node])),
    options: {
      getNodeRole: node => node.role,
      categorySpawnRadius: 0.20,
      nodeSpawnRadius: 0.28,
      nodeRingGap: 0.13,
      initialRingCapacity: 12,
      spawnJitter: 0,
    },
  });

  graph._initializeNodePositions(new Map());

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(Math.abs(distance(nodes[2], nodes[3]) - 128) < 1e-9);
  assert.ok(distance(nodes[1], nodes[3]) > 128);
});

test('categoria incremental nasce no território livre entre clusters preservados', () => {
  const root = { id: 'root', role: 'root' };
  const favorites = { id: 'favorites', role: 'category' };
  const hoodtraps = { id: 'hoodtraps', role: 'category' };
  const nescau = { id: 'nescau', role: 'category' };
  const testCategory = { id: 'test', role: 'category' };
  const hoodTrack = { id: 'hood-track', role: 'track' };
  const nodes = [root, favorites, hoodtraps, nescau, testCategory, hoodTrack];
  const rootPosition = { x: 600, y: 400, vx: 0, vy: 0 };
  const pointAt = angle => ({
    x: rootPosition.x + Math.cos(angle) * 520,
    y: rootPosition.y + Math.sin(angle) * 520,
    vx: 0,
    vy: 0,
  });
  const oldPositions = new Map([
    [root.id, rootPosition],
    [favorites.id, pointAt(-Math.PI / 2)],
    [hoodtraps.id, pointAt(Math.PI * 0.75)],
    [nescau.id, pointAt(Math.PI * 0.25)],
    [hoodTrack.id, { x: 120, y: 230, vx: 0, vy: 0 }],
  ]);
  const links = [favorites, hoodtraps, nescau, testCategory].map(category => ({
    source: root.id,
    target: category.id,
    _graphPhysics: { distance: 520 },
  }));
  links.push({
    source: hoodtraps.id,
    target: hoodTrack.id,
    _graphPhysics: { distance: 198 },
  });
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    W: 1200,
    H: 800,
    alpha: 0,
    nodes,
    links,
    byId: new Map(nodes.map(node => [node.id, node])),
    options: {
      getNodeRole: node => node.role,
      categorySpawnRadius: 0.46,
      nodeSpawnRadius: 0.28,
      nodeRingGap: 0.13,
      initialRingCapacity: 12,
      spawnJitter: 0,
    },
  });

  graph._initializeNodePositions(oldPositions);

  assert.equal(hoodtraps.x, oldPositions.get(hoodtraps.id).x);
  assert.equal(hoodtraps.y, oldPositions.get(hoodtraps.id).y);
  assert.ok(testCategory.x > rootPosition.x);
  assert.ok(testCategory.y < rootPosition.y);
  assert.ok(Math.abs(Math.hypot(
    testCategory.x - rootPosition.x,
    testCategory.y - rootPosition.y
  ) - 520) < 1e-9);
  assert.ok(Math.hypot(testCategory.x - hoodTrack.x, testCategory.y - hoodTrack.y) > 700);
});

test('música incremental nasce ao redor da posição preservada da categoria', () => {
  const root = { id: 'root', role: 'root' };
  const category = { id: 'category', role: 'category' };
  const track = { id: 'track', role: 'track' };
  const nodes = [root, category, track];
  const links = [
    { source: root.id, target: category.id, _graphPhysics: { distance: 520 } },
    { source: category.id, target: track.id, _graphPhysics: { distance: 198 } },
  ];
  const categoryPosition = { x: 280, y: 690, vx: 0, vy: 0 };
  const oldPositions = new Map([
    [root.id, { x: 600, y: 400, vx: 0, vy: 0 }],
    [category.id, categoryPosition],
  ]);
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    W: 1200,
    H: 800,
    alpha: 0,
    nodes,
    links,
    byId: new Map(nodes.map(node => [node.id, node])),
    options: {
      getNodeRole: node => node.role,
      categorySpawnRadius: 0.46,
      nodeSpawnRadius: 0.28,
      nodeRingGap: 0.13,
      initialRingCapacity: 12,
      spawnJitter: 0,
    },
  });

  graph._initializeNodePositions(oldPositions);

  assert.ok(Math.abs(Math.hypot(
    track.x - categoryPosition.x,
    track.y - categoryPosition.y
  ) - 198) < 1e-9);
});

function recoveryFixture({ dragX = 1100, dragY = 400 } = {}) {
  const root = { id: 'root', role: 'root', x: 600, y: 400, vx: 0, vy: 0 };
  const category = { id: 'category', role: 'category', x: dragX, y: dragY, vx: 0, vy: 0, fx: dragX, fy: dragY };
  const track = { id: 'track', role: 'track', x: 1318, y: 400, vx: 0, vy: 0 };
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    W: 1200,
    H: 800,
    alpha: 0.65,
    nodes: [root, category, track],
    links: [
      { source: root.id, target: category.id, distance: 520, strength: 0.52 },
      { source: category.id, target: track.id, distance: 198, strength: 0.44 },
    ],
    byId: new Map(),
    degree: {},
    running: false,
    _performance: performanceState(),
    options: {
      restingAlpha: 0.025,
      categoryReleaseAlpha: 0.14,
      categoryRecoveryAlpha: 0.055,
      categoryRecoveryChildMinInfluence: 0.24,
      categoryRecoveryBlendDistance: 220,
      categoryRecoveryParentTolerance: 10,
      categoryRecoverySpeedTolerance: 0.22,
      categoryRecoveryLinkTolerance: 18,
      categoryRecoveryStableFrames: 8,
      categoryRecoveryTimeoutMs: 12000,
      floatForce: 0,
      floatSpeed: 0.00042,
      getNodeRole: node => node.role,
      getNodeRadius: null,
      getNodeCharge: null,
      getCenterStrength: null,
      getLinkDistance: link => link.distance,
      getLinkStrength: link => link.strength,
    },
    _renderPositions() {},
  });

  graph._reindex();
  graph._releaseDraggedNode(category);
  return { graph, root, category, track };
}

test('soltar categoria reduz o pico e devolve influência às músicas gradualmente', () => {
  const { graph, category, track } = recoveryFixture({ dragX: 1450, dragY: 120 });

  assert.equal(graph.alpha, 0.14);
  assert.equal(category.fx, null);
  assert.ok(category._graphDragRecovery);

  graph._tick();

  assert.equal(category._graphDragRecovery.childInfluence, 0.24);
  assert.ok(Math.hypot(category.vx, category.vy) > 0);
  assert.ok(Math.hypot(track.vx, track.vy) > 0);
});

test('recuperação longa desacelera continuamente sem patamar de velocidade artificial', () => {
  const { graph, root, category } = recoveryFixture({ dragX: 1450, dragY: 120 });
  const speeds = [];
  const distances = [];
  const influences = [];

  for (let frame = 0; frame < 210; frame++) {
    graph._tick();
    speeds.push(Math.hypot(category.vx, category.vy));
    distances.push(Math.hypot(category.x - root.x, category.y - root.y));
    influences.push(category._graphDragRecovery?.childInfluence ?? 1);
  }

  const middleSpeeds = new Set(speeds.slice(25, 90).map(speed => speed.toFixed(2)));
  assert.ok(middleSpeeds.size > 12);
  assert.ok(speeds[4] > speeds[80]);
  assert.ok(speeds[80] > speeds[190]);
  assert.ok(distances[209] < distances[0]);
  assert.equal(influences[0], 0.24);
  assert.ok(influences[209] > 0.5);
  assert.ok(influences[209] > influences[0]);
});

test('arraste curto não injeta impulso mínimo nem cria retorno brusco', () => {
  const { graph, root, category } = recoveryFixture({ dragX: 1180, dragY: 400 });
  const initialError = Math.abs(Math.hypot(category.x - root.x, category.y - root.y) - 520);
  let peakSpeed = 0;

  for (let frame = 0; frame < 120; frame++) {
    graph._tick();
    peakSpeed = Math.max(peakSpeed, Math.hypot(category.vx, category.vy));
  }

  const finalError = Math.abs(Math.hypot(category.x - root.x, category.y - root.y) - 520);
  assert.ok(peakSpeed < 1.4);
  assert.ok(finalError < initialError);
});

test('física preserva dois agrupamentos depois de estabilizar', () => {
  const root = { id: 'root', role: 'root' };
  const favorites = { id: 'favorites', role: 'category' };
  const regularTracks = Array.from({ length: 7 }, (_, index) => ({ id: `regular-${index}`, role: 'track' }));
  const favoriteTracks = Array.from({ length: 14 }, (_, index) => ({ id: `favorite-${index}`, role: 'track' }));
  const nodes = [root, favorites, ...regularTracks, ...favoriteTracks];
  const links = [
    { source: root.id, target: favorites.id, distance: 520, strength: 0.52 },
    ...regularTracks.map(track => ({ source: root.id, target: track.id, distance: 198, strength: 0.44 })),
    ...favoriteTracks.map(track => ({ source: favorites.id, target: track.id, distance: 198, strength: 0.44 })),
  ];
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    W: 1200,
    H: 800,
    alpha: 1,
    nodes,
    links,
    byId: new Map(),
    degree: {},
    running: false,
    _performance: performanceState(),
    options: {
      restingAlpha: 0.025,
      floatForce: 0,
      floatSpeed: 0.00042,
      getNodeRole: node => node.role,
      getNodeRadius: null,
      getNodeCharge: null,
      getCenterStrength: null,
      getLinkDistance: link => link.distance,
      getLinkStrength: link => link.strength,
      categorySpawnRadius: 0.46,
      nodeSpawnRadius: 0.28,
      nodeRingGap: 0.13,
      initialRingCapacity: 12,
      spawnJitter: 14,
    },
    _renderPositions() {},
  });

  graph._reindex();
  graph._initializeNodePositions(new Map());
  for (let index = 0; index < 720; index++) graph._tick();

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(distance(root, favorites) > 450);
  assert.ok(average(regularTracks.map(track => distance(track, root))) < average(regularTracks.map(track => distance(track, favorites))));
  assert.ok(average(favoriteTracks.map(track => distance(track, favorites))) < average(favoriteTracks.map(track => distance(track, root))));
});

test('applyCamera não repete a mesma escrita no compositor', () => {
  let writes = 0;
  const world = {
    style: {
      set transform(value) {
        writes++;
        this.value = value;
      },
    },
  };
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    camera: { x: 10, y: 20, scale: 1.2 },
    zoomTarget: { x: 10, y: 20, scale: 1.2 },
    cameraFollow: null,
    options: { initialZoom: 1 },
    world,
  });

  graph.applyCamera();
  graph.applyCamera();
  assert.equal(writes, 1);
});

test('captura de desempenho resume frames, física, render e zoom sem alterar a simulação', async () => {
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    nodes: [{ id: 'root' }, { id: 'track' }],
    links: [{ source: 'root', target: 'track' }],
    W: 1280,
    H: 720,
    _performanceCapture: null,
  });

  const pending = graph.startPerformanceCapture({ durationMs: 3000 });
  graph._recordPerformanceCaptureFrame(100, 1.2, 0.4);
  graph._recordPerformanceCaptureFrame(107, 1.4, 0.5);
  graph._recordPerformanceCaptureFrame(114, 1.1, 0.3);
  graph._recordPerformanceCaptureFrame(128, 2.2, 0.8);
  graph._capturePerformanceMetric('zoomLatencyMs', 3.5);
  graph._capturePerformanceMetric('zoomFrameMs', 7);
  graph._capturePerformanceMetric('zoomCameraMs', 0.08);
  graph._capturePerformanceMetric('zoomSettleMs', 14);

  const report = graph._finishPerformanceCapture();
  const resolved = await pending;

  assert.equal(resolved, report);
  assert.equal(report.nodes, 2);
  assert.equal(report.links, 1);
  assert.equal(report.refreshHz, 143);
  assert.equal(report.frame.samples, 3);
  assert.equal(report.lateFrames, 1);
  assert.equal(report.physics.samples, 4);
  assert.equal(report.render.samples, 4);
  assert.equal(report.zoom.latency.samples, 1);
  assert.equal(report.zoom.latency.max, 3.5);
  assert.equal(report.cancelled, false);
  assert.equal(graph._performanceCapture, null);
});

test('captura de desempenho ativa é reutilizada e pode ser cancelada com segurança', async () => {
  const graph = Object.create(GraphEngine.prototype);
  Object.assign(graph, {
    nodes: [], links: [], W: 0, H: 0, _performanceCapture: null,
  });

  const first = graph.startPerformanceCapture({ durationMs: 3000 });
  const second = graph.startPerformanceCapture({ durationMs: 3000 });
  assert.equal(first, second);

  const report = graph.cancelPerformanceCapture();
  assert.equal((await first), report);
  assert.equal(report.cancelled, true);
  assert.equal(graph.cancelPerformanceCapture(), null);
});
