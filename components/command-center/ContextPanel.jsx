'use client';
import Link from 'next/link';
import { AlertCircle, ArrowUpRight, Calendar, AlertTriangle, CloudLightning, FileText } from 'lucide-react';
import { fmtLakh } from '@/lib/nexus/format';
import { timeLabel } from '@/lib/nexus/time';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const ALERT_DOT = { critical: 'bg-[#C8102E]', high: 'bg-orange-500', medium: 'bg-[#E87722]', low: 'bg-[#005EB8]' };

function Section({ title, icon: Icon, children }) {
  return (
    <div className="border-b border-[#D8DCE3] pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon size={12} className="text-[#9CA3AF]" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function ContextPanel({ context, tenants }) {
  const atRisk = tenants.filter((t) => t.exposureInrLakh > 0).slice(0, 3);
  return (
    <aside className="hidden xl:block w-80 flex-shrink-0 bg-white border-l border-[#D8DCE3] h-full overflow-y-auto p-4">
      <Section title="Most severe alerts" icon={AlertCircle}>
        <div className="space-y-2">
          {context.alerts.map((a) => (
            <Link key={a.id} href={`/incidents?alert=${a.id}`} className="flex items-start gap-2 rounded hover:bg-[#F8FAFC] -mx-1 px-1">
              <span className={`w-2 h-2 rounded-full ${ALERT_DOT[a.severity]} flex-shrink-0 mt-1.5`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#1A1F36] leading-snug">{a.label}</p>
                <p className="text-[10px] text-[#9CA3AF]" style={MONO}>{a.id} · {a.time}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {context.escalations.length > 0 && (
        <Section title="Escalations" icon={ArrowUpRight}>
          <div className="space-y-2">
            {context.escalations.map((e) => (
              <div key={e.id} className="bg-[#C8102E]/5 border border-[#C8102E]/10 rounded-lg px-3 py-2">
                <p className="text-xs text-[#1A1F36] leading-snug">{e.label}</p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5" style={MONO}>{e.time}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="SLA exposure" icon={AlertTriangle}>
        <div className="space-y-2">
          {atRisk.map((t) => (
            <div key={t.contractId} className="bg-[#E87722]/5 border border-[#E87722]/20 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-0.5 gap-2">
                <p className="text-[11px] font-bold text-[#1A1F36] truncate">{t.name}</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#E87722]/20 text-[#8A6508] flex-shrink-0">AT RISK</span>
              </div>
              <p className="text-[10px] text-[#6B7280]">{t.facilityId} · SLA {t.slaUptimePct}% · {t.allowedDowntimeMinPerYear} min a year</p>
              <p className="text-[10px] mt-0.5" style={MONO}><span className="text-[#B42318]">{fmtLakh(t.exposureInrLakh)}</span> <span className="text-[#9CA3AF]">via {t.worstAlert}</span></p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Maintenance due, next 45 days" icon={Calendar}>
        <div className="space-y-2">
          {context.maintenance.slice(0, 5).map((m) => (
            <div key={m.id} className="border border-[#D8DCE3] rounded-lg px-3 py-2">
              <p className="text-[10px] font-bold text-[#00338D]">{m.site} · {m.componentId}</p>
              <p className="text-xs text-[#1A1F36]">{m.task}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5" style={MONO}>{timeLabel(m.due)} · in {m.inDays} days</p>
            </div>
          ))}
          {context.maintenance.length > 5 && <p className="text-[10px] text-[#9CA3AF]">+{context.maintenance.length - 5} more</p>}
        </div>
      </Section>

      <Section title="Site hazards" icon={CloudLightning}>
        <div className="space-y-2">
          {context.hazards.map((h) => (
            <div key={h.id} className={`rounded-lg px-3 py-2 border ${h.severity === 'critical' ? 'bg-[#C8102E]/5 border-[#C8102E]/20' : 'bg-[#E87722]/5 border-[#E87722]/20'}`}>
              <p className="text-[10px] font-bold" style={{ color: h.severity === 'critical' ? '#B42318' : '#8A6508' }}>{h.site} · {h.type}</p>
              <p className="text-[11px] text-[#334155] leading-snug mt-0.5">{h.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="bg-[#00338D]/5 border border-[#00338D]/15 rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <FileText size={12} className="text-[#00338D]" />
          <span className="text-[10px] font-bold text-[#00338D] uppercase tracking-wider">Portfolio summary</span>
        </div>
        <p className="text-xs text-[#334155] leading-relaxed">{context.summary}</p>
      </div>
    </aside>
  );
}
