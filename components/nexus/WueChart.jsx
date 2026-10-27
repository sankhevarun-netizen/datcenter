'use client';
// Monthly WUE as small multiples: one panel per operating site on a shared
// scale (so sites compare directly), with the site's own target dashed and the
// peer median as a reference line. Hover shows the month's figures.
import { useState } from 'react';
import { monthLabel } from '@/lib/nexus/time';

const C = { line: '#005EB8', target: '#1A1F36', median: '#94A3B8', grid: '#EEF1F5', muted: '#64748B', over: '#B54708' };
const W = 260, H = 118, L = 34, R = 8, T = 22, B = 18;

function Panel({ site, lo, hi, median }) {
  const [hover, setHover] = useState(null);
  const m = site.months;
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const step = (W - L - R) / (m.length - 1);
  const x = (i) => L + i * step;
  const path = m.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.wue).toFixed(1)}`).join('');
  const h = hover !== null ? m[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`${site.name} WUE, latest ${site.latest.wue} against target ${site.targetWue}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(m.length - 1, Math.round((((e.clientX - r.left) / r.width) * W - L) / step))));
        }}>
        <text x={0} y={12} fontSize="11" fontWeight="700" fill="#1A1F36">{site.name.replace('Nexus ', '')}</text>
        <text x={W - R} y={12} fontSize="10" textAnchor="end" fill={site.againstTarget > 0 ? C.over : C.muted}>
          {site.latest.wue} {site.againstTarget > 0 ? `▲ ${site.againstTarget} over target` : 'within target'}
        </text>
        {[lo, hi].map((v) => (
          <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.grid} /><text x={L - 4} y={y(v) + 3} fontSize="9" textAnchor="end" fill={C.muted}>{v.toFixed(1)}</text></g>
        ))}
        <line x1={L} x2={W - R} y1={y(median)} y2={y(median)} stroke={C.median} strokeDasharray="2 3" />
        <line x1={L} x2={W - R} y1={y(site.targetWue)} y2={y(site.targetWue)} stroke={C.target} strokeDasharray="5 3" strokeWidth="1" />
        <path d={path} fill="none" stroke={C.line} strokeWidth="2" />
        <text x={L} y={H - 4} fontSize="9" fill={C.muted}>{monthLabel(m[0].month, true)}</text>
        <text x={W - R} y={H - 4} fontSize="9" textAnchor="end" fill={C.muted}>{monthLabel(m.at(-1).month, true)}</text>
        {h && <><line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={C.muted} /><circle cx={x(hover)} cy={y(h.wue)} r="4" fill={C.line} stroke="#fff" strokeWidth="2" /></>}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-5 z-10 rounded-md border border-[#D8DCE3] bg-white px-2 py-1.5 text-[10.5px] shadow-md whitespace-nowrap"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > m.length / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}>
          <p className="font-semibold text-[#1A1F36]">{monthLabel(h.month)}</p>
          <p className="text-[#334155]">WUE <span className="font-mono">{h.wue}</span> L/kWh</p>
          <p className="text-[#64748B]"><span className="font-mono">{(h.totalLitres / 1e6).toFixed(2)}</span> ML · peak <span className="font-mono">{h.peakLpm}</span> LPM</p>
        </div>
      )}
    </div>
  );
}

export default function WueChart({ sites, median }) {
  const live = sites.filter((s) => s.months.length);
  const vals = live.flatMap((s) => [...s.months.map((m) => m.wue), s.targetWue]).concat(median);
  const lo = Math.floor(Math.min(...vals) * 10 - 1) / 10;
  const hi = Math.ceil(Math.max(...vals) * 10 + 1) / 10;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#64748B] mb-2">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#005EB8] inline-block" /> Measured WUE (L per IT kWh)</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-[#1A1F36] inline-block" /> Site target</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dotted border-[#94A3B8] inline-block" /> Tier III peer median {median}</span>
        <span className="text-[#94A3B8]">Shared scale across panels.</span>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
        {live.map((s) => <Panel key={s.id} site={s} lo={lo} hi={hi} median={median} />)}
      </div>
    </div>
  );
}
