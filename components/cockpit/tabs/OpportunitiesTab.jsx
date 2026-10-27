'use client';
import { useState } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ReferenceArea } from 'recharts';
import { Check, AlertTriangle, ArrowRight } from 'lucide-react';
import Panel from '../Panel';
import { C } from '../tokens';
import { SEGMENT, Fit } from '../OpportunitiesTable';

const CRITERIA = [['strategic', 'Strategic fit'], ['capability', 'Capability'], ['timing', 'Timing'], ['risk', 'Risk (higher is lower risk)']];
const bn = (v) => Number(String(v).replace(/[$Bn]/g, ''));
const mean = (s) => Object.values(s).reduce((a, b) => a + b, 0) / Object.values(s).length;

function Matrix({ points, selected, onSelect, delay }) {
  return (
    <Panel title="Prioritisation Matrix" action={null} delay={delay}>
      <p style={{ fontSize: 12.5, color: C.text2 }}>Value against fit. Top right is where to start; click a point to open it.</p>
      <div className="flex-1 min-h-0 mt-1">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 300 }}>
          <ScatterChart margin={{ top: 16, right: 18, bottom: 18, left: -6 }} accessibilityLayer={false} style={{ outline: "none" }}>
            <ReferenceArea x1={4} x2={5.2} y1={2.5} y2={4.5} fill={C.greenTint} fillOpacity={0.9} label={{ value: 'Prioritise', position: 'insideTopRight', fill: C.greenDeep, fontSize: 12, fontWeight: 700 }} />
            <CartesianGrid stroke="#EEF2F8" />
            <XAxis type="number" dataKey="fit" domain={[2.5, 5.2]} ticks={[3, 4, 5]} tickLine={false} axisLine={{ stroke: '#D5DEEA' }} tick={{ fill: C.text2, fontSize: 12 }}
              label={{ value: 'Fit score (mean of criteria)', position: 'insideBottom', offset: -10, fill: C.text2, fontSize: 12 }} />
            <YAxis type="number" dataKey="value" domain={[0, 4.5]} ticks={[0, 1, 2, 3, 4]} tickLine={false} axisLine={false} tick={{ fill: C.text2, fontSize: 12 }}
              label={{ value: '2030 value ($Bn)', angle: -90, position: 'insideLeft', offset: 18, fill: C.text2, fontSize: 12 }} />
            <Scatter data={points} animationDuration={700} isAnimationActive
              shape={({ cx, cy, payload }) => {
                const on = payload.index === selected;
                return (
                  <g onClick={() => onSelect(payload.index)} style={{ cursor: 'pointer' }}>
                    <circle cx={cx} cy={cy} r={on ? 19 : 16} fill={on ? C.navyBlue : '#7DB4F0'} stroke="#FFFFFF" strokeWidth={2.5} />
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#FFFFFF" fontSize={13} fontWeight={700}>{payload.rank}</text>
                  </g>
                );
              }} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function Detail({ row, detail, rank, delay }) {
  const seg = SEGMENT[row.segment] ?? SEGMENT.Backup;
  return (
    <Panel title={`${rank}. ${row.name}`} action={null} delay={delay}>
      <div className="flex items-center gap-4 -mt-1 mb-3" style={{ fontSize: 13, color: C.text2 }}>
        <span className="rounded-full px-2.5 py-0.5" style={{ fontSize: 11.5, fontWeight: 500, color: seg.fg, border: `1px solid ${seg.border}`, background: seg.bg }}>{row.segment}</span>
        <span><b style={{ color: C.text }}>{row.value}</b> in 2030</span>
        <span style={{ color: C.blue }}>{row.timeline}</span>
        <span className="flex items-center gap-2">Fit <Fit score={row.fit} /></span>
      </div>
      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{detail.thesis}</p>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="rounded-lg" style={{ background: C.greenTint, padding: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Tata Power edge</p>
          <ul className="mt-2 space-y-1.5">
            {detail.edge.map((e) => <li key={e} className="flex gap-2" style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.4 }}><Check size={14} className="flex-shrink-0 mt-[2px]" style={{ color: C.greenDeep }} />{e}</li>)}
          </ul>
        </div>
        <div className="rounded-lg" style={{ background: '#FFF7ED', padding: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Key risks</p>
          <ul className="mt-2 space-y-1.5">
            {detail.risks.map((e) => <li key={e} className="flex gap-2" style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.4 }}><AlertTriangle size={14} className="flex-shrink-0 mt-[2px]" style={{ color: '#B54708' }} />{e}</li>)}
          </ul>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 mt-4">
        {CRITERIA.map(([k, label]) => (
          <div key={k}>
            <div className="flex justify-between" style={{ fontSize: 12, color: C.text2 }}><span>{label}</span><b style={{ color: C.text }}>{detail.scores[k]}/5</b></div>
            <div className="h-2 rounded-full mt-1.5" style={{ background: '#E6EDF6' }}>
              <div className="h-full rounded-full" style={{ width: `${detail.scores[k] * 20}%`, background: detail.scores[k] >= 4 ? C.green : detail.scores[k] === 3 ? C.accent : '#F59E0B' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-4">
        <div className="flex items-center gap-3 rounded-lg" style={{ background: C.tint, padding: '12px 14px' }}>
          <ArrowRight size={18} style={{ color: C.blue }} />
          <p style={{ fontSize: 13, color: C.text }}><b>Next step:</b> {detail.next}</p>
        </div>
      </div>
    </Panel>
  );
}

function Comparison({ rows, details, selected, onSelect, delay }) {
  const th = { fontSize: 12, fontWeight: 500, color: C.text2, textAlign: 'left', padding: '0 10px 8px' };
  const cell = (v) => ({ background: v >= 4 ? '#D9F5EA' : v === 3 ? C.tint : '#FDF0DC', color: v >= 4 ? '#047857' : v === 3 ? C.blue : '#B54708' });
  return (
    <Panel title="Criteria Comparison" action={null} delay={delay}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['#', 'Opportunity', 'Segment', 'Value', ...CRITERIA.map(([, l]) => l.replace(' (higher is lower risk)', '')), 'Fit'].map((h) => <th key={h} style={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} onClick={() => onSelect(i)} className="cursor-pointer" style={{ borderBottom: `1px solid ${C.border}`, background: i === selected ? C.tint : 'transparent' }}>
              <td style={{ padding: '9px 10px', fontSize: 13 }}>{i + 1}</td>
              <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: i === selected ? 700 : 500, color: C.text }}>{r.name}</td>
              <td style={{ padding: '9px 10px', fontSize: 13, color: C.text2 }}>{r.segment}</td>
              <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 700 }}>{r.value}</td>
              {CRITERIA.map(([k]) => (
                <td key={k} style={{ padding: '6px 10px' }}>
                  <span className="inline-flex w-9 justify-center rounded-md py-1" style={{ fontSize: 12.5, fontWeight: 700, ...cell(details[i].scores[k]) }}>{details[i].scores[k]}</span>
                </td>
              ))}
              <td style={{ padding: '9px 10px' }}><Fit score={r.fit} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export default function OpportunitiesTab({ data, delay = 0 }) {
  const [selected, setSelected] = useState(0);
  const rows = data.opportunities.rows;
  const details = data.opportunityDetails;
  const points = rows.map((r, i) => ({ index: i, rank: i + 1, fit: Math.round(mean(details[i].scores) * 100) / 100, value: bn(r.value) }));
  return (
    <div className="h-full grid gap-4" style={{ gridTemplateRows: 'minmax(0, 1.35fr) minmax(0, 1fr)' }}>
      <div className="grid gap-4 min-h-0" style={{ gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.5fr)' }}>
        <Matrix points={points} selected={selected} onSelect={setSelected} delay={delay} />
        <Detail key={selected} row={rows[selected]} detail={details[selected]} rank={selected + 1} delay={0} />
      </div>
      <Comparison rows={rows} details={details} selected={selected} onSelect={setSelected} delay={delay + 0.2} />
    </div>
  );
}
