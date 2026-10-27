'use client';
// Policy and compliance: every state and national obligation that binds a
// Nexus site, whether the site's metered data can evidence it today, the
// incentives on offer, and what is coming into force.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, AlertTriangle, CircleDashed, Clock, Gift } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { policyExposure, policyTimeline, DEADLINE_WINDOW_DAYS } from '@/lib/nexus/policy-engine';
import { nexus } from '@/lib/nexus/data';
import { timeLabel, AS_OF } from '@/lib/nexus/time';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const STATUS = {
  ready: { icon: CheckCircle2, fg: '#00704A', bg: '#E6F6EF', label: 'Evidence ready' },
  'ready-on-request': { icon: CheckCircle2, fg: '#00704A', bg: '#E6F6EF', label: 'Ready if requested' },
  partial: { icon: AlertTriangle, fg: '#8A6508', bg: '#FBF3DE', label: 'Partly evidenced' },
  gap: { icon: AlertTriangle, fg: '#B42318', bg: '#FDECEC', label: 'Cannot evidence' },
  upcoming: { icon: Clock, fg: '#1D4E89', bg: '#EAF2FB', label: 'Not yet in force' },
  'from-commissioning': { icon: CircleDashed, fg: '#475569', bg: '#EEF2F7', label: 'Applies from commissioning' },
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

export default function CompliancePage() {
  const all = useMemo(() => nexus.facilities.map((f) => policyExposure(f.facility_id)), []);
  const timeline = useMemo(() => policyTimeline(), []);
  const [selected, setSelected] = useState('BLR-1');
  const site = all.find((s) => s.facilityId === selected);
  const withGaps = all.filter((s) => s.obligations.some((o) => o.status === 'gap' || o.status === 'partial'));
  const deadlines = all.flatMap((s) => s.deadlinesApproaching.map((d) => ({ ...d, facility: s.facilityId })));
  const ready = all.flatMap((s) => s.obligations).filter((o) => o.status.startsWith('ready')).length;
  const total = all.flatMap((s) => s.obligations).length;

  return (
    <CCLayout title="Policy & Compliance">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Policies tracked" value={nexus.statePolicy.length} sub="state, national and reference" />
          <Tile label="Obligations evidenced" value={`${ready} of ${total}`} sub="from metered energy and water" />
          <Tile label="Sites with gaps" value={withGaps.length} sub={withGaps.map((s) => s.facilityId).join(', ')} />
          <Tile label={`Coming into force, ${DEADLINE_WINDOW_DAYS} days`} value={deadlines.length} sub={deadlines.map((d) => `${d.jurisdiction} in ${d.inDays} days (${d.facility})`).join(', ') || 'None'} />
        </div>

        <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-3">Policy timeline · as of {timeLabel(AS_OF)}</h2>
          <ol className="relative flex flex-wrap gap-y-3">
            {timeline.map((t) => (
              <li key={t.jurisdiction} className="flex-1 min-w-[150px] pr-3">
                <div className={`h-1 rounded-full mb-2 ${t.inForce ? 'bg-[#005EB8]' : 'bg-[#E8590C]'}`} />
                <p className="text-[10px] text-[#94A3B8]" style={MONO}>{timeLabel(t.effectiveFrom)}</p>
                <p className="text-xs font-semibold text-[#1A1F36] leading-snug">{t.jurisdiction}</p>
                <p className="text-[11px] text-[#64748B] leading-snug">{t.policy}</p>
                <p className="text-[10px] mt-0.5" style={{ color: t.inForce ? '#64748B' : '#B54708' }}>
                  {t.inForce ? `In force · ${t.appliesTo === 'Reference' ? 'reference only' : t.appliesTo}` : `In ${t.inDays} days · ${t.appliesTo}`}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-wrap gap-1.5">
          {all.map((s) => {
            const worst = s.obligations.some((o) => o.status === 'gap') ? 'gap' : s.obligations.some((o) => o.status === 'partial') ? 'partial' : s.obligations.some((o) => o.status === 'from-commissioning') ? 'from-commissioning' : 'ready';
            return (
              <button key={s.facilityId} onClick={() => setSelected(s.facilityId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${selected === s.facilityId ? 'bg-[#00338D] text-white border-[#00338D]' : 'bg-white text-[#334155] border-[#D8DCE3] hover:bg-[#F8FAFC]'}`}>
                <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: STATUS[worst].fg }} aria-hidden="true" />
                {s.name.replace('Nexus ', '')}
              </button>
            );
          })}
        </div>

        <div className="grid xl:grid-cols-[1.6fr_1fr] gap-4">
          <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
            <h2 className="text-sm font-bold text-[#1A1F36]">{site.name} · {site.jurisdiction}</h2>
            <p className="text-[11px] text-[#64748B] mb-3">{site.status}</p>
            <div className="space-y-3">
              {site.obligations.map((o) => {
                const st = STATUS[o.status];
                return (
                  <article key={o.jurisdiction} className="rounded-lg border border-[#D8DCE3] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#1A1F36]">{o.jurisdiction} · {o.policy}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.fg }}><st.icon size={11} /> {st.label}</span>
                    </div>
                    <p className="text-xs text-[#334155] mt-1">{o.obligation}</p>
                    <p className="text-[11px] text-[#94A3B8]">{o.detail} · effective {timeLabel(o.effectiveFrom)}{o.startsInDays ? ` (in ${o.startsInDays} days)` : ''}</p>
                    {o.evidence.length > 0 && <ul className="mt-1.5 text-[11px] text-[#00704A] space-y-0.5">{o.evidence.map((e) => <li key={e}>✓ {e}</li>)}</ul>}
                    {o.gaps.length > 0 && <ul className="mt-1.5 text-[11px] text-[#8A6508] space-y-0.5">{o.gaps.map((g) => <li key={g}>△ {g}</li>)}</ul>}
                  </article>
                );
              })}
            </div>
            <Link href="/command-center/esg" className="inline-block mt-3 text-xs font-semibold text-[#005EB8] hover:underline">Build the disclosure pack →</Link>
          </section>

          <div className="space-y-4">
            <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
              <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2"><Gift size={12} /> Incentives available</h3>
              {site.incentivesAvailable.length ? site.incentivesAvailable.map((i) => (
                <div key={i.jurisdiction} className="mb-2">
                  <p className="text-xs font-semibold text-[#1A1F36]">{i.jurisdiction}</p>
                  <p className="text-xs text-[#334155]">{i.incentives.join(' · ')}</p>
                  <p className="text-[11px] text-[#94A3B8]">{i.eligibility}</p>
                </div>
              )) : <p className="text-xs text-[#94A3B8]">No incentives under the applicable policies.</p>}
            </section>
            <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
              <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2"><CalendarClock size={12} /> Deadlines</h3>
              {site.deadlinesApproaching.length ? site.deadlinesApproaching.map((d) => (
                <p key={d.jurisdiction} className="text-xs text-[#1A1F36]"><strong>{d.jurisdiction}</strong> {d.policy} takes effect {timeLabel(d.effectiveFrom)} — in {d.inDays} days.</p>
              )) : <p className="text-xs text-[#94A3B8]">Nothing comes into force for this site in the next {DEADLINE_WINDOW_DAYS} days.</p>}
            </section>
          </div>
        </div>
      </div>
    </CCLayout>
  );
}
