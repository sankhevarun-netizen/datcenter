'use client';
import KPICard from './KPICard';

export default function KPIStrip({ kpis }) {
  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x scrollbar-thin">
        {kpis.map((kpi) => (
          <div key={kpi.id} className="snap-start flex-shrink-0 w-[180px]">
            <KPICard {...kpi} />
          </div>
        ))}
      </div>
    </div>
  );
}
