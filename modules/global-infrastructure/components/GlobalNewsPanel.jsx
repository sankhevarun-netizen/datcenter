'use client';
import { Newspaper } from 'lucide-react';
import { SkeletonBlock } from './Skeleton';

const DEFAULT_GROUPS = [
  { region: 'Americas', label: 'Americas' },
  { region: 'EMEA', label: 'Europe' },
  { region: 'APAC', label: 'Asia Pacific' },
  { region: 'MiddleEast', label: 'Middle East' },
];

const CATEGORY_COLOR = {
  Weather: '#005EB8', Power: '#E87722', Expansion: '#00B0A0',
  Community: '#00338D', Government: '#6B7280', Cyber: '#C8102E',
};

/**
 * Used both globally (default: one column per region) and on a regional
 * page (pass a single-entry `groups` so it renders one focused column
 * instead of forking into a separate "RegionalNewsPanel" component).
 */
export default function GlobalNewsPanel({ news = [], loading = true, onSelectNews, groups = DEFAULT_GROUPS }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 h-48">
            <SkeletonBlock height="h-3" width="w-20" className="mb-3" />
            {Array.from({ length: 3 }).map((_, j) => <SkeletonBlock key={j} height="h-3" className="mb-2" />)}
          </div>
        ))}
      </div>
    );
  }

  const gridCols = groups.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {groups.map(({ region, label }) => {
        const items = news.filter(n => n.facility.region === region).slice(0, 5);
        return (
          <div key={region} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Newspaper size={12} className="text-[#005EB8]" />
              <p className="text-xs font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{label}</p>
            </div>
            {items.length === 0 ? (
              <p className="text-[10px] text-[#9CA3AF]">No news in current filters.</p>
            ) : (
              <div className="space-y-2.5">
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => onSelectNews?.(item)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLOR[item.category] ?? '#9CA3AF' }} />
                      <span className="text-[9px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{item.category} · {item.facility.city}</span>
                    </div>
                    <p className="text-[11px] text-[#1A1F36] leading-snug group-hover:text-[#005EB8] transition-colors">{item.headline}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
