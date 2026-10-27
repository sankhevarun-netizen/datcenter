'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, GitBranch, Users, ListChecks, ShieldCheck } from 'lucide-react';
import { IMPACT_LABEL } from '@/lib/nexus/incident-brief';
import { fmtLakh } from '@/lib/nexus/format';

const SEV_CONFIG = {
  critical: { bg: 'bg-[#C8102E]', label: 'CRITICAL', rowBg: 'hover:bg-[#C8102E]/5', leftBorder: 'border-l-[#C8102E]' },
  high: { bg: 'bg-[#E87722]', label: 'HIGH', rowBg: 'hover:bg-[#E87722]/5', leftBorder: 'border-l-[#E87722]' },
  medium: { bg: 'bg-[#F2A900]', label: 'MEDIUM', rowBg: 'hover:bg-[#F2A900]/5', leftBorder: 'border-l-[#F2A900]' },
  low: { bg: 'bg-[#005EB8]', label: 'LOW', rowBg: 'hover:bg-[#005EB8]/5', leftBorder: 'border-l-[#005EB8]' },
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'text-[#C8102E] bg-[#C8102E]/10' },
  acknowledged: { label: 'Acknowledged', color: 'text-[#005EB8] bg-[#005EB8]/10' },
  escalated: { label: 'Escalated', color: 'text-[#E87722] bg-[#E87722]/10' },
  resolved: { label: 'Resolved', color: 'text-[#007A70] bg-[#00B0A0]/10' },
};

function OwnerBadge({ team }) {
  const initials = team.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div title={team} className="w-7 h-7 rounded-full bg-[#00338D]/10 border border-[#00338D]/20 flex items-center justify-center flex-shrink-0">
      <span className="text-[#00338D] text-[10px] font-bold">{initials}</span>
    </div>
  );
}

function Line({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={12} className="text-[#9CA3AF] mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[#6B7280] text-[10px] font-bold uppercase tracking-wider">{label}</p>
        <p className="text-[#1A1F36] text-xs leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

export default function IncidentRow({ incident, status, onAcknowledge }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEV_CONFIG[incident.severity] ?? SEV_CONFIG.medium;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;

  return (
    <motion.div layout className={`border-l-2 ${sev.leftBorder} rounded-r-lg transition-colors cursor-pointer ${sev.rowBg}`}>
      <div className="flex items-center gap-3 px-4 py-3" onClick={() => setExpanded(!expanded)}>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${sev.bg} text-white flex-shrink-0 w-16 justify-center`}>{sev.label}</span>
        <span className="text-[#9CA3AF] text-xs flex-shrink-0 w-20 hidden md:inline" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{incident.id}</span>
        <p className="text-[#1A1F36] font-semibold text-sm flex-1 truncate">{incident.title}</p>
        <span className="text-[#6B7280] text-xs flex-shrink-0 hidden lg:inline">{incident.site} · {incident.componentId}</span>
        <span className="text-[#9CA3AF] text-xs flex-shrink-0 w-20 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{incident.age}</span>
        <OwnerBadge team={incident.owner} />
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusCfg.color}`}>{statusCfg.label}</span>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-[#9CA3AF]" />
        </motion.div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-3 border-t border-[#D8DCE3] grid md:grid-cols-2 gap-3 bg-[#F0F2F5]/60">
              <Line icon={GitBranch} label={`Why · ${IMPACT_LABEL[incident.impact]}`}>
                {incident.failureMode}{incident.pattern ? `. ${incident.pattern}.` : '. No earlier incident matches.'}
              </Line>
              <Line icon={Users} label="Who is exposed">
                {incident.exposureInrLakh !== null && incident.tenants
                  ? `${incident.tenants} ${incident.tenants === 1 ? 'tenant' : 'tenants'}; ${fmtLakh(incident.exposureInrLakh)} contractual exposure if the chain drops.`
                  : incident.tenants ? `${incident.tenants} ${incident.tenants === 1 ? 'tenant' : 'tenants'} affected; no outage penalty at stake.` : 'No tenant attributable from the record.'}
              </Line>
              {incident.protection && <Line icon={ShieldCheck} label="Redundancy">{incident.protection}</Line>}
              {incident.firstAction && <Line icon={ListChecks} label={`First action · ${incident.owner}`}>{incident.firstAction}</Line>}
              <div className="md:col-span-2 flex flex-wrap gap-2 pt-1">
                {status === 'open' && (
                  <button onClick={(e) => { e.stopPropagation(); onAcknowledge?.(); }}
                    className="px-4 py-1.5 bg-[#00338D] hover:bg-[#002A73] text-white text-xs font-bold rounded-lg transition-colors">
                    Acknowledge
                  </button>
                )}
                <Link href={`/incidents?alert=${incident.id}`} onClick={(e) => e.stopPropagation()}
                  className="px-4 py-1.5 border border-[#D8DCE3] hover:bg-[#F0F2F5] text-[#00338D] text-xs font-bold rounded-lg transition-colors">
                  Open full brief
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
