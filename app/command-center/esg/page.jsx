'use client';
// ESG disclosure: framework line items computed from metered energy and
// water, each with its formula and source cells, downloadable as an
// audit-ready PDF pack or a workbook.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, Sheet, AlertCircle, Info, Braces } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { buildDisclosure, ledgerRows, ENERGY_MONTHS, FRAMEWORKS, scopeOf } from '@/lib/nexus/esg-engine';
import { narrateEsg } from '@/lib/nexus/esg-brief';
import { buildDisclosurePdf } from '@/lib/nexus/pdf-pack';
import { exportWorkbook } from '@/lib/export';
import { logEvent } from '@/lib/audit-client';
import { fmtNumber, fmtUpTo } from '@/lib/nexus/format';
import { monthLabel } from '@/lib/nexus/time';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const valueText = (l) => (l.value === null ? null : `${l.unit === '' || l.unit.includes('/') ? fmtUpTo(l.value, 3) : fmtNumber(l.value, Number.isInteger(l.value) ? 0 : 1)}`);

function Summary({ disclosure, offline, onText }) {
  const [state, setState] = useState({ text: '', narrating: true, source: null });
  const run = useRef(0);
  useEffect(() => {
    const id = ++run.current;
    const ctrl = new AbortController();
    setState({ text: '', narrating: true, source: null });
    narrateEsg(disclosure, { offline, signal: ctrl.signal, onText: (text) => { if (run.current === id) setState((s) => ({ ...s, text })); } })
      .then((r) => { if (run.current === id && r.source !== 'aborted') { setState({ text: r.text, narrating: false, source: r.source }); onText(r.text); } });
    return () => ctrl.abort();
  }, [disclosure, offline, onText]);
  return (
    <section className="bg-[#F7FAFD] rounded-xl border border-[#D6E4F2] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#005EB8] mb-2">Executive summary</p>
      {state.narrating && !state.text
        ? <div className="space-y-2 animate-pulse"><div className="h-2.5 bg-[#D6E4F2] rounded" /><div className="h-2.5 bg-[#D6E4F2] rounded w-4/5" /></div>
        : <p className="text-[13px] leading-relaxed text-[#1A1F36]">{state.text}</p>}
      {!state.narrating && state.text && <p className="text-[10px] text-[#94A3B8] mt-2">{state.source === 'llm' ? 'Written from the disclosed figures; every number checked.' : 'Generated from the disclosed figures.'}</p>}
    </section>
  );
}

export default function EsgPage() {
  const [offline, setOffline] = useState(null);
  const [framework, setFramework] = useState('BRSR');
  const [from, setFrom] = useState(ENERGY_MONTHS[0]);
  const [to, setTo] = useState(ENERGY_MONTHS.at(-1));
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(null);
  const [site, setSite] = useState('all');
  useEffect(() => { setOffline(new URLSearchParams(window.location.search).get('demo') === '1'); }, []);

  const scopeSites = useMemo(() => scopeOf(framework).facilities, [framework]);
  useEffect(() => { setSite('all'); }, [framework]);
  const disclosure = useMemo(() => buildDisclosure({ framework, from, to, ...(site !== 'all' ? { facilityIds: [site] } : {}) }), [framework, from, to, site]);
  const onText = useMemo(() => (t) => setSummary(t), []);
  const metered = disclosure.facilities.filter((f) => f.metered).map((f) => f.id);
  const fileBase = `nexus-${framework.toLowerCase()}-${site === 'all' ? 'portfolio' : site.toLowerCase()}-${from}-to-${to}`;
  const logExport = (format) => logEvent('export', `disclosure ${format}`, {
    facilityId: site === 'all' ? null : site,
    subject: `${disclosure.framework.id} ${from} to ${to}`,
    detail: { framework: disclosure.framework.id, readiness: disclosure.readinessScore, sites: disclosure.facilities.map((f) => f.id) },
  });
  const downloadJson = () => {
    logExport('json');
    const payload = { framework: disclosure.framework.name, period: disclosure.period, facilities: disclosure.facilities, readinessScore: disclosure.readinessScore, metrics: disclosure.lines, gaps: disclosure.gaps, pending: disclosure.pending, summary };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${fileBase}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    logExport('pdf');
    setBusy('pdf');
    try { (await buildDisclosurePdf(disclosure, summary)).save(`${fileBase}.pdf`); } finally { setBusy(null); }
  };
  const downloadXlsx = async () => {
    logExport('xlsx');
    setBusy('xlsx');
    try {
      await exportWorkbook([
        { name: 'Disclosure', rows: disclosure.lines.map((l) => ({ ref: l.ref, item: l.item, value: l.value, unit: l.unit, formula: l.formula ?? '', note: l.gap ?? '' })) },
        { name: 'By site', rows: disclosure.byFacility.map((f) => ({ facility: f.name, energy_mwh: f.figures.totalEnergyMwh.value, it_energy_mwh: f.figures.itEnergyMwh.value, pue: f.figures.pue.value, ref: f.figures.ref.value, erf: f.figures.erf.value, water_kl: f.figures.waterWithdrawnKl.value, wue: f.figures.wue.value, scope2_tco2e: f.figures.scope2Tco2.value })) },
        { name: 'Monthly ledger', rows: ledgerRows({ from, to, facilityIds: metered }) },
      ], `${fileBase}.xlsx`);
    } finally { setBusy(null); }
  };

  return (
    <CCLayout title="ESG Disclosure">
      <div className="p-6 space-y-4">
        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4 flex flex-wrap items-end gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Framework</p>
            <div className="flex bg-[#F0F2F5] rounded-lg p-0.5 gap-0.5">
              {Object.values(FRAMEWORKS).map((f) => (
                <button key={f.id} onClick={() => setFramework(f.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${framework === f.id ? 'bg-[#00338D] text-white' : 'text-[#6B7280] hover:text-[#1A1F36]'}`}>
                  {f.id === 'KA' ? 'Karnataka' : f.id === 'EED' ? 'EU EED' : f.id === 'GRESB' ? 'GRESB' : 'SEBI BRSR'}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Scope</span>
            <select value={site} onChange={(e) => setSite(e.target.value)} className="text-xs text-[#334155] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5">
              <option value="all">All sites in scope ({scopeSites.length})</option>
              {scopeSites.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          {[['From', from, setFrom], ['To', to, setTo]].map(([label, val, set]) => (
            <label key={label} className="text-xs">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{label}</span>
              <select value={val} onChange={(e) => {
                const v = e.target.value;
                if (label === 'From') { setFrom(v); if (v > to) setTo(v); } else { setTo(v); if (v < from) setFrom(v); }
              }} className="text-xs text-[#334155] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5">
                {ENERGY_MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </label>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={downloadPdf} disabled={busy !== null || !summary}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#00338D] hover:bg-[#002A73] text-white disabled:opacity-50">
              <FileDown size={13} /> {busy === 'pdf' ? 'Building…' : 'Disclosure pack (PDF)'}
            </button>
            <button onClick={downloadXlsx} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50">
              <Sheet size={13} /> {busy === 'xlsx' ? 'Building…' : 'Workbook (XLSX)'}
            </button>
            <button onClick={downloadJson} disabled={!summary}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50">
              <Braces size={13} /> JSON
            </button>
          </div>
        </section>

        {disclosure.policy && (
          <p className="text-xs text-[#64748B] flex items-start gap-1.5"><Info size={13} className="mt-0.5 flex-shrink-0" />
            {disclosure.policy.policy}: {disclosure.policy.obligation}. Applies to {disclosure.policy.appliesTo === 'All' ? 'every listed operation' : disclosure.policy.appliesTo === 'Reference' ? 'EU operations; used here as a reference standard' : disclosure.policy.appliesTo}, effective {monthLabel(disclosure.policy.effectiveFrom.slice(0, 7))}.
          </p>
        )}

        {offline !== null && <Summary disclosure={disclosure} offline={offline} onText={onText} />}

        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">{disclosure.framework.name} · {monthLabel(from)} to {monthLabel(to)}</h2>
            <span className="text-xs text-[#334155]">Readiness <strong style={MONO}>{disclosure.readinessScore}%</strong> <span className="text-[#94A3B8]">of required items disclosable from operating data</span></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[680px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#94A3B8]">
                  <th className="font-semibold pb-2 w-20">Ref</th><th className="font-semibold pb-2">Item</th>
                  <th className="font-semibold pb-2 text-right">Value</th><th className="font-semibold pb-2 pl-4">How it is computed</th>
                </tr>
              </thead>
              <tbody>
                {disclosure.lines.map((l, i) => (
                  <tr key={i} className="border-t border-[#F1F5F9] align-top">
                    <td className="py-2 pr-2 text-[#64748B] whitespace-nowrap" style={MONO}>{l.ref}</td>
                    <td className="py-2 pr-2 text-[#1A1F36]">{l.item}</td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">
                      {l.value === null
                        ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8A6508] bg-[#FBF3DE] rounded-full px-2 py-0.5"><AlertCircle size={10} /> {/^No metered data/.test(l.gap) ? 'Pending' : 'Not in dataset'}</span>
                        : <span className="font-semibold text-[#1A1F36]" style={MONO}>{valueText(l)} <span className="text-[10px] text-[#94A3B8]">{l.unit}</span></span>}
                    </td>
                    <td className="py-2 pl-4 text-[11px] text-[#64748B]">
                      {l.formula ? <><span style={MONO}>{l.formula}</span><span className="block text-[10px] text-[#94A3B8]">{l.source.sheet} rows {l.source.rowRanges} · <span className={l.confidence === 'measured' ? 'text-[#00704A]' : 'text-[#8A6508]'}>{l.confidence}</span> — {l.confidenceNote}</span></> : l.gap}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {disclosure.pending.length > 0 && (
            <p className="mt-3 text-xs text-[#8A6508] bg-[#FBF3DE] rounded-lg px-3 py-2">{disclosure.pending.map((p) => `${p.name}: ${p.reason}`).join(' ')}</p>
          )}
        </section>

        {disclosure.byFacility.length > 0 && (
          <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">By site</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[680px]">
                <thead>
                  <tr className="text-right text-[10px] uppercase tracking-wider text-[#94A3B8]">
                    <th className="text-left font-semibold pb-2">Site</th><th className="font-semibold pb-2">Energy MWh</th><th className="font-semibold pb-2">PUE</th>
                    <th className="font-semibold pb-2">REF</th><th className="font-semibold pb-2">ERF</th><th className="font-semibold pb-2">Water kL</th>
                    <th className="font-semibold pb-2">WUE</th><th className="font-semibold pb-2">Scope 2 tCO₂e</th>
                  </tr>
                </thead>
                <tbody>
                  {disclosure.byFacility.map((f) => (
                    <tr key={f.id} className="border-t border-[#F1F5F9] text-right tabular-nums text-[#334155]" style={MONO}>
                      <td className="py-1.5 text-left text-[#1A1F36]" style={{ fontFamily: 'inherit' }}>{f.name}</td>
                      <td>{fmtNumber(f.figures.totalEnergyMwh.value, 1)}</td><td>{fmtUpTo(f.figures.pue.value, 3)}</td>
                      <td>{fmtUpTo(f.figures.ref.value, 3)}</td><td>{fmtUpTo(f.figures.erf.value, 3)}</td>
                      <td>{fmtNumber(f.figures.waterWithdrawnKl.value)}</td><td>{fmtUpTo(f.figures.wue.value, 3)}</td>
                      <td>{fmtNumber(f.figures.scope2Tco2.value, 1)}</td>
                    </tr>
                  ))}
                  {disclosure.totals && (
                    <tr className="border-t-2 border-[#CBD5E1] text-right tabular-nums font-semibold text-[#1A1F36]" style={MONO}>
                      <td className="py-1.5 text-left" style={{ fontFamily: 'inherit' }}>Portfolio</td>
                      <td>{fmtNumber(disclosure.totals.totalEnergyMwh.value, 1)}</td><td>{fmtUpTo(disclosure.totals.pue.value, 3)}</td>
                      <td>{fmtUpTo(disclosure.totals.ref.value, 3)}</td><td>{fmtUpTo(disclosure.totals.erf.value, 3)}</td>
                      <td>{fmtNumber(disclosure.totals.waterWithdrawnKl.value)}</td><td>{fmtUpTo(disclosure.totals.wue.value, 3)}</td>
                      <td>{fmtNumber(disclosure.totals.scope2Tco2.value, 1)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-2">Portfolio ratios are period totals divided (sum over sum), so they are not the average of the site rows.</p>
          </section>
        )}
      </div>
    </CCLayout>
  );
}
