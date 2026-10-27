'use client';

const CONFIG = {
  healthy:     { bg: 'bg-[#00B0A0]/10', text: 'text-[#00B0A0]', dot: 'bg-[#00B0A0]', label: 'Healthy' },
  degraded:    { bg: 'bg-[#E87722]/10', text: 'text-[#E87722]', dot: 'bg-[#E87722]', label: 'Degraded' },
  warning:     { bg: 'bg-[#E87722]/10', text: 'text-[#E87722]', dot: 'bg-[#E87722]', label: 'Warning' },
  critical:    { bg: 'bg-[#C8102E]/10', text: 'text-[#C8102E]', dot: 'bg-[#C8102E]', label: 'Critical' },
  high:        { bg: 'bg-orange-100',   text: 'text-orange-600', dot: 'bg-orange-500', label: 'High' },
  medium:      { bg: 'bg-[#E87722]/10', text: 'text-[#E87722]', dot: 'bg-[#E87722]', label: 'Medium' },
  low:         { bg: 'bg-[#005EB8]/10', text: 'text-[#005EB8]', dot: 'bg-[#005EB8]', label: 'Low' },
  info:        { bg: 'bg-[#005EB8]/10', text: 'text-[#005EB8]', dot: 'bg-[#005EB8]', label: 'Info' },
  investigating: { bg: 'bg-[#C8102E]/10', text: 'text-[#C8102E]', dot: 'bg-[#C8102E]', label: 'Investigating' },
  identified:  { bg: 'bg-orange-100',   text: 'text-orange-600', dot: 'bg-orange-500', label: 'Identified' },
  monitoring:  { bg: 'bg-[#005EB8]/10', text: 'text-[#005EB8]', dot: 'bg-[#005EB8]', label: 'Monitoring' },
  resolved:    { bg: 'bg-[#00B0A0]/10', text: 'text-[#00B0A0]', dot: 'bg-[#00B0A0]', label: 'Resolved' },
  none:        { bg: 'bg-[#00B0A0]/10', text: 'text-[#00B0A0]', dot: 'bg-[#00B0A0]', label: 'None' },
};

export default function StatusBadge({ status, label, showDot = false, size = 'sm' }) {
  const cfg = CONFIG[status] ?? CONFIG.info;
  const displayLabel = label ?? cfg.label;
  const textSize = size === 'xs' ? 'text-[10px]' : 'text-xs';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${textSize} ${cfg.bg} ${cfg.text}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
      {displayLabel}
    </span>
  );
}
