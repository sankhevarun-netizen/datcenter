'use client';
// Site and supply risk: grid, natural hazard and water exposure per site,
// the interconnection position, and the supply chain behind recovery.
import { useEffect, useMemo, useRef, useState } from 'react';
import CCLayout from '@/components/command-center/CCLayout';
import { portfolioSiteRisk, WEIGHTS, BLEND, equipmentLabel } from '@/lib/nexus/site-risk-engine';
import { narrateSiteRisk } from '@/lib/nexus/site-risk-brief';
import { fmtNumber, fmtUpTo } from '@/lib/nexus/format';
import { nexus } from '@/lib/nexus/data';
import LiveConditions from '@/components/nexus/LiveConditions';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
// Validated sequential ramp (single hue, light → dark).
const RAMP = ['#EBA36C', '#E0864A', '#CF6530', '#B04A1E', '#843412'];
const cellColor = (pct) => RAMP[Math.min(RAMP.length - 1, Math.floor(pct / (100 / RAMP.length)))];
const inkOn = (pct) => (pct >= 60 ? '#FFFFFF' : '#1A1F36');
// Hazard levels 1–5 land on the five ramp steps.
const levelPct = (level) => (level - 1) * 25;
const equipment = equipmentLabel;
const BAND = {
  critical: { fg: '#B42318', bg: '#FDECEC', label: 'Critical' },
  high: { fg: '#B54708', bg: '#FEF0E6', label: 'High' },
  elevated: { fg: '#8A6508', bg: '#FBF3DE', label: 'Elevated' },
  low: { fg: '#00704A', bg: '#E6F6EF', label: 'Low' },
};

function Tile({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-[#D8DCE3] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{label}</p>
      <p className="text-xl font-semibold text-[#1A1F36]" style={MONO}>{value}</p>
      {sub && <p className="text-[11px] text-[#64748B]">{sub}</p>}
    </div>
  );
}

function Brief({ data, offline }) {
  const [state, setState] = useState({ text: '', narrating: true, source: null });
  const run = useRef(0);
  useEffect(() => {
    const id = ++run.current;
    const ctrl = new AbortController();
    narrateSiteRisk(data, { offline, signal: ctrl.signal, onText: (text) => { if (run.current === id) setState((s) => ({ ...s, text })); } })
      .then((r) => { if (run.current === id && r.source !== 'aborted') setState({ text: r.text, narrating: false, source: r.source }); });
    return () => ctrl.abort();
  }, [data, offline]);
  return (
    <section className="bg-[#F7FAFD] rounded-xl border border-[#D6E4F2] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#005EB8] mb-2">Risk brief</p>
      {state.narrating && !state.text
        ? <div className="space-y-2 animate-pulse"><div className="h-2.5 bg-[#D6E4F2] rounded" /><div className="h-2.5 bg-[#D6E4F2] rounded w-5/6" /></div>
        : <p className="text-[13px] leading-relaxed text-[#1A1F36]">{state.text}</p>}
      {!state.narrating && state.text && <p className="text-[10px] text-[#94A3B8] mt-2">{state.source === 'llm' ? 'Written from the scores below; every number checked.' : 'Generated from the scores below.'}</p>}
    </section>
  );
}

function Cell({ value, pct, title }) {
  return (
    <td className="p-0.5">
      <div title={title} className="rounded-md h-9 flex items-center justify-center text-xs font-semibold tabular-nums"
        style={{ background: cellColor(pct), color: inkOn(pct), ...MONO }}>{value}</div>
    </td>
  );
}

export default function SiteRiskPage() {
  const [offline, setOffline] = useState(null);
  useEffect(() => { setOffline(new URLSearchParams(window.location.search).get('demo') === '1'); }, []);
  const data = useMemo(() => portfolioSiteRisk(), []);
  const t = data.totals;

  return (
    <CCLayout title="Site & Supply Risk">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Highest-risk site" value={t.highestRisk.id} sub={`${t.highestRisk.composite} of 100 · ${BAND[t.highestRisk.band].label}`} />
          <Tile label="Grid-constrained sites" value={t.gridConstrained.length} sub={`${t.gridConstrained.join(', ')} at 90%+ of sanctioned load`} />
          <Tile label="Interconnection queue" value={t.queued.length ? `#${t.queued[0].position}` : '—'} sub={t.queued.length ? `${t.queued[0].id}, energisation ${t.queued[0].energisation}` : 'All sites connected'} />
          <Tile label="Single-source imports" value={t.singleSourceImported.length} sub={t.singleSourceImported.map(equipment).join(', ')} />
        </div>

        {offline !== null && <Brief data={data} offline={offline} />}

        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Exposure by site</h2>
            <p className="text-[10px] text-[#94A3B8]">Scores 0–100, hazard levels 1–5; darker is worse. Composite = {BLEND.mean * 100}% weighted mean (grid {WEIGHTS.grid * 100}%, hazard {WEIGHTS.hazard * 100}%, water {WEIGHTS.water * 100}%) + {BLEND.worst * 100}% worst part.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                  <th className="text-left font-semibold pb-2">Site</th>
                  <th className="font-semibold pb-2">Grid</th>
                  <th className="font-semibold pb-2">Seismic zone</th>
                  <th className="font-semibold pb-2">Flood</th>
                  <th className="font-semibold pb-2">Cyclone</th>
                  <th className="font-semibold pb-2">Heat</th>
                  <th className="font-semibold pb-2">Water stress</th>
                  <th className="font-semibold pb-2">Composite</th>
                  <th className="text-left font-semibold pb-2 pl-3">Driver</th>
                </tr>
              </thead>
              <tbody>
                {data.sites.map((s) => (
                  <tr key={s.id}>
                    <td className="pr-3 py-0.5">
                      <p className="font-semibold text-[#1A1F36]">{s.name.replace('Nexus ', '')}</p>
                      <p className="text-[10px] text-[#94A3B8]">{s.city}{s.status !== 'Operational' ? ' · under construction' : ''}</p>
                    </td>
                    <Cell value={fmtUpTo(s.grid.score, 0)} pct={s.grid.score} title={s.grid.evidence} />
                    <Cell value={s.hazard.seismicZone} pct={levelPct(s.hazard.levels.seismic)} title={`BIS IS 1893 zone ${s.hazard.seismicZone}`} />
                    <Cell value={s.hazard.levels.flood} pct={levelPct(s.hazard.levels.flood)} title={s.hazard.evidence} />
                    <Cell value={s.hazard.levels.cyclone} pct={levelPct(s.hazard.levels.cyclone)} title={s.hazard.evidence} />
                    <Cell value={s.hazard.levels.heat} pct={levelPct(s.hazard.levels.heat)} title={s.hazard.evidence} />
                    {s.water ? <Cell value={s.water.score} pct={s.water.score} title={s.water.evidence} /> : <td className="text-center text-[10px] text-[#94A3B8]">not drawing</td>}
                    <td className="p-0.5">
                      <div className="rounded-md h-9 flex items-center justify-center gap-1.5 text-xs font-bold border" style={{ background: BAND[s.band].bg, color: BAND[s.band].fg, borderColor: `${BAND[s.band].fg}33` }}>
                        <span style={MONO}>{fmtUpTo(s.composite, 1)}</span><span className="text-[10px] font-semibold">{BAND[s.band].label}</span>
                      </div>
                    </td>
                    <td className="pl-3 text-[11px] text-[#334155] capitalize">{s.driver === 'hazard' ? `natural hazard (${s.hazard.worst})` : s.driver === 'water' ? 'water stress' : 'grid'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-[#64748B]">
            <span className="mr-1">Low</span>{RAMP.map((c) => <span key={c} className="w-6 h-2.5 rounded-sm" style={{ background: c }} />)}<span className="ml-1">Severe</span>
            <span className="ml-3 text-[#94A3B8]">Hover a cell for its source.</span>
          </div>
        </section>

        <LiveConditions offline={offline} facilities={nexus.facilities.map((f) => ({ id: f.facility_id, name: f.name }))} />

        <div className="grid xl:grid-cols-2 gap-4">
          <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">Grid connection and headroom</h2>
            <div className="space-y-3">
              {data.grid.map((g) => (
                <div key={g.id}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#1A1F36]">{g.name.replace('Nexus ', '')} <span className="font-normal text-[#94A3B8]">· {g.utility} {g.voltageKv} kV · {g.feeds} feeds</span></span>
                    {g.status === 'Connected'
                      ? <span className="text-[#334155]" style={MONO}>{g.utilisedPct}% · {fmtNumber(g.headroomKw)} kW free</span>
                      : <span className="text-[#B54708] font-semibold">Queue #{g.queuePosition} · {g.energisation}</span>}
                  </div>
                  {g.status === 'Connected' ? (
                    <div className="mt-1 h-2.5 rounded-full bg-[#D8DCE3] overflow-hidden" role="img" aria-label={`${g.utilisedPct}% of sanctioned load`}>
                      <div className="h-full rounded-full" style={{ width: `${g.utilisedPct}%`, background: g.utilisedPct >= 95 ? '#C8102E' : g.utilisedPct >= 90 ? '#E87722' : '#005EB8' }} />
                    </div>
                  ) : <div className="mt-1 h-2.5 rounded-full border border-dashed border-[#CBD5E1]" />}
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">{fmtNumber(g.drawKw)} of {fmtNumber(g.sanctionedKw)} kW sanctioned · {g.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Supply chain behind recovery</h2>
            <p className="text-[10px] text-[#94A3B8] mb-3">Shared across the portfolio. Exposure weighs lead time, single sourcing and spares held.</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#94A3B8]">
                  <th className="font-semibold pb-1.5">Equipment</th><th className="font-semibold pb-1.5">Source</th>
                  <th className="font-semibold pb-1.5 text-right">Lead</th><th className="font-semibold pb-1.5 text-right">Exposure</th>
                </tr>
              </thead>
              <tbody>
                {data.supply.map((s) => (
                  <tr key={s.type} className="border-t border-[#F1F5F9] align-top" title={s.note}>
                    <td className="py-1.5 pr-2 text-[#1A1F36]">{equipment(s.type)}{s.singleSource && <span className="ml-1.5 text-[9px] font-bold uppercase text-[#B42318] bg-[#FDECEC] rounded px-1 py-0.5 whitespace-nowrap">single source</span>}</td>
                    <td className="py-1.5 pr-2 text-[#64748B]">{s.vendor} · {s.origin}<span className="block text-[10px] text-[#94A3B8]">{s.note}</span></td>
                    <td className="py-1.5 pr-2 text-right text-[#334155] whitespace-nowrap" style={MONO}>{s.leadWeeks} wk</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <span className="inline-block w-12 h-2 rounded-full bg-[#D8DCE3] overflow-hidden align-middle mr-1.5"><span className="block h-full rounded-full" style={{ width: `${s.exposure}%`, background: cellColor(s.exposure) }} /></span>
                      <span className="text-[#334155]" style={MONO}>{s.exposure}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </CCLayout>
  );
}
