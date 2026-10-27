'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { X, Network } from 'lucide-react';
import { CATEGORIES as MARKET_CATEGORIES, NODES as MARKET_NODES, EDGES as MARKET_EDGES } from '@/data/dcKnowledgeGraph';
import { buildPatternGraph, PATTERN_CATEGORIES } from '@/lib/nexus/pattern-graph';
import { KNOWLEDGE_CATEGORIES } from '@/lib/wiki/categories';

const POLL_MS = 30_000;

const DCKnowledgeGraph = dynamic(
  () => import('@/components/wiki/DCKnowledgeGraph'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
          <span className="text-white/30 text-xs">Loading knowledge graph…</span>
        </div>
      </div>
    ),
  }
);

export default function KnowledgeGraphPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const [mode, setMode] = useState('market');
  const [selected, setSelected] = useState(null);
  useEffect(() => { const m = new URLSearchParams(window.location.search).get('mode'); if (m === 'patterns' || m === 'knowledge') setMode(m); }, []);
  // The firm's knowledge store. Polled, but the graph only re-renders when the
  // node or edge count changes, so the layout does not reset under the reader.
  const [knowledge, setKnowledge] = useState({ nodes: [], edges: [], loaded: false });
  const shapeRef = useRef('');
  useEffect(() => {
    if (mode !== 'knowledge') return undefined;
    let alive = true;
    const load = () => fetch('/api/wiki/graph').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!alive || !d?.nodes) return;
      const shape = `${d.nodes.length}:${d.edges.length}`;
      if (shape !== shapeRef.current) { shapeRef.current = shape; setKnowledge({ nodes: d.nodes, edges: d.edges, loaded: true }); }
      else setKnowledge((k) => (k.loaded ? k : { ...k, loaded: true }));
    }).catch(() => {});
    load();
    const t = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [mode]);
  useEffect(() => { setActiveCategory('all'); setSelected(null); }, [mode]);
  const patternGraph = useMemo(() => buildPatternGraph(), []);
  const NODES = mode === 'patterns' ? patternGraph.nodes : mode === 'knowledge' ? knowledge.nodes : MARKET_NODES;
  const EDGES = mode === 'patterns' ? patternGraph.edges : mode === 'knowledge' ? knowledge.edges : MARKET_EDGES;
  const CATEGORIES = mode === 'patterns' ? PATTERN_CATEGORIES : mode === 'knowledge' ? KNOWLEDGE_CATEGORIES : MARKET_CATEGORIES;
  const selectedLink = selected?.kind === 'alert' ? `/incidents?alert=${selected.ref}`
    : selected?.kind === 'incident' ? `/incidents?incident=${selected.ref}`
      : selected?.kind === 'advisory' ? '/command-center/predictive'
        : selected?.kind === 'facility' ? '/command-center/portfolio' : null;

  const stats = [
    { label: 'Nodes',      value: NODES.length,      color: '#2563eb' },
    { label: 'Edges',      value: EDGES.filter(e => e.source && e.target).length, color: '#7c3aed' },
    { label: mode === 'market' ? 'Domains' : 'Patterns', value: mode === 'market' ? CATEGORIES.length : NODES.filter(n => n.category === 'pattern').length, color: '#0d9488' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="flex-shrink-0 bg-white border-b border-grey-border px-5 py-3 flex items-center justify-between gap-4"
      >
        {/* Left: close + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg border border-grey-border flex items-center justify-center hover:bg-grey-bg transition-colors flex-shrink-0"
          >
            <X size={14} className="text-text-secondary" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-success-light flex items-center justify-center flex-shrink-0">
              <Network size={14} className="text-success" />
            </div>
            <div className="min-w-0">
              <p
                className="font-extrabold text-text-primary text-sm leading-tight truncate"
                style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
              >
                DC Knowledge Graph
              </p>
              <p className="text-[9px] text-text-muted leading-tight">
                K-Nexus · Datacenter Domain Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Right: mode switch + stat chips */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex bg-grey-bg border border-grey-border rounded-lg p-0.5 gap-0.5 mr-2" role="tablist" aria-label="Graph">
            {[['market', 'Market knowledge'], ['knowledge', 'Firm knowledge'], ['patterns', 'Nexus pattern memory']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${mode === id ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>{label}</button>
            ))}
          </div>
          {stats.map(s => (
            <div
              key={s.label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-grey-bg border border-grey-border rounded-lg"
            >
              <span className="text-sm font-black tabular-nums" style={{ color: s.color }}>
                {s.value}
              </span>
              <span className="text-[9px] text-text-secondary font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar — domain legend */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-48 flex-shrink-0 bg-grey-bg border-r border-grey-border overflow-y-auto flex flex-col"
        >
          <div className="p-3">
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-2.5 px-1">
              {mode === 'market' ? 'Domains' : 'Node types'}
            </p>

            {/* All domains button */}
            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-2 mb-1 ${
                activeCategory === 'all'
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/60'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-text-muted flex-shrink-0" />
              <span className="truncate">{mode === 'market' ? 'All Domains' : 'Everything'}</span>
              <span className="ml-auto text-[9px] opacity-50">{NODES.length}</span>
            </button>

            {/* Category buttons */}
            {CATEGORIES.map(cat => {
              const count = NODES.filter(n => n.category === cat.id).length;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(isActive ? 'all' : cat.id)}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-2 mb-0.5"
                  style={
                    isActive
                      ? { backgroundColor: cat.color + '18', color: cat.color }
                      : { color: '#6B7280' }
                  }
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.color = '#1A1F36';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.color = '#6B7280';
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="truncate leading-tight">{cat.label}</span>
                  <span
                    className="ml-auto text-[9px] flex-shrink-0"
                    style={{ opacity: isActive ? 0.7 : 0.5 }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {mode !== 'market' && (
            <div className="p-3 border-t border-grey-border">
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Selected</p>
              {selected ? (
                <>
                  <p className="text-[11px] font-semibold text-text-primary leading-snug">{selected.label}</p>
                  <p className="text-[10px] text-text-secondary leading-relaxed mt-1">{selected.description}</p>
                  {selected.updated && <p className="text-[9px] text-text-muted mt-1">Updated {selected.updated}</p>}
                  {selectedLink && <Link href={selectedLink} className="inline-block mt-1.5 text-[10px] font-semibold text-[#005EB8] hover:underline">Open →</Link>}
                </>
              ) : (
                <p className="text-[10px] text-text-secondary leading-relaxed">{mode === 'patterns'
                  ? 'Every incident, open alert and maintenance advisory, linked to the failure pattern it shares and the site it happened at. Click a pattern to see everywhere it has occurred.'
                  : 'Concepts, patterns and market notes learned across engagements, one node per idea. Engagements are shown without client names. Briefs draw on this as context.'}</p>
              )}
            </div>
          )}

          {/* Legend: interaction hints */}
          <div className="mt-auto p-3 border-t border-grey-border">
            <p className="text-[9px] text-text-muted leading-relaxed">
              Click a domain to filter · Click a node to highlight connections · Drag to explore
            </p>
          </div>
        </motion.div>

        {/* Graph canvas */}
        <div className="flex-1 relative overflow-hidden">
          {mode === 'knowledge' && knowledge.loaded && NODES.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-text-muted">No knowledge recorded yet. Pages appear here as briefs and assessments are completed.</div>
          ) : (
            <DCKnowledgeGraph activeCategory={activeCategory} nodes={NODES} edges={EDGES} categories={CATEGORIES} onSelect={setSelected} />
          )}
        </div>

      </div>
    </div>
  );
}
