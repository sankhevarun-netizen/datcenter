'use client';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Cell, LabelList } from 'recharts';
import Panel from './Panel';
import { C } from './tokens';

// Bars darken with the year; the arrowed line traces the growth trajectory above them.
const RAMP = ['#B9D3F6', '#8DB8F0', '#5A98E6', '#2F72D8', '#1A47B5'];
const BEGIN = 900; // ms, after the panel has landed

export default function MarketPanel({ market, delay, onAction }) {
  const n = market.growth.length;
  // Trajectory sits just above the bars and stops short of the final bar, ending in an arrow.
  const data = market.growth.map((g, i) => ({ ...g, trend: i < n - 1 ? Math.round((g.sizeBn * 1.18 + 1.6) * 10) / 10 : null }));
  const cagrIndex = Math.floor((n - 1) / 2);

  return (
    <Panel title="Market Opportunity" delay={delay} onAction={onAction}>
      <p className="flex-shrink-0" style={{ fontSize: 13, color: C.text2, lineHeight: 1.45 }}>{market.headline}</p>
      <div className="flex items-center gap-5 mt-2 flex-shrink-0" style={{ fontSize: 12, color: C.text2 }}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: C.blue }} />Market Size (Bn USD)</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-[2.5px] rounded" style={{ background: C.blue }} />CAGR</span>
      </div>
      <div className="flex-1 min-h-[150px] mt-1">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 200 }}>
          <ComposedChart data={data} margin={{ top: 26, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <marker id="cockpit-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill={C.blue} />
              </marker>
            </defs>
            <CartesianGrid vertical={false} stroke="#EEF2F8" />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#D5DEEA' }} tick={{ fill: C.text2, fontSize: 12 }} />
            <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tickLine={false} axisLine={false} tick={{ fill: C.text2, fontSize: 12 }} />
            <Bar dataKey="sizeBn" barSize={34} radius={[3, 3, 0, 0]} isAnimationActive animationBegin={BEGIN} animationDuration={800} animationEasing="ease-out">
              {data.map((d, i) => <Cell key={d.year} fill={RAMP[i] ?? RAMP.at(-1)} />)}
              <LabelList dataKey="sizeBn" position="top" offset={8}
                content={({ x, y, width, index }) => (index === n - 1
                  ? <text x={x + width / 2} y={y - 8} textAnchor="middle" fill={C.text} fontSize={18} fontWeight={700}>{market.finalLabel}</text>
                  : null)} />
            </Bar>
            <Line dataKey="trend" type="monotone" stroke={C.blue} strokeWidth={2.2} dot={false} activeDot={false} connectNulls={false}
              markerEnd="url(#cockpit-arrow)" isAnimationActive animationBegin={BEGIN + 500} animationDuration={800}>
              <LabelList dataKey="trend"
                content={({ x, y, index }) => (index === cagrIndex
                  ? <text x={x - 12} y={y - 14} textAnchor="middle" fill={C.text} fontSize={14} fontWeight={700}>{market.cagrLabel}</text>
                  : null)} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1.5 flex-shrink-0" style={{ fontSize: 10, color: C.muted, lineHeight: 1.35 }}>{market.source}</p>
    </Panel>
  );
}
