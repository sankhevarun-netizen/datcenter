'use client';
import Panel from './Panel';
import { C } from './tokens';

export const SEGMENT = {
  Renewable: { fg: '#047857', border: '#A7E3C9', bg: '#F0FBF6' },
  Storage: { fg: C.blue, border: '#BCD3F8', bg: '#F3F7FE' },
  Grid: { fg: '#1E3A8A', border: '#C7D3EE', bg: '#F5F7FC' },
  Hybrid: { fg: '#0E7490', border: '#B6E0EA', bg: '#F1FAFC' },
  Backup: { fg: C.text2, border: '#D6DEEA', bg: '#F7F9FC' },
};

export function Fit({ score, max = 5 }) {
  return (
    <span className="inline-flex gap-[3px]" aria-label={`Fit ${score} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="rounded-[2px]" style={{ width: 11, height: 10, background: i < score ? C.green : '#DCE5F0' }} />
      ))}
    </span>
  );
}

const TH = { fontSize: 12, fontWeight: 500, color: C.text2, textAlign: 'left', padding: '0 10px 8px' };

export default function OpportunitiesTable({ opportunities, delay, onAction }) {
  return (
    <Panel title="Top Investment Opportunities" action="View All" delay={delay} onAction={onAction}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['#', 'Opportunity', 'Segment', 'Est. Value', 'Timeline', 'Fit Score'].map((h) => <th key={h} style={TH}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {opportunities.rows.map((r, i) => {
            const top = i === 0;
            const seg = SEGMENT[r.segment] ?? SEGMENT.Backup;
            const cell = { fontSize: 13, padding: '8px 10px', color: C.text, fontWeight: top ? 600 : 400 };
            return (
              <tr key={r.name} style={{ background: top ? C.tint : 'transparent', borderBottom: `1px solid ${C.border}` }}>
                <td style={cell}>{i + 1}</td>
                <td style={{ ...cell, color: top ? C.navyBlue : C.text }}>{r.name}</td>
                <td style={cell}>
                  <span className="inline-block rounded-full px-2.5 py-0.5" style={{ fontSize: 11.5, fontWeight: 500, color: seg.fg, border: `1px solid ${seg.border}`, background: seg.bg }}>{r.segment}</span>
                </td>
                <td style={{ ...cell, fontWeight: 700 }}>{r.value}</td>
                <td style={{ ...cell, color: C.blue }}>{r.timeline}</td>
                <td style={cell}><Fit score={r.fit} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2" style={{ fontSize: 10.5, color: C.muted }}>{opportunities.note}</p>
    </Panel>
  );
}
