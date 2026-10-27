'use client';
// Predictive watchlist: each risk with its evidence, whether it has alarmed
// yet, what acting now costs against waiting, and who sits downstream.
import Link from 'next/link';
import { BellOff, BellRing, Link2, TrendingUp, Wrench, FileWarning, Activity, Boxes } from 'lucide-react';
import { getFacility } from '@/lib/nexus/data';
import { fmtLakh } from '@/lib/nexus/format';
import { monthLabel, timeLabel } from '@/lib/nexus/time';

const PRIORITY = {
  high: { fg: '#B42318', bg: '#FDECEC', label: 'High' },
  medium: { fg: '#8A6508', bg: '#FBF3DE', label: 'Medium' },
};
const SOURCE_ICON = {
  '19_maintenance': Wrench,
  '11_incidents': FileWarning,
  '20_active_alerts': BellRing,
  '22_timeseries': Activity,
  '04_components': Boxes,
  '15_grid': Activity,
};
const SOURCE_LABEL = {
  '19_maintenance': 'Maintenance',
  '11_incidents': 'Incident record',
  '20_active_alerts': 'Alert',
  '22_timeseries': 'Monthly trend',
  '04_components': 'Redundancy',
  '15_grid': 'Grid connection',
};

function RiskCard({ r }) {
  const p = PRIORITY[r.priority];
  const site = getFacility(r.facilityId).name;
  return (
    <article className="bg-white rounded-xl border border-[#D8DCE3] p-4">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: p.bg, color: p.fg }}>{p.label} priority</span>
        {r.kind === 'component' && (r.alert ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F1F5F9] text-[#475569]"><BellRing size={10} /> Alarmed {r.alert.leadDays} days after advisory</span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF0E6] text-[#B54708]"><BellOff size={10} /> No alarm yet</span>
        ))}
        {r.kind === 'efficiency-drift' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FBF3DE] text-[#8A6508]"><TrendingUp size={10} /> Efficiency drift</span>
        )}
        {r.kind === 'capacity-trend' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EAF2FB] text-[#1D4E89]"><TrendingUp size={10} /> Capacity trend</span>
        )}
        <span className="text-[10px] text-[#94A3B8] ml-auto">{site}</span>
      </div>
      <h3 className="text-sm font-bold text-[#1A1F36]">{r.title}</h3>
      <p className="text-xs text-[#64748B] mt-0.5">
        {r.kind === 'efficiency-drift' ? `Since ${monthLabel(r.since)} · ${r.signal}` : r.kind === 'capacity-trend' ? r.signal : `First signal ${timeLabel(r.since)} · act by ${timeLabel(r.actBy)}`}
      </p>

      {r.commonModeWith?.length > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-[#FDECEC] text-[#B42318] p-2.5 text-xs">
          <Link2 size={13} className="mt-0.5 flex-shrink-0" />
          <span>Common-mode risk: {r.commonModeWith.join(', ')} is the redundant peer that would cover {r.componentId}, and it carries the same fault.</span>
        </div>
      )}

      <div className="mt-3 grid sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {r.cost?.scheduledInrLakh != null && (
          <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold">Act now vs wait</p>
            <p className="text-xs text-[#1A1F36]"><strong>{fmtLakh(r.cost.scheduledInrLakh)}</strong> scheduled</p>
            <p className="text-[11px] text-[#64748B]">{fmtLakh(r.cost.emergencyInrLakh)} median emergency</p>
          </div>
        )}
        {(r.kind === 'efficiency-drift' || r.kind === 'capacity-trend') && (() => {
          const t = r.kind === 'efficiency-drift' ? r.drift.trend : r.trend;
          return (
            <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold">Trend</p>
              <p className="text-xs text-[#1A1F36]"><strong>+{t.slopePerMonth}</strong> a month</p>
              <p className="text-[11px] text-[#64748B]">{t.confidence} confidence · fit {t.r2}</p>
            </div>
          );
        })()}
        {(r.kind === 'efficiency-drift' ? r.drift.trend : r.trend)?.projectedBreachMonth && (() => {
          const t = r.kind === 'efficiency-drift' ? r.drift.trend : r.trend;
          return (
            <div className="rounded-lg bg-[#FEF0E6] border border-[#F6D6BD] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-[#B54708] font-semibold">Projected breach</p>
              <p className="text-xs text-[#1A1F36]"><strong>{monthLabel(t.projectedBreachMonth)}</strong></p>
              <p className="text-[11px] text-[#64748B]">{t.interventionWindowWeeks} weeks to act · threshold {t.threshold}{r.kind === 'capacity-trend' ? '%' : ''}</p>
            </div>
          );
        })()}
        {r.kind === 'efficiency-drift' && (
          <>
            <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold">Cost so far</p>
              <p className="text-xs text-[#1A1F36]"><strong>{fmtLakh(r.cost.extraCostInrLakh)}</strong></p>
              <p className="text-[11px] text-[#64748B]">{r.cost.extraTco2} tCO2 extra</p>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold">If it continues</p>
              <p className="text-xs text-[#1A1F36]"><strong>{fmtLakh(r.cost.annualRunRateInrLakh)}</strong> a year</p>
              <p className="text-[11px] text-[#64748B]">at +{r.cost.meanExcess3m} PUE</p>
            </div>
          </>
        )}
        {r.exposure && (
          <div className="rounded-lg bg-[#F8FAFC] border border-[#D8DCE3] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold">Downstream</p>
            <p className="text-xs text-[#1A1F36]"><strong>{r.exposure.racks}</strong> racks</p>
            <p className="text-[11px] text-[#64748B]">{r.exposure.tenants} {r.exposure.tenants === 1 ? 'tenant' : 'tenants'}</p>
          </div>
        )}
      </div>

      <ul className="mt-3 space-y-1">
        {r.evidence.map((e, i) => {
          const Icon = SOURCE_ICON[e.source] ?? Activity;
          return (
            <li key={i} className="flex items-start gap-2 text-[11.5px] text-[#334155]">
              <Icon size={12} className="mt-0.5 flex-shrink-0 text-[#94A3B8]" />
              <span><span className="text-[#94A3B8]">{SOURCE_LABEL[e.source] ?? e.source}:</span>{' '}
                {e.alertId ? <Link href={`/incidents?alert=${e.alertId}`} className="text-[#005EB8] hover:underline">{e.text}</Link> : e.text}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export default function RiskWatchlist({ items }) {
  return <div className="space-y-3">{items.map((r) => <RiskCard key={r.id} r={r} />)}</div>;
}
