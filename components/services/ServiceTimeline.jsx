'use client';
// Services: the full advisory lifecycle on one horizontal timeline. Four
// phase zones; each service sits above or below the line, joined to it by a
// stem. Every badge and every count comes from lib/platform-registry.js:
// Live services open their screen, Dataset and Roadmap services explain
// themselves in place. Nothing here is typed twice.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Briefcase, TrendingUp, ShieldAlert, BarChart3, Package, Wrench, FileText, HardHat, Scale, Monitor,
  AlertTriangle, Radar, Gauge, Droplets, SunMedium, FileCheck2, IndianRupee, Users, Network, Landmark,
  ChevronDown, ArrowRight, ArrowUpRight, Compass, Box, Settings, Coins, X,
} from 'lucide-react';
import { PHASES, STOPS, STATUS, countBy } from '@/lib/platform-registry';
import StatusBadge, { StatusCount } from '@/components/shared/StatusBadge';

const ICON = {
  globe: Globe, briefcase: Briefcase, trend: TrendingUp, shield: ShieldAlert, chart: BarChart3, package: Package, wrench: Wrench,
  file: FileText, hardhat: HardHat, scale: Scale, monitor: Monitor, alert: AlertTriangle, radar: Radar, gauge: Gauge,
  droplet: Droplets, sun: SunMedium, filecheck: FileCheck2, dollar: IndianRupee, users: Users, network: Network, bank: Landmark,
};
const PHASE_ICON = { strategise: Compass, build: Box, operate: Settings, monetise: Coins };
const ORDER = ['live', 'dataset', 'roadmap'];
const FONT = { fontFamily: "'Inter', 'Segoe UI', sans-serif" };
// Track geometry (px): cards above, the line, cards below.
// Cards have a minimum height and grow away from the line (up above it, down below it).
const TOP = 214, LINE = 56, CARD_H = 146, GAP = 18, BELOW = 200;
const LINE_Y = TOP + LINE / 2;
// Laid out at this width; narrower screens get the same composition, scaled.
const DESIGN_W = 1760;

function HeaderPill({ status, items, children }) {
  const [open, setOpen] = useState(false);
  const s = status ? STATUS[status] : null;
  return (
    <span className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold cursor-default"
        style={s ? { color: s.text, background: s.bg, borderColor: `${s.color}55` } : { color: '#1A1F36', borderColor: '#D8DCE3' }}>
        {s && <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color, boxShadow: status === 'live' ? `0 0 0 3px ${s.color}33` : 'none' }} />}
        {children}
      </span>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute right-0 top-full mt-2 z-40 w-64 max-h-80 overflow-auto rounded-xl bg-white border border-[#D8DCE3] shadow-xl p-3">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">{items.length} {s ? s.countLabel : 'services'}</p>
            <ul className="space-y-1">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 text-[12px] text-[#1A1F36]">
                  <span>{i.title}</span>{!s && <StatusBadge status={i.status} variant="dot" size="sm" />}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

function ServiceCard({ stop, phase, below, onHover, open, onToggle }) {
  const router = useRouter();
  const Icon = ICON[stop.icon] ?? Globe;
  const live = stop.status === 'live';
  const roadmap = stop.status === 'roadmap';
  const activate = () => (live ? router.push(stop.href) : onToggle());
  return (
    <div className="relative">
      <motion.button type="button" onClick={activate} onMouseEnter={() => onHover(stop.id)} onMouseLeave={() => onHover(null)}
        whileHover={live ? { y: -2 } : undefined}
        aria-label={`${stop.title}: ${STATUS[stop.status].label}${live ? ', opens the screen' : ''}`}
        style={{ minHeight: CARD_H }} className={`w-full text-left rounded-xl bg-white border border-[#E2E8F0] p-3 flex flex-col transition-shadow ${live ? 'cursor-pointer shadow-[0_2px_10px_rgba(15,45,82,0.07)] hover:shadow-[0_10px_24px_rgba(15,45,82,0.14)]' : 'cursor-default shadow-[0_1px_4px_rgba(15,45,82,0.05)]'} ${roadmap ? 'opacity-70' : ''}`}>
        <span className="flex items-start justify-between">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${phase.color}14` }}><Icon size={16} style={{ color: phase.color }} /></span>
          {live && <ArrowUpRight size={14} className="text-[#94A3B8]" />}
        </span>
        <span className="block text-[13px] font-bold text-[#1A1F36] leading-tight mt-2">{stop.title}</span>
        <span className="block text-[11.5px] text-[#64748B] leading-snug mt-0.5">{stop.role}</span>
        <span className="mt-auto pt-1.5"><StatusBadge status={stop.status} size="sm" /></span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: below ? -4 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`absolute left-1/2 -translate-x-1/2 z-30 w-60 rounded-xl bg-white border border-[#D8DCE3] shadow-xl p-3 ${below ? 'top-full mt-2' : 'bottom-full mb-2'}`}
            role="dialog" aria-label={stop.title}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12.5px] font-bold text-[#1A1F36]">{stop.title}</p>
              <button type="button" onClick={onToggle} aria-label="Close" className="text-[#94A3B8] hover:text-[#1A1F36]"><X size={14} /></button>
            </div>
            <p className="text-[12px] text-[#334155] mt-1 leading-snug">{stop.description}</p>
            <p className="flex items-start gap-1.5 text-[11px] mt-2 leading-snug" style={{ color: STATUS[stop.status].text }}>
              <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: STATUS[stop.status].color }} />{STATUS[stop.status].note}.
            </p>
            {stop.href && !roadmap && (
              <Link href={stop.href} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#005EB8] hover:underline mt-2">Open the screen <ArrowRight size={12} /></Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Zone({ phase, number, stops, first, last, single, hovered, setHovered, openId, setOpenId }) {
  const Icon = PHASE_ICON[phase.id];
  const top = stops.filter((_, i) => i % 2 === 0);
  const bottom = stops.filter((_, i) => i % 2 === 1);
  const xOf = (row, k) => ((k + 0.5) / row.length) * 100;
  const placed = [...top.map((s, k) => ({ s, x: xOf(top, k), below: false })), ...bottom.map((s, k) => ({ s, x: xOf(bottom, k), below: true }))];
  return (
    <section className="relative flex flex-col min-w-0" style={{
      // Width follows the number of services, with a floor so a short phase keeps room for its header.
      flexGrow: single ? 1 : Math.max(stops.length, 5), flexBasis: 0,
      background: `linear-gradient(180deg, ${phase.color}10 0%, ${phase.color}08 60%, ${phase.color}05 100%)`,
      borderLeft: first ? 'none' : `3px solid ${phase.color}`,
    }}>
      {/* Phase header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-[30px] font-light leading-none tabular-nums" style={{ color: `${phase.color}99` }}>{String(number).padStart(2, '0')}</span>
          <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: phase.color }}><Icon size={20} className="text-white" /></span>
          <div className="min-w-0">
            <p className="text-[16px] font-extrabold tracking-[0.16em] uppercase" style={{ color: phase.color }}>{phase.label}</p>
            <p className="text-[12.5px] text-[#475569] leading-snug mt-0.5">{phase.purpose}</p>
          </div>
        </div>
        <div className="flex-shrink-0 space-y-0.5">
          <p className="text-[12.5px] font-bold text-[#1A1F36]">{stops.length} services</p>
          {ORDER.map((st) => <p key={st}><StatusCount status={st} count={countBy(stops, st)} size="sm" /></p>)}
        </div>
      </div>

      {/* Track */}
      <div className="relative mx-3" style={{ height: TOP + LINE / 2 + BELOW }}>
        {/* the line: one stroke per zone, meeting edge to edge across zones */}
        <div className="absolute h-[3px]" style={{ top: LINE_Y - 1.5, left: first ? 6 : -12, right: last ? 14 : -12, background: phase.color }} />
        {last && (
          <svg className="absolute" style={{ top: LINE_Y - 8, right: 2 }} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M3 2 L13 8 L3 14" fill="none" stroke={phase.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {placed.map(({ s, x, below }) => {
          const on = hovered === s.id;
          return (
            <div key={s.id}>
              {/* stem */}
              <div className="absolute w-px" style={{ left: `${x}%`, top: below ? LINE_Y : TOP - GAP, height: below ? LINE / 2 + GAP : GAP + LINE / 2, background: phase.color, opacity: on ? 1 : 0.55, width: on ? 2 : 1 }} />
              {/* dot */}
              <motion.span key={on ? `${s.id}-on` : s.id} className="absolute rounded-full bg-white flex items-center justify-center"
                style={{ left: `${x}%`, top: LINE_Y, width: below ? 12 : 22, height: below ? 12 : 22, marginLeft: below ? -6 : -11, marginTop: below ? -6 : -11, border: `${below ? 2 : 2.5}px solid ${phase.color}`, boxShadow: s.status === 'live' ? `0 0 0 4px ${STATUS.live.color}26` : 'none' }}
                animate={on && s.status === 'live' ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.5 }}>
                <span className={`${below ? 'w-1 h-1' : 'w-2.5 h-2.5'} rounded-full`} style={{ background: s.status === 'roadmap' ? '#FFFFFF' : phase.color, border: s.status === 'roadmap' ? `1.5px dashed ${phase.color}` : 'none' }} />
              </motion.span>
              {/* card */}
              <div className="absolute px-1.5" style={{
                left: `${(below ? xOf(bottom, bottom.indexOf(s)) : xOf(top, top.indexOf(s))) - 50 / (below ? bottom : top).length}%`,
                width: `${100 / (below ? bottom : top).length}%`,
                ...(below ? { top: LINE_Y + LINE / 2 + GAP } : { bottom: TOP + LINE / 2 + BELOW - (TOP - GAP) }),
                zIndex: openId === s.id ? 30 : 1,
              }}>
                <ServiceCard stop={s} phase={phase} below={below} onHover={setHovered} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ServiceTimeline() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [hovered, setHovered] = useState(null);
  const [openId, setOpenId] = useState(null);
  const visible = filter === 'all' ? PHASES : PHASES.filter((p) => p.id === filter);
  const scrollRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => { const w = scrollRef.current?.clientWidth ?? DESIGN_W; setScale(Math.min(1, w / DESIGN_W)); };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const byStatus = useMemo(() => Object.fromEntries(ORDER.map((s) => [s, STOPS.filter((x) => x.status === s)])), []);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden" style={FONT}>
      {/* Header strip */}
      <header className="flex-shrink-0 border-b border-[#E2E8F0] px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => router.back()} aria-label="Close" className="w-8 h-8 rounded-lg border border-[#D8DCE3] flex items-center justify-center hover:bg-[#F0F2F5] text-[#64748B]"><X size={15} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kpmg-logo-navy.svg" alt="KPMG" className="h-7 w-auto" />
          <span className="w-px h-10 bg-[#D8DCE3]" />
          <div>
            <h1 className="text-[20px] font-bold text-[#1A1F36] leading-tight">Services</h1>
            <p className="text-[13px] text-[#64748B]">Datacentre Advisory · Full Lifecycle Service Map</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <HeaderPill status="live" items={byStatus.live}>{byStatus.live.length} Live</HeaderPill>
          <HeaderPill status="dataset" items={byStatus.dataset}>{byStatus.dataset.length} on dataset</HeaderPill>
          {byStatus.roadmap.length > 0 && <HeaderPill status="roadmap" items={byStatus.roadmap}>{byStatus.roadmap.length} roadmap</HeaderPill>}
          <HeaderPill items={STOPS}>{STOPS.length} stops</HeaderPill>
          <label className="relative ml-1">
            <span className="sr-only">View by phase</span>
            <select value={filter} onChange={(e) => { setFilter(e.target.value); setOpenId(null); }}
              className="appearance-none rounded-lg border border-[#D8DCE3] bg-white pl-3.5 pr-9 py-2 text-[13px] font-semibold text-[#00338D] cursor-pointer">
              <option value="all">View by Phase: All</option>
              {PHASES.map((p) => <option key={p.id} value={p.id}>View by Phase: {p.label}</option>)}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
          </label>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden" onClick={(e) => { if (e.target === e.currentTarget) setOpenId(null); }}>
        <div className="px-6 py-5" style={scale < 1 ? { width: DESIGN_W, zoom: scale } : undefined}>
          {/* Phase zones on one timeline */}
          <div className="flex rounded-2xl overflow-visible">
            {visible.map((p, i) => (
              <Zone key={p.id} phase={p} number={PHASES.indexOf(p) + 1} stops={STOPS.filter((s) => s.phase === p.id)}
                first={i === 0} last={i === visible.length - 1} single={visible.length === 1}
                hovered={hovered} setHovered={setHovered} openId={openId} setOpenId={setOpenId} />
            ))}
          </div>

          {/* Phase summary cards */}
          <div className="grid grid-cols-4 gap-4 mt-5">
            {PHASES.map((p) => {
              const Icon = PHASE_ICON[p.id];
              const stops = STOPS.filter((s) => s.phase === p.id);
              const active = filter === p.id;
              return (
                <div key={p.id} className="rounded-2xl bg-white border border-[#E2E8F0] p-4 shadow-[0_1px_4px_rgba(15,45,82,0.05)]" style={{ borderTop: `3px solid ${p.color}`, outline: active ? `2px solid ${p.color}55` : 'none' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: p.color }}><Icon size={17} className="text-white" /></span>
                    <span className="text-[14px] font-extrabold tracking-[0.1em] uppercase text-[#1A1F36]">{p.label}</span>
                  </div>
                  <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 mt-3">
                    <div><p className="text-[30px] font-semibold leading-none tabular-nums" style={{ color: p.color }}>{stops.length}</p><p className="text-[12px] text-[#64748B]">services</p></div>
                    <div className="space-y-0.5 border-r border-[#E2E8F0] pr-4">
                      {ORDER.map((st) => <p key={st}><StatusCount status={st} count={countBy(stops, st)} size="sm" /></p>)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[#1A1F36]">Key outcomes</p>
                      <p className="text-[12px] text-[#475569] leading-snug">{p.outcomes}</p>
                    </div>
                    <button type="button" onClick={() => setFilter(active ? 'all' : p.id)} aria-label={active ? 'Show all phases' : `Show ${p.label} only`}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition hover:brightness-95" style={{ background: `${p.color}18`, color: p.color }}>
                      <ArrowRight size={16} className={active ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11.5px] text-[#64748B] mt-4">Live services open their screen. Dataset and roadmap services explain themselves when clicked. Counts are computed from the service list.</p>
        </div>
      </div>
    </div>
  );
}
