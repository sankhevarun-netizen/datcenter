'use client';
// Incident intelligence: the live alert queue and recorded incidents from the
// Nexus dataset, each opening a brief that answers what happened, why, who is
// exposed and what to do.
import { useEffect, useMemo, useState } from 'react';
import CCLayout from '@/components/command-center/CCLayout';
import IncidentBrief, { SEVERITY_STYLE } from '@/components/nexus/IncidentBrief';
import { analyseIncident, incidentQueue } from '@/lib/nexus/incident-engine';
import { IMPACT_LABEL } from '@/lib/nexus/incident-brief';
import { nexus, index } from '@/lib/nexus/data';
import { AS_OF, daysBetween, timeLabel } from '@/lib/nexus/time';
import { fmtDuration, fmtDurationShort } from '@/lib/nexus/format';
import { usePersistentState } from '@/lib/use-persistent-state';
import { logEvent } from '@/lib/audit-client';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const IMPACTS = ['outage', 'capacity', 'compliance', 'efficiency'];
const OWN_SITES = new Set(nexus.facilities.map((f) => f.facility_id));

// Impact class per alert, computed once from the dataset.
const QUEUE = incidentQueue().map((a) => ({ ...a, impact: analyseIncident({ alertId: a.alert_id }).impact }));
const RECENT_INCIDENTS = nexus.incidents
  .filter((i) => OWN_SITES.has(i.facility_id) && daysBetween(i.detected_at.slice(0, 10), AS_OF.slice(0, 10)) <= 365)
  .sort((a, b) => b.detected_at.localeCompare(a.detected_at));

function Tile({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-[#D8DCE3] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{label}</p>
      <p className="text-2xl font-semibold text-[#1A1F36] tabular-nums" style={MONO}>{value}</p>
      {sub && <p className="text-[11px] text-[#64748B]">{sub}</p>}
    </div>
  );
}

function QueueItem({ active, onClick, severity, id, title, meta, chip }) {
  const sev = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.medium;
  return (
    <button onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${active ? 'bg-[#F0F6FC] border-[#005EB8]/40' : 'bg-white border-[#D8DCE3] hover:bg-[#F8FAFC]'}`}>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sev.dot }} aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase" style={{ color: sev.fg }}>{sev.label}</span>
        <span className="text-[10px] text-[#94A3B8]" style={MONO}>{id}</span>
        {chip && <span className="ml-auto text-[10px] text-[#64748B]">{chip}</span>}
      </div>
      <p className="text-xs font-semibold text-[#1A1F36] leading-snug">{title}</p>
      <p className="text-[11px] text-[#94A3B8]">{meta}</p>
    </button>
  );
}

export default function IncidentsPage() {
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState({ alertId: QUEUE[0]?.alert_id });
  const [facility, setFacility] = useState('All');
  const [impact, setImpact] = useState('All');
  // Acknowledgements persist per user and are shared with the command centre.
  const [statuses, setStatuses] = usePersistentState('alerts:statuses', {});

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setOffline(p.get('demo') === '1');
    if (index.alertById.has(p.get('alert'))) setSelected({ alertId: p.get('alert') });
    else if (index.incidentById.has(p.get('incident'))) setSelected({ incidentId: p.get('incident') });
  }, []);

  const alerts = useMemo(() => QUEUE.filter((a) => (facility === 'All' || a.facility_id === facility) && (impact === 'All' || a.impact === impact)), [facility, impact]);
  const incidents = useMemo(() => RECENT_INCIDENTS.filter((i) => facility === 'All' || i.facility_id === facility), [facility]);

  const outageCount = QUEUE.filter((a) => a.impact === 'outage').length;
  const urgent = QUEUE.filter((a) => a.severity === 'critical' || a.severity === 'high').length;
  const mttr = RECENT_INCIDENTS.length ? Math.round(RECENT_INCIDENTS.reduce((s, i) => s + i.duration_min, 0) / RECENT_INCIDENTS.length) : null;

  return (
    <CCLayout title="Incidents">
      {({ showToast }) => (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Open alerts" value={QUEUE.length} sub={`As of ${timeLabel(AS_OF)}`} />
            <Tile label="Critical or high" value={urgent} sub="Need action today" />
            <Tile label="Outage risks" value={outageCount} sub="Tenant SLAs at stake" />
            <Tile label="Mean time to repair" value={mttr !== null ? fmtDurationShort(mttr) : '—'} sub={`${RECENT_INCIDENTS.length} incidents, last 12 months`} />
          </div>

          <div className="bg-white rounded-xl border border-[#D8DCE3] p-3 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-[#94A3B8] font-medium">Impact:</span>
            {['All', ...IMPACTS].map((k) => (
              <button key={k} onClick={() => setImpact(k)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${impact === k ? 'bg-[#00338D] text-white' : 'bg-[#F0F2F5] text-[#6B7280] hover:bg-[#D8DCE3]'}`}>
                {k === 'All' ? 'All' : IMPACT_LABEL[k]}
              </button>
            ))}
            <div className="w-px h-4 bg-[#D8DCE3]" />
            <select value={facility} onChange={(e) => setFacility(e.target.value)} aria-label="Facility"
              className="text-xs text-[#6B7280] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5 focus:outline-none">
              <option value="All">All facilities</option>
              {nexus.facilities.map((f) => <option key={f.facility_id} value={f.facility_id}>{f.name}</option>)}
            </select>
          </div>

          <div className="grid lg:grid-cols-[minmax(280px,360px)_1fr] gap-4 items-start">
            <div className="space-y-4 lg:sticky lg:top-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2">Alert queue · {alerts.length}</p>
                <div className="space-y-1.5">
                  {alerts.map((a) => (
                    <QueueItem key={a.alert_id} active={selected.alertId === a.alert_id} onClick={() => setSelected({ alertId: a.alert_id })}
                      severity={a.severity} id={a.alert_id} title={a.message}
                      meta={`${index.facilityById.get(a.facility_id).name} · ${a.component_id} · ${statuses[a.alert_id] ?? a.status}`}
                      chip={IMPACT_LABEL[a.impact]} />
                  ))}
                  {!alerts.length && <p className="text-xs text-[#94A3B8] px-1">No alerts match these filters.</p>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2">Recorded incidents · last 12 months</p>
                <div className="space-y-1.5">
                  {incidents.map((i) => (
                    <QueueItem key={i.incident_id} active={selected.incidentId === i.incident_id} onClick={() => setSelected({ incidentId: i.incident_id })}
                      severity={i.severity} id={i.incident_id} title={i.description}
                      meta={`${index.facilityById.get(i.facility_id).name} · ${i.component_id} · ${fmtDuration(i.duration_min)}`} />
                  ))}
                </div>
              </div>
            </div>

            <IncidentBrief key={selected.alertId ?? selected.incidentId} {...selected} offline={offline}
              status={selected.alertId ? statuses[selected.alertId] : undefined}
              onAcknowledge={() => {
                setStatuses((s) => ({ ...s, [selected.alertId]: 'acknowledged' }));
                logEvent('action', 'acknowledge alert', { facilityId: index.alertById.get(selected.alertId)?.facility_id, subject: selected.alertId });
                showToast(`${selected.alertId} acknowledged`);
              }} />
          </div>
        </div>
      )}
    </CCLayout>
  );
}
