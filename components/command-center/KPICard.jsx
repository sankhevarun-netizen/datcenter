'use client';
import SparklineChart from './SparklineChart';

const STATUS_BORDER = {
  healthy: 'border-l-[#00B0A0]',
  warning: 'border-l-[#E87722]',
  critical: 'border-l-[#C8102E]',
};

const STATUS_SPARKLINE = {
  healthy: '#00B0A0',
  warning: '#E87722',
  critical: '#C8102E',
};

const TREND_ICON = { up: '▲', down: '▼', flat: '→' };

export default function KPICard({ title, value, unit, trend, trendValue, trendIsPositive, status, sparklineData, comparisonLabel }) {
  const borderColor = STATUS_BORDER[status] ?? STATUS_BORDER.healthy;
  const sparkColor = STATUS_SPARKLINE[status] ?? '#005EB8';
  const trendColor = trendIsPositive ? 'text-[#00B0A0]' : 'text-[#C8102E]';

  return (
    <div className={`bg-white rounded-xl border-l-[3px] border border-[#D8DCE3] ${borderColor} shadow-sm p-4 min-w-[160px] flex flex-col gap-1 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">{title}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
        {unit && <span className="text-xs text-[#9CA3AF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{unit}</span>}
      </div>
      <div className="my-0.5">
        <SparklineChart data={sparklineData} color={sparkColor} height={28} />
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${trendColor}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {TREND_ICON[trend]} {trendValue}
        </span>
        <span className="text-[10px] text-[#9CA3AF]">{comparisonLabel}</span>
      </div>
    </div>
  );
}
