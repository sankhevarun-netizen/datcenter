'use client';
// Water intelligence: where the portfolio draws water, how stressed each
// basin is, how much is fresh, when demand peaks, and what must be reported.
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Scale, CalendarClock, Droplets } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import WueChart from '@/components/nexus/WueChart';
import WaterCircularity from '@/components/nexus/WaterCircularity';
import { portfolioWater, waterImpactOfChange } from '@/lib/nexus/water-engine';
import { narrateWater } from '@/lib/nexus/water-brief';
import { cohortFor } from '@/lib/nexus/benchmark-engine';
import { fmtNumber, fmtUpTo } from '@/lib/nexus/format';
import { monthLabel, timeLabel } from '@/lib/nexus/time';

const WaterMap = dynamic(() => import('@/components/nexus/WaterMap'), { ssr: false, loading: () => <div className="h-full w-full bg-[#F0F2F5] animate-pulse" /> });
const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const STRESS_LEGEND = [['0–20', '#EBA36C'], ['20–40', '#E0864A'], ['40–60', '#CF6530'], ['60–80', '#B04A1E'], ['80–100', '#843412']];

function Tile({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-[#D8DCE3] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{label}</p>
      <p className="text-xl font-semibold text-[#1A1F36] tabular-nums" style={MONO}>{value}</p>
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
    narrateWater(data, { offline, signal: ctrl.signal, onText: (text) => { if (run.current === id) setState((s) => ({ ...s, text })); } })
      .then((r) => { if (run.current === id && r.source !== 'aborted') setState({ text: r.text, narrating: false, source: r.source }); });
    return () => ctrl.abort();
  }, [data, offline]);
  return (
    <section className="bg-[#F7FAFD] rounded-xl border border-[#D6E4F2] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#005EB8] mb-2">Water brief</p>
      {state.narrating && !state.text
        ? <div className="space-y-2 animate-pulse"><div className="h-2.5 bg-[#D6E4F2] rounded" /><div className="h-2.5 bg-[#D6E4F2] rounded w-5/6" /></div>
        : <p className="text-[13px] leading-relaxed text-[#1A1F36]">{state.text}</p>}
      {!state.narrating && state.text && <p className="text-[10px] text-[#94A3B8] mt-2">{state.source === 'llm' ? 'Written from the figures below; every number checked.' : 'Generated from the figures below.'}</p>}
    </section>
  );
}

export default function WaterPage() {
  const [offline, setOffline] = useState(null);
  const [selected, setSelected] = useState('CHN-1');
  const [addKw, setAddKw] = useState(1000);
  useEffect(() => { setOffline(new URLSearchParams(window.location.search).get('demo') === '1'); }, []);
  const data = useMemo(() => portfolioWater(), []);
  const t = data.totals;
  const live = data.sites.filter((s) => s.ytd);
  const site = data.sites.find((s) => s.id === selected);
  const median = cohortFor('WUE (L/kWh)', 'Tier III').p50_median;
  const impact = useMemo(() => waterImpactOfChange({ facilityId: selected, additionalLoadKw: Math.max(0, Number(addKw) || 0) }), [selected, addKw]);

  return (
    <CCLayout title="Water Intelligence">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Portfolio WUE" value={`${t.wue}`} sub={`L per IT kWh, ${monthLabel(data.month)}`} />
          <Tile label="Water drawn this year" value={`${fmtNumber(t.totalMl, 1)} ML`} sub={`${fmtNumber(t.freshMl, 1)} ML fresh · ${t.treatedSharePct}% treated`} />
          <Tile label="Fresh water from extreme-stress basins" value={`${t.extremeStressFreshSharePct}%`} sub={t.extremeStressSites.join(' and ')} />
          <Tile label="Open water alerts" value={t.alerts} sub={t.obligationsStarting.length ? `${t.obligationsStarting[0].jurisdiction} rules start in ${t.obligationsStarting[0].startsInDays} days` : 'No new obligations'} />
        </div>

        {offline !== null && <Brief data={data} offline={offline} />}

        <div className="grid xl:grid-cols-[1.3fr_1fr] gap-4">
          <section className="bg-white rounded-xl border border-[#D8DCE3] overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Basin stress and freshwater drawn</h2>
              <div className="flex items-center gap-1 text-[10px] text-[#64748B]">
                <span className="mr-1">Stress index</span>
                {STRESS_LEGEND.map(([l, c]) => <span key={l} className="flex items-center gap-1 mr-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{l}</span>)}
                <span className="ml-1">· size = fresh water drawn · hollow = not yet operating</span>
              </div>
            </div>
            <div className="h-[380px]"><WaterMap sites={data.sites} selected={selected} onSelect={setSelected} /></div>
          </section>

          <section className="bg-white rounded-xl border border-[#D8DCE3] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#1A1F36]">{site.name}</h2>
              <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Facility"
                className="text-xs text-[#334155] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-2 py-1">
                {data.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {site.ytd ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2.5"><p className="text-[10px] text-[#94A3B8] uppercase font-semibold">WUE, {monthLabel(site.latest.month, true)}</p><p className="font-semibold text-[#1A1F36]" style={MONO}>{site.latest.wue} <span className="text-[10px] text-[#94A3B8]">target {site.targetWue}</span></p><p className="text-[10px] text-[#64748B]">{site.benchmark.rank} vs {site.benchmark.cohort}</p></div>
                <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2.5"><p className="text-[10px] text-[#94A3B8] uppercase font-semibold">Basin stress</p><p className="font-semibold text-[#1A1F36]" style={MONO}>{site.stress.index}</p><p className="text-[10px] text-[#64748B]">{site.stress.label} · {site.source}</p></div>
                <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2.5"><p className="text-[10px] text-[#94A3B8] uppercase font-semibold">Peak demand</p><p className="font-semibold text-[#1A1F36]" style={MONO}>{site.peak.lpm} LPM</p><p className="text-[10px] text-[#64748B]">{monthLabel(site.peak.month)} · {site.peak.ratio}× that month's average</p></div>
                <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2.5"><p className="text-[10px] text-[#94A3B8] uppercase font-semibold">This year</p><p className="font-semibold text-[#1A1F36]" style={MONO}>{fmtUpTo(site.ytd.totalLitres / 1e6, 1)} ML</p><p className="text-[10px] text-[#64748B]">{site.ytd.treatedSharePct}% treated</p></div>
              </div>
            ) : (
              <p className="text-xs text-[#64748B]">Under construction; not yet drawing water. Design WUE {site.targetWue} L per IT kWh — {site.benchmark.rank} against {site.benchmark.cohort} peers.</p>
            )}
            <div className="rounded-lg border border-[#D6E4F2] bg-[#F7FAFD] p-2.5">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-[#334155]">
                What if we add
                <input type="number" min="0" step="100" value={addKw} onChange={(e) => setAddKw(e.target.value)} aria-label="Additional IT load in kW"
                  className="w-20 rounded-md border border-[#CBD5E1] bg-white px-2 py-0.5 text-xs" style={MONO} />
                kW of IT load?
              </label>
              <p className="text-xs text-[#1A1F36] mt-1.5">
                <strong style={MONO}>+{fmtNumber(impact.additionalLitresPerYear / 1e6, 2)} ML</strong> a year
                {impact.increasePct !== null && <> (+{impact.increasePct}% on today's run-rate)</>}, of which {fmtNumber(impact.additionalFreshLitresPerYear / 1e6, 2)} ML fresh. WUE stays {impact.wue} L/kWh.
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">{impact.stressContextNote}. {impact.reportableUnderPolicy ? 'The change is reportable under a water obligation at this site.' : 'No water-specific obligation applies at this site.'}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">Added load at the dataset's 47% average utilisation, at the site's reported WUE — the cascade engine's basis.</p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#334155] mb-1.5"><Scale size={12} /> Reporting obligations</p>
              <ul className="space-y-1.5">
                {site.obligations.map((o) => (
                  <li key={o.jurisdiction} className="text-xs rounded-lg border border-[#D8DCE3] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#1A1F36]">{o.jurisdiction} · {o.policy}</span>
                      {o.inForce
                        ? <span className="text-[10px] font-semibold text-[#00704A] bg-[#E6F6EF] rounded-full px-2 py-0.5 flex-shrink-0">In force</span>
                        : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B54708] bg-[#FEF0E6] rounded-full px-2 py-0.5 flex-shrink-0"><CalendarClock size={10} /> From {timeLabel(o.effectiveFrom)}</span>}
                    </div>
                    <p className="text-[#334155] mt-0.5">{o.obligation}</p>
                    <p className="text-[#94A3B8] text-[11px]">{o.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
            {site.alerts.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#334155] mb-1.5"><Droplets size={12} /> Open water alerts</p>
                {site.alerts.map((a) => (
                  <Link key={a.alertId} href={`/incidents?alert=${a.alertId}`} className="block text-xs text-[#005EB8] hover:underline">{a.alertId} · {a.componentId}: {a.message}</Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">Monthly WUE against target</h2>
          <WueChart sites={data.sites} median={median} />
        </section>

        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">Fresh and treated water, {monthLabel(t.ytdFrom, true)} to {monthLabel(t.ytdTo, true)}</h2>
          <div className="space-y-2">
            {live.sort((a, b) => b.ytd.totalLitres - a.ytd.totalLitres).map((s) => {
              const max = Math.max(...live.map((x) => x.ytd.totalLitres));
              return (
                <div key={s.id} className="grid grid-cols-[96px_1fr_150px] items-center gap-3 text-xs">
                  <span className="text-[#334155] truncate">{s.name.replace('Nexus ', '')}</span>
                  <div className="flex h-3.5" style={{ width: `${(s.ytd.totalLitres / max) * 100}%` }} title={`${fmtUpTo(s.ytd.freshLitres / 1e6, 1)} ML fresh, ${fmtUpTo(s.ytd.treatedLitres / 1e6, 1)} ML treated`}>
                    <div className="h-full rounded-l bg-[#005EB8]" style={{ width: `${100 - s.ytd.treatedSharePct}%` }} />
                    <div className="h-full rounded-r bg-[#00B0A0] border-l-2 border-white" style={{ width: `${s.ytd.treatedSharePct}%` }} />
                  </div>
                  <span className="text-[#64748B] text-right" style={MONO}>{fmtUpTo(s.ytd.totalLitres / 1e6, 1)} ML · {s.ytd.treatedSharePct}% treated</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-[#64748B]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#005EB8]" /> Fresh (municipal)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#00B0A0]" /> Treated recycle</span>
          </div>
        </section>

        <WaterCircularity />
      </div>
    </CCLayout>
  );
}
