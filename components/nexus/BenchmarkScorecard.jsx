'use client';
// Portfolio scorecard: every facility against every scored metric, with the
// portfolio line last. Each cell shows the value and its peer rank.
import { useMemo } from 'react';
import { portfolioScorecard } from '@/lib/nexus/benchmark-engine';
import { fmtUpTo } from '@/lib/nexus/format';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const RANK = {
  'top decile': ['#E6F6EF', '#00704A'], 'top quartile': ['#E6F6EF', '#00704A'],
  'above median': ['#EEF2F7', '#334155'], 'at median': ['#EEF2F7', '#334155'],
  'below median': ['#FBF3DE', '#8A6508'], 'bottom quartile': ['#FDECEC', '#B42318'], 'bottom decile': ['#FDECEC', '#B42318'],
};
const KEYS = ['pue', 'wue', 'renewable', 'mttr', 'utilisation', 'stranded'];

function Cell({ m }) {
  if (!m || m.value === null) return <td className="py-1.5 px-1 text-center text-[10px] text-[#94A3B8]">—</td>;
  const [bg, fg] = m.rank ? RANK[m.rank] : ['#F8FAFC', '#64748B'];
  return (
    <td className="py-1 px-1 text-center" title={`${m.cohort}: ${m.rank ?? 'not scored'} · ${m.basis}`}>
      <span className="inline-flex flex-col items-center rounded-md px-1.5 py-0.5 min-w-[72px]" style={{ background: bg, color: fg }}>
        <span className="text-[11px] font-semibold" style={MONO}>{fmtUpTo(m.value, m.dp)}{m.unit === '%' ? '%' : ''}</span>
        <span className="text-[9px]">{m.rank ?? '—'}</span>
      </span>
    </td>
  );
}

export default function BenchmarkScorecard() {
  const { rows, portfolio } = useMemo(() => portfolioScorecard(), []);
  const labels = Object.fromEntries(rows[0].metrics.map((m) => [m.key, `${m.label}${m.unit && m.unit !== '%' ? ` (${m.unit})` : ''}`]));
  const byKey = (list) => Object.fromEntries(list.map((m) => [m.key, m]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
            <th className="text-left font-semibold pb-2">Facility</th>
            {KEYS.map((k) => <th key={k} className="font-semibold pb-2">{labels[k]}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = byKey(r.metrics);
            return (
              <tr key={r.facilityId} className="border-t border-[#F1F5F9]">
                <td className="py-1.5 pr-2 text-[#1A1F36] font-medium whitespace-nowrap">{r.name.replace('Nexus ', '')}</td>
                {KEYS.map((k) => <Cell key={k} m={m[k]} />)}
              </tr>
            );
          })}
          <tr className="border-t-2 border-[#CBD5E1]">
            <td className="py-1.5 pr-2 text-[#1A1F36] font-bold">Portfolio</td>
            {KEYS.map((k) => <Cell key={k} m={byKey(portfolio)[k]} />)}
          </tr>
        </tbody>
      </table>
      <p className="text-[10px] text-[#94A3B8] mt-2">Hover a cell for its cohort and basis. — means the dataset cannot support the metric for that site.</p>
    </div>
  );
}
