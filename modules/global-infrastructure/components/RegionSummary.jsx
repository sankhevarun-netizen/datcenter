'use client';

export default function RegionSummary({ title, rows, valueSuffix = '' }) {
  if (!rows.length) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">{title}</p>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={row.region} className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#F0F2F5] flex items-center justify-center text-[9px] font-bold text-[#6B7280] flex-shrink-0">
              {i + 1}
            </span>
            <span className="text-xs text-[#1A1F36] font-medium flex-1 truncate">{row.region}</span>
            <span className="text-xs font-bold text-[#00338D]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {row.value}{valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
