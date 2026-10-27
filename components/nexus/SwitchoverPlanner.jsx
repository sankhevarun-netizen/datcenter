'use client';
// Switchover Planner: pick an asset, an action and a window, and see what it
// touches before executing — verdict, impact, tenant/SLA exposure, the
// safest window, and a runbook. Compute is synchronous and client-side
// (planSwitchover), exactly like the capacity-simulation page; the AI brief
// streams through the same guard every other Nexus brief uses.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle, PlayCircle, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { planSwitchover, SWITCHOVER_TYPES } from '@/lib/nexus/switchover-engine';
import { narrateSwitchover } from '@/lib/nexus/switchover-brief';
import { nexus, componentsOf } from '@/lib/nexus/data';
import { fmtKw, fmtLakh, fmtDuration } from '@/lib/nexus/format';
import { exportWorkbook, exportPanelPdf } from '@/lib/export';
import { logEvent } from '@/lib/audit-client';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const TYPE_LABEL = { utility_feed: 'Utility Feeds', ups: 'UPS', generator: 'Generators', chiller: 'Chillers', pdu: 'PDUs', crah: 'CRAH Units' };
const VERDICT_BAND = {
  GO: { fg: '#00704A', bg: '#E6F6EF', label: 'GO', icon: CheckCircle2 },
  'GO WITH CONDITIONS': { fg: '#8A6508', bg: '#FBF3DE', label: 'GO WITH CONDITIONS', icon: AlertTriangle },
  'NO GO': { fg: '#B42318', bg: '#FDECEC', label: 'NO-GO', icon: XCircle },
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

function Brief({ result, offline }) {
  const [state, setState] = useState({ text: '', narrating: true, source: null });
  const run = useRef(0);
  useEffect(() => {
    if (offline === null) return;
    const id = ++run.current;
    setState({ text: '', narrating: true, source: null });
    const ctrl = new AbortController();
    narrateSwitchover(result, { offline, signal: ctrl.signal, onText: (text) => { if (run.current === id) setState((s) => ({ ...s, text })); } })
      .then((r) => { if (run.current === id && r.source !== 'aborted') setState({ text: r.text, narrating: false, source: r.source }); });
    return () => ctrl.abort();
  }, [result, offline]);
  return (
    <section className="bg-[#F7FAFD] rounded-xl border border-[#D6E4F2] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#005EB8] mb-2">Analyst brief</p>
      {state.narrating && !state.text
        ? <div className="space-y-2 animate-pulse"><div className="h-2.5 bg-[#D6E4F2] rounded" /><div className="h-2.5 bg-[#D6E4F2] rounded w-5/6" /></div>
        : <p className="text-[13px] leading-relaxed text-[#1A1F36] whitespace-pre-line">{state.text}</p>}
      {!state.narrating && state.text && <p className="text-[10px] text-[#94A3B8] mt-2">{state.source === 'llm' ? 'Written from the figures below; every number checked.' : 'Generated from the figures below.'}</p>}
    </section>
  );
}

export default function SwitchoverPlanner() {
  const [offline, setOffline] = useState(null);
  useEffect(() => { setOffline(new URLSearchParams(window.location.search).get('demo') === '1'); }, []);

  const facilityId = 'MUM-1'; // only MUM-1 has a component graph in this dataset
  const facility = nexus.facilities.find((f) => f.facility_id === facilityId);
  const switchComponents = useMemo(() => componentsOf(facilityId).filter((c) => SWITCHOVER_TYPES.includes(c.component_type)), []);
  const grouped = useMemo(() => {
    const g = {};
    for (const c of switchComponents) (g[c.component_type] ??= []).push(c);
    return g;
  }, [switchComponents]);

  const [componentId, setComponentId] = useState('UTIL-FEED-A');
  const [action, setAction] = useState('transfer_load');
  const [windowStart, setWindowStart] = useState('2026-10-10T02:00');
  const [durationHours, setDurationHours] = useState(4);

  const component = switchComponents.find((c) => c.component_id === componentId);
  const peers = component?.redundantPeers ?? [];
  const transferToId = action === 'transfer_load' ? (peers[0] ?? null) : null;

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);

  const runPlan = () => {
    setError(null);
    try {
      const plan = planSwitchover({ facilityId, componentId, action, transferToId, windowStart: windowStart.replace('T', ' '), durationHours: Number(durationHours) });
      setResult(plan);
      logEvent('action', 'switchover_plan', { facilityId, subject: componentId, detail: { verdict: plan.verdict?.level, windowStart, durationHours } });
    } catch (err) {
      setResult(null);
      setError(err.message);
    }
  };

  const verdictLabel = result?.verdict ? result.verdict.level.replace(/_/g, ' ') : null;
  const band = verdictLabel ? VERDICT_BAND[verdictLabel] : null;

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `switchover-${componentId}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    logEvent('export', 'switchover_export', { facilityId, subject: componentId, detail: { format: 'json' } });
  };
  const handleExportWorkbook = () => {
    exportWorkbook([
      { name: 'Tenants', rows: result.tenants.map((t) => ({ tenant: t.name, racks: t.racksAffected, itKw: t.itKw, exposureInrLakh: t.exposureInrLakh, notification: t.notificationClause })) },
      { name: 'Windows', rows: result.windows.ranked.map((w) => ({ start: w.start, score: w.score, factors: w.factors.map((f) => f.text).join('; ') })) },
      { name: 'Runbook', rows: result.runbook.steps.map((s) => ({ order: s.order, phase: s.phase, action: s.action, owner: s.owner_team, withinMin: s.within_min })) },
    ], `switchover-${componentId}.xlsx`);
    logEvent('export', 'switchover_export', { facilityId, subject: componentId, detail: { format: 'xlsx' } });
  };
  const handleExportPdf = () => {
    if (panelRef.current) exportPanelPdf(panelRef.current, `switchover-${componentId}.pdf`);
    logEvent('export', 'switchover_export', { facilityId, subject: componentId, detail: { format: 'pdf' } });
  };

  return (
    <div className="p-6 space-y-4">
      <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
        <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">
          <Shuffle size={13} className="text-[#005EB8]" /> Plan a switchover
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Facility</label>
            <input disabled value={facility?.name ?? facilityId} className="px-3 py-2 rounded-lg border border-[#D8DCE3] text-xs text-[#94A3B8] bg-[#F7FAFC]" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Asset</label>
            <select value={componentId} onChange={(e) => setComponentId(e.target.value)} className="px-3 py-2 rounded-lg border border-[#D8DCE3] text-xs text-[#1A1F36] bg-white min-w-[220px]">
              {Object.entries(grouped).map(([type, list]) => (
                <optgroup key={type} label={TYPE_LABEL[type] ?? type}>
                  {list.map((c) => <option key={c.component_id} value={c.component_id}>{c.label} ({c.utilisation_pct}%)</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="px-3 py-2 rounded-lg border border-[#D8DCE3] text-xs text-[#1A1F36] bg-white">
              <option value="transfer_load">Transfer load</option>
              <option value="take_offline">Take offline</option>
            </select>
          </div>
          {action === 'transfer_load' && (
            <div>
              <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Transfer target</label>
              <input disabled value={transferToId ?? 'No recorded peer'} className="px-3 py-2 rounded-lg border border-[#D8DCE3] text-xs text-[#94A3B8] bg-[#F7FAFC]" />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Window start</label>
            <input type="datetime-local" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className="px-3 py-2 rounded-lg border border-[#D8DCE3] text-xs text-[#1A1F36] bg-white" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Duration (h)</label>
            <input type="number" min="0.5" step="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="w-20 px-3 py-2 rounded-lg border border-[#D8DCE3] text-xs text-[#1A1F36] bg-white" />
          </div>
          <button onClick={runPlan} disabled={action === 'transfer_load' && !transferToId} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50" style={{ background: '#00338D' }}>
            <PlayCircle size={14} /> Plan switchover
          </button>
        </div>
        {action === 'transfer_load' && !transferToId && <p className="text-[11px] text-[#B42318] mt-2">This asset has no recorded redundant peer — only "take offline" is available.</p>}
        {offline && <p className="text-[10px] text-[#005EB8] mt-2">Offline — the analyst brief uses the template only, no model call.</p>}
      </section>

      {error && <p className="text-xs text-[#B42318]">{error}</p>}

      {result && !result.mapped && (
        <section className="bg-[#FBF3DE] rounded-xl border border-[#E8B93C]/40 p-4 text-xs text-[#8A6508]">
          {facilityId} has no component graph on file — this planner only covers facilities with a mapped topology (currently MUM-1 only).
        </section>
      )}

      {result && result.mapped && (
        <div ref={panelRef} className="space-y-4 bg-[#F0F2F5] -m-1 p-1">
          <section className="rounded-xl border p-4 flex items-start gap-4" style={{ background: band.bg, borderColor: `${band.fg}33` }}>
            <band.icon size={28} style={{ color: band.fg }} />
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: band.fg }}>{band.label}</p>
              <p className="text-[11px] text-[#334155] mt-0.5">{result.input.action === 'take_offline' ? 'Take offline' : 'Transfer load'}: {result.input.label}{result.input.transferToId ? ` → ${result.input.transferToId}` : ''}</p>
              <ul className="mt-1.5 space-y-0.5">
                {result.verdict.reasons.map((r, i) => <li key={i} className="text-xs text-[#1A1F36]">{r.text}</li>)}
              </ul>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleExportJson} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[#D8DCE3] bg-white text-[#64748B]"><Download size={11} /> JSON</button>
              <button onClick={handleExportWorkbook} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[#D8DCE3] bg-white text-[#64748B]"><FileSpreadsheet size={11} /> XLSX</button>
              <button onClick={handleExportPdf} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[#D8DCE3] bg-white text-[#64748B]"><Download size={11} /> PDF</button>
            </div>
          </section>

          <Brief result={result} offline={offline} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Racks affected" value={result.racks.count} sub={fmtKw(result.racks.itKw)} />
            <Tile label="Tenants affected" value={result.tenants.length} sub={result.tenants[0]?.name ?? '—'} />
            <Tile label="Contractual exposure" value={fmtLakh(result.totalExposureInrLakh)} />
            <Tile label="Recommended window" value={result.windows.recommended ? `${result.windows.recommended.score}/100` : '—'} sub={result.windows.recommended?.startLabel} />
          </div>

          {result.tenants.length > 0 && (
            <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">Tenants &amp; SLA</h3>
              <table className="w-full text-xs">
                <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#94A3B8]"><th className="pb-1.5">Tenant</th><th className="pb-1.5">Racks</th><th className="pb-1.5">SLA</th><th className="pb-1.5">Exposure</th><th className="pb-1.5">Notify</th></tr></thead>
                <tbody>
                  {result.tenants.map((t) => (
                    <tr key={t.tenantId} className="border-t border-[#F1F5F9]">
                      <td className="py-1.5 font-semibold text-[#1A1F36]">{t.name}</td>
                      <td className="py-1.5 text-[#64748B]">{t.racksAffected}</td>
                      <td className="py-1.5 text-[#64748B]">{t.slaUptimePct ?? '—'}%</td>
                      <td className="py-1.5 font-semibold" style={{ ...MONO, color: t.exposureInrLakh > 0 ? '#B42318' : '#00704A' }}>{fmtLakh(t.exposureInrLakh)}</td>
                      <td className="py-1.5 text-[#64748B]">{t.notificationClause ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">Windows</h3>
            <p className="text-[10px] text-[#94A3B8] mb-3">Tenant-activity weighting is a <strong>placeholder profile</strong> (data/nexus/loadProfile.json) — replace with real BMS/DCIM hourly activity before relying on this for scheduling.</p>
            <div className="space-y-1.5">
              {result.windows.ranked.map((w, i) => (
                <div key={w.start} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: i === 0 ? '#E6F6EF' : '#F7FAFC' }}>
                  <span className="text-xs text-[#1A1F36]">{i === 0 && <span className="mr-2 text-[9px] font-bold text-[#00704A]">RECOMMENDED</span>}{w.startLabel}</span>
                  <span className="text-xs font-bold" style={{ ...MONO, color: w.score >= 80 ? '#00704A' : w.score >= 50 ? '#8A6508' : '#B42318' }}>{w.score}/100</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">Runbook</h3>
            {['pre', 'execute', 'verify', 'rollback'].map((phase) => {
              const steps = result.runbook.steps.filter((s) => s.phase === phase);
              if (!steps.length) return null;
              return (
                <div key={phase} className={phase === 'rollback' ? 'mt-3 pt-3 border-t border-dashed border-[#F4A3A3]' : 'mb-3'}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: phase === 'rollback' ? '#B42318' : '#334155' }}>{phase}</p>
                  <ol className="space-y-1">
                    {steps.map((s) => (
                      <li key={s.order} className="text-xs text-[#1A1F36] flex gap-2">
                        <span className="text-[#94A3B8]" style={MONO}>{s.order}.</span>
                        <span>{s.action} <span className="text-[10px] text-[#94A3B8]">— {s.owner_team}, within {fmtDuration(s.within_min)}</span></span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
