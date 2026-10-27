'use client';
import { HEALTH_COLORS } from './healthColors';

const ITEMS = [
  { key: 'healthy', label: 'Healthy' },
  { key: 'warning', label: 'Warning' },
  { key: 'critical', label: 'Critical' },
];

export default function MapLegend({ mode = 'dark' }) {
  const isDark = mode === 'dark';
  return (
    <div
      className={`absolute bottom-3 left-3 z-[400] rounded-xl px-3 py-2 flex items-center gap-3 backdrop-blur-sm border ${
        isDark ? 'bg-[#0D1428]/85 border-white/10' : 'bg-white/90 border-[#D8DCE3]'
      }`}
      role="group"
      aria-label="Facility health legend"
    >
      {ITEMS.map(({ key, label }) => (
        <span key={key} className={`flex items-center gap-1.5 text-[10px] font-semibold ${isDark ? 'text-white/70' : 'text-[#6B7280]'}`}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: HEALTH_COLORS[key] }} />
          {label}
        </span>
      ))}
      <span className={`w-px h-3 ${isDark ? 'bg-white/15' : 'bg-[#D8DCE3]'}`} />
      <span className={`text-[10px] ${isDark ? 'text-white/40' : 'text-[#9CA3AF]'}`}>Clusters = facility count</span>
    </div>
  );
}
