'use client';
// PUE drift as small multiples: one panel per operating facility, this year
// against the same month last year. Months inside a detected drift window are
// shaded. Each panel has its own scale (the comparison is within a site).
import { useMemo, useState } from 'react';
import { detectDrift } from '@/lib/nexus/predictive-engine';
import { getFacility } from '@/lib/nexus/data';
import { monthLabel } from '@/lib/nexus/time';

const C = {
  actual: '#005EB8',
  baseline: '#94A3B8',
  drift: '#FBE7B5',
  driftInk: '#8A6508',
  grid: '#EEF1F5',
  ink: '#1A1F36',
  muted: '#64748B',
};
const W = 300, H = 132, L = 40, R = 10, T = 26, B = 22;

function Panel({ facilityId, measure }) {
  const [hover, setHover] = useState(null);
  const { series, drift } = useMemo(() => detectDrift(facilityId, measure), [facilityId, measure]);
  const pts = series.slice(-12);
  const vals = pts.flatMap((p) => [p.value, p.baseline]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || 0.01;
  const y = (v) => T + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - T - B);
  const step = (W - L - R) / (pts.length - 1);
  const x = (i) => L + i * step;
  const line = (key) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
  const driftIdx = pts.map((p, i) => (p.inDrift ? i : -1)).filter((i) => i >= 0);
  const dp = measure === 'pue' ? 3 : 2;
  const name = getFacility(facilityId).name.replace('Nexus ', '');
  const h = hover !== null ? pts[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`${name} ${measure.toUpperCase()}: ${drift ? `drift ${monthLabel(drift.from)} to ${monthLabel(drift.to)}` : 'no drift'}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(pts.length - 1, Math.round((px - L) / step))));
        }}>
        <text x={0} y={13} fontSize="11" fontWeight="700" fill={C.ink}>{name}</text>
        <text x={W - R} y={13} fontSize="10" textAnchor="end" fill={drift ? C.driftInk : C.muted} fontWeight={drift ? 700 : 400}>
          {drift ? `▲ Drift since ${monthLabel(drift.from, true)}` : 'No drift'}
        </text>
        {driftIdx.length > 0 && (
          <rect x={x(driftIdx[0]) - step / 2} y={T} width={step * driftIdx.length} height={H - T - B} fill={C.drift} opacity="0.7" />
        )}
        {[lo, hi].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.grid} />
            <text x={L - 5} y={y(v) + 3} fontSize="9" textAnchor="end" fill={C.muted}>{v.toFixed(dp)}</text>
          </g>
        ))}
        <path d={line('baseline')} fill="none" stroke={C.baseline} strokeWidth="2" strokeDasharray="4 3" />
        <path d={line('value')} fill="none" stroke={C.actual} strokeWidth="2" />
        {[0, pts.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize="9" textAnchor={i ? 'end' : 'start'} fill={C.muted}>{monthLabel(pts[i].month, true)}</text>
        ))}
        {h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={C.muted} strokeWidth="1" />
            <circle cx={x(hover)} cy={y(h.value)} r="4" fill={C.actual} stroke="#fff" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(h.baseline)} r="3.5" fill={C.baseline} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-6 z-10 rounded-md border border-[#D8DCE3] bg-white px-2 py-1.5 text-[10.5px] shadow-md whitespace-nowrap"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > pts.length / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}>
          <p className="font-semibold text-[#1A1F36]">{monthLabel(h.month)}</p>
          <p className="text-[#334155]">This year <span className="font-mono">{h.value.toFixed(dp)}</span></p>
          <p className="text-[#64748B]">Last year <span className="font-mono">{h.baseline.toFixed(dp)}</span></p>
          <p className={h.excess > 0 ? 'text-[#8A6508]' : 'text-[#00704A]'}>Change <span className="font-mono">{h.excess > 0 ? '+' : ''}{h.excess.toFixed(dp)}</span></p>
        </div>
      )}
    </div>
  );
}

export default function DriftChart({ facilityIds, measure = 'pue' }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#64748B] mb-2">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#005EB8] inline-block" /> Last 12 months</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[#94A3B8] inline-block" /> Same month a year earlier</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#FBE7B5] inline-block rounded-sm" /> Detected drift</span>
        <span className="text-[#94A3B8]">Each panel has its own scale.</span>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
        {facilityIds.map((id) => <Panel key={id} facilityId={id} measure={measure} />)}
      </div>
    </div>
  );
}
