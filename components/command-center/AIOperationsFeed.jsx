'use client';
// Operations feed: the predictive watchlist, condensed. Each item carries its
// evidence count (how many independent records support it) instead of a
// confidence score, and opens the full watchlist or incident brief.
import Link from 'next/link';
import { Radar, BellOff, BellRing, TrendingUp } from 'lucide-react';
import { getFacility } from '@/lib/nexus/data';
import { fmtLakh } from '@/lib/nexus/format';

const PRIORITY = {
  high: { border: 'border-[#C8102E]/20', bg: 'bg-[#C8102E]/5', fg: '#B42318' },
  medium: { border: 'border-[#E87722]/25', bg: 'bg-[#E87722]/5', fg: '#8A6508' },
};

export default function AIOperationsFeed({ risks }) {
  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden h-full">
      <div className="h-0.5 bg-gradient-to-r from-[#00338D] via-[#005EB8] to-[#00B0A0]" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-[#1A1F36] text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Before It Breaks</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#005EB8]/10 text-[#005EB8] text-[10px] font-bold">
              <Radar size={9} /> Predictive
            </span>
          </div>
          <Link href="/command-center/predictive" className="text-[10px] text-[#005EB8] font-semibold hover:underline">{risks.length} risks →</Link>
        </div>

        <div className="space-y-2.5">
          {risks.map((r) => {
            const p = PRIORITY[r.priority];
            const alertId = r.kind === 'component' ? r.alert?.alertId : r.linkedAlerts[0];
            return (
              <div key={r.id} className={`border rounded-xl p-3 ${p.border} ${p.bg}`}>
                <div className="flex items-start gap-2.5">
                  {r.kind === 'efficiency-drift' || r.kind === 'capacity-trend' ? <TrendingUp size={15} className="text-[#A47C0B] flex-shrink-0 mt-0.5" />
                    : r.alert ? <BellRing size={15} className="text-[#64748B] flex-shrink-0 mt-0.5" />
                      : <BellOff size={15} style={{ color: p.fg }} className="flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1A1F36] text-xs leading-snug">{r.title}</p>
                    <p className="text-[10px] text-[#6B7280] mt-1 line-clamp-2">
                      {r.kind === 'efficiency-drift'
                        ? `${fmtLakh(r.cost.extraCostInrLakh)} of extra energy so far; ${fmtLakh(r.cost.annualRunRateInrLakh)} a year if uncorrected.`
                        : r.kind === 'capacity-trend'
                          ? `${r.signal}; ${r.trend.interventionWindowWeeks} weeks to ${r.trend.threshold}%.`
                          : r.commonModeWith.length
                          ? `Redundant peer ${r.commonModeWith.join(', ')} carries the same fault.${r.cost?.scheduledInrLakh != null ? ` ${fmtLakh(r.cost.scheduledInrLakh)} scheduled vs ${fmtLakh(r.cost.emergencyInrLakh)} emergency.` : ''}`
                          : r.signal}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-[10px]">
                      <span className="text-[#9CA3AF]">{getFacility(r.facilityId).name} · {r.evidence.length} supporting records</span>
                      {alertId
                        ? <Link href={`/incidents?alert=${alertId}`} className="font-bold text-[#00338D] hover:underline">Brief</Link>
                        : <Link href="/command-center/predictive" className="font-bold text-[#00338D] hover:underline">Details</Link>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
