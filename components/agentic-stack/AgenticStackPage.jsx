'use client';
// AI Stack: the platform's architecture as it is wired today. One data
// model, seven lenses (each a live route), deterministic engines doing every
// calculation, and the external data and tools. Names, routes and status come
// from lib/platform-registry.js; counts are computed from the dataset.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Gauge, Radar, Droplets, SunMedium, ShieldAlert, FileCheck2, Scale, Cog, Database, MessageSquareText,
  Route as RouteIcon, ArrowUpRight, Bell, Landmark, Lock, Shuffle,
} from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { LENSES, ENGINES, TOOLS, STATUS, countBy } from '@/lib/platform-registry';
import { nexus } from '@/lib/nexus/data';
import StatusBadge from '@/components/shared/StatusBadge';

const LENS_ICON = { gauge: Gauge, radar: Radar, droplet: Droplets, sun: SunMedium, shield: ShieldAlert, 'file-check': FileCheck2, scale: Scale, shuffle: Shuffle };
const FONT = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };

// ── tool marks (generic glyphs; no vendor artwork) ────────────────────────
function TavilyLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#18181B" />
      <rect x="10" y="14" width="28" height="3.5" rx="1.5" fill="#F5A623" />
      <rect x="14" y="21" width="20" height="3" rx="1.5" fill="#F5A623" opacity="0.8" />
      <rect x="18" y="27.5" width="12" height="2.5" rx="1.25" fill="#F5A623" opacity="0.6" />
      <circle cx="34" cy="36" r="6" fill="none" stroke="#F5A623" strokeWidth="2" />
      <line x1="38.2" y1="40.2" x2="42" y2="44" stroke="#F5A623" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ExaLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#1E293B" />
      <path d="M15 15h18M15 24h13M15 33h18M15 15v18" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function PeeringDBLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#003366" />
      <circle cx="14" cy="24" r="5" fill="none" stroke="#4A90D9" strokeWidth="2" />
      <circle cx="34" cy="16" r="4" fill="none" stroke="#4A90D9" strokeWidth="2" />
      <circle cx="34" cy="32" r="4" fill="none" stroke="#4A90D9" strokeWidth="2" />
      <circle cx="24" cy="24" r="3" fill="#4A90D9" opacity="0.5" />
      <line x1="19" y1="24" x2="21" y2="24" stroke="#4A90D9" strokeWidth="1.5" />
      <line x1="27" y1="22" x2="30.5" y2="18.5" stroke="#4A90D9" strokeWidth="1.5" />
      <line x1="27" y1="26" x2="30.5" y2="29.5" stroke="#4A90D9" strokeWidth="1.5" />
    </svg>
  );
}
function KnowledgeGraphLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect width="48" height="48" rx="10" fill="#064E3B" />
      <circle cx="24" cy="24" r="4.5" fill="#10B981" />
      {[[11, 17], [37, 17], [11, 37], [37, 37]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.5" fill="#34D399" opacity="0.85" />)}
      <path d="M14.5 19l6 3M33.5 19l-6 3M14.5 35l6-8M33.5 35l-6-8" stroke="#10B981" strokeWidth="1.5" />
    </svg>
  );
}
const TOOL_LOGO = { tavily: TavilyLogo, exa: ExaLogo, peeringdb: PeeringDBLogo, 'knowledge-graph': KnowledgeGraphLogo };

const Badge = ({ status }) => <StatusBadge status={status} variant="dot" />;

function Connector({ height = 28, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const len = el.getTotalLength();
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
    const t = setTimeout(() => { el.style.transition = 'stroke-dashoffset 0.45s ease-out'; el.style.strokeDashoffset = '0'; }, delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className="flex justify-center" style={{ height }}>
      <svg width="24" height={height} viewBox={`0 0 24 ${height}`} fill="none" overflow="visible" aria-hidden>
        <path ref={ref} d={`M12 0 L12 ${height - 8}`} stroke="#005EB8" strokeWidth="1.8" strokeLinecap="round" />
        <path d={`M6 ${height - 12} L12 ${height - 4} L18 ${height - 12}`} stroke="#005EB8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// Curves from one point out to n slots (fan out) or back in (fan in).
function Fan({ count, direction = 'out', height = 40 }) {
  const W = 700;
  const xs = Array.from({ length: count }, (_, i) => ((i + 0.5) * W) / count);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden>
      {xs.map((x) => (
        <path key={x} d={direction === 'out' ? `M${W / 2} 0 C${W / 2} ${height / 2} ${x} ${height / 2} ${x} ${height}` : `M${x} 0 C${x} ${height / 2} ${W / 2} ${height / 2} ${W / 2} ${height}`}
          stroke="#005EB8" strokeWidth="1.4" fill="none" opacity="0.4" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

function Layer({ children, className = '' }) {
  return <div className={`bg-white rounded-2xl border border-[#D8DCE3] shadow-[0_2px_10px_rgba(0,51,141,0.06)] ${className}`}>{children}</div>;
}

function LensCard({ lens, onHover, delay }) {
  const Icon = LENS_ICON[lens.icon];
  const disabled = lens.status === 'roadmap';
  const body = (
    <>
      <div className="h-1 w-full" style={{ background: disabled ? '#CBD5E1' : lens.color }} />
      <div className="p-3.5 flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${lens.color}14`, border: `1px solid ${lens.color}33` }}>
            <Icon size={17} style={{ color: lens.color }} />
          </span>
          {disabled ? <Lock size={14} className="text-[#94A3B8]" /> : <ArrowUpRight size={15} className="text-[#94A3B8] group-hover:text-[#005EB8] transition-colors" />}
        </div>
        <div className="min-h-[54px]">
          <p className="text-[13.5px] font-bold text-[#1A1F36] leading-tight" style={FONT}>{lens.label}</p>
          <p className="text-[11.5px] text-[#64748B] mt-0.5 leading-snug">{lens.subtitle}</p>
        </div>
        <Badge status={lens.status} />
      </div>
    </>
  );
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      onMouseEnter={() => onHover(lens)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(lens)} onBlur={() => onHover(null)}>
      {disabled ? (
        <div className="bg-white rounded-xl border border-[#D8DCE3] overflow-hidden opacity-70 cursor-not-allowed h-full" aria-disabled>{body}</div>
      ) : (
        <Link href={lens.href} className="group block bg-white rounded-xl border border-[#D8DCE3] overflow-hidden h-full shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-[#005EB8]/40 transition-all">{body}</Link>
      )}
    </motion.div>
  );
}

export default function AgenticStackPage() {
  const [hovered, setHovered] = useState(null);

  // Everything counted from the registry and the dataset, never typed.
  const wiredLenses = LENSES.filter((l) => l.status !== 'roadmap').length;
  const liveTools = countBy(TOOLS, 'live');
  const model = useMemo(() => [
    ['Facilities', nexus.facilities.length],
    ['Halls', nexus.halls.length],
    ['Rows', nexus.rows.length],
    ['Racks', nexus.racks.length],
    ['Components', nexus.components.length],
    ['Dependency edges', nexus.dependencies.length],
    ['Tenants', nexus.tenants.length],
    ['Contracts', nexus.contracts.length],
    ['Energy & water months', nexus.energy.length + nexus.water.length],
    ['Hourly generation', nexus.hourlyGeneration.length],
  ], []);
  const examples = useMemo(() => {
    const alert = [...nexus.activeAlerts].filter((a) => a.status !== 'resolved').sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.severity] - { critical: 0, high: 1, medium: 2, low: 3 }[b.severity]))[0];
    const disclosure = nexus.statePolicy.find((p) => /BRSR/i.test(p.policy));
    return [
      { Icon: MessageSquareText, kind: 'A question', text: 'Can we take 2 MW at 60 kW density in Mumbai?' },
      { Icon: Bell, kind: 'An alert', text: `${alert.alert_id} on ${alert.component_id}: ${alert.message}` },
      { Icon: Landmark, kind: 'A regulator’s request', text: `${disclosure.policy}: ${disclosure.detail.toLowerCase()}` },
    ];
  }, []);
  const activeEngines = new Set(hovered?.engines ?? []);

  return (
    <CCLayout title="AI Stack">
      <div className="min-h-full bg-[#F0F2F5] p-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[#00338D] font-bold text-xl tracking-tight" style={FONT}>Data Center Life-Cycle Intelligence Platform</h1>
            <p className="text-[#64748B] text-sm mt-0.5">One data model, {LENSES.length} lenses on it. Every number is computed in code.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#00338D]/10 border border-[#00338D]/20 text-[#00338D] text-[11px] font-bold uppercase tracking-wider">Proprietary</span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00B0A0]/10 border border-[#00B0A0]/25 text-[#007A70] text-[11px] font-semibold" title="Counted from the platform registry">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00B0A0] animate-pulse" />{wiredLenses} lenses wired · {liveTools} live data tools
            </span>
          </div>
        </motion.div>

        <div className="max-w-[1400px] mx-auto">
          {/* Query / event */}
          <Layer className="px-5 py-4">
            <p className="text-center text-[10.5px] font-bold uppercase tracking-widest text-[#94A3B8] mb-3">User query or event</p>
            <div className="grid md:grid-cols-3 gap-3">
              {examples.map(({ Icon, kind, text }) => (
                <div key={kind} className="flex items-start gap-2.5 rounded-xl bg-[#F7FAFD] border border-[#D6E4F2] px-3 py-2.5">
                  <Icon size={15} className="text-[#005EB8] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold text-[#64748B]">{kind}</p>
                    <p className="text-[12.5px] text-[#1A1F36] leading-snug">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Layer>
          <Connector delay={150} />

          {/* Orchestrator */}
          <div className="flex justify-center">
            <Layer className="px-6 py-3.5 flex items-center gap-3 max-w-xl w-full">
              <span className="w-10 h-10 rounded-xl bg-[#00338D] flex items-center justify-center flex-shrink-0"><RouteIcon size={18} className="text-white" /></span>
              <div className="flex-1">
                <p className="text-[14px] font-bold text-[#1A1F36]" style={FONT}>Orchestrator</p>
                <p className="text-[12px] text-[#64748B]">Parses the question or event and routes it to the lens that owns it.</p>
              </div>
              <Badge status="dataset" />
            </Layer>
          </div>
          <Fan count={LENSES.length} />

          {/* Lenses */}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${LENSES.length}, minmax(0, 1fr))` }}>
            {LENSES.map((l, i) => <LensCard key={l.id} lens={l} onHover={setHovered} delay={0.1 + i * 0.05} />)}
          </div>
          <Fan count={LENSES.length} direction="in" />

          {/* Deterministic engines */}
          <div className="relative border-y-2 border-[#00338D] bg-[#EAF1FB] px-6 py-5">
            <div className="flex flex-wrap items-start gap-4">
              <span className="w-11 h-11 rounded-xl bg-white border border-[#00338D]/25 flex items-center justify-center flex-shrink-0"><Cog size={20} className="text-[#00338D]" /></span>
              <div className="flex-1 min-w-[260px]">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00338D]">Deterministic engines</p>
                <p className="text-[15px] font-semibold text-[#1A1F36] mt-1" style={FONT}>Every number is computed in code from facility data.</p>
                <p className="text-[13px] text-[#334155]">The model parses questions and explains results. It never calculates, and every figure it writes is checked against the computed facts before it is shown.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {ENGINES.map((e) => {
                const on = activeEngines.has(e.id);
                return (
                  <span key={e.id} title={`lib/nexus/${e.module}`}
                    className="text-[11.5px] font-medium rounded-lg px-2.5 py-1 border transition-all"
                    style={on ? { background: '#00338D', color: '#FFFFFF', borderColor: '#00338D' } : { background: '#FFFFFF', color: '#1A1F36', borderColor: '#C9D7EC', opacity: hovered ? 0.55 : 1 }}>
                    {e.label}
                  </span>
                );
              })}
            </div>
            {hovered && <p className="text-[11px] text-[#00338D] mt-2">{hovered.label} runs on the highlighted engines.</p>}
          </div>
          <Connector delay={300} />

          {/* One data model */}
          <Layer className="px-6 py-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-10 h-10 rounded-xl bg-[#00338D]/10 border border-[#00338D]/20 flex items-center justify-center"><Database size={18} className="text-[#00338D]" /></span>
              <div>
                <p className="text-[14px] font-bold text-[#1A1F36]" style={FONT}>One data model</p>
                <p className="text-[12px] text-[#64748B]">Every lens reads the same records, so an answer on one screen traces to the same rows as every other.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {model.map(([label, n]) => (
                <div key={label} className="rounded-lg bg-[#F0F2F5] px-3 py-2">
                  <p className="text-[16px] font-semibold text-[#00338D] tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{n.toLocaleString('en-IN')}</p>
                  <p className="text-[11px] text-[#64748B]">{label}</p>
                </div>
              ))}
            </div>
          </Layer>
          <Connector delay={420} />

          {/* Data & tools */}
          <Layer className="px-6 py-4">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Data & tools</p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {TOOLS.map((t) => {
                const Logo = TOOL_LOGO[t.id];
                const inner = (
                  <div className={`flex items-start gap-3 rounded-xl border border-[#D8DCE3] p-3 h-full ${t.status === 'roadmap' ? 'opacity-70' : 'hover:border-[#005EB8]/40 hover:shadow-sm transition'}`}>
                    <Logo size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13.5px] font-bold text-[#1A1F36]" style={FONT}>{t.label}</p>
                        <Badge status={t.status} />
                      </div>
                      <p className="text-[12px] text-[#64748B]">{t.description}</p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">{t.detail}</p>
                    </div>
                  </div>
                );
                return t.href && t.status !== 'roadmap' ? <Link key={t.id} href={t.href}>{inner}</Link> : <div key={t.id}>{inner}</div>;
              })}
            </div>
          </Layer>

          {/* Badge legend */}
          <div className="flex flex-wrap items-center gap-5 mt-4 text-[11px] text-[#64748B]">
            {Object.entries(STATUS).map(([k, s]) => (
              <span key={k} className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} /><b style={{ color: s.color }}>{s.label}</b> {s.note.charAt(0).toLowerCase() + s.note.slice(1)}</span>
            ))}
          </div>
        </div>
      </div>
    </CCLayout>
  );
}
