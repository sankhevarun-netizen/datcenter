'use client';
import KPICard from '@/components/command-center/KPICard';
import { SkeletonCard } from './Skeleton';
import { useCountUp } from '../hooks/useCountUp';

// KPICard expects a trend/sparkline shape designed for live telemetry. These
// are point-in-time portfolio metrics, so we feed it a flat sparkline and a
// neutral trend rather than fabricating movement that doesn't exist.
function toKpiCardProps(kpi, animatedValue) {
  const flatLine = [1, 1, 1, 1, 1, 1];
  const status = (kpi.id === 'critical' || kpi.id === 'maintenance') && Number(kpi.value) > 0 ? 'warning' : 'healthy';
  return {
    title: kpi.label,
    value: animatedValue,
    unit: kpi.unit,
    trend: 'flat',
    trendValue: kpi.caption ?? 'Portfolio snapshot',
    trendIsPositive: true,
    status,
    sparklineData: flatLine,
    comparisonLabel: '',
  };
}

function KpiCardButton({ kpi, onSelect, isActive }) {
  const animatedValue = useCountUp(kpi.value);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(kpi)}
      aria-pressed={isActive}
      className={`text-left w-full rounded-xl transition-all ${isActive ? 'ring-2 ring-[#005EB8] ring-offset-2 ring-offset-[#F0F2F5]' : 'hover:-translate-y-0.5'}`}
    >
      <KPICard {...toKpiCardProps(kpi, animatedValue)} />
    </button>
  );
}

export default function PortfolioKPIs({ kpis = [], loading = true, onSelect, activeKpiId = null }) {
  if (loading || kpis.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3" role="group" aria-label="Executive KPI summary — click a card to filter the map">
      {kpis.map(kpi => (
        <KpiCardButton key={kpi.id} kpi={kpi} onSelect={onSelect} isActive={activeKpiId === kpi.id} />
      ))}
    </div>
  );
}
