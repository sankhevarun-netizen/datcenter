'use client';
// Clean energy, hour by hour: how far Mumbai-1's power is from 24/7
// carbon-free matching, what annual reporting hides, what a battery changes,
// and the actions ranked across energy, water and carbon. Every figure comes
// from lib/nexus engines over the dataset; the brief only words them.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { CloudRain, BatteryCharging, Factory, Info } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { matchingScore, matchingWithStorage, cloudyDayStressTest, currentPosition, ppaOf, batteriesOf } from '@/lib/nexus/cfe-engine';
import { scope2Emissions, scope2Scenario, embodiedCarbonOfStranded } from '@/lib/nexus/carbon-engine';
import { recommendedActions } from '@/lib/nexus/procurement-advisor';
import { narrateCfe, PRECEDENT } from '@/lib/nexus/cfe-brief';
import { getFacility } from '@/lib/nexus/data';
import { fmtNumber, fmtLakh } from '@/lib/nexus/format';
import { monthLabel, timeLabel } from '@/lib/nexus/time';

const FACILITY = 'MUM-1';
const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const C = { navy: '#00338D', blue: '#005EB8', teal: '#00B0A0', crimson: '#C8102E', amber: '#E87722', ink: '#1A1F36', muted: '#64748B', border: '#D8DCE3' };
const STAGES = [['today', 'Today'], ['ppa', 'With solar PPA'], ['battery', 'PPA + battery']];
const SOURCES = [
  ['Princeton Digital Group, Tata Power Renewable Energy and Flexidao: India’s first hourly CFE matching scheme, MU1 Mumbai', 'https://www.datacenterdynamics.com/en/news/pdg-to-implement-indias-first-carbon-free-energy-matching-scheme-at-mu1-campus-in-mumbai/'],
  ['RECs are reconciled annually and detached from generation time and place', 'https://feeds.optenpower.com/blog/compass-datacenters-clean-energy-procurement'],
  ['Hyperscalers now require hourly-matched clean energy', 'https://feeds.optenpower.com/blog/ppa-data-center-news'],
  ['India corporate renewable sourcing 23% → 39% (Global Renewables Alliance, May 2026)', 'https://globalrenewablesalliance.org/wp-content/uploads/2026/05/GRA-Report-24-7-carbon-free-energy.pdf'],
  ['Google’s India PPAs for 24/7 CFE, including Navi Mumbai', 'https://www.datacenterdynamics.com/en/news/google-inks-three-ppas-across-the-us-and-india/'],
  ['Battery cost: Ember, How cheap is battery storage? (Dec 2025)', 'https://ember-energy.org/app/uploads/2025/12/How-cheap-is-battery-storage-PDF.pdf'],
];
// Compact money for table cells: crore from ₹1 crore up, lakh below.
const money = (lakh) => (lakh >= 100 ? `₹${fmtNumber(lakh / 100, lakh >= 1000 ? 0 : 1)} crore` : `₹${fmtNumber(lakh, 0)} lakh`);
const hh = (h) => `${String(h).padStart(2, '0')}:00`;

function Tile({ label, value, sub, tone = C.ink }) {
  return (
    <div className="bg-white rounded-xl border border-[#D8DCE3] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ ...MONO, color: tone }}>{value}</p>
      {sub && <p className="text-[11px] text-[#64748B] leading-snug">{sub}</p>}
    </div>
  );
}

function Brief({ payload, offline }) {
  const [state, setState] = useState({ text: '', narrating: true, source: null });
  const run = useRef(0);
  useEffect(() => {
    const id = ++run.current;
    const ctrl = new AbortController();
    narrateCfe(payload, { offline, signal: ctrl.signal, onText: (text) => { if (run.current === id) setState((s) => ({ ...s, text })); } })
      .then((r) => { if (run.current === id && r.source !== 'aborted') setState({ text: r.text, narrating: false, source: r.source }); });
    return () => ctrl.abort();
  }, [payload, offline]);
  return (
    <section className="bg-[#F7FAFD] rounded-xl border border-[#D6E4F2] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#005EB8] mb-2">Clean-energy brief</p>
      {state.narrating && !state.text
        ? <div className="space-y-2 animate-pulse"><div className="h-2.5 bg-[#D6E4F2] rounded" /><div className="h-2.5 bg-[#D6E4F2] rounded w-5/6" /></div>
        : <p className="text-[13px] leading-relaxed text-[#1A1F36]">{state.text}</p>}
      <p className="text-[10.5px] text-[#64748B] mt-3 pt-2 border-t border-[#D6E4F2]">
        Hourly CFE matching modelled on {PRECEDENT}
      </p>
    </section>
  );
}

function ProfileTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-[#D8DCE3] rounded-lg shadow-lg px-3 py-2 text-[11.5px]">
      <p className="font-semibold text-[#1A1F36]">{hh(label)}–{hh((label + 1) % 24)}</p>
      <p className="text-[#64748B]">Load <b className="text-[#1A1F36]" style={MONO}>{fmtNumber(p.load, 1)} MW</b></p>
      <p className="text-[#64748B]">Matched solar <b style={{ ...MONO, color: C.teal }}>{fmtNumber(p.solar, 1)} MW</b></p>
      {p.storage > 0 && <p className="text-[#64748B]">From battery <b style={{ ...MONO, color: C.blue }}>{fmtNumber(p.storage, 1)} MW</b></p>}
      <p className="text-[#64748B]">Grid fallback <b style={{ ...MONO, color: C.crimson }}>{fmtNumber(p.gap, 1)} MW</b></p>
      <p className="text-[#64748B]">Matched <b className="text-[#1A1F36]" style={MONO}>{p.pct}%</b></p>
    </div>
  );
}

const CATEGORY = { storage: ['Storage', C.blue], procurement: ['Procurement', C.navy], efficiency: ['Efficiency', C.teal], water: ['Water', '#0E7490'] };

export default function CleanEnergyPage() {
  const [offline, setOffline] = useState(null);
  const [stage, setStage] = useState('ppa');
  const reference = useMemo(() => batteriesOf(FACILITY).find((b) => b.asset_id.endsWith('-A')), []);
  const [batteryMwh, setBatteryMwh] = useState(reference ? reference.capacity_kwh / 1000 : 120);
  useEffect(() => { setOffline(new URLSearchParams(window.location.search).get('demo') === '1'); }, []);

  const facility = getFacility(FACILITY);
  const today = useMemo(() => currentPosition(FACILITY), []);
  const score = useMemo(() => matchingScore(FACILITY), []);
  const ppa = useMemo(() => ppaOf(FACILITY), []);
  const cloudy = useMemo(() => cloudyDayStressTest(FACILITY), []);
  const sized = useMemo(() => matchingWithStorage(FACILITY, reference.asset_id), [reference]);
  const battery = useMemo(() => (batteryMwh * 1000 === reference.capacity_kwh ? sized : matchingWithStorage(FACILITY, { capacityKwh: batteryMwh * 1000, powerKw: (batteryMwh * 1000) / 4 })), [batteryMwh, reference, sized]);
  const scope2 = useMemo(() => scope2Emissions(FACILITY), []);
  const embodied = useMemo(() => embodiedCarbonOfStranded(FACILITY), []);
  const actions = useMemo(() => recommendedActions(FACILITY), []);
  const briefPayload = useMemo(() => ({ facilityId: FACILITY, today, score, storage: sized, cloudy }), [today, score, sized, cloudy]);

  const profile = stage === 'battery' ? battery.hourlyProfile : score.hourlyProfile;
  const chart = profile.map((p) => {
    const load = p.loadKw / 1000;
    const solar = stage === 'today' ? 0 : p.matchedKw / 1000;
    const storage = stage === 'battery' ? p.storageKw / 1000 : 0;
    return { hour: p.hour, load, solar, storage, gap: Math.max(0, load - solar - storage), pct: stage === 'today' ? 0 : p.matchingPct };
  });
  const matched = stage === 'today' ? today.hourlyVerifiedPct : stage === 'ppa' ? score.matchedPct : battery.matchedPctAfter;
  const reported = stage === 'today' ? today.reportedRenewablePct : score.comparedToAnnualRec.annualRecPct;
  const overnight = stage === 'today' ? 0 : stage === 'ppa' ? score.overnightPct : battery.overnightPctAfter;
  const cleanHours = Math.round((matched / 100) * 24 * 10) / 10;
  const factor = today.gridCarbonKgPerKwh;
  const scenarios = [
    ['Today (recorded)', scope2.annualisedNetTco2, C.muted],
    ['With solar PPA', scope2Scenario({ loadMwhPerYear: scope2.annualisedLoadMwh, cleanSharePct: score.matchedPct, factorKgPerKwh: factor }).tco2PerYear, C.navy],
    [`PPA + ${batteryMwh} MWh battery`, scope2Scenario({ loadMwhPerYear: scope2.annualisedLoadMwh, cleanSharePct: battery.matchedPctAfter, factorKgPerKwh: factor }).tco2PerYear, C.teal],
  ];

  return (
    <CCLayout title="Clean Energy (24/7)">
      <div className="p-6 space-y-4">
        {/* Stage switch */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-[#00338D]">{facility.name}: hourly carbon-free energy matching</h1>
            <p className="text-[12px] text-[#64748B]">Annual reporting adds a year of clean power against a year of load. Hourly matching counts only clean power used in the hour it is generated.</p>
          </div>
          <div className="flex p-1 rounded-xl bg-white border border-[#D8DCE3] gap-1" role="tablist" aria-label="Scenario">
            {STAGES.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={stage === id} onClick={() => setStage(id)}
                className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition ${stage === id ? 'bg-[#00338D] text-white' : 'text-[#64748B] hover:text-[#00338D]'}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Actual 24/7 CFE matching" value={`${matched}%`} tone={C.teal}
            sub={stage === 'today' ? 'Certificates carry no generation hour; nothing is verified hourly' : `Clean power used in the hour it was generated, ${score.sample.days} representative days`} />
          <Tile label="What's reported today (RECs)" value={`${reported}%`}
            sub={stage === 'today' ? `13_energy, ${monthLabel(today.from)} to ${monthLabel(today.to)}` : `Annual volumetric, ${(ppa.power_kw / 1000).toFixed(1)} MW solar PPA`} />
          <Tile label="Hidden by annual reporting" value={`${Math.round((reported - matched) * 10) / 10} pts`} tone={C.crimson}
            sub={score.worstHourBand ? `Concentrated ${hh(score.worstHourBand.startHour)}–${hh(score.worstHourBand.endHour)}, overnight ${overnight}% matched` : null} />
          <Tile label="Clean-power hours" value={`${cleanHours} of 24`} tone={C.navy} sub="The matched share of a day's load, in hours" />
        </div>

        {/* Hero chart */}
        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">24-hour matching profile, average day</h2>
              <p className="text-[11.5px] text-[#64748B]">Facility load against clean power used in the same hour. The red band is grid fallback.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#64748B]">
              <span className="flex items-center gap-1.5"><span className="w-4 h-[2.5px] rounded" style={{ background: C.navy }} />Load</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: C.teal }} />Matched solar</span>
              {stage === 'battery' && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: C.blue }} />From battery</span>}
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: '#F4C7CF' }} />Grid fallback</span>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 800, height: 280 }}>
              <ComposedChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
                <CartesianGrid vertical={false} stroke="#EEF2F8" />
                <XAxis dataKey="hour" tickFormatter={hh} interval={2} tickLine={false} axisLine={{ stroke: C.border }} tick={{ fill: C.muted, fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: C.muted, fontSize: 11 }} unit=" MW" width={62} />
                <Tooltip content={<ProfileTooltip />} />
                <Area type="monotone" dataKey="solar" stackId="s" stroke={C.teal} fill={C.teal} fillOpacity={0.85} isAnimationActive animationDuration={600} />
                <Area type="monotone" dataKey="storage" stackId="s" stroke={C.blue} fill={C.blue} fillOpacity={0.85} isAnimationActive animationDuration={600} />
                <Area type="monotone" dataKey="gap" stackId="s" stroke="#E8A1AE" fill="#F4C7CF" fillOpacity={0.9} isAnimationActive animationDuration={600} />
                <Line type="monotone" dataKey="load" stroke={C.navy} strokeWidth={2.2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {stage === 'battery' && (
            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-[#F0F2F5] px-4 py-3">
              <BatteryCharging size={18} style={{ color: C.blue }} />
              <label className="flex items-center gap-3 text-[12.5px] text-[#1A1F36] font-semibold">
                Battery size
                <input type="range" min={0} max={200} step={10} value={batteryMwh} onChange={(e) => setBatteryMwh(Number(e.target.value))} className="w-56 accent-[#005EB8]" aria-label="Battery size in MWh" />
                <span style={MONO}>{batteryMwh} MWh / {batteryMwh / 4} MW</span>
              </label>
              <span className="text-[12px] text-[#64748B]">Overnight <b className="text-[#1A1F36]">{battery.overnightPctBefore}% → {battery.overnightPctAfter}%</b> · capex <b className="text-[#1A1F36]">{battery.capexInrLakh != null ? fmtLakh(battery.capexInrLakh) : '—'}</b> · payback on tariff savings <b className="text-[#1A1F36]">{battery.paybackYears != null ? `${battery.paybackYears} years` : 'none'}</b></span>
              <span className="text-[11px] text-[#94A3B8] w-full">The proposed {reference.capacity_kwh / 1000} MWh unit is in 28_clean_energy_assets; the 4 MWh pilot moves overnight matching by about one point. Stored solar saves ₹{battery.savingInrPerKwh}/kWh against the ₹{today.gridTariffInrKwh} grid tariff, so the case is the 24/7 commitment, not arbitrage.</span>
            </div>
          )}
        </section>

        <div className="grid xl:grid-cols-[1.5fr_1fr] gap-4">
          {offline !== null && <Brief payload={briefPayload} offline={offline} />}
          <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
            <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#64748B]"><CloudRain size={14} style={{ color: C.blue }} />What a cloudy day does</h2>
            <p className="text-[13px] text-[#1A1F36] mt-2">On {timeLabel(cloudy.date)}, a {cloudy.sky} day, solar fell {cloudy.solarDropPct}% below the other days.</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="rounded-lg bg-[#F0F2F5] px-3 py-2"><p className="text-[10px] uppercase tracking-wider font-bold text-[#94A3B8]">Midday matching</p><p className="text-lg font-semibold" style={MONO}><span style={{ color: C.teal }}>{cloudy.normalMiddayPct}%</span> → <span style={{ color: C.crimson }}>{cloudy.cloudyMiddayPct}%</span></p></div>
              <div className="rounded-lg bg-[#F0F2F5] px-3 py-2"><p className="text-[10px] uppercase tracking-wider font-bold text-[#94A3B8]">Extra grid that day</p><p className="text-lg font-semibold text-[#1A1F36]" style={MONO}>{cloudy.gridFallbackIncreaseMwh} MWh</p></div>
            </div>
            <p className="text-[11px] text-[#64748B] mt-2">A monsoon week against an hourly commitment is the risk to plan for; storage covers hours, not days.</p>
          </section>
        </div>

        {/* Carbon */}
        <div className="grid xl:grid-cols-[1.4fr_1fr] gap-4">
          <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
            <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#64748B]"><Factory size={14} style={{ color: C.navy }} />Scope 2, {facility.name}</h2>
            <p className="text-[11.5px] text-[#64748B] mb-2">{scope2.methodology}</p>
            <div className="grid md:grid-cols-[1.3fr_1fr] gap-4">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 200 }}>
                  <BarChart data={scope2.monthly.map((m) => ({ ...m, label: monthLabel(m.month, true) }))} margin={{ top: 6, right: 6, bottom: 0, left: -10 }}>
                    <CartesianGrid vertical={false} stroke="#EEF2F8" />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: C.border }} tick={{ fill: C.muted, fontSize: 10.5 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: C.muted, fontSize: 10.5 }} width={48} />
                    <Tooltip formatter={(v, k) => [`${fmtNumber(v, 0)} tCO2`, k === 'gridTco2' ? 'Grid (Scope 2)' : 'Avoided by renewables']} cursor={{ fill: '#F0F2F5' }} />
                    <Bar dataKey="gridTco2" stackId="c" fill={C.navy} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="avoidedTco2" stackId="c" fill={C.teal} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">Annual Scope 2 by scenario</p>
                <ul className="space-y-2.5">
                  {scenarios.map(([label, t, color]) => (
                    <li key={label}>
                      <div className="flex justify-between text-[12px]"><span className="text-[#1A1F36]">{label}</span><b style={{ ...MONO, color }}>{fmtNumber(t, 0)} t</b></div>
                      <div className="h-1.5 rounded-full bg-[#F0F2F5] mt-1"><div className="h-full rounded-full" style={{ width: `${(t / scenarios[0][1]) * 100}%`, background: color }} /></div>
                    </li>
                  ))}
                </ul>
                <p className="text-[10.5px] text-[#94A3B8] mt-2">Navy: grid emissions. Teal: emissions avoided by today’s renewable share.</p>
              </div>
            </div>
          </section>
          <section className="bg-white rounded-xl border border-[#D8DCE3] border-l-[3px] border-l-[#00B0A0] p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Embodied carbon in stranded capacity</h2>
            <p className="text-[13px] text-[#1A1F36] mt-2 leading-relaxed">
              <b>{embodied.strandedKw} kW</b> of structurally stranded capacity (rows {embodied.rows.map((r) => r.rowId).join(', ')}) already carries an estimated <b>{fmtNumber(embodied.estimatedEmbodiedTco2, 0)} tCO2e</b> of embodied carbon. Recovering it avoids building that again.
            </p>
            <Link href="/command-center/capacity-simulation" className="inline-block mt-2 text-[12px] font-semibold text-[#005EB8] hover:underline">Open the stranded capacity scene →</Link>
            <p className="text-[10.5px] text-[#94A3B8] mt-3 flex gap-1.5"><Info size={12} className="flex-shrink-0 mt-[1px]" />{embodied.source}</p>
          </section>
        </div>

        {/* Advisor */}
        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Recommended actions, ranked</h2>
            <p className="text-[11px] text-[#94A3B8]">Score = 40% matching gain + 40% carbon avoided + 20% water saved, each against the largest candidate. A sort, not a forecast.</p>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#D8DCE3]">
                {['#', 'Action', 'Type', 'Matching', 'tCO2 / year', 'Water', 'Cost', 'Payback', 'Score'].map((h) => (
                  <th key={h} className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#94A3B8] px-2 pb-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => {
                const [cat, color] = CATEGORY[a.category];
                return (
                  <tr key={a.id} className={`border-b border-[#D8DCE3] ${a.rank === 1 ? 'bg-[#EFF5FD]' : ''}`}>
                    <td className="px-2 py-2.5 text-[12.5px] text-[#64748B]">{a.rank}</td>
                    <td className="px-2 py-2.5">
                      <p className={`text-[13px] text-[#1A1F36] ${a.rank === 1 ? 'font-bold' : 'font-medium'}`}>{a.action}</p>
                      <p className="text-[11px] text-[#64748B]">{a.detail}</p>
                    </td>
                    <td className="px-2 py-2.5"><span className="text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ color, background: `${color}14`, border: `1px solid ${color}33` }}>{cat}</span></td>
                    <td className="px-2 py-2.5 text-[12.5px]" style={MONO}>{a.impact.matchingPctGain ? `+${a.impact.matchingPctGain} pts` : '—'}</td>
                    <td className="px-2 py-2.5 text-[12.5px]" style={MONO}>{a.impact.tco2Avoided ? `${fmtNumber(a.impact.tco2Avoided, 0)}${a.impact.oneOff ? ' once' : ''}` : '—'}</td>
                    <td className="px-2 py-2.5 text-[12.5px]" style={MONO}>{a.impact.waterLitresSaved ? `${fmtNumber(a.impact.waterLitresSaved / 1e6, 1)} ML` : '—'}</td>
                    <td className="px-2 py-2.5 text-[12.5px]" style={MONO}>{a.impact.costInrLakh ? money(a.impact.costInrLakh) : <span className="text-[11px] text-[#64748B]" style={{ fontFamily: 'inherit' }}>{a.costNote ?? '—'}</span>}</td>
                    <td className="px-2 py-2.5 text-[12.5px]" style={MONO}>{a.paybackYears != null ? `${a.paybackYears} y` : '—'}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2"><div className="w-16 h-1.5 rounded-full bg-[#F0F2F5]"><div className="h-full rounded-full" style={{ width: `${a.score}%`, background: a.priority === 'High' ? C.teal : a.priority === 'Medium' ? C.blue : '#94A3B8' }} /></div><span className="text-[11.5px] font-semibold text-[#1A1F36]" style={MONO}>{a.score}</span></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Sources */}
        <section className="text-[10.5px] text-[#94A3B8] leading-relaxed">
          <p className="font-semibold text-[#64748B] mb-1">Sources</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            {SOURCES.map(([t, url]) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">{t}</a></li>)}
            <li>Load from 13_energy; proposed PPA and storage from 27_hourly_generation and 28_clean_energy_assets; PPA landed cost within the ₹4.0–8.15/kWh reported for Maharashtra open-access solar, 2025–26.</li>
          </ol>
        </section>
      </div>
    </CCLayout>
  );
}
