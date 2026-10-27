'use client';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Cell, LabelList } from 'recharts';
import Panel from '../Panel';
import { C, ICONS, TINTS } from '../tokens';

const cagr = (a, b, years = 4) => Math.round(((b / a) ** (1 / years) - 1) * 100);
const GRID = { Tight: '#B54708', Constrained: '#B42318', Moderate: C.blue, Available: C.greenDeep };
const RAMP = ['#B9D3F6', '#8DB8F0', '#5A98E6', '#2F72D8', '#1A47B5'];

function CapacityPanel({ m, delay }) {
  const data = m.capacity.map((c) => ({ ...c, facilityGw: Math.round(c.itGw * m.pue * 100) / 100 }));
  return (
    <Panel title="Datacentre Capacity Trajectory" action={null} delay={delay}>
      <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.45 }}>IT capacity grows from {m.capacity[0].itGw} GW to {m.capacity.at(-1).itGw} GW. At PUE {m.pue}, grid draw reaches {data.at(-1).facilityGw} GW.</p>
      <div className="flex items-center gap-5 mt-2" style={{ fontSize: 12, color: C.text2 }}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: C.blue }} />IT capacity (GW)</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-[2.5px] rounded" style={{ background: C.navyBlue }} />Facility power at PUE {m.pue} (GW)</span>
      </div>
      <div className="flex-1 min-h-0 mt-1">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 220 }}>
          <ComposedChart data={data} margin={{ top: 22, right: 10, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="#EEF2F8" />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#D5DEEA' }} tick={{ fill: C.text2, fontSize: 12 }} />
            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tickLine={false} axisLine={false} tick={{ fill: C.text2, fontSize: 12 }} />
            <Bar dataKey="itGw" barSize={36} radius={[3, 3, 0, 0]} animationDuration={800}>
              {data.map((d, i) => <Cell key={d.year} fill={RAMP[i]} />)}
              <LabelList dataKey="itGw" position="top" offset={6} style={{ fill: C.text, fontSize: 12, fontWeight: 600 }} formatter={(v) => `${v}`} />
            </Bar>
            <Line dataKey="facilityGw" type="monotone" stroke={C.navyBlue} strokeWidth={2.2} dot={{ r: 3.5, fill: C.navyBlue, strokeWidth: 0 }} animationBegin={500} animationDuration={800} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function SegmentGrowthPanel({ m, delay }) {
  const max = Math.max(...m.segmentGrowth.map((s) => s.y2030));
  const fastest = [...m.segmentGrowth].sort((a, b) => cagr(b.y2026, b.y2030) - cagr(a.y2026, a.y2030))[0];
  return (
    <Panel title="Segment Growth, 2026 → 2030" action={null} delay={delay}>
      <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.45 }}>{fastest.name} grows fastest, at {cagr(fastest.y2026, fastest.y2030)}% a year, as buyers move to 24×7 supply.</p>
      <div className="flex items-center gap-5 mt-2 mb-2" style={{ fontSize: 12, color: C.text2 }}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: '#C7DCF5' }} />2026</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: C.navyBlue }} />2030</span>
      </div>
      <ul className="flex-1 flex flex-col justify-around">
        {m.segmentGrowth.map((s) => (
          <li key={s.name}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.name}</span>
              <span className="rounded-full px-2 py-0.5" style={{ fontSize: 11.5, fontWeight: 600, color: C.greenDeep, background: C.greenTint }}>{cagr(s.y2026, s.y2030)}% CAGR</span>
            </div>
            {[['y2026', '#C7DCF5'], ['y2030', C.navyBlue]].map(([k, color]) => (
              <div key={k} className="flex items-center gap-2 mt-1">
                <span className="h-3 rounded-[3px]" style={{ width: `${(s[k] / max) * 80}%`, background: color }} />
                <span style={{ fontSize: 12, color: C.text2, fontWeight: k === 'y2030' ? 700 : 400 }}>${s[k]}Bn</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ClustersPanel({ m, delay }) {
  const th = { fontSize: 11.5, fontWeight: 500, color: C.text2, textAlign: 'left', padding: '0 8px 8px' };
  return (
    <Panel title="Demand by Cluster" action={null} delay={delay}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Cluster', '2026 GW', '2030 GW', 'Growth', 'Grid'].map((h) => <th key={h} style={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {m.clusters.map((c, i) => (
            <tr key={c.city} style={{ borderBottom: `1px solid ${C.border}`, background: i === 0 ? C.tint : 'transparent' }}>
              <td style={{ padding: '8px', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: C.text }}>{c.city}</span>
                <span className="block" style={{ fontSize: 11, color: C.text2 }}>{c.note}</span>
              </td>
              <td style={{ padding: '8px', fontSize: 13, color: C.text2 }}>{c.gw2026}</td>
              <td style={{ padding: '8px', fontSize: 13, fontWeight: 700, color: C.text }}>{c.gw2030}</td>
              <td style={{ padding: '8px', fontSize: 13, color: C.blue }}>{Math.round((c.gw2030 / c.gw2026) * 10) / 10}×</td>
              <td style={{ padding: '8px' }}><span className="rounded-full px-2 py-0.5" style={{ fontSize: 11.5, fontWeight: 600, color: GRID[c.grid], border: `1px solid ${GRID[c.grid]}40` }}>{c.grid}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export default function MarketAnalysisTab({ data, delay = 0 }) {
  const m = data.marketAnalysis;
  return (
    <div className="h-full grid gap-4" style={{ gridTemplateRows: 'minmax(0, 1.15fr) minmax(0, 1fr)' }}>
      <div className="grid gap-4 min-h-0" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.95fr) minmax(0, 1.15fr)' }}>
        <CapacityPanel m={m} delay={delay} />
        <SegmentGrowthPanel m={m} delay={delay + 0.08} />
        <ClustersPanel m={m} delay={delay + 0.16} />
      </div>
      <div className="grid gap-4 min-h-0" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.8fr)' }}>
        <Panel title="Demand Drivers" action={null} delay={delay + 0.3}>
          <div className="flex-1 grid grid-cols-2 gap-3">
            {m.drivers.map((d) => {
              const Icon = ICONS[d.icon];
              const t = TINTS[d.tint];
              return (
                <div key={d.title} className="rounded-lg flex gap-3" style={{ background: t.card, padding: 14 }}>
                  <Icon size={22} strokeWidth={2.2} className="flex-shrink-0 mt-0.5" style={{ color: t.fg }} />
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{d.title}</p>
                    <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.45, marginTop: 4 }}>{d.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Policy & Tariff Tailwinds" action={null} delay={delay + 0.38}>
          <ul className="flex-1 flex flex-col justify-between">
            {m.policy.map((p) => (
              <li key={p.name} className="pl-3" style={{ borderLeft: `3px solid ${C.pale}` }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{p.name}</p>
                <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.45, marginTop: 2 }}>{p.effect}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="How the Market Is Sized" action={null} delay={delay + 0.46}>
          <ol className="flex-1 flex flex-col gap-2.5">
            {m.method.map((t, i) => (
              <li key={i} className="flex gap-2.5" style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.45 }}>
                <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: C.tint, color: C.blue, fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
