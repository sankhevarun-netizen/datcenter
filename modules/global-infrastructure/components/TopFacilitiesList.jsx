'use client';
import { motion } from 'framer-motion';

const BAR_COLORS = { Americas: '#005EB8', EMEA: '#00338D', APAC: '#00B0A0', MiddleEast: '#E87722' };

/**
 * Generic ranked-list chart reused for every "Top N facilities by metric"
 * panel (largest, top renewable, top capacity consumers, lowest PUE,
 * highest carbon) — one component, five usages, rather than five
 * near-identical bar charts.
 */
export default function TopFacilitiesList({ title, rows, unit = '', onHoverFacility }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map(r => r.value));

  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4">
      <p className="text-xs font-bold text-[#1A1F36] mb-3" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{title}</p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={row.id}
            className="group cursor-default"
            onMouseEnter={() => onHoverFacility?.(row.id)}
            onMouseLeave={() => onHoverFacility?.(null)}
          >
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-[#6B7280] truncate group-hover:text-[#1A1F36] font-medium">{i + 1}. {row.name}</span>
              <span className="font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{row.value}{unit}</span>
            </div>
            <div className="h-1.5 bg-[#F0F2F5] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: BAR_COLORS[row.region] ?? '#9CA3AF' }}
                initial={{ width: 0 }}
                animate={{ width: `${(row.value / max) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
