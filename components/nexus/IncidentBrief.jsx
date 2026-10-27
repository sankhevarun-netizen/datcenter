'use client';
// The incident brief: an analyst summary streamed through the number guard,
// then the four structured answers it is built from — what happened, why,
// who is exposed and what to do. Every figure comes from analyseIncident().
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, GitBranch, Users, ListChecks, ShieldCheck, ShieldAlert, ShieldQuestion, History, Truck, Scale, Timer } from 'lucide-react';
import { analyseIncident, slaClock } from '@/lib/nexus/incident-engine';
import { similarPatterns } from '@/lib/nexus/pattern-graph';
import { narrateIncident, IMPACT_LABEL } from '@/lib/nexus/incident-brief';
import { fmtKw, fmtLakh, fmtDuration, fmtDurationShort, fmtUpTo } from '@/lib/nexus/format';
import { timeLabel } from '@/lib/nexus/time';
import { usePersistentState } from '@/lib/use-persistent-state';
import { logEvent } from '@/lib/audit-client';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };

export const SEVERITY_STYLE = {
  critical: { fg: '#B42318', bg: '#FDECEC', dot: '#C8102E', label: 'Critical' },
  high: { fg: '#B54708', bg: '#FEF0E6', dot: '#E8590C', label: 'High' },
  medium: { fg: '#8A6508', bg: '#FBF3DE', dot: '#E87722', label: 'Medium' },
  low: { fg: '#1D4E89', bg: '#EAF2FB', dot: '#005EB8', label: 'Low' },
};

const IMPACT_STYLE = {
  outage: { fg: '#B42318', bg: '#FDECEC' },
  capacity: { fg: '#1D4E89', bg: '#EAF2FB' },
  compliance: { fg: '#6B3FA0', bg: '#F3EDFA' },
  efficiency: { fg: '#8A6508', bg: '#FBF3DE' },
};

function Chip({ style, children }) {
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: style.bg, color: style.fg }}>{children}</span>;
}

function Card({ icon: Icon, title, children }) {
  return (
    <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">
        <Icon size={13} className="text-[#005EB8]" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, children }) {
  return (
    <div className="flex gap-3 text-xs py-1">
      <span className="w-28 flex-shrink-0 text-[#94A3B8]">{label}</span>
      <span className="text-[#1A1F36] min-w-0">{children}</span>
    </div>
  );
}

const PROTECTION = {
  redundant: { icon: ShieldCheck, fg: '#00704A', bg: '#E6F6EF', label: 'Redundancy holds' },
  'single-path': { icon: ShieldAlert, fg: '#B54708', bg: '#FEF0E6', label: 'Single path' },
  exposed: { icon: ShieldAlert, fg: '#B42318', bg: '#FDECEC', label: 'Peers cannot carry the load' },
  unknown: { icon: ShieldQuestion, fg: '#475569', bg: '#EEF2F7', label: 'Topology not on file' },
};

const clockText = (min) => {
  const neg = min < 0;
  const m = Math.abs(min);
  const h = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  const ss = Math.floor((m * 60) % 60);
  return `${neg ? '−' : ''}${h ? `${h} h ` : ''}${String(mm).padStart(h ? 2 : 1, '0')} min ${String(ss).padStart(2, '0')} s`;
};

// Live SLA clock: once declared service-affecting, each exposed tenant's
// notification deadline and penalty threshold count down in real time.
function SlaClock({ analysis }) {
  // The declaration time persists per user, so a running clock survives a reload.
  const [startedAt, setStartedAt] = usePersistentState(`sla:${analysis.id}`, null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!startedAt) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  const declare = () => {
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
    logEvent('action', 'declare service-affecting', { facilityId: analysis.facilityId, subject: analysis.id, detail: { declaredAt: new Date(t).toISOString() } });
  };
  const elapsed = startedAt ? Math.max(0, (now - startedAt) / 60000) : 0;
  const rows = slaClock(analysis, elapsed);
  if (!rows.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-[#D8DCE3] p-2.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#334155]"><Timer size={12} /> SLA clock</p>
        {startedAt
          ? <span className="text-[10px] text-[#B42318] font-semibold" style={MONO}>Service-affecting · {clockText(elapsed)}</span>
          : <button onClick={declare} className="text-[10px] font-bold px-2 py-1 rounded-md bg-[#B42318] text-white hover:bg-[#912018]">Declare service-affecting</button>}
      </div>
      <table className="w-full text-[11px]">
        <thead><tr className="text-[#94A3B8] text-left"><th className="font-medium">Tenant</th><th className="font-medium text-right">Notify within</th><th className="font-medium text-right">Penalty threshold</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tenantId} className="border-t border-[#F1F5F9]">
              <td className="py-1 pr-2 text-[#1A1F36]">{r.name}</td>
              <td className="py-1 pr-2 text-right whitespace-nowrap" style={{ ...MONO, color: r.notifyLeftMin !== null && r.notifyLeftMin < 0 ? '#B42318' : '#334155' }}>{r.notifyLeftMin === null ? '—' : r.notifyLeftMin < 0 ? 'overdue' : clockText(r.notifyLeftMin)}</td>
              <td className="py-1 text-right whitespace-nowrap" style={{ ...MONO, color: r.breached ? '#B42318' : r.breakLeftMin < 30 ? '#B54708' : '#334155' }}>{r.breached ? `breached · ₹${fmtUpTo(r.penaltyInrLakh, 1)} L` : clockText(r.breakLeftMin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Brief({ analysis, offline }) {
  const [state, setState] = useState({ text: '', narrating: true, source: null });
  const run = useRef(0);
  useEffect(() => {
    const id = ++run.current;
    const ctrl = new AbortController();
    setState({ text: '', narrating: true, source: null });
    narrateIncident(analysis, {
      offline,
      signal: ctrl.signal,
      onText: (text) => { if (run.current === id) setState((s) => ({ ...s, text })); },
    }).then((r) => { if (run.current === id && r.source !== 'aborted') setState({ text: r.text, narrating: false, source: r.source }); });
    return () => ctrl.abort();
  }, [analysis, offline]);

  const paragraphs = state.text.split(/\n\s*\n/).filter(Boolean);
  return (
    <section className="bg-[#F7FAFD] rounded-xl border border-[#D6E4F2] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#005EB8] mb-2">Analyst brief</p>
      {state.narrating && !state.text ? (
        <div className="space-y-2 animate-pulse" aria-label="Brief loading">
          <div className="h-2.5 bg-[#D6E4F2] rounded w-full" /><div className="h-2.5 bg-[#D6E4F2] rounded w-11/12" /><div className="h-2.5 bg-[#D6E4F2] rounded w-4/5" />
        </div>
      ) : (
        <div className="space-y-2">
          {paragraphs.map((p, i) => {
            const m = /^(What happened|Why|Who is exposed|Who was exposed|What to do):\s*/.exec(p);
            return (
              <p key={i} className="text-[13px] leading-relaxed text-[#1A1F36]">
                {m && <span className="font-semibold">{m[1]}: </span>}{m ? p.slice(m[0].length) : p}
              </p>
            );
          })}
        </div>
      )}
      {!state.narrating && state.text && (
        <p className="text-[10px] text-[#94A3B8] mt-2">
          {state.source === 'llm' ? 'Written from computed figures; every number checked against the analysis below.' : 'Generated from the analysis below.'}
        </p>
      )}
    </section>
  );
}

export default function IncidentBrief({ alertId, incidentId, offline = false, status, onAcknowledge }) {
  const analysis = useMemo(() => analyseIncident({ alertId, incidentId }), [alertId, incidentId]);
  // The same failure mode, still open elsewhere in the portfolio.
  const related = useMemo(() => similarPatterns({
    facilityId: analysis.facilityId, componentId: analysis.componentId,
    text: `${analysis.what.headline} ${analysis.what.note ?? ''} ${analysis.why.rootCause ?? ''}`, excludeId: analysis.id,
  }), [analysis]);
  const a = analysis;
  const sev = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.medium;
  const prot = a.who.protection ? PROTECTION[a.who.protection.state] : null;
  const currentStatus = status ?? a.status;

  return (
    <div className="space-y-3">
      {/* Header */}
      <header className="bg-white rounded-xl border border-[#D8DCE3] p-4">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <Chip style={{ fg: sev.fg, bg: sev.bg }}>{sev.label}</Chip>
          <Chip style={IMPACT_STYLE[a.impact]}>{IMPACT_LABEL[a.impact]}</Chip>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] capitalize">{currentStatus}</span>
          <span className="text-[10px] text-[#94A3B8]" style={MONO}>{a.id}</span>
        </div>
        <h2 className="text-base font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{a.what.headline}</h2>
        <p className="text-xs text-[#64748B] mt-0.5">
          {a.componentId} · {a.facilityName} · {a.kind === 'alert' ? 'raised' : 'detected'} {timeLabel(a.detectedAt)}{a.owner ? ` · ${a.owner}` : ''}
        </p>
        {a.kind === 'alert' && currentStatus === 'open' && onAcknowledge && (
          <button onClick={onAcknowledge} className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00338D] hover:bg-[#002A73] text-white transition-colors">
            Acknowledge
          </button>
        )}
      </header>

      <Brief analysis={analysis} offline={offline} />

      <div className="grid xl:grid-cols-2 gap-3">
        {/* What */}
        <Card icon={Activity} title="What happened">
          {a.what.rating && (
            <>
              <Fact label="Rating">{fmtUpTo(a.what.rating.capacity)} {a.what.rating.unit}, {a.what.rating.redundancy}</Fact>
              <Fact label="Load"><span style={MONO}>{fmtUpTo(a.what.rating.load, 1)} {a.what.rating.unit}</span> ({fmtUpTo(a.what.rating.utilisationPct, 1)}%)</Fact>
            </>
          )}
          {a.what.note && <Fact label="Note">{a.what.note}</Fact>}
          {a.what.durationMin !== null && <Fact label="Duration">{fmtDuration(a.what.durationMin)}, resolved {timeLabel(a.what.resolvedAt)}</Fact>}
          {a.what.replay && (
            <div className="mt-2 rounded-lg bg-[#F7FAFD] border border-[#D6E4F2] p-2.5 text-xs text-[#1A1F36]">
              In <span style={MONO}>{a.what.replay.incidentId}</span> the telemetry signal preceded detection by <strong>{fmtDuration(a.what.replay.leadMinutes)}</strong>.{' '}
              <Link href="/command-center/capacity-simulation?scene=scene4" className="text-[#005EB8] font-semibold hover:underline">Open the replay</Link>
            </div>
          )}
        </Card>

        {/* Why */}
        <Card icon={GitBranch} title="Why">
          {a.why.failureMode && <Fact label="Failure mode">{a.why.failureMode}</Fact>}
          {a.why.rootCause && <Fact label="Root cause">{a.why.rootCause}</Fact>}
          {a.why.probableCause && (
            <Fact label="Probable cause">
              {a.why.probableCause.cause}{' '}
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: a.why.probableCause.confidence === 'high' ? '#E6F6EF' : a.why.probableCause.confidence === 'moderate' ? '#FBF3DE' : '#EEF2F7', color: a.why.probableCause.confidence === 'high' ? '#00704A' : a.why.probableCause.confidence === 'moderate' ? '#8A6508' : '#475569' }}>{a.why.probableCause.confidence} confidence</span>
              <span className="block text-[10px] text-[#94A3B8]">{a.why.probableCause.basis}</span>
            </Fact>
          )}
          {a.why.findings[0] && <Fact label="Last finding">{a.why.findings[0].findings} <span className="text-[#94A3B8]">({a.why.findings[0].date})</span></Fact>}
          {a.why.pattern.length > 0 ? (
            <div className="mt-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#334155] mb-1">
                <History size={12} /> Seen {a.why.pattern.length} {a.why.pattern.length === 1 ? 'time' : 'times'} across {a.why.sites.length} {a.why.sites.length === 1 ? 'site' : 'sites'}
              </p>
              <table className="w-full text-[11px]">
                <tbody>
                  {a.why.pattern.map((p) => (
                    <tr key={p.incidentId} className="border-t border-[#F1F5F9]">
                      <td className="py-1 pr-2 text-[#334155]" style={MONO}>{p.incidentId}</td>
                      <td className="py-1 pr-2 text-[#64748B]">{p.facilityId} · {p.componentId}</td>
                      <td className="py-1 text-right text-[#334155] tabular-nums whitespace-nowrap" style={MONO}>{fmtDurationShort(p.durationMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[#94A3B8] mt-1">No earlier incident in the record matches this pattern.</p>
          )}
          {related?.liveElsewhere.length > 0 && (
            <div className="mt-2 rounded-lg bg-[#F3EDFA] border border-[#E2D5F3] p-2.5">
              <p className="text-[11px] font-semibold text-[#6B3FA0] mb-0.5">Live elsewhere now</p>
              {related.liveElsewhere.map((r) => (
                <p key={r.id} className="text-[11px] text-[#334155]"><span style={MONO}>{r.componentId}</span> at {r.facilityId} · {r.kind === 'advisory' ? 'maintenance advisory' : 'open alert'} {r.date}</p>
              ))}
              <Link href="/wiki?mode=patterns" className="text-[10px] font-semibold text-[#6B3FA0] hover:underline">See the pattern graph →</Link>
            </div>
          )}
        </Card>

        {/* Who */}
        <Card icon={a.impact === 'compliance' ? Scale : Users} title={a.kind === 'incident' ? 'Who was exposed' : 'Who is exposed'}>
          {prot && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 mb-2" style={{ background: prot.bg, color: prot.fg }}>
              <prot.icon size={14} className="mt-0.5 flex-shrink-0" />
              <div className="text-xs"><p className="font-bold">{prot.label}</p><p className="opacity-90">{a.who.protection.detail}</p></div>
            </div>
          )}
          {a.who.obligations.length > 0 ? (
            <ul className="space-y-1.5">
              {a.who.obligations.map((o) => (
                <li key={o.jurisdiction} className="text-xs"><span className="font-semibold text-[#1A1F36]">{o.jurisdiction}</span> <span className="text-[#64748B]">· {o.policy}</span><br /><span className="text-[#334155]">{o.obligation}</span></li>
              ))}
            </ul>
          ) : (
            <>
              <p className="text-xs text-[#334155] mb-2">
                {a.who.mapped ? <><span style={MONO}>{a.who.racks}</span> racks in {a.who.rows.length === 1 ? 'Row' : 'Rows'} {a.who.rows.join(', ')}, <span style={MONO}>{fmtKw(a.who.itKw)}</span> of IT load downstream</>
                  : a.who.scope === 'site' ? 'Site-wide plant: every tenant at the facility depends on it.'
                    : 'Rack-level mapping for this site is not on file.'}
              </p>
              {a.who.recorded && (
                <p className="text-xs text-[#334155] mb-2">Recorded: {a.who.recorded.tenantsAffected} {a.who.recorded.tenantsAffected === 1 ? 'tenant' : 'tenants'} affected, cost {fmtLakh(a.who.recorded.costInrLakh)}.</p>
              )}
              {a.who.tenants.length > 0 && (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[#94A3B8] text-left">
                      <th className="font-medium pb-1">Tenant</th>
                      <th className="font-medium pb-1 text-right">SLA</th>
                      {a.who.totalExposureInrLakh !== null && <th className="font-medium pb-1 text-right">At risk</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {a.who.tenants.map((t) => (
                      <tr key={t.tenantId} className="border-t border-[#F1F5F9]">
                        <td className="py-1 pr-2 text-[#1A1F36]">{t.name}{t.racks !== null && <span className="text-[#94A3B8]"> · {t.racks} racks</span>}</td>
                        <td className="py-1 pr-2 text-right text-[#334155] tabular-nums" style={MONO}>{t.contract ? `${t.contract.slaUptimePct}%` : '—'}</td>
                        {a.who.totalExposureInrLakh !== null && (
                          <td className="py-1 text-right text-[#1A1F36] tabular-nums whitespace-nowrap" style={MONO}>{t.exposureInrLakh !== null ? `₹${fmtUpTo(t.exposureInrLakh, 1)} L` : '—'}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {a.who.totalExposureInrLakh !== null && a.who.tenants.length > 0 && (
                <p className="text-[11px] text-[#64748B] mt-2">
                  If the chain drops for {fmtDuration(a.who.outage.minutes)} ({a.who.outage.basis.toLowerCase()}): <strong className="text-[#1A1F36]">{fmtLakh(a.who.totalExposureInrLakh)}</strong>, from contracts whose penalty threshold the outage passes.
                  {a.who.tenants[0].contract?.notificationClause && ` Notification: ${a.who.tenants[0].contract.notificationClause.toLowerCase()} once service-affecting.`}
                </p>
              )}
              {a.kind === 'alert' && a.impact === 'outage' && <SlaClock analysis={a} />}
            </>
          )}
        </Card>

        {/* Do */}
        <Card icon={ListChecks} title="What to do">
          {a.do.steps.length ? (
            <ol className="space-y-1.5">
              {a.do.steps.map((s) => (
                <li key={s.step} className="flex gap-2 text-xs">
                  <span className="w-5 h-5 flex-shrink-0 rounded-full bg-[#EAF2FB] text-[#005EB8] text-[10px] font-bold flex items-center justify-center">{s.step}</span>
                  <span className="min-w-0">
                    <span className="text-[#1A1F36]">{s.action}</span>
                    <span className="block text-[10px] text-[#94A3B8]">{s.owner} · within {fmtDuration(s.withinMin)}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : <p className="text-xs text-[#94A3B8]">No runbook is on file for this condition.</p>}
          {a.do.supply && (a.impact === 'outage' || a.impact === 'capacity') && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] p-2.5 text-xs text-[#334155]">
              <Truck size={13} className="mt-0.5 flex-shrink-0 text-[#64748B]" />
              <span>
                Part supply: <strong className="text-[#1A1F36]">{a.do.supply.leadTimeWeeks} weeks</strong> from {a.do.supply.vendor} ({a.do.supply.origin})
                {a.do.supply.singleSource ? ', single source' : ''}, {a.do.supply.sparesOnSite === 0 ? 'no spares on site' : `${a.do.supply.sparesOnSite} on site`}.
                <span className="block text-[10px] text-[#94A3B8] mt-0.5">{a.do.supply.note}</span>
              </span>
            </div>
          )}
          {a.do.upgrade && (
            <p className="text-[11px] text-[#64748B] mt-2">Upgrade on file: {a.do.upgrade.description}, {fmtLakh(a.do.upgrade.costInrLakh)}, {a.do.upgrade.leadTimeWeeks} weeks.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
