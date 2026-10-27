'use client';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Panel from './Panel';
import { C } from './tokens';

const RAD = Math.PI / 180;
const DARK = new Set(['#1E3A8A', '#3B82F6']);

// Percentage on each arc, between the inner and outer radius.
function arcLabel({ cx, cy, midAngle, innerRadius, outerRadius, payload }) {
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill={DARK.has(payload.color) ? '#FFFFFF' : C.navyBlue}>{payload.share}%</text>;
}

export default function SegmentPanel({ segments, delay, onAction }) {
  return (
    <Panel title="Opportunity by Segment" delay={delay} onAction={onAction}>
      <div className="flex-1 flex items-center gap-4 min-h-0">
        <div className="relative flex-shrink-0" style={{ width: '50%', height: 220 }}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 200 }}>
            <PieChart>
              <Pie data={segments.items} dataKey="valueBn" nameKey="name" innerRadius="58%" outerRadius="96%" startAngle={90} endAngle={-270}
                stroke="#FFFFFF" strokeWidth={2} labelLine={false} label={arcLabel}
                isAnimationActive animationBegin={950} animationDuration={900}>
                {segments.items.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{segments.total}</span>
            <span style={{ fontSize: 13, color: C.text2 }}>Total</span>
          </div>
        </div>
        <ul className="flex-1 min-w-0 space-y-3.5">
          {segments.items.map((s) => (
            <li key={s.name} className="flex items-start gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: s.color }} />
              <span className="min-w-0">
                <span className="block" style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{s.name}</span>
                <span className="block" style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{s.value} <span style={{ fontWeight: 500 }}>({s.share}%)</span></span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
