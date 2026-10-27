'use client';
// Predictive risk: what is heading toward an outage or a cost before an alarm
// says so — built from the maintenance record, incident history, alert queue
// and the monthly efficiency trend.
import { useEffect, useMemo, useRef, useState } from 'react';
import CCLayout from '@/components/command-center/CCLayout';
import RiskWatchlist from '@/components/nexus/RiskWatchlist';
import DriftChart from '@/components/nexus/DriftChart';
import { riskWatchlist } from '@/lib/nexus/predictive-engine';
import { narrateRisks } from '@/lib/nexus/risk-brief';
import { nexus } from '@/lib/nexus/data';
import { fmtLakh } from '@/lib/nexus/format';
import { AS_OF, timeLabel } from '@/lib/nexus/time';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const OPERATING = nexus.facilities.filter((f) => f.status === 'Operational').map((f) => f.facility_id);

function Tile({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-[#D8DCE3] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{label}</p>
      <p className="text-xl font-semibold text-[#1A1F36] tabular-nums" style={MONO}>{value}</p>
      {sub && <p className="text-[11px] text-[#64748B]">{sub}</p>}
    </div>
  );
}

function RiskNote({ items, offline }) {
  const [state, setState] = useState({ text: '', narrating: true, source: null });
  const run = useRef(0);
  useEffect(() => {
    const id = ++run.current;
    const ctrl = new AbortController();
    narrateRisks(items, { offline, signal: ctrl.signal, onText: (text) => { if (run.current === id) setState((s) => ({ ...s, text })); } })
      .then((r) => { if (run.current === id && r.source !== 'aborted') setState({ text: r.text, narrating: false, source: r.source }); });
    return () => ctrl.abort();
  }, [items, offline]);
  return (
    <section className="bg-[#F7FAFD] rounded-xl border border-[#D6E4F2] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#005EB8] mb-2">Before it breaks · risk note</p>
      {state.narrating && !state.text ? (
        <div className="space-y-2 animate-pulse"><div className="h-2.5 bg-[#D6E4F2] rounded" /><div className="h-2.5 bg-[#D6E4F2] rounded w-5/6" /></div>
      ) : (
        <p className="text-[13px] leading-relaxed text-[#1A1F36]">{state.text}</p>
      )}
      {!state.narrating && state.text && (
        <p className="text-[10px] text-[#94A3B8] mt-2">{state.source === 'llm' ? 'Written from the detected risks below; every number checked.' : 'Generated from the detected risks below.'}</p>
      )}
    </section>
  );
}

export default function PredictivePage() {
  const [offline, setOffline] = useState(null);
  useEffect(() => { setOffline(new URLSearchParams(window.location.search).get('demo') === '1'); }, []);
  const items = useMemo(() => riskWatchlist(), []);
  const silent = items.filter((r) => r.kind === 'component' && r.impact === 'outage' && !r.alert);
  const drift = items.filter((r) => r.kind === 'efficiency-drift');
  const driftSoFar = drift.reduce((s, r) => s + r.cost.extraCostInrLakh, 0);
  const runRate = drift.reduce((s, r) => s + r.cost.annualRunRateInrLakh, 0);

  return (
    <CCLayout title="Predictive Risk">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Risks watched" value={items.length} sub={`As of ${timeLabel(AS_OF)}`} />
          <Tile label="Outage risks, no alarm" value={silent.length} sub={silent.map((r) => r.componentId).join(', ') || 'None'} />
          <Tile label="Drift cost so far" value={fmtLakh(Math.round(driftSoFar * 10) / 10).split(' (')[0]} sub={`${drift.length} ${drift.length === 1 ? 'site' : 'sites'} drifting`} />
          <Tile label="Drift run-rate" value={fmtLakh(Math.round(runRate * 10) / 10).split(' (')[0]} sub="a year if uncorrected" />
        </div>

        {offline !== null && <RiskNote items={items} offline={offline} />}

        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">PUE against the same month last year</h2>
          <DriftChart facilityIds={OPERATING} measure="pue" />
        </section>

        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2">Watchlist · most urgent first</h2>
          <RiskWatchlist items={items} />
        </section>
      </div>
    </CCLayout>
  );
}
