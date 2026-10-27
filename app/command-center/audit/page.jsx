'use client';
// Audit trail and model spend. Both come from permission-checked APIs: a role
// without access sees why, not the data.
import { useEffect, useState } from 'react';
import { Download, ShieldAlert, Database } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { nexus } from '@/lib/nexus/data';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const KINDS = ['', 'action', 'agent_output', 'export', 'access'];
const KIND_LABEL = { '': 'All', action: 'User actions', agent_output: 'Agent outputs', export: 'Exports', access: 'Access' };

function Denied({ message }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#F6D6BD] bg-[#FEF0E6] p-4 text-sm text-[#B54708]">
      <ShieldAlert size={16} className="mt-0.5" /> <span>{message}</span>
    </div>
  );
}

export default function AuditPage() {
  const [kind, setKind] = useState('');
  const [facility, setFacility] = useState('');
  const [audit, setAudit] = useState({ state: 'loading' });
  const [usage, setUsage] = useState({ state: 'loading' });

  useEffect(() => {
    const q = new URLSearchParams({ ...(kind ? { kind } : {}), ...(facility ? { facility } : {}), limit: '300' });
    setAudit({ state: 'loading' });
    fetch(`/api/audit?${q}`).then(async (r) => {
      const d = await r.json();
      setAudit(r.ok ? { state: 'ok', ...d } : { state: 'denied', message: d.error });
    }).catch(() => setAudit({ state: 'denied', message: 'Audit service unavailable' }));
  }, [kind, facility]);

  useEffect(() => {
    fetch('/api/usage').then(async (r) => {
      const d = await r.json();
      setUsage(r.ok ? { state: 'ok', ...d } : { state: 'denied', message: d.error });
    }).catch(() => setUsage({ state: 'denied', message: 'Usage service unavailable' }));
  }, []);

  const csvHref = `/api/audit?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(facility ? { facility } : {}), format: 'csv', limit: '5000' })}`;

  return (
    <CCLayout title="Audit & Usage">
      <div className="p-6 space-y-4">
        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-bold text-[#1A1F36]">Audit trail</h2>
              <p className="text-xs text-[#64748B]">Every user action and every agent output, append-only.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-[#F0F2F5] rounded-lg p-0.5 gap-0.5">
                {KINDS.map((k) => (
                  <button key={k || 'all'} onClick={() => setKind(k)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${kind === k ? 'bg-[#00338D] text-white' : 'text-[#6B7280] hover:text-[#1A1F36]'}`}>{KIND_LABEL[k]}</button>
                ))}
              </div>
              <select value={facility} onChange={(e) => setFacility(e.target.value)} aria-label="Facility"
                className="text-xs text-[#334155] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-2 py-1">
                <option value="">All facilities</option>
                {nexus.facilities.map((f) => <option key={f.facility_id} value={f.facility_id}>{f.facility_id}</option>)}
              </select>
              {audit.state === 'ok' && (
                <a href={csvHref} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]"><Download size={12} /> CSV</a>
              )}
            </div>
          </div>
          {audit.state === 'loading' && <div className="h-24 bg-[#F0F2F5] rounded-lg animate-pulse" />}
          {audit.state === 'denied' && <Denied message={`${audit.message}. The audit trail is visible to partner and admin roles.`} />}
          {audit.state === 'ok' && (
            <>
              <p className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] mb-2"><Database size={11} /> Stored in {audit.backend === 'supabase' ? 'Supabase' : 'the local store (Supabase unreachable or tables not yet created)'} · {audit.rows.length} entries shown</p>
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs min-w-[760px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-[#94A3B8]">
                      <th className="font-semibold pb-2">When (UTC)</th><th className="font-semibold pb-2">Who</th><th className="font-semibold pb-2">Kind</th>
                      <th className="font-semibold pb-2">Action</th><th className="font-semibold pb-2">Site</th><th className="font-semibold pb-2">Subject / detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.rows.map((r, i) => (
                      <tr key={r.id ?? i} className="border-t border-[#F1F5F9] align-top">
                        <td className="py-1.5 pr-2 whitespace-nowrap text-[#334155]" style={MONO}>{String(r.at).replace('T', ' ').slice(0, 19)}</td>
                        <td className="py-1.5 pr-2 text-[#334155]">{r.user_email ?? 'open access'} <span className="text-[#94A3B8]">· {r.role}</span></td>
                        <td className="py-1.5 pr-2 text-[#64748B]">{KIND_LABEL[r.kind] ?? r.kind}</td>
                        <td className="py-1.5 pr-2 text-[#1A1F36] font-medium">{r.action}</td>
                        <td className="py-1.5 pr-2 text-[#64748B]">{r.facility_id ?? '—'}</td>
                        <td className="py-1.5 text-[#64748B] max-w-[420px]">
                          {r.subject && <span className="text-[#334155]">{r.subject} </span>}
                          {r.detail?.source && <span>· {r.detail.source === 'llm' ? 'written brief' : 'template brief'}{r.detail.rejected ? `, figure ${r.detail.rejected} rejected` : ''}</span>}
                          {r.detail?.framework && <span>· readiness {r.detail.readiness}%</span>}
                        </td>
                      </tr>
                    ))}
                    {!audit.rows.length && <tr><td colSpan={6} className="py-6 text-center text-[#94A3B8]">No entries yet for these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
          <h2 className="text-sm font-bold text-[#1A1F36]">Model spend by engagement</h2>
          <p className="text-xs text-[#64748B] mb-3">Tokens and list-price cost per facility or engagement, from every model call.</p>
          {usage.state === 'loading' && <div className="h-16 bg-[#F0F2F5] rounded-lg animate-pulse" />}
          {usage.state === 'denied' && <Denied message={`${usage.message}. Model spend is visible to partner and admin roles.`} />}
          {usage.state === 'ok' && (usage.engagements.length ? (
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#94A3B8]">
                <th className="font-semibold pb-2">Engagement</th><th className="font-semibold pb-2 text-right">Calls</th>
                <th className="font-semibold pb-2 text-right">Input tokens</th><th className="font-semibold pb-2 text-right">Output tokens</th>
                <th className="font-semibold pb-2 text-right">Cost (USD)</th><th className="font-semibold pb-2 pl-4">By feature</th>
              </tr></thead>
              <tbody>
                {usage.engagements.map((e) => (
                  <tr key={e.engagement} className="border-t border-[#F1F5F9]">
                    <td className="py-1.5 font-medium text-[#1A1F36]">{e.engagement}</td>
                    <td className="py-1.5 text-right" style={MONO}>{e.calls}</td>
                    <td className="py-1.5 text-right" style={MONO}>{e.inputTokens.toLocaleString('en-IN')}</td>
                    <td className="py-1.5 text-right" style={MONO}>{e.outputTokens.toLocaleString('en-IN')}</td>
                    <td className="py-1.5 text-right font-semibold" style={MONO}>${e.costUsd.toFixed(4)}</td>
                    <td className="py-1.5 pl-4 text-[#64748B]">{Object.entries(e.byFeature).map(([f, c]) => `${f} $${c.toFixed(4)}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-xs text-[#94A3B8]">No model calls recorded yet.</p>)}
        </section>
      </div>
    </CCLayout>
  );
}
