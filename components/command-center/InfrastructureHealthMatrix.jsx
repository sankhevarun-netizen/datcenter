'use client';
import { Zap, Thermometer, Network, Shield, Flame, Droplets } from 'lucide-react';
import StatusBadge from './StatusBadge';

const ICON_MAP = { Zap, Thermometer, Network, Shield, Flame, Droplets };
const RISK_STATUS = { Low: 'healthy', Medium: 'warning', High: 'critical' };
const MONO = { fontFamily: "'JetBrains Mono', monospace" };

function HealthBar({ pct }) {
  const color = pct >= 98 ? '#00B0A0' : pct >= 90 ? '#E87722' : '#C8102E';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#D8DCE3] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold text-[#1A1F36] w-12 text-right" style={MONO}>{pct}%</span>
    </div>
  );
}

export default function InfrastructureHealthMatrix({ facilityName, systems }) {
  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-[#1A1F36] text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Infrastructure Health Matrix</h2>
        <span className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wider">{facilityName}</span>
      </div>
      <p className="text-[10px] text-[#9CA3AF] mb-4">Share of units with no open advisory or alert · peak unit loading against its derated rating</p>

      <div className="space-y-4">
        {systems.map((row) => {
          const Icon = ICON_MAP[row.icon] ?? Zap;
          return (
            <div key={row.system} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#00338D]/8 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-[#00338D]" />
                  </div>
                  <span className="text-xs font-semibold text-[#1A1F36] truncate">{row.system}</span>
                </div>
                <StatusBadge status={RISK_STATUS[row.failureRisk]} label={`${row.failureRisk} risk`} size="xs" />
              </div>
              <HealthBar pct={row.healthPct} />
              <div className="flex items-center justify-between gap-2 text-[10px] pl-9">
                <span className="text-[#9CA3AF] truncate">
                  Flagged <span className={row.degraded > 0 ? 'text-[#A47C0B] font-bold' : 'text-[#00B0A0] font-bold'}>{row.degraded}</span>/{row.total}
                  {row.flagged.length > 0 && <span className="text-[#6B7280]"> · {row.flagged.join(', ')}</span>}
                  {row.peak && <span className="text-[#6B7280]"> · peak {row.peak.componentId} {row.peak.utilisationPct}%</span>}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#F0F2F5] text-[#6B7280] font-medium flex-shrink-0">{row.redundancy}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
