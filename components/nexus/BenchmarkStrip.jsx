'use client';
// Peer benchmark strip: one row per metric. The grey band is the Indian peer
// range (p10–p90, interquartile darker), the tick is the median, the dot is
// this facility. Every axis runs worse → better left to right.
import { useMemo, useState } from 'react';
import { benchmarkFacility } from '@/lib/nexus/benchmark-engine';
import { fmtUpTo } from '@/lib/nexus/format';

const RANK_STYLE = {
  'top decile': { bg: '#E6F6EF', fg: '#00704A', label: 'Top decile' },
  'top quartile': { bg: '#E6F6EF', fg: '#00704A', label: 'Top quartile' },
  'above median': { bg: '#EEF2F7', fg: '#334155', label: 'Above median' },
  'at median': { bg: '#EEF2F7', fg: '#334155', label: 'At median' },
  'below median': { bg: '#FBF3DE', fg: '#8A6508', label: 'Below median' },
  'bottom quartile': { bg: '#FDECEC', fg: '#B42318', label: 'Bottom quartile' },
  'bottom decile': { bg: '#FDECEC', fg: '#B42318', label: 'Bottom decile' },
};

const fmt = (v, dp) => fmtUpTo(v, dp);

// Outside the published band the share is a bound, not a point estimate.
function peerLine(m) {
  if (m.score === null) return '';
  if (m.rank === 'top decile') return ' Better than at least 90% of peers.';
  if (m.rank === 'bottom decile') return ' Behind at least 90% of peers.';
  return ` Better than ${m.score}% of peers.`;
}

function Track({ m }) {
  const { band } = m;
  const lowerIsBetter = /lower/i.test(m.direction);
  const lo = Math.min(band.p10, m.value ?? band.p10);
  const hi = Math.max(band.p90, m.value ?? band.p90);
  const pad = (hi - lo) * 0.06;
  const min = lo - pad;
  const max = hi + pad;
  // Position as a share of the track, flipped so "better" is always to the right.
  const x = (v) => {
    const t = (v - min) / (max - min);
    return `${(lowerIsBetter ? 1 - t : t) * 100}%`;
  };
  const span = (a, b) => {
    const [l, r] = lowerIsBetter ? [b, a] : [a, b];
    return { left: x(l), width: `calc(${x(r)} - ${x(l)})` };
  };
  return (
    <div className="relative h-5" aria-hidden="true">
      <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-[#EEF1F5]" style={span(band.p10, band.p90)} />
      <div className="absolute top-1/2 -translate-y-1/2 h-2 bg-[#D5DCE5]" style={span(band.p25, band.p75)} />
      <div className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3.5 bg-[#64748B] rounded" style={{ left: x(band.p50) }} />
      {m.value !== null && (
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#005EB8] ring-2 ring-white shadow-sm" style={{ left: x(m.value) }} />
      )}
    </div>
  );
}

export default function BenchmarkStrip({ facilityId, compact = false }) {
  const metrics = useMemo(() => benchmarkFacility(facilityId), [facilityId]);
  const [hover, setHover] = useState(null);

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[minmax(110px,1.1fr)_minmax(120px,2fr)_112px] gap-x-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
        <span>Metric</span>
        <span className="flex justify-between"><span>Worse</span><span>Better →</span></span>
        <span className="text-right">Peer rank</span>
      </div>
      {metrics.map((m) => {
        const rank = m.rank ? RANK_STYLE[m.rank] : null;
        const open = hover === m.key;
        return (
          <div key={m.key} className="relative" onMouseEnter={() => setHover(m.key)} onMouseLeave={() => setHover(null)}>
            <div className={`grid grid-cols-[minmax(110px,1.1fr)_minmax(120px,2fr)_112px] items-center gap-x-3 px-2 py-1.5 rounded-lg transition-colors ${open ? 'bg-[#F5F8FB]' : ''}`}>
              <div className="min-w-0">
                <p className="text-[11px] text-[#64748B] truncate">{m.label}</p>
                <p className="text-sm font-semibold text-[#1A1F36] tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {m.value === null ? '—' : fmt(m.value, m.dp)}
                  {m.value !== null && m.unit && <span className="text-[10px] text-[#94A3B8] ml-1">{m.unit}</span>}
                </p>
              </div>
              <Track m={m} />
              <div className="justify-self-end">
                {rank ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: rank.bg, color: rank.fg }}>
                    {rank.label}
                  </span>
                ) : (
                  <span className="text-[10px] text-[#94A3B8] whitespace-nowrap">{m.value === null ? 'No data' : 'Context'}</span>
                )}
              </div>
            </div>
            {!compact && open && (
              <div role="tooltip" className="absolute z-20 left-2 right-2 top-full mt-0.5 rounded-lg border border-[#D8DCE3] bg-white shadow-lg px-3 py-2 text-[11px] text-[#334155]">
                <p className="font-semibold text-[#1A1F36]">{m.cohort} · {m.direction.toLowerCase()}</p>
                <p className="tabular-nums mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  p10 {fmt(m.band.p10, 2)} · p25 {fmt(m.band.p25, 2)} · median {fmt(m.band.p50, 2)} · p75 {fmt(m.band.p75, 2)} · p90 {fmt(m.band.p90, 2)}
                </p>
                <p className="text-[#64748B] mt-0.5">
                  {m.value === null ? m.basis : `${m.basis}.${peerLine(m)}`}
                  {m.measured && ` ${m.measured.basis}: ${fmt(m.measured.value, m.dp)}.`}
                </p>
                <p className="text-[#94A3B8] mt-0.5">Cohort basis: {m.cohortBasis}</p>
              </div>
            )}
          </div>
        );
      })}
      <p className="px-2 pt-1 text-[10px] text-[#94A3B8]">Band: Indian peer range p10–p90, darker p25–p75; tick: median; dot: this facility.</p>
    </div>
  );
}
