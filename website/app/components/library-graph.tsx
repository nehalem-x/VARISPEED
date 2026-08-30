'use client';

import { useEffect, useRef, useState } from 'react';

type DemoNode = {
  id: string;
  title: string;
  label: string;
  countLabel: string;
  role: 'root' | 'category' | 'track';
  isCategory?: boolean;
};

type DemoLink = {
  source: string;
  target: string;
  distance: number;
  strength: number;
  kind: string;
};

type GraphInstance = {
  setData(data: { nodes: DemoNode[]; links: DemoLink[] }): void;
  fitGraph(): void;
  focusNode(id: string, options: { scale: number; followDuration: number }): void;
  zoomBy(factor: number, anchor: { x: number; y: number }): void;
  clearSelection(): void;
  resize(): void;
  destroy(): void;
  _resizeObserver?: ResizeObserver;
};

declare global {
  interface Window {
    GraphEngine?: new (options: Record<string, unknown>) => GraphInstance;
  }
}

const nodes: DemoNode[] = [
  { id: 'library', title: 'Biblioteca', label: 'Biblioteca', countLabel: '14 MÚSICAS', role: 'root', isCategory: true },
  { id: 'late', title: 'Depois das duas', label: 'Depois das duas', countLabel: '5 MÚSICAS', role: 'category', isCategory: true },
  { id: 'motion', title: 'Em movimento', label: 'Em movimento', countLabel: '4 MÚSICAS', role: 'category', isCategory: true },
  { id: 'memory', title: 'Memórias', label: 'Memórias', countLabel: '5 MÚSICAS', role: 'category', isCategory: true },
  { id: 'track-01', title: 'Neon sem pressa', label: 'Neon sem pressa', countLabel: '3:42 · 75%', role: 'track' },
  { id: 'track-02', title: 'Cidade em silêncio', label: 'Cidade em silêncio', countLabel: '2:58 · 80%', role: 'track' },
  { id: 'track-03', title: 'Último ônibus', label: 'Último ônibus', countLabel: '4:11 · 70%', role: 'track' },
  { id: 'track-04', title: 'Quarto vazio', label: 'Quarto vazio', countLabel: '2:35 · 85%', role: 'track' },
  { id: 'track-05', title: 'Sem gravidade', label: 'Sem gravidade', countLabel: '3:14 · 110%', role: 'track' },
  { id: 'track-06', title: 'Vértice', label: 'Vértice', countLabel: '2:49 · 125%', role: 'track' },
  { id: 'track-07', title: 'Pulso', label: 'Pulso', countLabel: '3:07 · 100%', role: 'track' },
  { id: 'track-08', title: 'Linha de fuga', label: 'Linha de fuga', countLabel: '4:20 · 115%', role: 'track' },
  { id: 'track-09', title: 'Primeiro arquivo', label: 'Primeiro arquivo', countLabel: '3:51 · 90%', role: 'track' },
  { id: 'track-10', title: 'Fita antiga', label: 'Fita antiga', countLabel: '2:44 · 80%', role: 'track' },
  { id: 'track-11', title: 'Chuva no vidro', label: 'Chuva no vidro', countLabel: '5:03 · 75%', role: 'track' },
  { id: 'track-12', title: 'Domingo', label: 'Domingo', countLabel: '3:28 · 95%', role: 'track' },
  { id: 'track-13', title: 'Rastro', label: 'Rastro', countLabel: '2:56 · 100%', role: 'track' },
  { id: 'track-14', title: 'Voltar diferente', label: 'Voltar diferente', countLabel: '4:08 · 85%', role: 'track' },
];

const membership = (source: string, targets: string[]): DemoLink[] => targets.map((target) => ({
  source,
  target,
  distance: source === 'library' ? 520 : 198,
  strength: source === 'library' ? 0.52 : 0.44,
  kind: source === 'library' ? 'hierarchy' : 'membership',
}));

const links: DemoLink[] = [
  ...membership('library', ['late', 'motion', 'memory']),
  ...membership('late', ['track-01', 'track-02', 'track-03', 'track-04', 'track-13']),
  ...membership('motion', ['track-05', 'track-06', 'track-07', 'track-08']),
  ...membership('memory', ['track-09', 'track-10', 'track-11', 'track-12', 'track-14']),
];

function loadGraphEngine() {
  if (window.GraphEngine) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-varispeed-graph]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GraphEngine indisponível')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = '/graph-engine.js';
    script.dataset.varispeedGraph = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GraphEngine indisponível'));
    document.head.appendChild(script);
  });
}

export function LibraryGraph() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GraphInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedNode, setSelectedNode] = useState<DemoNode | null>(null);

  useEffect(() => {
    let engine: GraphInstance | null = null;
    let disposed = false;
    let resizeFrame = 0;
    const resizeGraph = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => engine?.resize());
    };

    loadGraphEngine().then(() => {
      if (disposed || !hostRef.current || !window.GraphEngine) return;
      engine = new window.GraphEngine({
        host: hostRef.current,
        initialZoom: 0.84,
        minFitZoom: 0.58,
        minZoom: 0.42,
        maxZoom: 2.1,
        compactBreakpoint: 0,
        categorySpawnRadius: 0.46,
        nodeSpawnRadius: 0.28,
        nodeRingGap: 0.13,
        initialRingCapacity: 10,
        spawnJitter: 12,
        nodeLabelMaxWidth: 150,
        getNodeRole: (node: DemoNode) => node.role,
        getNodeLabel: (node: DemoNode) => node.label,
        getNodeCountLabel: (node: DemoNode) => node.countLabel,
        getNodeTitle: (node: DemoNode) => `${node.title} — ${node.countLabel.toLocaleLowerCase('pt-BR')}`,
        shouldNodeOpenOnClick: () => true,
        onSelectionChange: (_nodeId: string | null, node: DemoNode | null) => setSelectedNode(node),
        onNodeClick: (node: DemoNode) => engine?.focusNode(node.id, { scale: 1.24, followDuration: 1800 }),
      });
      engineRef.current = engine;
      // O GraphEngine real observa o host porque a Biblioteca pode abrir e fechar.
      // Nesta página o palco é permanente; resize de janela evita que a escrita do
      // backing store do Canvas retroalimente o ResizeObserver no modo de desenvolvimento.
      engine._resizeObserver?.disconnect();
      window.addEventListener('resize', resizeGraph, { passive: true });
      engine.setData({ nodes, links });
      requestAnimationFrame(() => engine?.fitGraph());
      setReady(true);
    }).catch(() => setReady(false));

    return () => {
      disposed = true;
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', resizeGraph);
      engineRef.current = null;
      engine?.destroy();
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // O palco assume completamente a roda: impede a rolagem da página e envia
    // o gesto diretamente à câmera, mantendo o ponto sob o cursor como âncora.
    const zoomGraph = (event: WheelEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      event.preventDefault();
      event.stopPropagation();

      const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? stage.clientHeight
          : 1;
      const rect = stage.getBoundingClientRect();
      engine.zoomBy(Math.exp(-(event.deltaY * deltaScale) * 0.001), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    stage.addEventListener('wheel', zoomGraph, { passive: false, capture: true });

    const leaveFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !engineRef.current) return;
      engineRef.current.clearSelection();
      engineRef.current.fitGraph();
    };
    window.addEventListener('keydown', leaveFocus);

    return () => {
      stage.removeEventListener('wheel', zoomGraph, { capture: true });
      window.removeEventListener('keydown', leaveFocus);
    };
  }, []);

  const clearFocus = () => {
    engineRef.current?.clearSelection();
    engineRef.current?.fitGraph();
  };

  return (
    <div ref={stageRef} className="graph-stage">
      <div ref={hostRef} className="graph-host" aria-label="Demonstração interativa da Biblioteca do VARISPEED" />
      <div className="graph-readout">
        <span>{ready ? 'SIMULAÇÃO ATIVA' : 'INICIALIZANDO'}</span>
        {selectedNode ? (
          <button type="button" onClick={clearFocus} aria-label={`Sair do foco em ${selectedNode.label}`}>
            SAIR DO FOCO · ESC
          </button>
        ) : (
          <span>ARRASTE · RODA PARA ZOOM · CLIQUE</span>
        )}
      </div>
    </div>
  );
}
