'use client';
import { useState } from 'react';
import { Zap, Server, Weight, Network, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

const PRIORITY_STYLES = {
  critical: { color: '#C8102E', bg: '#FEF2F2' },
  high:     { color: '#D97706', bg: '#FFFBEB' },
  medium:   { color: '#005EB8', bg: '#EFF6FF' },
};

const CAPACITY_STYLES = {
  ok:       { color: '#00B0A0', bg: '#F0FDF4', label: 'OK' },
  warning:  { color: '#E87722', bg: '#FFFBEB', label: 'Near limit' },
  critical: { color: '#C8102E', bg: '#FEF2F2', label: 'Capacity breach' },
};

function ImpactBadge({ icon: Icon, value, unit, label }) {
  return (
    <div className="flex items-center gap-1">
      <Icon size={9} className="text-[#9CA3AF]" />
      <span className="text-[9px] font-mono text-[#374151]">+{value} {unit}</span>
    </div>
  );
}

export default function DeploymentCard({ deployment: dep, columns, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);

  const ps = PRIORITY_STYLES[dep.priority] || PRIORITY_STYLES.medium;
  const cs = CAPACITY_STYLES[dep.capacityStatus] || CAPACITY_STYLES.ok;

  const currentColIdx = columns.findIndex(c => c.id === dep.status);
  const nextCol = columns[currentColIdx + 1];
  const prevCol = columns[currentColIdx - 1];

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;

  return (
    <div className="bg-white rounded-xl border border-[#D8DCE3] shadow-sm overflow-hidden">
      {/* Top accent bar */}
      <div className="h-0.5" style={{ backgroundColor: PRIORITY_STYLES[dep.priority]?.color || '#9CA3AF' }} />

      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#1A1F36] leading-tight" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
              {dep.equipment}
            </p>
            <p className="text-[10px] text-[#9CA3AF] mt-0.5">{dep.dcName} · {dep.rackLabel || 'Floor mount'}</p>
          </div>
          <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ backgroundColor: ps.bg, color: ps.color }}>
            {dep.priority}
          </span>
        </div>

        {/* Capacity impact */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ImpactBadge icon={Zap}    value={dep.powerImpactKw}   unit="kW"  label="Power" />
            <ImpactBadge icon={Server} value={dep.spaceImpactU}    unit="U"   label="Space" />
            <ImpactBadge icon={Weight} value={dep.weightImpactKg}  unit="kg"  label="Weight" />
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cs.bg, color: cs.color }}>
            {cs.label}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-[9px] text-[#9CA3AF]">
          {dep.tenant && <span className="font-medium text-[#6B7280]">{dep.tenant}</span>}
          {dep.tenant && <span>·</span>}
          <span>{dep.requestedBy}</span>
          <span>·</span>
          <span>{formatDate(dep.requestedAt)}</span>
          {dep.estimatedArrival && <><span>·</span><span>ETA {formatDate(dep.estimatedArrival)}</span></>}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-[9px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors py-0.5"
        >
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {expanded ? 'Less' : 'Details'}
        </button>

        {/* Expanded notes */}
        {expanded && (
          <div className="border-t border-[#F0F2F5] pt-2 space-y-2">
            {dep.notes && (
              <p className="text-[10px] text-[#6B7280] leading-relaxed">{dep.notes}</p>
            )}
            {dep.approvedBy && (
              <p className="text-[9px] text-[#9CA3AF]">Approved by <strong>{dep.approvedBy}</strong> · {formatDate(dep.approvedAt)}</p>
            )}
            {dep.installedBy && (
              <p className="text-[9px] text-[#9CA3AF]">Installed by <strong>{dep.installedBy}</strong> · {formatDate(dep.installedAt)}</p>
            )}
          </div>
        )}

        {/* Action buttons */}
        {dep.status !== 'installed' && (
          <div className="flex items-center gap-2 pt-1 border-t border-[#F0F2F5]">
            {nextCol && (
              <button
                onClick={() => onStatusChange(dep.id, nextCol.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold text-white transition-colors"
                style={{ backgroundColor: nextCol.color }}
              >
                <ArrowRight size={9} />
                Move to {nextCol.label}
              </button>
            )}
            {prevCol && dep.status === 'requested' && (
              <button
                onClick={() => onStatusChange(dep.id, 'rejected')}
                className="px-2 py-1.5 rounded-lg text-[10px] font-semibold border border-[#D8DCE3] text-[#9CA3AF] hover:bg-[#FEF2F2] hover:text-[#C8102E] hover:border-[#C8102E30] transition-colors"
              >
                Reject
              </button>
            )}
          </div>
        )}
        {dep.status === 'installed' && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-[#F0F2F5]">
            <div className="w-2 h-2 rounded-full bg-[#00B0A0]" />
            <span className="text-[10px] text-[#00B0A0] font-semibold">Installed {formatDate(dep.installedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
