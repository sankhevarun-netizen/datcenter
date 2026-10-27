'use client';
// Every tenant contract with its SLA, the downtime it allows a year, the
// penalty cap, and the largest exposure any open outage-class alert puts on it.
import Link from 'next/link';
import { fmtLakh, fmtUpTo } from '@/lib/nexus/format';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };

export default function TenantSlaPanel({ tenants }) {
  const exposed = tenants.filter((t) => t.exposureInrLakh > 0);
  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="font-bold text-[#1A1F36] text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Tenants & SLA Exposure</h2>
          <p className="text-[#9CA3AF] text-xs mt-0.5">{tenants.length} contracts · {exposed.length} exposed to an open outage-class alert · exposure if the affected chain drops for its typical outage; a penalty applies once an outage passes the contract threshold</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-[#94A3B8]">
              <th className="font-semibold pb-2">Tenant</th>
              <th className="font-semibold pb-2">Site</th>
              <th className="font-semibold pb-2 text-right">SLA</th>
              <th className="font-semibold pb-2 text-right">Downtime allowed / yr</th>
              <th className="font-semibold pb-2 text-right">Penalty · threshold</th>
              <th className="font-semibold pb-2 text-right">Exposure now</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.contractId} className="border-t border-[#F1F5F9]">
                <td className="py-1.5 pr-2">
                  <span className="text-[#1A1F36] font-medium">{t.name}</span>
                  <span className="text-[#94A3B8]"> · {t.workload}</span>
                </td>
                <td className="py-1.5 pr-2 text-[#64748B]">{t.facilityId}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-[#334155]" style={MONO}>{t.slaUptimePct}%</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-[#334155]" style={MONO}>{t.allowedDowntimeMinPerYear} min</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-[#334155]" style={MONO}>₹{fmtUpTo(t.penaltyInrLakh, 1)} L · {t.thresholdHours} h</td>
                <td className="py-1.5 text-right tabular-nums whitespace-nowrap" style={MONO}>
                  {t.exposureInrLakh > 0 ? (
                    <Link href={`/incidents?alert=${t.worstAlert}`} className="text-[#B42318] font-semibold hover:underline" title={`Largest via ${t.worstAlert}`}>
                      ₹{fmtUpTo(t.exposureInrLakh, 1)} L
                    </Link>
                  ) : <span className="text-[#94A3B8]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[#94A3B8] mt-2">Total if every exposed chain dropped at once: {fmtLakh(Math.round(exposed.reduce((s, t) => s + t.exposureInrLakh, 0) * 10) / 10)}. Each tenant counted once, at its largest exposure.</p>
    </div>
  );
}
