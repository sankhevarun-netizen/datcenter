'use client';
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { NODES, EDGES, CATEGORIES } from '@/data/dcKnowledgeGraph';

const ForceGraph2D =
  typeof window !== 'undefined'
    ? require('react-force-graph-2d').default
    : null;

function catColor(categoryId, categories = CATEGORIES) {
  return categories.find(c => c.id === categoryId)?.color ?? '#64748b';
}

function catLabel(categoryId, categories = CATEGORIES) {
  return categories.find(c => c.id === categoryId)?.label ?? categoryId;
}

function buildNeighborSet(nodeId, edges) {
  const s = new Set();
  edges.forEach(e => {
    const src = e.source?.id ?? e.source;
    const tgt = e.target?.id ?? e.target;
    if (src === nodeId) s.add(tgt);
    if (tgt === nodeId) s.add(src);
  });
  return s;
}

// nodes / edges / categories default to the market knowledge graph; the wiki's
// pattern-memory mode passes the Nexus pattern graph instead.
export default function DCKnowledgeGraph({ activeCategory = 'all', nodes: srcNodes = NODES, edges: srcEdges = EDGES, categories = CATEGORIES, onSelect }) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const zoomedRef = useRef(false);
  const [dimensions, setDimensions] = useState({ w: 900, h: 600 });
  const [mounted, setMounted] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Reset zoom flag when category changes so new layout auto-fits
  useEffect(() => { zoomedRef.current = false; }, [activeCategory, srcNodes]);

  // Reset selected node when category changes
  useEffect(() => { setSelectedNode(null); }, [activeCategory, srcNodes]);

  const graphData = useMemo(() => {
    let nodes, links;
    if (activeCategory === 'all') {
      nodes = srcNodes.map(n => ({ ...n }));
      links = srcEdges.filter(e => e.source && e.target).map(e => ({ ...e }));
    } else {
      const ids = new Set(srcNodes.filter(n => n.category === activeCategory).map(n => n.id));
      const validEdges = srcEdges.filter(e => e.source && e.target);
      validEdges.forEach(e => {
        const s = e.source?.id ?? e.source;
        const t = e.target?.id ?? e.target;
        if (ids.has(s)) ids.add(t);
        if (ids.has(t)) ids.add(s);
      });
      nodes = srcNodes.filter(n => ids.has(n.id)).map(n => ({ ...n }));
      links = validEdges.filter(e => {
        const s = e.source?.id ?? e.source;
        const t = e.target?.id ?? e.target;
        return ids.has(s) && ids.has(t);
      }).map(e => ({ ...e }));
    }
    return { nodes, links };
  }, [activeCategory, srcNodes, srcEdges]);

  // Weak pull toward the centre so nodes without links stay with the graph
  // instead of drifting to the edge of the canvas.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    let simNodes = [];
    const gravity = (alpha) => {
      for (const n of simNodes) {
        n.vx -= (n.x ?? 0) * 0.03 * alpha;
        n.vy -= (n.y ?? 0) * 0.03 * alpha;
      }
    };
    gravity.initialize = (ns) => { simNodes = ns; };
    fg.d3Force('gravity', gravity);
  }, [mounted, graphData]);

  const neighborSet = useMemo(() => {
    if (!selectedNode) return new Set();
    return buildNeighborSet(selectedNode.id, graphData.links);
  }, [selectedNode, graphData.links]);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const baseR = (node.size ?? 8) * 0.55;
    const r = Math.max(3, baseR / Math.max(0.6, Math.sqrt(globalScale) * 0.75));
    const color = catColor(node.category, categories);

    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const hasSelection = !!selectedNode;
    const isNeighbor = hasSelection ? neighborSet.has(node.id) : false;
    const isDimmed = hasSelection && !isSelected && !isNeighbor;

    ctx.globalAlpha = isDimmed ? 0.12 : 1;

    // Glow for selected/hovered
    if (isSelected || isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 / globalScale;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isSelected ? color : isHovered ? color + 'ee' : color + 'bb';
    ctx.fill();

    if (isSelected || isHovered) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(26,31,54,0.15)';
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // Always-visible label
    const minScaleForLabel = 0.15;
    if (globalScale >= minScaleForLabel) {
      const fontSize = Math.max(5, Math.min(11, (node.size >= 12 ? 10 : 8.5) / Math.max(0.8, Math.sqrt(globalScale))));
      ctx.font = `${node.size >= 12 ? '600 ' : ''}${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isDimmed ? 'rgba(26,31,54,0.15)' : isSelected || isHovered ? '#1A1F36' : 'rgba(26,31,54,0.65)';
      ctx.fillText(node.label, x, y + r + 2 / globalScale);
    }

    ctx.globalAlpha = 1;
  }, [selectedNode, hoveredNode, neighborSet, categories]);

  const linkCanvasObject = useCallback((link, ctx, globalScale) => {
    const src = link.source;
    const tgt = link.target;
    if (src?.x == null || tgt?.x == null) return;

    const hasSelection = !!selectedNode;
    const srcId = src.id ?? src;
    const tgtId = tgt.id ?? tgt;
    const isRelevant = !hasSelection || (neighborSet.has(srcId) && neighborSet.has(tgtId));

    ctx.globalAlpha = isRelevant ? (hasSelection ? 0.5 : 0.3) : 0.04;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.7 / Math.max(1, globalScale);
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [selectedNode, neighborSet]);

  const handleNodeHover = useCallback((node, _prev, event) => {
    setHoveredNode(node ?? null);
    if (node && event && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
  }, []);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(prev => {
      const next = prev?.id === node.id ? null : node;
      onSelect?.(next);
      return next;
    });
  }, [onSelect]);

  const handleEngineStop = useCallback(() => {
    if (!zoomedRef.current && fgRef.current) {
      fgRef.current.zoomToFit(600, 50);
      zoomedRef.current = true;
    }
  }, []);

  const activeNode = selectedNode ?? hoveredNode;

  return (
    <div className="relative w-full h-full bg-white p-3">
    <div ref={containerRef} className="relative w-full h-full">
      {mounted && ForceGraph2D && (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={dimensions.w}
          height={dimensions.h}
          backgroundColor="#ffffff"
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          linkCanvasObject={linkCanvasObject}
          linkCanvasObjectMode={() => 'replace'}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          onBackgroundClick={() => { setSelectedNode(null); onSelect?.(null); }}
          nodeLabel=""
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.35}
          warmupTicks={80}
          cooldownTicks={200}
          onEngineStop={handleEngineStop}
        />
      )}

      {/* Hover / selected tooltip */}
      {activeNode && (
        <div
          className="absolute z-30 w-64 pointer-events-none"
          style={{
            left: Math.min(hoverPos.x + 16, dimensions.w - 272),
            top: Math.max(8, Math.min(hoverPos.y - 10, dimensions.h - 160)),
          }}
        >
          <div className="bg-white/97 backdrop-blur-sm rounded-xl border border-grey-border shadow-2xl p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: catColor(activeNode.category, categories) }}
              />
              <span className="font-bold text-text-primary text-sm leading-tight">{activeNode.label}</span>
            </div>
            <span
              className="inline-block text-[9px] px-2 py-0.5 rounded-full font-semibold mb-2"
              style={{
                background: catColor(activeNode.category, categories) + '18',
                color: catColor(activeNode.category, categories),
              }}
            >
              {catLabel(activeNode.category, categories)}
            </span>
            <p className="text-[10px] text-text-secondary leading-relaxed">{activeNode.description}</p>
            {selectedNode?.id === activeNode.id && (
              <p className="text-[9px] text-text-muted mt-2">Click again to deselect</p>
            )}
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-5 right-5 flex flex-col gap-1.5">
        {[
          { icon: <ZoomIn size={13} />, action: () => fgRef.current?.zoom(1.4, 300) },
          { icon: <ZoomOut size={13} />, action: () => fgRef.current?.zoom(0.714, 300) },
          { icon: <Maximize2 size={13} />, action: () => fgRef.current?.zoomToFit(400, 50) },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            className="w-8 h-8 bg-white border border-grey-border rounded-lg shadow-md text-text-secondary flex items-center justify-center hover:bg-grey-bg hover:text-text-primary transition-colors"
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {/* Click-outside hint */}
      {!selectedNode && !hoveredNode && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted pointer-events-none select-none">
          Drag to explore · Scroll to zoom · Click a node to highlight connections
        </div>
      )}
    </div>
    </div>
  );
}
