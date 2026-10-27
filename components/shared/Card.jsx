'use client';
export function Card({ children, className = '', hover = false, onClick, padding = 'p-6' }) {
  const base = 'bg-white rounded-2xl border border-[#D8DCE3] transition-all duration-200';
  const hoverStyles = hover
    ? 'hover:shadow-[0_10px_25px_-5px_rgba(0,51,141,0.12),0_4px_10px_-5px_rgba(0,51,141,0.08)] hover:-translate-y-0.5 cursor-pointer'
    : 'shadow-[0_1px_3px_0_rgba(0,0,0,0.08),0_1px_2px_-1px_rgba(0,0,0,0.06)]';

  return (
    <div
      className={`${base} ${hoverStyles} ${padding} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function DarkCard({ children, className = '', padding = 'p-6' }) {
  return (
    <div className={`bg-[#00338D] rounded-2xl border border-white/10 ${padding} ${className}`}>
      {children}
    </div>
  );
}

export function MetricCard({ label, value, unit, icon: Icon, color = '#005EB8', trend }) {
  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,51,141,0.1)] transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: color + '18' }}
        >
          {Icon && <Icon size={20} style={{ color }} />}
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trend > 0 ? 'text-[#00B0A0] bg-[#00B0A0]/10' : 'text-[#EF4444] bg-[#EF4444]/10'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="font-mono font-bold text-2xl text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
        {unit && <span className="text-sm font-normal text-[#6B7280] ml-1">{unit}</span>}
      </div>
      <div className="text-sm text-[#6B7280] mt-1 font-medium">{label}</div>
    </div>
  );
}
