'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X, Network } from 'lucide-react';
import dynamic from 'next/dynamic';
import { CATEGORIES, DC_NODES, DC_EDGES } from '@/data/tmtOntology';

// Dynamic import keeps ForceGraph2D out of SSR
const OntologyGraph = dynamic(
  () => import('@/components/ontology/OntologyGraph'),
  { ssr: false, loading: () => <GraphSkeleton /> }
);

function GraphSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#f5f0ea]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#1e40af]/10 flex items-center justify-center animate-pulse">
          <Network size={22} className="text-[#1e40af]" />
        </div>
        <p className="text-sm font-semibold text-slate-500">Loading ontology graph…</p>
      </div>
    </div>
  );
}

const LEGEND_TYPES = [
  { type: 'ontology', label: 'Ontology Node', shape: 'circle', color: '#1e40af' },
  { type: 'metric',   label: 'Metric',        shape: 'ring',   color: '#0d9488' },
  { type: 'decision', label: 'Decision Gate',  shape: 'tri',    color: '#C8102E' },
];

export default function OntologyPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');

  const stats = useMemo(() => {
    const nodes = activeCategory === 'all' ? DC_NODES : DC_NODES.filter((n) => n.category === activeCategory);
    const nodeIds = new Set(nodes.map((n) => n.id));
    // include neighbours
    DC_EDGES.forEach((e) => {
      if (nodeIds.has(e.source)) nodeIds.add(e.target);
      if (nodeIds.has(e.target)) nodeIds.add(e.source);
    });
    const filteredEdges = DC_EDGES.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    return { nodes: nodeIds.size, edges: filteredEdges.length };
  }, [activeCategory]);

  return (
    <div className="fixed inset-0 z-50 bg-[#F8FAFD] flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-[#D8DCE3] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg border border-[#D8DCE3] flex items-center justify-center hover:bg-[#F0F2F5] transition-colors"
          >
            <X size={15} className="text-[#6B7280]" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="font-extrabold text-[#1A1F36] text-base"
                style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
              >
                DC Ontology Graph
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Static
              </span>
            </div>
            <p className="text-[10px] text-[#9CA3AF]">
              K-Nexus · Datacenter Lifecycle Knowledge Graph
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2">
          {[
            { label: 'Nodes',  value: stats.nodes,   color: '#1e40af' },
            { label: 'Edges',  value: stats.edges,   color: '#7c3aed' },
            { label: 'Categories', value: CATEGORIES.length, color: '#059669' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1 px-2.5 py-1 bg-[#F0F2F5] rounded-lg">
              <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
              <span className="text-[9px] text-[#9CA3AF]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left sidebar */}
        <div className="w-56 flex-shrink-0 bg-white border-r border-[#D8DCE3] flex flex-col overflow-hidden">

          {/* Category filter */}
          <div className="p-4 border-b border-[#F0F2F5]">
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">
              Filter by Domain
            </p>
            <div className="space-y-1">
              <button
                onClick={() => setActiveCategory('all')}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-2 ${
                  activeCategory === 'all'
                    ? 'bg-[#EBF5FF] text-[#00338D]'
                    : 'text-[#6B7280] hover:bg-[#F0F2F5]'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                All Domains
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id === activeCategory ? 'all' : cat.id)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-2 ${
                    activeCategory === cat.id
                      ? 'bg-opacity-10 font-bold'
                      : 'text-[#6B7280] hover:bg-[#F0F2F5]'
                  }`}
                  style={
                    activeCategory === cat.id
                      ? { backgroundColor: `${cat.color}15`, color: cat.color }
                      : {}
                  }
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Node type legend */}
          <div className="p-4 border-b border-[#F0F2F5]">
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">
              Node Types
            </p>
            <div className="space-y-2.5">
              {LEGEND_TYPES.map(({ type, label, shape, color }) => (
                <div key={type} className="flex items-center gap-2.5">
                  <LegendShape shape={shape} color={color} />
                  <span className="text-[10px] font-semibold text-[#374151]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Node count by category */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">
              Nodes per Domain
            </p>
            <div className="space-y-2">
              {CATEGORIES.map((cat) => {
                const count = DC_NODES.filter((n) => n.category === cat.id).length;
                return (
                  <div key={cat.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{cat.label}</span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Graph canvas */}
        <div className="flex-1 relative overflow-hidden">
          <OntologyGraph activeCategory={activeCategory} />
        </div>

      </div>
    </div>
  );
}

function LegendShape({ shape, color }) {
  if (shape === 'ring') {
    return (
      <div
        className="w-4 h-4 rounded-full border-2 flex-shrink-0"
        style={{ borderColor: color, backgroundColor: `${color}12` }}
      />
    );
  }
  if (shape === 'tri') {
    return (
      <svg width="16" height="14" viewBox="0 0 10 9" className="flex-shrink-0">
        <polygon points="5,0.5 9.5,8.5 0.5,8.5" fill={color} />
      </svg>
    );
  }
  return (
    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
  );
}
