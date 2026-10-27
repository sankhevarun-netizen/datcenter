'use client';
// Nexus portfolio: the six sites on the shared global-infrastructure map, a
// facility drill-down into every Nexus view, a comparison table, and an
// executive briefing that exports as a PDF.
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { FileDown, X, ArrowUpRight } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import GIIHeader from '@/modules/global-infrastructure/components/GIIHeader';
import SourceSwitch from '@/modules/global-infrastructure/components/SourceSwitch';
import { SkeletonBlock } from '@/modules/global-infrastructure/components/Skeleton';
import { fetchNexusFacilities } from '@/modules/global-infrastructure/services/nexusFacilityService';
import { HEALTH_COLORS } from '@/modules/global-infrastructure/components/map/healthColors';
import { facilityWater } from '@/lib/nexus/water-engine';
import { narratePortfolio } from '@/lib/nexus/portfolio-brief';
import { portfolioSummary } from '@/lib/nexus/portfolio';
import { exportPanelPdf } from '@/lib/export';
import { logEvent } from '@/lib/audit-client';
import { fmtNumber, fmtUpTo } from '@/lib/nexus/format';
import { timeLabel } from '@/lib/nexus/time';

const WorldMap = dynamic(() => import('@/modules/global-infrastructure/components/map/WorldMap'), {
  ssr: false, loading: () => <SkeletonBlock height="h-full" width="w-full" className="rounded-2xl" />,
});
const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const STATUS = {
  critical: { fg: '#B42318', bg: '#FDECEC', label: 'Critical' },
  serious: { fg: '#C2410C', bg: '#FEF0E6', label: 'Serious' },
  warning: { fg: '#8A6508', bg: '#FBF3DE', label: 'Warning' },
  good: { fg: '#00704A', bg: '#E6F6EF', label: 'Healthy' },
  commissioning: { fg: '#475569', bg: '#EEF2F7', label: 'Under construction' },
};
const BAND = { critical: 'Critical', high: 'High', elevated: 'Elevated', low: 'Low' };
const INDIA = { latitude: 21.5, longitude: 78.6, zoom: 5, key: 'india' };

// The map's three marker colours, re-used for each overlay with its own legend.
const OVERLAYS = {
  status: { label: 'Status', legend: [['healthy', 'Healthy'], ['warning', 'Serious or warning'], ['critical', 'Critical'], ['commissioning', 'Under construction']] },
  risk: { label: 'Site risk', legend: [['healthy', 'Low or elevated'], ['warning', 'High'], ['critical', 'Critical'], ['commissioning', 'No score']] },
  water: { label: 'Water stress', legend: [['healthy', 'Below high'], ['warning', 'High'], ['critical', 'Extremely high'], ['commissioning', 'Not drawing water']] },
};
function overlayHealth(f, mode) {
  if (mode === 'risk') return { critical: 'critical', high: 'warning', elevated: 'healthy', low: 'healthy' }[f.riskBand];
  if (mode === 'water') {
    const w = facilityWater(f.id);
    if (!w.stress) return 'commissioning';
    return w.stress.label === 'Extremely high' ? 'critical' : w.stress.label === 'High' ? 'warning' : 'healthy';
  }
  return f.health;
}

const COLUMNS = [
  { key: 'name', label: 'Facility', sort: (f) => f.name },
  { key: 'status', label: 'Status', sort: (f) => ['critical', 'serious', 'warning', 'good', 'commissioning'].indexOf(f.nexusHealth) },
  { key: 'itLoadMw', label: 'IT load MW', num: true, sort: (f) => f.itLoadMw },
  { key: 'utilizationPct', label: 'Utilisation', num: true, sort: (f) => f.utilizationPct },
  { key: 'pue', label: 'PUE', num: true, sort: (f) => f.pue },
  { key: 'wue', label: 'WUE', num: true, sort: (f) => f.wue },
  { key: 'renewablePct', label: 'Renewable', num: true, sort: (f) => f.renewablePct },
  { key: 'gridHeadroomKw', label: 'Grid headroom kW', num: true, sort: (f) => f.gridHeadroomKw },
  { key: 'riskScore', label: 'Site risk', num: true, sort: (f) => f.riskScore },
  { key: 'openAlerts', label: 'Open alerts', num: true, sort: (f) => f.openAlerts },
];

function Tile({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-[#D8DCE3] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{label}</p>
      <p className="text-xl font-semibold text-[#1A1F36]" style={MONO}>{value}</p>
      {sub && <p className="text-[11px] text-[#64748B]">{sub}</p>}
    </div>
  );
}

function Briefing({ offline, onReady }) {
  const [state, setState] = useState({ text: '', narrating: true, source: null });
  const run = useRef(0);
  useEffect(() => {
    const id = ++run.current;
    const ctrl = new AbortController();
    narratePortfolio({ offline, signal: ctrl.signal, onText: (text) => { if (run.current === id) setState((s) => ({ ...s, text })); } })
      .then((r) => { if (run.current === id && r.source !== 'aborted') { setState({ text: r.text, narrating: false, source: r.source }); onReady(true); } });
    return () => ctrl.abort();
  }, [offline, onReady]);
  return (
    <>
      {state.narrating && !state.text
        ? <div className="space-y-2 animate-pulse"><div className="h-2.5 bg-[#D6E4F2] rounded" /><div className="h-2.5 bg-[#D6E4F2] rounded w-5/6" /><div className="h-2.5 bg-[#D6E4F2] rounded w-2/3" /></div>
        : <p className="text-[13px] leading-relaxed text-[#1A1F36]">{state.text}</p>}
      {!state.narrating && state.text && <p className="text-[10px] text-[#94A3B8] mt-2">{state.source === 'llm' ? 'Written from portfolio figures; every number checked.' : 'Generated from portfolio figures.'}</p>}
    </>
  );
}

function Drilldown({ f, onClose }) {
  const st = STATUS[f.nexusHealth];
  const links = [
    { href: '/command-center', label: 'Command centre' },
    { href: `/incidents`, label: `Incident queue (${f.openAlerts} open)` },
    ...(f.hasComponentModel ? [{ href: '/command-center/capacity-simulation', label: 'Capacity and twin' }] : []),
    { href: '/command-center/water', label: 'Water' },
    { href: '/command-center/site-risk', label: 'Site risk' },
  ];
  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] p-4 h-full">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#1A1F36]">{f.name}</h3>
          <p className="text-[11px] text-[#64748B]">{f.city}, {f.state} · {f.tier} · since {f.commissionedYear}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-[#94A3B8] hover:text-[#1A1F36]"><X size={16} /></button>
      </div>
      <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        {f.status === 'Active' ? (
          <>
            <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2"><p className="text-[10px] text-[#94A3B8]">IT load</p><p className="font-semibold" style={MONO}>{fmtUpTo(f.itLoadMw, 2)} of {fmtUpTo(f.capacityMw, 1)} MW</p></div>
            <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2"><p className="text-[10px] text-[#94A3B8]">PUE · WUE</p><p className="font-semibold" style={MONO}>{f.pue} · {f.wue}</p></div>
            <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2"><p className="text-[10px] text-[#94A3B8]">Renewable</p><p className="font-semibold" style={MONO}>{f.renewablePct}% <span className="text-[10px] text-[#94A3B8] font-normal">{f.renewableRank}</span></p></div>
            <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2"><p className="text-[10px] text-[#94A3B8]">Grid</p><p className="font-semibold" style={MONO}>{fmtNumber(f.gridHeadroomKw)} kW free</p></div>
          </>
        ) : (
          <div className="col-span-2 rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2"><p className="text-[10px] text-[#94A3B8]">Pipeline</p><p className="font-semibold">{fmtUpTo(f.capacityMw, 1)} MW design · queue position {f.queuePosition}</p></div>
        )}
        <div className="col-span-2 rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2"><p className="text-[10px] text-[#94A3B8]">Site risk</p><p className="font-semibold" style={MONO}>{fmtUpTo(f.riskScore, 1)} of 100 · {BAND[f.riskBand]} <span className="text-[10px] font-normal text-[#94A3B8]">driven by {f.riskDriver === 'hazard' ? 'natural hazard' : f.riskDriver === 'water' ? 'water stress' : 'grid'}</span></p></div>
      </div>
      <div className="mt-3 space-y-1">
        {links.map((l) => (
          <Link key={l.label} href={l.href} className="flex items-center justify-between text-xs text-[#005EB8] hover:underline">{l.label}<ArrowUpRight size={12} /></Link>
        ))}
      </div>
    </div>
  );
}

export default function NexusPortfolioPage() {
  const [offline, setOffline] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState({ key: 'status', dir: 1 });
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef(null);
  useEffect(() => { setOffline(new URLSearchParams(window.location.search).get('demo') === '1'); }, []);

  const facilities = useMemo(() => fetchNexusFacilities(), []);
  const [overlay, setOverlay] = useState('status');
  const mapped = useMemo(() => facilities.map((f) => ({ ...f, health: overlayHealth(f, overlay) })), [facilities, overlay]);
  const summary = useMemo(() => portfolioSummary(), []);
  const t = summary.totals;
  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key);
    return [...facilities].sort((a, b) => {
      const va = col.sort(a), vb = col.sort(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [facilities, sort]);

  const doExport = async () => {
    logEvent('export', 'portfolio briefing pdf', { subject: `as of ${summary.asOf}` });
    setExporting(true);
    try { await exportPanelPdf(exportRef.current, 'nexus-portfolio-briefing.pdf'); } finally { setExporting(false); }
  };

  return (
    <CCLayout title="Nexus Portfolio">
      <div className="p-4">
        <GIIHeader title="Nexus Portfolio" subtitle="Where the Nexus sites are, how each is running, and what the board needs to decide"
          actions={<SourceSwitch active="nexus" />} />

        <div ref={exportRef} className="mt-4 space-y-4 bg-[#F0F2F5] p-0.5">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Tile label="Facilities" value={t.facilities} sub={`${t.operational} operating`} />
            <Tile label="Design IT capacity" value={`${fmtUpTo(t.designKw / 1000, 1)} MW`} sub={`${fmtUpTo(t.itLoadKw / 1000, 1)} MW in use`} />
            <Tile label="Portfolio PUE" value={t.pue} sub="energy-weighted" />
            <Tile label="Renewable share" value={`${t.renewablePct}%`} sub="of energy this month" />
            <Tile label="Availability" value={`${t.availability12mPct}%`} sub="12-month mean" />
            <Tile label="Open alerts" value={t.alerts} sub={`${t.alertCounts.critical} critical · ${t.alertCounts.high} high`} />
          </div>

          <section className="bg-[#F7FAFD] rounded-xl border border-[#D6E4F2] p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#005EB8]">Executive briefing · as of {timeLabel(summary.asOf)}</p>
              <button onClick={doExport} disabled={!ready || exporting} data-html2canvas-ignore
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00338D] hover:bg-[#002A73] text-white disabled:opacity-50">
                <FileDown size={13} /> {exporting ? 'Exporting…' : 'Export briefing (PDF)'}
              </button>
            </div>
            {offline !== null && <Briefing offline={offline} onReady={setReady} />}
          </section>

          <div className="flex flex-col lg:flex-row gap-4" data-html2canvas-ignore>
            <div className="w-full lg:w-[68%] relative h-[420px] lg:h-[520px]">
              <WorldMap facilities={mapped} selectedFacilityId={selected?.id} onMarkerClick={(f) => setSelected(facilities.find((x) => x.id === f.id))} flyToTarget={INDIA} mode="light" />
              <div className="absolute top-3 right-3 z-[500] bg-white/95 border border-[#D8DCE3] rounded-lg shadow-sm p-2 text-[11px]">
                <label className="flex items-center gap-2 font-semibold text-[#334155]">Colour by
                  <select value={overlay} onChange={(e) => setOverlay(e.target.value)} className="rounded border border-[#CBD5E1] px-1.5 py-0.5 text-[11px]">
                    {Object.entries(OVERLAYS).map(([id, o]) => <option key={id} value={id}>{o.label}</option>)}
                  </select>
                </label>
                <ul className="mt-1.5 space-y-0.5">
                  {OVERLAYS[overlay].legend.map(([k, label]) => (
                    <li key={k} className="flex items-center gap-1.5 text-[#475569]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: HEALTH_COLORS[k] }} />{label}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="w-full lg:w-[32%]">
              {selected ? <Drilldown f={selected} onClose={() => setSelected(null)} /> : (
                <div className="bg-white rounded-2xl border border-[#D8DCE3] p-4 h-full text-xs text-[#64748B]">
                  Select a facility on the map or in the table to see its figures and open its views. Marker colour follows the overlay chosen on the map.
                </div>
              )}
            </div>
          </div>

          <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">Facilities · click a heading to sort</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[860px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                    {COLUMNS.map((c) => (
                      <th key={c.key} className={`font-semibold pb-2 ${c.num ? 'text-right' : 'text-left'}`}>
                        <button onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))} className="uppercase tracking-wider hover:text-[#1A1F36]">
                          {c.label}{sort.key === c.key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f) => {
                    const st = STATUS[f.nexusHealth];
                    const live = f.status === 'Active';
                    return (
                      <tr key={f.id} onClick={() => setSelected(f)} className={`border-t border-[#F1F5F9] cursor-pointer ${selected?.id === f.id ? 'bg-[#F0F6FC]' : 'hover:bg-[#F8FAFC]'}`}>
                        <td className="py-2 pr-2"><span className="font-semibold text-[#1A1F36]">{f.name}</span><span className="block text-[10px] text-[#94A3B8]">{f.city}</span></td>
                        <td className="py-2 pr-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>{st.label}</span></td>
                        {[
                          live ? fmtUpTo(f.itLoadMw, 2) : '—',
                          live ? `${f.utilizationPct}%` : '—',
                          live ? f.pue : `${f.pue} design`,
                          live ? f.wue : `${f.wue} design`,
                          `${f.renewablePct}%`,
                          live ? fmtNumber(f.gridHeadroomKw) : `queue #${f.queuePosition}`,
                          `${fmtUpTo(f.riskScore, 1)} · ${BAND[f.riskBand]}`,
                          f.openAlerts,
                        ].map((v, i) => <td key={i} className="py-2 pr-2 text-right tabular-nums text-[#334155] whitespace-nowrap" style={MONO}>{v}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

      </div>
    </CCLayout>
  );
}
