'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
// SSR-safe import: react-force-graph-2d uses browser APIs
const ForceGraph2D = typeof window !== 'undefined'
  ? require('react-force-graph-2d').default
  : null;

import {
  DC_NODES,
  DC_EDGES,
  CATEGORIES,
  FIXED_POSITIONS,
} from '@/data/tmtOntology';
import { NodeDetailPanel } from './NodeDetailPanel';

function catColor(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId)?.color ?? '#64748b';
}

function drawNode(node, ctx, globalScale, highlighted) {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const baseR = node.isCore ? 10 : 7;
  const r = baseR / Math.max(1, Math.sqrt(globalScale) * 0.7);
  const color = catColor(node.category);

  if (node.type === 'decision') {
    const h = r * 1.9;
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.65);
    ctx.lineTo(x + h * 0.6, y + h * 0.4);
    ctx.lineTo(x - h * 0.6, y + h * 0.4);
    ctx.closePath();
    ctx.fillStyle = highlighted ? '#ef4444' : '#C8102E';
    ctx.fill();
    if (highlighted) {
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }
  } else if (node.type === 'metric') {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, 0, 2 * Math.PI);
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = (highlighted ? 2.5 : 1.8) / globalScale;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(13,148,136,0.12)';
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = highlighted ? color : color + 'dd';
    ctx.fill();
    if (highlighted) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5 / globalScale;
      ctx.stroke();
    }
    if (node.isCore) {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.45, 0, 2 * Math.PI);
      ctx.strokeStyle = color + '55';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }
  }

  const fontSize = Math.max(8, 11 / Math.max(1, Math.sqrt(globalScale)));
  ctx.font = `${node.isCore ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelY = y + (node.type === 'decision' ? r * 1.2 : r * 1.3);
  ctx.fillStyle = '#1e293b';
  ctx.fillText(node.label, x, labelY);
}

export default function OntologyGraph({ activeCategory = 'all' }) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const pinNode = (n) => {
    const pos = FIXED_POSITIONS[n.id];
    return { ...n, x: pos?.x ?? 0, y: pos?.y ?? 0, fx: pos?.x ?? 0, fy: pos?.y ?? 0 };
  };

  const graphData = useMemo(() => {
    if (activeCategory === 'all') {
      return {
        nodes: DC_NODES.map(pinNode),
        links: DC_EDGES.map((e) => ({ ...e })),
      };
    }
    const nodeIds = new Set(
      DC_NODES.filter((n) => n.category === activeCategory).map((n) => n.id)
    );
    DC_EDGES.forEach((e) => {
      const src = typeof e.source === 'string' ? e.source : e.source.id;
      const tgt = typeof e.target === 'string' ? e.target : e.target.id;
      if (nodeIds.has(src)) nodeIds.add(tgt);
      if (nodeIds.has(tgt)) nodeIds.add(src);
    });
    return {
      nodes: DC_NODES.filter((n) => nodeIds.has(n.id)).map(pinNode),
      links: DC_EDGES.filter((e) => {
        const src = typeof e.source === 'string' ? e.source : e.source.id;
        const tgt = typeof e.target === 'string' ? e.target : e.target.id;
        return nodeIds.has(src) && nodeIds.has(tgt);
      }).map((e) => ({ ...e })),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const isHighlighted = selectedNode?.id === node.id || hoverInfo?.node.id === node.id;
    drawNode(node, ctx, globalScale, isHighlighted);
  }, [selectedNode, hoverInfo]);

  const linkCanvasObject = useCallback((link, ctx, globalScale) => {
    const src = link.source;
    const tgt = link.target;
    if (src?.x == null || tgt?.x == null) return;

    const mx = (src.x + tgt.x) / 2;
    const my = (src.y + tgt.y) / 2;

    ctx.save();
    ctx.setLineDash([4 / globalScale, 4 / globalScale]);
    ctx.strokeStyle = 'rgba(100,116,139,0.35)';
    ctx.lineWidth = 1 / globalScale;
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const fontSize = Math.max(6, 8 / Math.max(1, Math.sqrt(globalScale)));
    ctx.font = `${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(100,116,139,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(link.label, mx, my);
    ctx.restore();
  }, []);

  const handleNodeHover = useCallback((node) => {
    if (node) {
      setHoverInfo((prev) => {
        if (prev?.node.id === node.id) return prev;
        return { node, x: 0, y: 0 };
      });
    } else {
      setHoverInfo(null);
    }
  }, []);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
    setHoverInfo(null);
  }, []);

  // Track mouse for hover-card position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (ev) => {
      if (hoverInfo) {
        const rect = el.getBoundingClientRect();
        setHoverInfo((prev) =>
          prev ? { ...prev, x: ev.clientX - rect.left, y: ev.clientY - rect.top } : null
        );
      }
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, [hoverInfo]);

  const canvasWidth = selectedNode ? Math.max(400, dimensions.w - 380) : dimensions.w;

  return (
    <div className="relative w-full h-full bg-[#f5f0ea]" ref={containerRef}>
      {/* System corner badges */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <span className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-full bg-white/80 text-slate-600 shadow-sm">
          OSS / BSS
        </span>
      </div>
      <div
        className="absolute top-4 z-10 pointer-events-none"
        style={{ right: selectedNode ? '396px' : '16px' }}
      >
        <span className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-full bg-white/80 text-slate-600 shadow-sm">
          MLOps Platform
        </span>
      </div>
      <div className="absolute bottom-14 left-4 z-10 pointer-events-none">
        <span className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-full bg-white/80 text-slate-600 shadow-sm">
          CMS
        </span>
      </div>
      <div
        className="absolute bottom-14 z-10 pointer-events-none"
        style={{ right: selectedNode ? '396px' : '16px' }}
      >
        <span className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-full bg-white/80 text-slate-600 shadow-sm">
          Cloud Platform
        </span>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
        <button
          onClick={() => fgRef.current?.zoom(1.4, 300)}
          className="w-8 h-8 bg-white border border-slate-200 rounded shadow-sm text-slate-600 hover:bg-slate-50 text-lg font-bold leading-none flex items-center justify-center"
        >
          +
        </button>
        <button
          onClick={() => fgRef.current?.zoom(0.714, 300)}
          className="w-8 h-8 bg-white border border-slate-200 rounded shadow-sm text-slate-600 hover:bg-slate-50 text-lg font-bold leading-none flex items-center justify-center"
        >
          −
        </button>
        <button
          onClick={() => fgRef.current?.zoomToFit(400, 40)}
          className="w-8 h-8 bg-white border border-slate-200 rounded shadow-sm text-slate-500 hover:bg-slate-50 text-xs font-bold leading-none flex items-center justify-center"
          title="Fit view"
        >
          ⤢
        </button>
      </div>

      {/* Force graph — only render client-side */}
      {mounted && ForceGraph2D && (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={canvasWidth}
          height={dimensions.h}
          backgroundColor="#f5f0ea"
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          linkCanvasObject={linkCanvasObject}
          linkCanvasObjectMode={() => 'replace'}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          nodeLabel=""
          enableNodeDrag={false}
          enableZoomInteraction
          enablePanInteraction
          warmupTicks={0}
          cooldownTicks={0}
          d3AlphaDecay={1}
          d3VelocityDecay={1}
          linkDirectionalParticles={0}
        />
      )}

      {/* Hover card */}
      {hoverInfo && !selectedNode && hoverInfo.x > 0 && (
        <HoverCard info={hoverInfo} />
      )}

      {/* Detail panel */}
      {selectedNode && (
        <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  );
}

function HoverCard({ info }) {
  const { node, x, y } = info;
  const cat = CATEGORIES.find((c) => c.id === node.category);
  const color = cat?.color ?? '#64748b';

  const connections = [];
  DC_EDGES.forEach((e) => {
    const src = typeof e.source === 'string' ? e.source : e.source.id;
    const tgt = typeof e.target === 'string' ? e.target : e.target.id;
    if (src === node.id) {
      const n = DC_NODES.find((x) => x.id === tgt);
      if (n) connections.push({ label: n.label, rel: e.label });
    } else if (tgt === node.id) {
      const n = DC_NODES.find((x) => x.id === src);
      if (n) connections.push({ label: n.label, rel: e.label });
    }
  });
  const shown = connections.slice(0, 5);
  const extra = connections.length - shown.length;

  const left = Math.min(x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 310);
  const top = Math.max(8, Math.min(y - 10, (typeof window !== 'undefined' ? window.innerHeight : 800) - 300));

  return (
    <div
      className="absolute z-30 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 pointer-events-none"
      style={{ left, top }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="font-bold text-slate-900 text-sm">{node.label}</span>
      </div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded border"
          style={{ backgroundColor: `${color}18`, color, borderColor: `${color}40` }}
        >
          {cat?.label}
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200 capitalize">
          {node.type === 'ontology' ? 'Ontology' : node.type}
        </span>
      </div>
      {node.businessIntent && (
        <p className="text-[10px] text-slate-500 mb-2 leading-relaxed line-clamp-2">
          {node.businessIntent}
        </p>
      )}
      <div className="space-y-1.5">
        {shown.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-400 font-mono">{c.rel}</span>
            <span className="text-xs text-slate-700 font-medium">{c.label}</span>
          </div>
        ))}
        {extra > 0 && (
          <p className="text-[10px] text-slate-400 pl-3.5">+{extra} more connections</p>
        )}
      </div>
      <p className="text-[9px] text-slate-300 mt-2">Click to explore →</p>
    </div>
  );
}
