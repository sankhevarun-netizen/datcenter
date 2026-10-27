'use client';
import { PieChart, Pie, Cell } from 'recharts';
import { fmtUpTo, fmtNumber } from '@/lib/nexus/format';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const statusColor = (pct, warn, crit) => (pct >= crit ? '#C8102E' : pct >= warn ? '#E87722' : '#00B0A0');

export default function CapacityUtilization({ capacity }) {
  const { usedKw, designKw, pipelineKw, byFacility, cooling, grid } = capacity;
  const powerDonut = [
    { name: 'Used', value: usedKw, color: '#00338D' },
    { name: 'Available', value: designKw - usedKw, color: '#D8DCE3' },
  ];
  const coolingColor = statusColor(cooling.loadPct, 80, 90);

  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[#1A1F36] text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Capacity & Utilisation</h2>
        <span className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wider">Operating sites</span>
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-[#6B7280] mb-2">IT load against design, by facility</p>
          <div className="space-y-1.5">
            {byFacility.map((f) => (
              <div key={f.id} className="grid grid-cols-[84px_1fr_88px] items-center gap-2" title={`${f.name}: ${fmtNumber(f.usedKw)} of ${fmtNumber(f.designKw)} kW`}>
                <span className="text-[11px] text-[#334155] truncate">{f.name}</span>
                <div className="h-2.5 bg-[#D8DCE3] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#00338D]" style={{ width: `${f.utilisationPct}%` }} />
                </div>
                <span className="text-[10px] text-[#6B7280] text-right" style={MONO}>{f.utilisationPct}% · {fmtUpTo(f.designKw / 1000, 1)} MW</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center">
            <p className="text-xs font-semibold text-[#6B7280] mb-2">IT power in use</p>
            <div className="relative">
              <PieChart width={100} height={100}>
                <Pie data={powerDonut} innerRadius={30} outerRadius={45} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0} isAnimationActive={false}>
                  {powerDonut.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-[#1A1F36]" style={MONO}>{fmtUpTo(usedKw / 1000, 1)}</span>
                <span className="text-[9px] text-[#9CA3AF]">MW</span>
              </div>
            </div>
            <p className="text-[10px] text-[#9CA3AF] text-center">{fmtUpTo((designKw - usedKw) / 1000, 1)} MW available · {fmtUpTo(pipelineKw / 1000, 1)} MW under construction</p>
          </div>

          <div className="flex flex-col">
            <p className="text-xs font-semibold text-[#6B7280] mb-2">Cooling load · Mumbai-1</p>
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[#9CA3AF]">{fmtNumber(cooling.usedKw)} of {fmtNumber(cooling.capacityKw)} kW</span>
                <span className="text-xs font-bold" style={{ color: coolingColor, ...MONO }}>{cooling.loadPct}%</span>
              </div>
              <div className="h-3 bg-[#D8DCE3] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${cooling.loadPct}%`, backgroundColor: coolingColor }} />
              </div>
              <p className="text-[10px] mt-1" style={{ color: coolingColor }}>{cooling.loadPct >= 80 ? '⚠ Above 80% of hall cooling' : 'Within hall cooling capacity'}</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-[#6B7280] mb-2">Grid headroom against sanctioned load</p>
          <div className="space-y-1">
            {grid.map((g) => {
              const c = statusColor(g.utilisedPct, 90, 95);
              return (
                <div key={g.id} className="flex items-center gap-2 text-[11px]" title={g.note}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} aria-hidden="true" />
                  <span className="text-[#334155] w-[84px] truncate">{g.name}</span>
                  <span className="text-[#1A1F36] font-semibold" style={MONO}>{fmtNumber(g.headroomKw)} kW</span>
                  <span className="text-[#9CA3AF] ml-auto" style={MONO}>{g.utilisedPct}% drawn</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
