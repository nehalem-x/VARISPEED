(() => {
'use strict';

let graphInstanceSequence = 0;

class GraphEngine {
  constructor(options = {}) {
    if (!options.host) throw new Error('GraphEngine: options.host é obrigatório.');

    this.host = options.host;
    this.options = {
      initialZoom: 1.18,
      minZoom: 0.48,
      minFitZoom: null,
      maxZoom: 2.35,
      dragThreshold: 7,
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
      floatForce: 0.018,
      floatSpeed: 0.00042,
      cameraEaseMs: 82,
      wheelResponse: 0.62,
      wheelRenderHoldMs: 72,
      cameraFollowMs: 520,
      fitPadding: 84,
      compactBreakpoint: 800,
      showControls: true,
      nodeLabelMaxWidth: 0,
      reduceMotion: () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
      categorySpawnRadius: 0.22,
      nodeSpawnRadius: 0.38,
      nodeRingGap: 0.14,
      initialRingCapacity: 12,
      spawnJitter: 75,
      getViewportInsets: () => ({ left: 0, top: 0, right: 0, bottom: 0 }),
      getNodeRole: node => node.role || node.type || 'node',
      getNodeLabel: node => node.label ?? '',
      getNodeCountLabel: node => node.countLabel ?? '',
      getNodeTitle: node => node.title ?? node.label ?? '',
      getNodeRadius: null,
      getNodeCharge: null,
      getCenterStrength: null,
      isNodePlaying: () => false,
      getLinkDistance: link => Number.isFinite(link.distance) ? link.distance : 102,
      getLinkStrength: link => Number.isFinite(link.strength) ? link.strength : 0.52,
      renderNodeIcon: null,
      onNodeClick: null,
      onNodeContextMenu: null,
      onSelectionChange: null,
      onResize: null,
      shouldNodeOpenOnClick: node => true,
      shouldIgnoreWheel: event => !!event.target.closest?.('[data-graph-ignore-wheel]'),
      ...options,
    };

    this.nodes = [];
    this.links = [];
    this.byId = new Map();
    this.degree = {};
    this.linkEls = [];
    this.nodeEls = [];

    this.W = 0;
    this.H = 0;
    this.hostOrigin = null;
    this.hovered = '';
    this.selected = '';
    this.dragging = null;
    this._pendingData = null;
    this.alpha = 1;

    this.camera = { x: 0, y: 0, scale: this.options.initialZoom };
    this.zoomTarget = { ...this.camera };
    this.zoomFrame = 0;
    this.zoomLastTime = 0;
    this.wheelDelta = 0;
    this.wheelClientX = 0;
    this.wheelClientY = 0;
    this.wheelQueuedAt = 0;
    this.wheelInteractionStartedAt = 0;
    this.wheelLastFrameAt = 0;
    this.wheelSettlePending = false;
    this.wheelRenderHoldUntil = 0;
    this.cameraFollow = null;
    this.raf = 0;
    this.running = false;
    this.labelFrame = 0;
    this.instanceId = ++graphInstanceSequence;
    this._dataSignature = '';
    this._labelWidthCache = new Map();
    this._performanceCapture = null;
    this._performance = {
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
      zoomDeferredRenders: 0,
      skippedDataUpdates: 0,
      sampleFrames: 0,
      sampleStartedAt: performance.now(),
    };

    this._createDOM();
    this._bindEvents();
    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(this.host);
    this.resize();
    this._tick = this._tick.bind(this);
    this.resume();
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  setData({ nodes = [], links = [] } = {}) {
    const next = {
      nodes: nodes.map(n => ({ ...n })),
      links: links.map(l => ({ ...l })),
    };
    const signature = this._graphDataSignature(next);

    /* Substituir os objetos/elementos SVG durante pointer capture rompe o
       gesto e deixa a engine manipulando um nó que já não é renderizado. */
    if (this.dragging) {
      this._pendingData = next;
      return this;
    }

    /* Reabrir a Biblioteca normalmente entrega o mesmo grafo. Nesse caso,
       conservar objetos, SVG, listeners e medições evita reconstruir tudo
       sem mudar o reset de layout, o alpha ou qualquer força física. */
    if (signature === this._dataSignature) {
      this._pendingData = null;
      this._performance.skippedDataUpdates++;
      this.alpha = Math.max(this.alpha, 1);
      return this;
    }

    this._pendingData = null;
    const oldPositions = new Map(
      this.nodes
        .filter(n => n.initialized && Number.isFinite(n.x) && Number.isFinite(n.y))
        .map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }])
    );

    this.nodes = next.nodes;
    this.links = next.links;

    this._reindex();
    if (this.selected && !this.byId.has(this.selected)) this.selected = '';
    if (this.hovered && !this.byId.has(this.hovered)) this.hovered = '';
    this._initializeNodePositions(oldPositions);
    this._renderGraphDOM();
    this._dataSignature = signature;

    if (!this._cameraInitialized && this.nodes.length) {
      this.camera = this._initialCameraTarget();
      this.zoomTarget = { ...this.camera };
      this.applyCamera();
      this._cameraInitialized = true;
    }

    this.alpha = Math.max(this.alpha, 1);
    return this;
  }

  updateData(data) {
    return this.setData(data);
  }

  resetLayout({ resetCamera = true } = {}) {
    if (this.dragging) return this;
    this._initializeNodePositions(new Map());
    this._renderPositions();

    if (resetCamera && this.nodes.length) {
      this.stopCameraAnimation();
      this.cameraFollow = null;
      this.camera = this._initialCameraTarget();
      this.zoomTarget = { ...this.camera };
      this.applyCamera();
      this._cameraInitialized = true;
    }

    return this;
  }

  setSelected(nodeId = '') {
    this.selected = nodeId && this.byId.has(nodeId) ? nodeId : '';
    this._renderStyles();
    this.options.onSelectionChange?.(
      this.selected || null,
      this.byId.get(this.selected) || null
    );
    return this;
  }

  clearSelection() {
    return this.setSelected('');
  }

  refreshStyles() {
    this._renderStyles();
    return this;
  }

  pause() {
    this.cancelInteraction();
    this.stopCameraAnimation();
    this.wheelDelta = 0;
    this.wheelRenderHoldUntil = 0;
    if (!this.running) return this;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    return this;
  }

  resume() {
    if (this.running) return this;
    this.running = true;
    this.raf = requestAnimationFrame(this._tick);
    return this;
  }

  cancelInteraction() {
    const interaction = this.dragging;
    if (!interaction) return this;

    if (interaction.type === 'node') {
      this._releaseDraggedNode(interaction.node);
    }

    this.dragging = null;

    if (this.svg?.hasPointerCapture?.(interaction.id)) {
      try { this.svg.releasePointerCapture(interaction.id); }
      catch (_) { /* a captura já pode ter sido perdida pelo navegador */ }
    }

    this._flushPendingData();
    return this;
  }

  getNode(nodeId) {
    return this.byId.get(nodeId) || null;
  }

  getCamera() {
    return { ...this.camera };
  }

  getPerformanceSnapshot() {
    return { ...this._performance };
  }

  startPerformanceCapture({ durationMs = 8000 } = {}) {
    if (this._performanceCapture) return this._performanceCapture.promise;

    const duration = this._clamp(Number(durationMs) || 8000, 3000, 30000);
    const startedAt = performance.now();
    let resolveCapture;
    const promise = new Promise(resolve => { resolveCapture = resolve; });
    const capture = {
      startedAt,
      durationMs: duration,
      lastFrameAt: 0,
      frameMs: [],
      physicsMs: [],
      renderMs: [],
      zoomLatencyMs: [],
      zoomFrameMs: [],
      zoomCameraMs: [],
      zoomSettleMs: [],
      deferredRenders: 0,
      resolve: resolveCapture,
      promise,
      timer: 0,
    };

    capture.timer = setTimeout(() => this._finishPerformanceCapture(), duration);
    this._performanceCapture = capture;
    return promise;
  }

  cancelPerformanceCapture() {
    return this._finishPerformanceCapture({ cancelled: true });
  }

  resize() {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;

    /* ResizeObserver também dispara quando um ancestral recebe `hidden`.
       Conservar o último viewport válido impede que W/H=0 contaminem uma
       reconstrução de dados feita enquanto a Biblioteca está fechada. */
    if (!(width > 0) || !(height > 0)) return this;

    const rect = this.host.getBoundingClientRect();
    this.hostOrigin = {
      left: rect.left,
      top: rect.top,
    };

    const changed = width !== this.W || height !== this.H;
    this.W = width;
    this.H = height;
    this.svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    this.linksSvg?.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);

    if (this.nodes.length && !this.nodes[0].initialized) {
      this._initializeNodePositions();
    }

    if (changed) this.options.onResize?.(this);

    return this;
  }

  focusNode(nodeId, {
    followViewport = true,
    followDuration = this.options.cameraFollowMs,
    scale = this.zoomTarget.scale,
  } = {}) {
    if (this.dragging) return this;
    const target = this._targetForNode(nodeId, { scale });
    if (!target) return this;

    this.zoomTarget = target;

    this.cameraFollow = followViewport
      ? {
          nodeId,
          until: Number.isFinite(followDuration)
            ? performance.now() + Math.max(0, followDuration)
            : Infinity
        }
      : null;

    this._startSmoothCamera();
    return this;
  }

  home({
    preserveScale = true,
    followViewport = true
  } = {}) {
    const roots = this.nodes.filter(
      n => this._role(n) === 'root'
    );

    if (roots.length === 1) {
      return this.focusNode(roots[0].id, {
        followViewport,
        scale: preserveScale
          ? this.zoomTarget.scale
          : this.options.initialZoom,
      });
    }

    const primary = roots.length
      ? roots
      : this.nodes.filter(
          n => this._role(n) === 'category'
        );

    return this.fitGraph(
      primary.length
        ? primary.map(n => n.id)
        : null
    );
  }

  resetView() {
    const roots = this.nodes.filter(
      n => this._role(n) === 'root'
    );

    if (roots.length === 1) {
      this.focusNode(roots[0].id, {
        followViewport: true,
        scale: this.options.initialZoom,
      });
    } else {
      this.fitGraph(
        roots.length
          ? roots.map(n => n.id)
          : null
      );
    }

    this.alpha = Math.max(
      this.alpha,
      0.65
    );

    return this;
  }

  fitGraph(
    nodeIds = null,
    {
      padding = this.options.fitPadding
    } = {}
  ) {
    /* Um fit pode estar enfileirado pelo layout ou pelo ResizeObserver. Se ele
       começar depois do pointerdown, volta a mover a câmera sob o ponteiro e
       faz o arrasto parecer bloqueado. A interação manual sempre tem prioridade. */
    if (this.dragging) return this;

    const candidates = (
      nodeIds?.length
        ? nodeIds.map(id => this.byId.get(id))
        : this.nodes
    ).filter(node => node && Number.isFinite(node.x) && Number.isFinite(node.y));

    if (!candidates.length) return this;

    const vp = this.getVisibleViewport();

    const xs = candidates.map(n => n.x);
    const ys = candidates.map(n => n.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const graphW = Math.max(
      1,
      maxX - minX
    );

    const graphH = Math.max(
      1,
      maxY - minY
    );

    const usableW = Math.max(
      120,
      vp.width - padding * 2
    );

    const usableH = Math.max(
      120,
      vp.height - padding * 2
    );

    const scale = this._clamp(
      Math.min(
        usableW / graphW,
        usableH / graphH
      ),
      Number.isFinite(this.options.minFitZoom)
        ? Math.max(this.options.minZoom, this.options.minFitZoom)
        : this.options.minZoom,
      this.options.maxZoom
    );

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    this.cameraFollow = null;

    this.zoomTarget = {
      x: vp.centerX - cx * scale,
      y: vp.centerY - cy * scale,
      scale,
    };

    this._startSmoothCamera();

    return this;
  }

  zoomBy(
    factor,
    anchor = null
  ) {
    if (this.dragging) return this;
    this.cameraFollow = null;

    this._updateZoomTarget(factor, anchor);
    this._startSmoothCamera();

    return this;
  }

  _updateZoomTarget(
    factor,
    anchor = null
  ) {
    if (!Number.isFinite(factor) || factor <= 0) return false;

    const base = this.zoomTarget;

    let point = anchor;
    if (!point) {
      const vp = this.getVisibleViewport();
      point = {
        x: vp.centerX,
        y: vp.centerY
      };
    }

    const scale = this._clamp(
      base.scale * factor,
      this.options.minZoom,
      this.options.maxZoom
    );

    const gx =
      (point.x - base.x) /
      base.scale;

    const gy =
      (point.y - base.y) /
      base.scale;

    this.zoomTarget = {
      x: point.x - gx * scale,
      y: point.y - gy * scale,
      scale,
    };

    return true;
  }

  stopCameraAnimation() {
    if (this.zoomFrame) {
      cancelAnimationFrame(
        this.zoomFrame
      );
    }

    this.zoomFrame = 0;
    this.zoomLastTime = 0;
    this.wheelDelta = 0;
    this.wheelQueuedAt = 0;
    this.wheelInteractionStartedAt = 0;
    this.wheelLastFrameAt = 0;
    this.wheelSettlePending = false;
    this.cameraFollow = null;

    this.zoomTarget = {
      ...this.camera
    };

    return this;
  }

  getVisibleViewport() {
    const compact =
      this.W <=
      this.options.compactBreakpoint;

    const raw = compact
      ? {
          left: 0,
          top: 0,
          right: 0,
          bottom: 0
        }
      : (
          this.options.getViewportInsets?.() ||
          {}
        );

    const left = Math.max(
      0,
      Number(raw.left) || 0
    );

    const top = Math.max(
      0,
      Number(raw.top) || 0
    );

    const right = Math.max(
      0,
      Number(raw.right) || 0
    );

    const bottom = Math.max(
      0,
      Number(raw.bottom) || 0
    );

    const width = Math.max(
      240,
      this.W - left - right
    );

    const height = Math.max(
      180,
      this.H - top - bottom
    );

    return {
      left,
      top,
      right,
      bottom,
      width,
      height,

      centerX:
        left +
        width / 2,

      centerY:
        top +
        height / 2,
    };
  }

  destroy() {
    this.cancelPerformanceCapture();
    this.pause();
    cancelAnimationFrame(this.labelFrame);
    this.labelFrame = 0;

    this._resizeObserver?.disconnect();
    this._abortController?.abort();

    this.host.replaceChildren();
  }

  // ---------------------------------------------------------------------------
  // DOM / RENDER
  // ---------------------------------------------------------------------------

  _createDOM() {
    this.host.classList.add(
      'graph-engine-host'
    );

    this.svg =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      );

    this.svg.classList.add(
      'graph-engine-svg',
      'graph-engine-nodes-svg'
    );

    this.svg.setAttribute(
      'aria-label',
      'Grafo interativo'
    );

    this.defs =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        'defs'
      );

    this.world =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      );

    this.world.classList.add(
      'graph-engine-world'
    );

    this.linksSvg =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      );

    this.linksSvg.classList.add(
      'graph-engine-svg',
      'graph-engine-links-svg'
    );

    this.linksSvg.setAttribute(
      'aria-hidden',
      'true'
    );

    this.linkWorld =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      );

    this.linkWorld.classList.add(
      'graph-engine-world'
    );

    this.gLinks =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      );

    this.gLinks.classList.add(
      'graph-engine-links'
    );

    this.gNodes =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      );

    this.gNodes.classList.add(
      'graph-engine-nodes'
    );

    this.linkWorld.appendChild(
      this.gLinks
    );

    this.world.appendChild(
      this.gNodes
    );

    this.linksSvg.appendChild(
      this.linkWorld
    );

    this.svg.append(
      this.defs,
      this.world
    );

    this.host.append(
      this.linksSvg,
      this.svg
    );

    if (this.options.showControls) {
      this.controls =
        document.createElement(
          'div'
        );

      this.controls.className =
        'graph-engine-controls';

      this.controls.innerHTML = `
        <button
          type="button"
          class="btn btn--ghost graph-engine-control"
          data-graph-control="zoom-in"
          aria-label="Ampliar zoom"
        >
          +
        </button>

        <button
          type="button"
          class="btn btn--ghost graph-engine-control"
          data-graph-control="zoom-out"
          aria-label="Reduzir zoom"
        >
          −
        </button>

        <button
          type="button"
          class="btn btn--ghost graph-engine-control"
          data-graph-control="reset"
          aria-label="Centralizar"
        >
          ◎
        </button>
      `;

      this.host.appendChild(
        this.controls
      );
    }
  }

  _renderGraphDOM() {
    const buildStartedAt = performance.now();
    this.defs.replaceChildren();
    this.gLinks.replaceChildren();
    this.gNodes.replaceChildren();
    const linkFragment = document.createDocumentFragment();
    const nodeFragment = document.createDocumentFragment();

    this.linkEls =
      this.links.map(link => {
        const el =
          document.createElementNS(
            'http://www.w3.org/2000/svg',
            'line'
          );

        el.classList.add(
          'graph-engine-link'
        );

        if (link.kind) {
          el.classList.add(
            `kind-${this._safeClass(link.kind)}`
          );
        }

        linkFragment.appendChild(el);

        return el;
      });
    this.gLinks.appendChild(linkFragment);

    this.nodeEls =
      this.nodes.map((node, i) => {
        const role =
          this._role(node);

        const group =
          document.createElementNS(
            'http://www.w3.org/2000/svg',
            'g'
          );

        group.classList.add(
          'graph-engine-node',
          `role-${this._safeClass(role)}`
        );

        group.dataset.id =
          node.id;

        group.setAttribute(
          'tabindex',
          '0'
        );

        group.setAttribute(
          'role',
          'button'
        );

        const title =
          document.createElementNS(
            'http://www.w3.org/2000/svg',
            'title'
          );

        title.textContent =
          this.options.getNodeTitle(node) ||
          '';

        group.setAttribute(
          'aria-label',
          title.textContent ||
          this.options.getNodeLabel(node) ||
          'Nó do grafo'
        );

        group.setAttribute(
          'aria-pressed',
          'false'
        );

        const hit =
          document.createElementNS(
            'http://www.w3.org/2000/svg',
            'circle'
          );

        hit.classList.add(
          'graph-engine-hit'
        );

        hit.setAttribute(
          'r',
          Math.max(
            16,
            this._radius(node) + 10
          )
        );

        const dot =
          document.createElementNS(
            'http://www.w3.org/2000/svg',
            'circle'
          );

        const playingRing =
          document.createElementNS(
            'http://www.w3.org/2000/svg',
            'circle'
          );

        playingRing.classList.add(
          'graph-engine-playing-ring'
        );

        playingRing.setAttribute(
          'r',
          this._radius(node) + 5
        );

        dot.classList.add(
          'graph-engine-dot'
        );

        dot.setAttribute(
          'r',
          this._radius(node)
        );

        group.append(
          title,
          hit,
          playingRing,
          dot
        );

        if (
          typeof this.options
            .renderNodeIcon ===
          'function'
        ) {
          this.options.renderNodeIcon({
            node,
            group,
            dot,
            engine: this
          });
        }

        const label =
          this.options.getNodeLabel(
            node
          );

        if (
          label !== null &&
          label !== undefined &&
          String(label) !== ''
        ) {
          const text =
            document.createElementNS(
              'http://www.w3.org/2000/svg',
              'text'
            );

          text.classList.add(
            'graph-engine-label'
          );

          text.setAttribute(
            'text-anchor',
            'middle'
          );

          text.setAttribute(
            'y',
            this._radius(node) + 18
          );

          text.textContent =
            label;

          const maxLabelWidth =
            role === 'track'
              ? Math.max(0, Number(this.options.nodeLabelMaxWidth) || 0)
              : 0;

          if (maxLabelWidth > 0) {
            const clipId = `graph-label-${this.instanceId}-${i}`;
            const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            clip.setAttribute('id', clipId);
            clipRect.setAttribute('x', String(-maxLabelWidth / 2));
            clipRect.setAttribute('y', String(this._radius(node) + 6));
            clipRect.setAttribute('width', String(maxLabelWidth));
            clipRect.setAttribute('height', '18');
            clip.appendChild(clipRect);
            this.defs.appendChild(clip);
            text.setAttribute('clip-path', `url(#${clipId})`);
            text.dataset.marqueeWidth = String(maxLabelWidth);
          }

          group.appendChild(
            text
          );
        }

        const countLabel =
          this.options.getNodeCountLabel(
            node
          );

        if (
          countLabel !== null &&
          countLabel !== undefined &&
          String(countLabel) !== ''
        ) {
          const count =
            document.createElementNS(
              'http://www.w3.org/2000/svg',
              'text'
            );

          count.classList.add(
            'graph-engine-count-label'
          );

          count.setAttribute(
            'text-anchor',
            'middle'
          );

          count.setAttribute(
            'y',
            this._radius(node) + 31
          );

          count.textContent =
            countLabel;

          group.appendChild(
            count
          );
        }

        nodeFragment.appendChild(
          group
        );

        group.addEventListener(
          'pointerenter',
          () => {
            this.hovered =
              node.id;

            this._renderStyles();
          }
        );

        group.addEventListener(
          'pointerleave',
          () => {
            if (
              this.hovered ===
              node.id
            ) {
              this.hovered = '';
              this._renderStyles();
            }
          }
        );

        group.addEventListener(
          'focus',
          () => {
            this.hovered =
              node.id;

            this._renderStyles();
          }
        );

        group.addEventListener(
          'blur',
          () => {
            if (
              this.hovered ===
              node.id
            ) {
              this.hovered = '';
              this._renderStyles();
            }
          }
        );

        group.addEventListener(
          'pointerdown',
          event =>
            this._beginNodeInteraction(
              event,
              node
            )
        );

        group.addEventListener(
          'contextmenu',
          event => {
            if (
              !this.options
                .onNodeContextMenu
            ) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();

            this.options
              .onNodeContextMenu(
                node,
                event,
                this
              );
          }
        );

        group.addEventListener(
          'keydown',
          event => {
            if (
              (
                event.key === 'Enter' ||
                event.key === ' '
              ) &&
              this.options
                .shouldNodeOpenOnClick(
                  node
                )
            ) {
              event.preventDefault();

              this._activateNode(
                node,
                event
              );
            }
          }
        );

        return group;
      });
    this.gNodes.appendChild(nodeFragment);

    this._renderStyles();
    cancelAnimationFrame(this.labelFrame);
    this.labelFrame = requestAnimationFrame(() => {
      this.labelFrame = requestAnimationFrame(() => {
        this.labelFrame = 0;
        this._refreshNodeLabelMarquees();
      });
    });
    this._performance.buildMs = performance.now() - buildStartedAt;
  }

  _refreshNodeLabelMarquees() {
    const marqueeStartedAt = performance.now();
    const reduced = this.options.reduceMotion?.() === true;
    this.gNodes.querySelectorAll('.graph-engine-label[data-marquee-width]').forEach(text => {
      text.querySelector('animate')?.remove();
      text.classList.remove('is-overflowing');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('x', '0');
      if (reduced) return;

      const width = Number(text.dataset.marqueeWidth) || 0;
      const measureKey = `${text.textContent}\u0000${width}`;
      let contentWidth = this._labelWidthCache.get(measureKey);
      if (!Number.isFinite(contentWidth)) {
        try { contentWidth = text.getComputedTextLength(); }
        catch (_) { return; }
        this._labelWidthCache.set(measureKey, contentWidth);
      }
      if (!(contentWidth > width + 1)) return;

      const start = -width / 2;
      const end = start - (contentWidth - width);
      const duration = Math.max(7, Math.min(18, 4 + (contentWidth - width) / 18));
      const animation = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      text.classList.add('is-overflowing');
      text.setAttribute('text-anchor', 'start');
      text.setAttribute('x', String(start));
      animation.setAttribute('attributeName', 'x');
      animation.setAttribute('values', `${start};${start};${end};${end};${start}`);
      animation.setAttribute('keyTimes', '0;0.14;0.58;0.72;1');
      animation.setAttribute('dur', `${duration.toFixed(2)}s`);
      animation.setAttribute('begin', '0.8s');
      animation.setAttribute('repeatCount', 'indefinite');
      text.appendChild(animation);
    });
    this._performance.marqueeMs = performance.now() - marqueeStartedAt;
  }

  _renderStyles() {
    const focus =
      this.hovered ||
      this.selected;

    const related =
      this._connectedIds(
        focus
      );

    this.links.forEach(
      (link, i) => {
        const active =
          !!focus &&
          (
            link.source === focus ||
            link.target === focus
          );

        const muted =
          !!related &&
          !active;

        this.linkEls[i]
          ?.setAttribute(
            'class',
            `graph-engine-link${link.kind ? ` kind-${this._safeClass(link.kind)}` : ''}${
              active
                ? ' active'
                : muted
                  ? ' muted'
                  : ''
            }`
          );
      }
    );

    this.nodes.forEach(
      (node, i) => {
        const focused =
          focus === node.id;

        const muted =
          !!related &&
          !related.has(node.id);

        const selected =
          this.selected === node.id;

        const playing =
          !!this.options
            .isNodePlaying(
              node,
              this
            );

        this.nodeEls[i]
          ?.setAttribute(
            'class',
            `graph-engine-node role-${this._safeClass(this._role(node))}` +
            `${focused ? ' focused' : ''}` +
            `${muted ? ' muted' : ''}` +
            `${selected ? ' selected' : ''}` +
            `${playing ? ' playing' : ''}`
          );

        this.nodeEls[i]
          ?.setAttribute(
            'aria-pressed',
            String(selected)
          );

        this.nodeEls[i]
          ?.setAttribute(
            'aria-current',
            String(playing)
          );
      }
    );
  }

  _renderPositions() {
    this.links.forEach(
      (link, i) => {
        const A =
          this.byId.get(
            link.source
          );

        const B =
          this.byId.get(
            link.target
          );

        const el =
          this.linkEls[i];

        if (
          !A ||
          !B ||
          !el
        ) {
          return;
        }

        const x1 = A.x.toFixed(2);
        const y1 = A.y.toFixed(2);
        const x2 = B.x.toFixed(2);
        const y2 = B.y.toFixed(2);
        const signature = `${x1},${y1},${x2},${y2}`;
        if (el._graphPosition !== signature) {
          el._graphPosition = signature;
          el.setAttribute('x1', x1);
          el.setAttribute('y1', y1);
          el.setAttribute('x2', x2);
          el.setAttribute('y2', y2);
        }
      }
    );

    this.nodes.forEach(
      (node, i) => {
      const el = this.nodeEls[i];
      if (!el) return;
      const transform = `translate(${node.x.toFixed(2)}px, ${node.y.toFixed(2)}px)`;
      if (el._graphPosition !== transform) {
        el._graphPosition = transform;
        el.style.transform = transform;
      }
      }
    );
  }

  // ---------------------------------------------------------------------------
  // CAMERA
  // ---------------------------------------------------------------------------

  applyCamera() {
    const cameraValid =
      Number.isFinite(this.camera?.x) &&
      Number.isFinite(this.camera?.y) &&
      Number.isFinite(this.camera?.scale) &&
      this.camera.scale > 0;

    const targetValid =
      Number.isFinite(this.zoomTarget?.x) &&
      Number.isFinite(this.zoomTarget?.y) &&
      Number.isFinite(this.zoomTarget?.scale) &&
      this.zoomTarget.scale > 0;

    if (!cameraValid) {
      this.camera = targetValid
        ? { ...this.zoomTarget }
        : { x: 0, y: 0, scale: this.options.initialZoom };
    }

    if (!targetValid) {
      this.zoomTarget = { ...this.camera };
      this.cameraFollow = null;
    }

    const transform = `translate(${this.camera.x}px, ${this.camera.y}px) scale(${this.camera.scale})`;
    [this.linkWorld, this.world].filter(Boolean).forEach(layer => {
      if (layer._graphCamera === transform) return;
      layer._graphCamera = transform;
      layer.style.transform = transform;
    });
  }

  _targetForNode(
    nodeId,
    {
      scale = this.zoomTarget.scale
    } = {}
  ) {
    const node =
      this.byId.get(
        nodeId
      );

    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return null;

    const vp =
      this.getVisibleViewport();

    return {
      x:
        vp.centerX -
        node.x * scale,

      y:
        vp.centerY -
        node.y * scale,

      scale,
    };
  }

  _initialCameraTarget() {
    const roots =
      this.nodes.filter(
        n =>
          this._role(n) ===
          'root'
      );

    if (roots.length === 1) {
      const target = this._targetForNode(
        roots[0].id,
        {
          scale:
            this.options
              .initialZoom
        }
      );

      if (target) return target;
    }

    return {
      x: 0,
      y: 0,
      scale:
        this.options.initialZoom
    };
  }

  _refreshFollowTarget() {
    if (!this.cameraFollow) {
      return;
    }

    if (
      performance.now() >
      this.cameraFollow.until
    ) {
      this.cameraFollow = null;
      return;
    }

    const target =
      this._targetForNode(
        this.cameraFollow.nodeId,
        {
          scale:
            this.zoomTarget.scale
        }
      );

    if (target) {
      this.zoomTarget =
        target;
    }
  }

  _startSmoothCamera() {
    if (this.zoomFrame) {
      return;
    }

    this.zoomLastTime = performance.now();

    const animate =
      time => {
        const wheelZoomed = this._consumeWheelZoom(performance.now());
        const finishingWheel = !wheelZoomed && this.wheelSettlePending;
        this._refreshFollowTarget();

        const previous =
          this.zoomLastTime ||
          time;

        const dt = Math.min(
          32,
          Math.max(
            0,
            time - previous
          )
        );

        this.zoomLastTime =
          time;

        const timedEase =
          1 -
          Math.exp(
            -dt /
            this.options
              .cameraEaseMs
          );

        const ease = finishingWheel
          ? 1
          : wheelZoomed
            ? Math.max(timedEase, this.options.wheelResponse)
            : timedEase;

        const cameraStartedAt = performance.now();
        this._moveCameraTowardTarget(ease);
        const cameraMs = performance.now() - cameraStartedAt;

        if (wheelZoomed || finishingWheel) {
          this._recordZoomFrame(time, cameraMs);
        }

        if (wheelZoomed) {
          this.wheelSettlePending = true;
        } else if (finishingWheel) {
          this.wheelSettlePending = false;
          if (this._performance && this.wheelInteractionStartedAt) {
            const settleMs = Math.max(
              0,
              performance.now() - this.wheelInteractionStartedAt
            );
            this._performance.zoomSettleMs = settleMs;
            this._capturePerformanceMetric('zoomSettleMs', settleMs);
          }
          this.wheelInteractionStartedAt = 0;
          this.wheelLastFrameAt = 0;
        }

        const settled =
          Math.abs(
            this.camera.x -
            this.zoomTarget.x
          ) < 0.02 &&

          Math.abs(
            this.camera.y -
            this.zoomTarget.y
          ) < 0.02 &&

          Math.abs(
            this.camera.scale -
            this.zoomTarget.scale
          ) < 0.00015 &&

          this.wheelDelta === 0;

        if (
          settled &&
          !this.cameraFollow
        ) {
          this.camera = {
            ...this.zoomTarget
          };

          this.applyCamera();

          this.zoomFrame = 0;
          this.zoomLastTime = 0;

          return;
        }

        this.zoomFrame =
          requestAnimationFrame(
            animate
          );
      };

    this.zoomFrame =
      requestAnimationFrame(
        animate
      );
  }

  _moveCameraTowardTarget(ease) {
    const amount = this._clamp(Number(ease) || 0, 0, 1);
    this.camera = {
      x: this.camera.x + (this.zoomTarget.x - this.camera.x) * amount,
      y: this.camera.y + (this.zoomTarget.y - this.camera.y) * amount,
      scale: this.camera.scale + (this.zoomTarget.scale - this.camera.scale) * amount,
    };
    this.applyCamera();
  }

  _queueWheelZoom(deltaY, clientX, clientY) {
    const delta = Number(deltaY);
    if (!Number.isFinite(delta) || delta === 0) return;
    const queuedAt = performance.now();
    if (!this.wheelDelta) this.wheelQueuedAt = queuedAt;
    if (!this.wheelInteractionStartedAt) this.wheelInteractionStartedAt = queuedAt;
    const renderHoldMs = Math.max(0, Number(this.options.wheelRenderHoldMs) || 0);
    this.wheelRenderHoldUntil = Math.max(
      this.wheelRenderHoldUntil,
      queuedAt + renderHoldMs
    );
    this.wheelDelta += delta;
    this.wheelClientX = clientX;
    this.wheelClientY = clientY;

    this._startSmoothCamera();
  }

  _consumeWheelZoom(frameTime = performance.now()) {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;
    if (this.dragging || !delta) return false;

    if (this._performance && this.wheelQueuedAt) {
      const latency = Math.max(0, frameTime - this.wheelQueuedAt);
      this._performance.zoomLatencyMs = this._blendMetric(
        this._performance.zoomLatencyMs,
        latency,
        0.2
      );
      this._capturePerformanceMetric('zoomLatencyMs', latency);
    }
    this.wheelQueuedAt = 0;

    /* A roda e a câmera compartilham o mesmo frame. Assim cada quadro recebe
       no máximo uma transformação, mesmo durante uma sequência de scroll. */
    const origin = this.hostOrigin || this.host.getBoundingClientRect();
    this.cameraFollow = null;
    return this._updateZoomTarget(
      Math.exp(-delta * 0.0010),
      {
        x: this.wheelClientX - origin.left,
        y: this.wheelClientY - origin.top
      }
    );
  }

  _recordZoomFrame(frameTime, cameraMs) {
    if (!this._performance) return;
    if (this.wheelLastFrameAt) {
      const interval = Math.max(0, frameTime - this.wheelLastFrameAt);
      this._performance.zoomFrameMs = this._blendMetric(
        this._performance.zoomFrameMs,
        interval,
        0.2
      );
      this._capturePerformanceMetric('zoomFrameMs', interval);
      if (interval > 25) this._performance.zoomDroppedFrames++;
    }
    this.wheelLastFrameAt = frameTime;
    this._performance.zoomCameraMs = this._blendMetric(
      this._performance.zoomCameraMs,
      Math.max(0, cameraMs),
      0.2
    );
    this._capturePerformanceMetric('zoomCameraMs', Math.max(0, cameraMs));
  }

  // ---------------------------------------------------------------------------
  // INTERACTION
  // ---------------------------------------------------------------------------

  _bindEvents() {
    this._abortController =
      new AbortController();

    const signal =
      this._abortController
        .signal;

    this.controls
      ?.addEventListener(
        'click',
        event => {
          const button =
            event.target.closest(
              '[data-graph-control]'
            );

          if (!button) return;

          const action =
            button.dataset
              .graphControl;

          if (
            action === 'zoom-in'
          ) {
            this.zoomBy(
              1.22
            );
          }

          if (
            action === 'zoom-out'
          ) {
            this.zoomBy(
              0.82
            );
          }

          if (
            action === 'reset'
          ) {
            this.resetView();
          }
        },
        {
          signal
        }
      );

    this.svg.addEventListener(
      'pointerdown',
      event => {
        if (
          event.button !== 0 ||
          event.isPrimary === false ||
          this.dragging ||
          event.target.closest(
            '.graph-engine-node'
          )
        ) {
          return;
        }

        this.stopCameraAnimation();

        this.dragging = {
          type: 'pan',
          id: event.pointerId,

          startX:
            event.clientX,

          startY:
            event.clientY,

          cx:
            this.camera.x,

          cy:
            this.camera.y,
        };

        try {
          this.svg.setPointerCapture(
            event.pointerId
          );
        } catch (_) {
          this.dragging = null;
        }
      },
      {
        signal
      }
    );

    this.svg.addEventListener(
      'pointermove',
      event =>
        this._pointerMove(
          event
        ),
      {
        signal
      }
    );

    this.svg.addEventListener(
      'pointerup',
      event =>
        this._endInteraction(
          event
        ),
      {
        signal
      }
    );

    this.svg.addEventListener(
      'pointercancel',
      event =>
        this._endInteraction(
          event
        ),
      {
        signal
      }
    );

    this.svg.addEventListener(
      'lostpointercapture',
      event => {
        if (this.dragging?.id === event.pointerId) this.cancelInteraction();
      },
      {
        signal
      }
    );

    window.addEventListener(
      'blur',
      () => this.cancelInteraction(),
      { signal }
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.cancelInteraction();
      },
      { signal }
    );

    this.host.addEventListener(
      'wheel',
      event => {
        if (this.dragging) return;
        if (
          this.options
            .shouldIgnoreWheel?.(
              event
            )
        ) {
          return;
        }

        event.preventDefault();

        this._queueWheelZoom(
          event.deltaY,
          event.clientX,
          event.clientY
        );
      },
      {
        passive: false,
        signal
      }
    );
  }

  _beginNodeInteraction(
    event,
    node
  ) {
    if (
      event.button !== 0 ||
      event.isPrimary === false ||
      this.dragging
    ) {
      return;
    }

    /* Um gesto manual sempre assume o controle. Sem cancelar o follow aqui,
       a câmera continua perseguindo o nó enquanto ele é arrastado e os dois
       movimentos parecem se anular. Isto não altera a simulação física. */
    this.stopCameraAnimation();

    event.stopPropagation();

    this.dragging = {
      type: 'node-pending',
      node,
      id: event.pointerId,

      startX:
        event.clientX,

      startY:
        event.clientY,

      captureTarget:
        this.svg,
    };

    try {
      this.svg.setPointerCapture(
        event.pointerId
      );
    } catch (_) {
      this.dragging = null;
    }
  }

  _pointerMove(event) {
    if (
      !this.dragging ||
      this.dragging.id !==
        event.pointerId
    ) {
      return;
    }

    if (
      this.dragging.type ===
      'pan'
    ) {
      this.camera.x =
        this.dragging.cx +
        event.clientX -
        this.dragging.startX;

      this.camera.y =
        this.dragging.cy +
        event.clientY -
        this.dragging.startY;

      this.zoomTarget = {
        ...this.camera
      };

      this.applyCamera();

      return;
    }

    if (
      this.dragging.type ===
      'node-pending'
    ) {
      const distance =
        Math.hypot(
          event.clientX -
          this.dragging.startX,

          event.clientY -
          this.dragging.startY
        );

      if (
        distance <
        this.options
          .dragThreshold
      ) {
        return;
      }

      this.dragging.type =
        'node';

      delete this.dragging.node._graphDragRecovery;

      const point =
        this._graphPoint(
          event
        );

      const node =
        this.dragging.node;

      node.fx =
        point.x;

      node.fy =
        point.y;

      node.x =
        point.x;

      node.y =
        point.y;

      this.alpha =
        Math.max(
          this.alpha,
          0.75
        );

      return;
    }

    if (
      this.dragging.type ===
      'node'
    ) {
      const point =
        this._graphPoint(
          event
        );

      const node =
        this.dragging.node;

      node.fx =
        point.x;

      node.fy =
        point.y;

      node.x =
        point.x;

      node.y =
        point.y;

      this.alpha =
        Math.max(
          this.alpha,
          0.65
        );
    }
  }

  _endInteraction(event) {
    if (
      !this.dragging ||
      this.dragging.id !==
        event.pointerId
    ) {
      return;
    }

    const interaction =
      this.dragging;

    if (
      interaction.type ===
      'node'
    ) {
      this._releaseDraggedNode(interaction.node);

    } else if (
      interaction.type ===
        'node-pending' &&
      event.type ===
        'pointerup'
    ) {
      if (
        this.options
          .shouldNodeOpenOnClick(
            interaction.node
          )
      ) {
        this._activateNode(
          interaction.node,
          event
        );
      }
    }

    this.dragging = null;

    if (
      this.svg
        .hasPointerCapture(
          event.pointerId
        )
    ) {
      try {
        this.svg
          .releasePointerCapture(
            event.pointerId
          );
      } catch (_) { /* captura já encerrada */ }
    }

    this._flushPendingData();
  }

  _releaseDraggedNode(node) {
    node.fx = null;
    node.fy = null;

    if (this._role(node) !== 'category') {
      this.alpha = Math.max(this.alpha, 0.35);
      return;
    }

    node._graphDragRecovery = {
      stableFrames: 0,
      until: performance.now() + this.options.categoryRecoveryTimeoutMs,
    };

    /* O arraste mantém a simulação aquecida em 0.65. Reduzir esse pico ao
       soltar impede que todas as molas ligadas à categoria disparem juntas. */
    this.alpha = Math.max(
      this.options.restingAlpha,
      Math.min(this.alpha, this.options.categoryReleaseAlpha)
    );
  }

  _activateNode(
    node,
    event
  ) {
    this.setSelected(
      node.id
    );

    this.options
      .onNodeClick?.(
        node,
        event,
        this
      );
  }

  _graphPoint(event) {
    const rect =
      this.host
        .getBoundingClientRect();

    return {
      x:
        (
          event.clientX -
          rect.left -
          this.camera.x
        ) /
        this.camera.scale,

      y:
        (
          event.clientY -
          rect.top -
          this.camera.y
        ) /
        this.camera.scale,
    };
  }

  // ---------------------------------------------------------------------------
  // PHYSICS
  // valores preservados da engine de origem
  // ---------------------------------------------------------------------------

  _buildCollisionGrid() {
    let cellSize = this._collisionCellSize;
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      const fallbackRadius = this.nodes.reduce(
        (largest, node) => Math.max(largest, Number(node._graphPhysics?.radius) || 0),
        0
      );
      cellSize = Math.max(1, fallbackRadius * 2 + 44);
    }
    const cells = new Map();

    this.nodes.forEach((node, index) => {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
      const cellX = Math.floor(node.x / cellSize);
      const cellY = Math.floor(node.y / cellSize);
      const key = `${cellX}:${cellY}`;
      const bucket = cells.get(key);
      if (bucket) bucket.push(index);
      else cells.set(key, [index]);
    });

    return { cells, cellSize };
  }

  _collisionCandidateIndices(index, grid) {
    const node = this.nodes[index];
    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      return this.nodes.slice(index + 1).map((_, offset) => index + offset + 1);
    }

    const cellX = Math.floor(node.x / grid.cellSize);
    const cellY = Math.floor(node.y / grid.cellSize);
    const candidates = [];

    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        const bucket = grid.cells.get(`${cellX + offsetX}:${cellY + offsetY}`);
        if (!bucket) continue;
        for (const candidate of bucket) {
          if (candidate > index) candidates.push(candidate);
        }
      }
    }

    /* A grade apenas elimina pares geometricamente impossíveis. Ordenar pelo
       índice conserva a mesma sequência i/j usada pela colisão original. */
    candidates.sort((a, b) => a - b);
    return candidates;
  }

  _tick() {
    const tickStartedAt = performance.now();
    let physicsMs = 0;
    let renderMs = 0;
    if (
      this.nodes.length
    ) {
      const recoveringCategory = this.nodes.some((node) => {
        const recovery = node._graphDragRecovery;
        if (!recovery) return false;
        if (tickStartedAt < recovery.until) {
          recovery.maxChildError = 0;
          return true;
        }
        delete node._graphDragRecovery;
        return false;
      });

      const a =
        Math.max(
          this.options
            .restingAlpha,
          recoveringCategory
            ? this.options.categoryRecoveryAlpha
            : 0,
          this.alpha
        );

      // -----------------------------------------------------------------------
      // MANY-BODY / REPULSÃO
      // -----------------------------------------------------------------------

      for (
        let i = 0;
        i < this.nodes.length;
        i++
      ) {
        for (
          let j = i + 1;
          j < this.nodes.length;
          j++
        ) {
          const A =
            this.nodes[i];

          const B =
            this.nodes[j];

          const dx =
            B.x - A.x;

          const dy =
            B.y - A.y;

          const d2 =
            Math.max(
              100,
              dx * dx +
              dy * dy
            );

          const d =
            Math.sqrt(d2);

          const ua = A._graphPhysics.charge;

          const ub = B._graphPhysics.charge;

          const force =
            (
              (
                ua + ub
              ) *
              1.15 /
              d2
            ) *
            a;

          const fx =
            dx / d *
            force;

          const fy =
            dy / d *
            force;

          if (
            A.fx == null
          ) {
            A.vx -= fx;
            A.vy -= fy;
          }

          if (
            B.fx == null
          ) {
            B.vx += fx;
            B.vy += fy;
          }
        }
      }

      // -----------------------------------------------------------------------
      // LINK ATTRACTION / MOLAS
      // -----------------------------------------------------------------------

      for (
        const link
        of this.links
      ) {
        if (link.physics === false) continue;

        const A =
          this.byId.get(
            link.source
          );

        const B =
          this.byId.get(
            link.target
          );

        if (
          !A ||
          !B
        ) {
          continue;
        }

        const dx =
          B.x - A.x;

        const dy =
          B.y - A.y;

        const d =
          Math.max(
            1,
            Math.hypot(
              dx,
              dy
            )
          );

        const target = link._graphPhysics.distance;

        const strength = link._graphPhysics.strength;

        const returningCategory = A._graphDragRecovery
          ? A
          : B._graphDragRecovery
            ? B
            : null;
        const otherNode = returningCategory === A
          ? B
          : returningCategory === B
            ? A
            : null;

        if (
          returningCategory &&
          otherNode?._graphPhysics?.role === 'root'
        ) {
          returningCategory._graphDragRecovery.parentError = d - target;
          returningCategory._graphDragRecovery.childInfluence = this._clamp(
            1 - Math.abs(d - target) / this.options.categoryRecoveryBlendDistance,
            this.options.categoryRecoveryChildMinInfluence,
            1
          );
        } else if (
          returningCategory &&
          otherNode?._graphPhysics?.role === 'track'
        ) {
          returningCategory._graphDragRecovery.maxChildError = Math.max(
            returningCategory._graphDragRecovery.maxChildError || 0,
            Math.abs(d - target)
          );
        }

        const force =
          (
            d - target
          ) *
          strength *
          0.065 *
          a;

        const fx =
          dx / d *
          force;

        const fy =
          dy / d *
          force;

        const recoveryScaleA =
          A._graphDragRecovery &&
          B._graphPhysics.role === 'track'
            ? A._graphDragRecovery.childInfluence ??
              this.options.categoryRecoveryChildMinInfluence
            : 1;
        const recoveryScaleB =
          B._graphDragRecovery &&
          A._graphPhysics.role === 'track'
            ? B._graphDragRecovery.childInfluence ??
              this.options.categoryRecoveryChildMinInfluence
            : 1;

        if (
          A.fx == null
        ) {
          A.vx += fx * recoveryScaleA;
          A.vy += fy * recoveryScaleA;
        }

        if (
          B.fx == null
        ) {
          B.vx -= fx * recoveryScaleB;
          B.vy -= fy * recoveryScaleB;
        }
      }

      // -----------------------------------------------------------------------
      // ATRAÇÃO AO CENTRO
      // -----------------------------------------------------------------------

      for (
        const node
        of this.nodes
      ) {
        if (
          node.fx != null
        ) {
          node.x =
            node.fx;

          node.y =
            node.fy;

          node.vx = 0;
          node.vy = 0;

          continue;
        }

        const {
          centerX: sx,
          centerY: sy
        } = node._graphPhysics;

        node.vx +=
          (
            this.W / 2 -
            node.x
          ) *
          sx *
          0.006 *
          a;

        node.vy +=
          (
            this.H / 2 -
            node.y
          ) *
          sy *
          0.006 *
          a;
      }

      // -----------------------------------------------------------------------
      // COLISÃO
      // -----------------------------------------------------------------------

      const collisionGrid =
        this._buildCollisionGrid();

      for (
        let i = 0;
        i < this.nodes.length;
        i++
      ) {
        const collisionCandidates =
          this._collisionCandidateIndices(
            i,
            collisionGrid
          );

        for (
          const j
          of collisionCandidates
        ) {
          const A =
            this.nodes[i];

          const B =
            this.nodes[j];

          const dx =
            B.x - A.x;

          const dy =
            B.y - A.y;

          const min =
            A._graphPhysics.radius +
            B._graphPhysics.radius +
            44;

          /* Se a separação em qualquer eixo já alcança a distância mínima,
             o par não pode colidir. Pares candidatos continuam usando a
             mesma distância euclidiana e o mesmo impulso da física original. */
          if (
            Math.abs(dx) >= min ||
            Math.abs(dy) >= min
          ) {
            continue;
          }

          const d =
            Math.max(
              0.001,
              Math.hypot(
                dx,
                dy
              )
            );

          if (
            d < min
          ) {
            const overlap =
              (
                min - d
              ) /
              d *
              0.055 *
              a;

            const fx =
              dx *
              overlap;

            const fy =
              dy *
              overlap;

            if (
              A.fx == null
            ) {
              A.vx -= fx;
              A.vy -= fy;
            }

            if (
              B.fx == null
            ) {
              B.vx += fx;
              B.vy += fy;
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // MOVIMENTO CONTÍNUO
      // -----------------------------------------------------------------------

      const now =
        performance.now();

      this.nodes.forEach(
        (
          node,
          index
        ) => {
          if (
            node.fx != null
          ) {
            return;
          }

          const phase = node._graphPhysics.phase;

          const multiplier = node._graphPhysics.floatMultiplier;

          node.vx +=
            Math.sin(
              now *
              this.options
                .floatSpeed +
              phase *
              2.17
            ) *
            this.options
              .floatForce *
            multiplier;

          node.vy +=
            Math.cos(
              now *
              this.options
                .floatSpeed *
              0.83 +
              phase *
              1.73
            ) *
            this.options
              .floatForce *
            multiplier;

          // velocityDecay equivalente a ~0.40
          node.vx *= 0.60;
          node.vy *= 0.60;

          const recovery = node._graphDragRecovery;
          if (recovery) {
            const speed = Math.hypot(node.vx, node.vy);
            const parentSettled =
              Number.isFinite(recovery.parentError) &&
              Math.abs(recovery.parentError) <=
                this.options.categoryRecoveryParentTolerance;
            const linkedTracksSettled =
              recovery.maxChildError <=
                this.options.categoryRecoveryLinkTolerance;
            const speedSettled =
              speed <=
                this.options.categoryRecoverySpeedTolerance;

            recovery.stableFrames =
              parentSettled && linkedTracksSettled && speedSettled
                ? recovery.stableFrames + 1
                : 0;

            if (
              recovery.stableFrames >= this.options.categoryRecoveryStableFrames ||
              now >= recovery.until
            ) {
              delete node._graphDragRecovery;
            }
          }

          node.x +=
            node.vx;

          node.y +=
            node.vy;
        }
      );

      this.alpha +=
        (
          this.options
            .restingAlpha -
          this.alpha
        ) *
        0.055;

      physicsMs = performance.now() - tickStartedAt;
      const cameraOnlyFrame = this._shouldDeferPositionRender(tickStartedAt);
      if (cameraOnlyFrame) {
        this._performance.zoomDeferredRenders++;
        if (this._performanceCapture) this._performanceCapture.deferredRenders++;
      } else {
        const renderStartedAt = performance.now();
        this._renderPositions();
        renderMs = performance.now() - renderStartedAt;
      }
    }

    const measuredAt = performance.now();
    const blend = (previous, current) => previous
      ? previous * 0.90 + current * 0.10
      : current;
    this._performance.physicsMs = blend(this._performance.physicsMs, physicsMs);
    this._performance.renderMs = blend(this._performance.renderMs, renderMs);
    this._recordPerformanceCaptureFrame(measuredAt, physicsMs, renderMs);
    this._performance.sampleFrames++;
    const sampleElapsed = measuredAt - this._performance.sampleStartedAt;
    if (sampleElapsed >= 500) {
      this._performance.fps = Math.round(this._performance.sampleFrames * 1000 / sampleElapsed);
      this._performance.sampleFrames = 0;
      this._performance.sampleStartedAt = measuredAt;
    }

    if (this.running) {
      this.raf =
        requestAnimationFrame(
          this._tick
        );
    } else {
      this.raf = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // INTERNAL HELPERS
  // ---------------------------------------------------------------------------

  _capturePerformanceMetric(name, value) {
    const capture = this._performanceCapture;
    if (!capture || !Array.isArray(capture[name]) || !Number.isFinite(value)) return;
    capture[name].push(Math.max(0, value));
  }

  _shouldDeferPositionRender(frameTime = performance.now()) {
    return frameTime < this.wheelRenderHoldUntil && this.dragging?.type !== 'node';
  }

  _recordPerformanceCaptureFrame(frameTime, physicsMs, renderMs) {
    const capture = this._performanceCapture;
    if (!capture) return;
    if (capture.lastFrameAt) {
      const interval = frameTime - capture.lastFrameAt;
      if (Number.isFinite(interval) && interval >= 0) capture.frameMs.push(interval);
    }
    capture.lastFrameAt = frameTime;
    if (Number.isFinite(physicsMs)) capture.physicsMs.push(Math.max(0, physicsMs));
    if (Number.isFinite(renderMs)) capture.renderMs.push(Math.max(0, renderMs));
  }

  _performanceMetricSummary(values = []) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return { samples: 0, average: 0, p95: 0, max: 0 };
    const total = sorted.reduce((sum, value) => sum + value, 0);
    const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return {
      samples: sorted.length,
      average: total / sorted.length,
      p95: sorted[p95Index],
      max: sorted[sorted.length - 1],
    };
  }

  _finishPerformanceCapture({ cancelled = false } = {}) {
    const capture = this._performanceCapture;
    if (!capture) return null;
    this._performanceCapture = null;
    clearTimeout(capture.timer);

    const endedAt = performance.now();
    const elapsedMs = Math.max(0, endedAt - capture.startedAt);
    const frame = this._performanceMetricSummary(capture.frameMs);
    const sortedFrames = capture.frameMs
      .filter(value => Number.isFinite(value) && value > 1 && value < 100)
      .sort((a, b) => a - b);
    const medianFrameMs = sortedFrames.length
      ? sortedFrames[Math.floor(sortedFrames.length / 2)]
      : 0;
    const refreshHz = medianFrameMs > 0 ? Math.round(1000 / medianFrameMs) : 0;
    const lateThresholdMs = medianFrameMs > 0 ? medianFrameMs * 1.5 : 25;
    const lateFrames = capture.frameMs.filter(value => value > lateThresholdMs).length;
    const report = {
      version: 1,
      cancelled: Boolean(cancelled),
      capturedAt: new Date().toISOString(),
      durationMs: elapsedMs,
      nodes: this.nodes.length,
      links: this.links.length,
      viewport: {
        width: this.W,
        height: this.H,
        pixelRatio: Number(globalThis.devicePixelRatio) || 1,
      },
      refreshHz,
      frameBudgetMs: medianFrameMs,
      fps: elapsedMs > 0 ? capture.frameMs.length * 1000 / elapsedMs : 0,
      lateFrames,
      lateFramePercent: capture.frameMs.length
        ? lateFrames * 100 / capture.frameMs.length
        : 0,
      frame,
      physics: this._performanceMetricSummary(capture.physicsMs),
      render: this._performanceMetricSummary(capture.renderMs),
      zoom: {
        latency: this._performanceMetricSummary(capture.zoomLatencyMs),
        frame: this._performanceMetricSummary(capture.zoomFrameMs),
        camera: this._performanceMetricSummary(capture.zoomCameraMs),
        settle: this._performanceMetricSummary(capture.zoomSettleMs),
        deferredRenders: capture.deferredRenders,
      },
    };

    capture.resolve(report);
    return report;
  }

  _flushPendingData() {
    if (this.dragging || !this._pendingData) return;
    const pending = this._pendingData;
    this._pendingData = null;
    this.setData(pending);
  }

  _graphDataSignature(data) {
    return JSON.stringify(data);
  }

  _reindex() {
    this.byId =
      new Map(
        this.nodes.map(
          n => [
            n.id,
            n
          ]
        )
      );

    this.degree =
      Object.fromEntries(
        this.nodes.map(
          n => [
            n.id,
            0
          ]
        )
      );

    for (
      const link
      of this.links
    ) {
      if (link.physics === false) continue;

      if (
        this.degree[
          link.source
        ] !== undefined
      ) {
        this.degree[
          link.source
        ]++;
      }

      if (
        this.degree[
          link.target
        ] !== undefined
      ) {
        this.degree[
          link.target
        ]++;
      }
    }

    for (
      const node
      of this.nodes
    ) {
      node.degree =
        this.degree[
          node.id
        ] || 0;

      node.vx ??= 0;
      node.vy ??= 0;
    }

    this.nodes.forEach((node, index) => {
      const role = this._role(node);
      const center = this._centerStrength(node);
      node._graphPhysics = {
        role,
        radius: this._radius(node),
        charge: this._charge(node),
        centerX: center.x,
        centerY: center.y,
        phase: index * 1.61803398875,
        floatMultiplier: role === 'root' ? 0.25 : role === 'category' ? 0.65 : 1,
      };
    });

    const largestCollisionRadius = this.nodes.reduce(
      (largest, node) => Math.max(largest, node._graphPhysics.radius),
      0
    );
    this._collisionCellSize = Math.max(1, largestCollisionRadius * 2 + 44);

    this.links.forEach(link => {
      if (link.physics === false) {
        link._graphPhysics = null;
        return;
      }
      const source = this.byId.get(link.source);
      const target = this.byId.get(link.target);
      if (!source || !target) {
        link._graphPhysics = null;
        return;
      }
      link._graphPhysics = {
        distance: this.options.getLinkDistance(link, source, target),
        strength: this.options.getLinkStrength(link, source, target),
      };
    });
  }

  _initializeNodePositions(
    oldPositions =
      new Map()
  ) {
    const canPlace = this.W > 0 && this.H > 0;
    let placed = false;
    const root = this.nodes.find(node => this._role(node) === 'root') || null;
    const categories = this.nodes.filter(node => this._role(node) === 'category');
    const tracks = this.nodes.filter(node => this._role(node) !== 'root' && this._role(node) !== 'category');
    const ringCapacity = Math.max(6, Math.floor(Number(this.options.initialRingCapacity) || 12));
    const minDimension = Math.min(this.W, this.H);
    const centerX = this.W * 0.52;
    const centerY = this.H * 0.50;
    const spawnParent = new Map();
    const spawnDistance = new Map();
    const trackGroups = new Map();
    const trackPlacement = new Map();
    const spawnAnchors = new Map();
    const indexedNodes = this.byId instanceof Map
      ? this.byId
      : new Map(this.nodes.map(node => [node.id, node]));

    /* O mesmo link que governa a mola define o agrupamento e o raio inicial.
       Assim, o primeiro frame já representa a topologia que a física manterá. */
    for (const link of this.links || []) {
      if (link.layout === false) continue;
      const source = indexedNodes.get(link.source);
      const target = indexedNodes.get(link.target);
      if (!source || !target) continue;
      const sourceRole = this._role(source);
      const targetRole = this._role(target);
      let parent = null;
      let child = null;
      if ((sourceRole === 'root' || sourceRole === 'category') && targetRole === 'track') {
        parent = source;
        child = target;
      } else if ((targetRole === 'root' || targetRole === 'category') && sourceRole === 'track') {
        parent = target;
        child = source;
      } else if (sourceRole === 'root' && targetRole === 'category') {
        parent = source;
        child = target;
      } else if (targetRole === 'root' && sourceRole === 'category') {
        parent = target;
        child = source;
      }
      if (!parent || !child) continue;
      spawnParent.set(child.id, parent.id);
      const distance = link._graphPhysics?.distance;
      if (Number.isFinite(distance) && distance > 0) spawnDistance.set(child.id, distance);
    }

    for (const track of tracks) {
      const parentId = spawnParent.get(track.id) || '';
      if (!trackGroups.has(parentId)) trackGroups.set(parentId, []);
      trackGroups.get(parentId).push(track);
    }

    for (const group of trackGroups.values()) {
      group.forEach((track, index) => trackPlacement.set(track.id, { index, count: group.length }));
    }

    const preservedRoot = root ? oldPositions.get(root.id) : null;
    const rootAnchor = preservedRoot && Number.isFinite(preservedRoot.x) && Number.isFinite(preservedRoot.y)
      ? { x: preservedRoot.x, y: preservedRoot.y }
      : { x: centerX, y: centerY };
    if (root) spawnAnchors.set(root.id, rootAnchor);

    const preservedCategoryAngles = [];
    const occupiedPositions = [];
    for (const node of this.nodes) {
      const old = oldPositions.get(node.id);
      if (!old || !Number.isFinite(old.x) || !Number.isFinite(old.y)) continue;
      if (node !== root) occupiedPositions.push({ x: old.x, y: old.y });
      if (this._role(node) !== 'category') continue;
      spawnAnchors.set(node.id, { x: old.x, y: old.y });
      preservedCategoryAngles.push(Math.atan2(old.y - rootAnchor.y, old.x - rootAnchor.x));
    }

    const newCategories = categories.filter(node => !spawnAnchors.has(node.id));
    if (!preservedCategoryAngles.length) {
      newCategories.forEach((node, index) => {
        const angle = -Math.PI / 2 + index / Math.max(1, newCategories.length) * Math.PI * 2;
        const ring = spawnDistance.get(node.id) ?? minDimension * this.options.categorySpawnRadius;
        const anchor = {
          x: rootAnchor.x + Math.cos(angle) * ring,
          y: rootAnchor.y + Math.sin(angle) * ring,
        };
        spawnAnchors.set(node.id, anchor);
        occupiedPositions.push(anchor);
      });
    } else {
      newCategories.forEach(node => {
        const ring = spawnDistance.get(node.id) ?? minDimension * this.options.categorySpawnRadius;
        const angle = this._categorySpawnAngle(
          preservedCategoryAngles,
          rootAnchor,
          ring,
          occupiedPositions
        );
        const anchor = {
          x: rootAnchor.x + Math.cos(angle) * ring,
          y: rootAnchor.y + Math.sin(angle) * ring,
        };
        spawnAnchors.set(node.id, anchor);
        preservedCategoryAngles.push(angle);
        occupiedPositions.push(anchor);
      });
    }

    this.nodes.forEach(
      (
        node,
        i
      ) => {
        const old =
          oldPositions.get(
            node.id
          );

        if (old && Number.isFinite(old.x) && Number.isFinite(old.y)) {
          Object.assign(
            node,
            old,
            {
              initialized:
                true
            }
          );

          return;
        }

        /* Posições preservadas continuam válidas mesmo com o host oculto.
           Nós realmente novos aguardam o próximo resize visível. */
        if (!canPlace) return;

        const role =
          this._role(node);

        let angle = 0;
        let ring = 0;
        if (role === 'category') {
          const anchor = spawnAnchors.get(node.id);
          node.x = anchor?.x ?? centerX;
          node.y = anchor?.y ?? centerY;
        } else if (role !== 'root') {
          const placement = trackPlacement.get(node.id) || { index: 0, count: tracks.length };
          const index = placement.index;
          const ringIndex = Math.floor(index / ringCapacity);
          const ringStart = ringIndex * ringCapacity;
          const ringCount = Math.min(ringCapacity, placement.count - ringStart);
          const slot = index - ringStart;
          const stagger = ringIndex % 2 ? Math.PI / Math.max(1, ringCount) : 0;
          angle = -Math.PI / 2 + slot / Math.max(1, ringCount) * Math.PI * 2 + stagger;
          ring = (spawnDistance.get(node.id) ?? minDimension * this.options.nodeSpawnRadius) +
            ringIndex * minDimension * this.options.nodeRingGap;
        }

        if (role !== 'category') {
          const parentAnchor = spawnAnchors.get(spawnParent.get(node.id)) || { x: centerX, y: centerY };
          node.x =
            role === 'root'
              ? centerX
              : parentAnchor.x +
              Math.cos(
                angle
              ) *
              ring +
              (
                this._seeded(i) -
                0.5
              ) *
              this.options
                .spawnJitter;

          node.y =
            role === 'root'
              ? centerY
              : parentAnchor.y +
              Math.sin(
                angle
              ) *
              ring +
              (
                this._seeded(
                  i + 30
                ) -
                0.5
              ) *
              this.options
                .spawnJitter;
        }

        node.vx = 0;
        node.vy = 0;

        node.initialized =
          true;

        placed = true;
      }
    );

    if (placed || canPlace) this.alpha = 1;
  }

  _connectedIds(id) {
    if (!id) {
      return null;
    }

    const set =
      new Set([
        id
      ]);

    for (
      const link
      of this.links
    ) {
      if (
        link.source === id
      ) {
        set.add(
          link.target
        );
      }

      if (
        link.target === id
      ) {
        set.add(
          link.source
        );
      }
    }

    return set;
  }

  _categorySpawnAngle(angles, root, ring, occupiedPositions = []) {
    const tau = Math.PI * 2;
    const normalized = angles
      .filter(Number.isFinite)
      .map(angle => ((angle % tau) + tau) % tau)
      .sort((a, b) => a - b);
    if (!normalized.length) return -Math.PI / 2;

    let best = null;
    for (let index = 0; index < normalized.length; index++) {
      const start = normalized[index];
      const end = index + 1 < normalized.length
        ? normalized[index + 1]
        : normalized[0] + tau;
      const gap = end - start;
      const angle = start + gap / 2;
      const x = root.x + Math.cos(angle) * ring;
      const y = root.y + Math.sin(angle) * ring;
      const clearance = occupiedPositions.length
        ? occupiedPositions.reduce(
            (nearest, point) => Math.min(nearest, Math.hypot(x - point.x, y - point.y)),
            Infinity
          )
        : gap * ring;

      /* O tamanho angular escolhe o setor estrutural; a folga real desempata
         setores equivalentes para não nascer dentro de um cluster já aberto. */
      if (
        !best ||
        gap > best.gap + 1e-9 ||
        (Math.abs(gap - best.gap) <= 1e-9 && clearance > best.clearance)
      ) {
        best = { angle, gap, clearance };
      }
    }

    return best ? best.angle : -Math.PI / 2;
  }

  _role(node) {
    return (
      this.options
        .getNodeRole(node) ||
      'node'
    );
  }

  _radius(node) {
    if (
      typeof this.options
        .getNodeRadius ===
      'function'
    ) {
      return this.options
        .getNodeRadius(
          node,
          this
        );
    }

    const role =
      this._role(node);

    if (
      role === 'root'
    ) {
      return 14.5;
    }

    if (
      role === 'category'
    ) {
      return 8.6;
    }

    return (
      5.4 +
      Math.min(
        1.6,
        Math.sqrt(
          Math.max(
            1,
            node.degree || 0
          )
        ) *
        0.42
      )
    );
  }

  _charge(node) {
    if (
      typeof this.options
        .getNodeCharge ===
      'function'
    ) {
      return this.options
        .getNodeCharge(
          node,
          this
        );
    }

    const role =
      this._role(node);

    return role === 'root'
      ? 420
      : role === 'category'
        ? 250
        : 175;
  }

  _centerStrength(node) {
    if (
      typeof this.options
        .getCenterStrength ===
      'function'
    ) {
      return this.options
        .getCenterStrength(
          node,
          this
        );
    }

    const role =
      this._role(node);

    if (
      role === 'root'
    ) {
      return {
        x: 0.20,
        y: 0.20
      };
    }

    if (
      role === 'category'
    ) {
      return {
        x: 0.028,
        y: 0.030
      };
    }

    return {
      x: 0.010,
      y: 0.011
    };
  }

  _seeded(i) {
    const x =
      Math.sin(
        i * 999 +
        17
      ) *
      43758.5453;

    return (
      x -
      Math.floor(x)
    );
  }

  _safeClass(value) {
    return String(
      value ||
      'node'
    ).replace(
      /[^a-zA-Z0-9_-]/g,
      '-'
    );
  }

  _blendMetric(previous, current, weight = 0.1) {
    const amount = this._clamp(Number(weight) || 0, 0, 1);
    return previous
      ? previous * (1 - amount) + current * amount
      : current;
  }

  _clamp(
    value,
    min,
    max
  ) {
    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );
  }
}

window.GraphEngine = GraphEngine;
})();
