'use client';
// Scene 4 telemetry as small multiples: one single-series panel per measure
// (different units never share an axis), a shared time axis, the agent flag
// and operator detection as labelled event rules, and the lead time between
// them as a wash. Hover shows a crosshair across every panel.
import { useMemo, useRef, useState } from 'react';
import { toMinutes } from '@/lib/nexus/replay';

const PANELS = [
  { key: 'cell_temp_c', label: 'Cell temperature', unit: '°C', dp: 1 },
  { key: 'internal_resistance_mohm', label: 'Internal resistance', unit: 'mΩ', dp: 3 },
  { key: 'string_voltage_v', label: 'String voltage', unit: 'V', dp: 1 },
  { key: 'state_of_health_pct', label: 'State of health', unit: '%', dp: 1 },
];
const C = {
  series: '#3987e5',
  warning: '#fab219',
  critical: '#d03b3b',
  grid: '#1c2a3d',
  surface: '#0a1220',
  ink: '#D8DCE3',
  inkSecondary: '#c3c2b7',
  muted: '#898781',
};
const W = 380, PAD_L = 44, PAD_R = 10, TOP = 44, PANEL_H = 58, GAP = 26, AXIS_H = 22;

const hhmm = (ts) => ts.split(' ')[1];

export default function TelemetryChart({ readings, flaggedAt, detectedAt }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef(null);

  const geo = useMemo(() => {
    const flagM = toMinutes(flaggedAt), detM = toMinutes(detectedAt);
    const x0 = readings[0].minute, x1 = Math.max(readings[readings.length - 1].minute, detM) + 10;
    const x = (m) => PAD_L + ((m - x0) / (x1 - x0)) * (W - PAD_L - PAD_R);
    const panels = PANELS.map((p, i) => {
      const vals = readings.map((r) => r[p.key]);
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const pad = (hi - lo) * 0.12 || 1;
      const top = TOP + i * (PANEL_H + GAP);
      const y = (v) => top + PANEL_H - ((v - (lo - pad)) / (hi + pad - (lo - pad))) * PANEL_H;
      const path = readings.map((r, j) => `${j ? 'L' : 'M'}${x(r.minute).toFixed(1)},${y(r[p.key]).toFixed(1)}`).join(' ');
      return { ...p, top, y, path, lo, hi };
    });
    const height = TOP + PANELS.length * (PANEL_H + GAP) - GAP + AXIS_H;
    const ticks = readings.filter((r) => r.timestamp.endsWith(':00') && Number(hhmm(r.timestamp).slice(0, 2)) % 2 === 0);
    return { x, flagX: x(flagM), detX: x(detM), panels, height, ticks };
  }, [readings, flaggedAt, detectedAt]);

  const onMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    let best = null;
    for (const r of readings) {
      const d = Math.abs(geo.x(r.minute) - sx);
      if (!best || d < best.d) best = { r, d };
    }
    setHover(best ? { reading: best.r, px: ((geo.x(best.r.minute) / W) * rect.width), width: rect.width } : null);
  };

  const bottom = geo.height - AXIS_H;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide">UPS-1 battery string B telemetry</p>
        <button onClick={() => setShowTable((s) => !s)} className="text-[10px] text-[#93c5fd] hover:text-white underline-offset-2 hover:underline">
          {showTable ? 'Show chart' : 'View as table'}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-[300px] overflow-y-auto rounded-lg border border-white/10">
          <table className="w-full text-[10px] font-mono tabular-nums">
            <thead className="sticky top-0 bg-[#0d1626] text-white/50">
              <tr><th className="text-left px-2 py-1">Time</th>{PANELS.map((p) => <th key={p.key} className="text-right px-2 py-1">{p.unit}</th>)}<th className="text-left px-2 py-1">State</th></tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.timestamp} className={`border-t border-white/5 ${r.flag ? 'bg-[#fab219]/10' : ''}`}>
                  <td className="px-2 py-0.5 text-white/70">{r.timestamp.slice(5)}</td>
                  {PANELS.map((p) => <td key={p.key} className="px-2 py-0.5 text-right text-white/80">{r[p.key]}</td>)}
                  <td className="px-2 py-0.5 text-white/60">{r.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${geo.height}`} className="w-full block" role="img"
            aria-label={`Telemetry for UPS-1 battery string B from ${readings[0].timestamp} to ${readings[readings.length - 1].timestamp}. Agent flag at ${flaggedAt}, operator detection at ${detectedAt}.`}>
            {/* Lead-time wash between the two events */}
            <rect x={geo.flagX} y={TOP - 4} width={geo.detX - geo.flagX} height={bottom - TOP + 4} fill={C.warning} opacity={0.1} />

            {geo.panels.map((p) => (
              <g key={p.key}>
                <text x={PAD_L} y={p.top - 7} fontSize="9.5" fill={C.inkSecondary} fontWeight="600">{p.label} ({p.unit})</text>
                <line x1={PAD_L} x2={W - PAD_R} y1={p.top + PANEL_H} y2={p.top + PANEL_H} stroke={C.grid} strokeWidth="1" />
                <line x1={PAD_L} x2={W - PAD_R} y1={p.top} y2={p.top} stroke={C.grid} strokeWidth="1" />
                <text x={PAD_L - 5} y={p.y(p.hi) + 3} fontSize="8.5" fill={C.muted} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.hi.toFixed(p.dp === 3 ? 2 : 1)}</text>
                <text x={PAD_L - 5} y={p.y(p.lo) + 3} fontSize="8.5" fill={C.muted} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.lo.toFixed(p.dp === 3 ? 2 : 1)}</text>
                <path d={p.path} fill="none" stroke={C.series} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              </g>
            ))}

            {/* Event rules, labelled — never colour alone */}
            <line x1={geo.flagX} x2={geo.flagX} y1={4} y2={bottom} stroke={C.warning} strokeWidth="1.5" />
            <line x1={geo.detX} x2={geo.detX} y1={16} y2={bottom} stroke={C.critical} strokeWidth="1.5" />
            {/* Both labels sit inside the lead window so neither runs off the plot. */}
            <g transform={`translate(${geo.flagX}, 10)`}>
              <path d="M2,-6 L2,4 M2,-6 L9,-3.5 L2,-1" stroke={C.warning} strokeWidth="1.4" fill={C.warning} />
              <text x={12} y={2} fontSize="9" fill={C.ink} fontWeight="600">Agent flag {hhmm(flaggedAt)}</text>
            </g>
            {/* Second row, so the two labels never overlap however narrow the window. */}
            <g transform={`translate(${geo.detX}, 22)`}>
              <circle cx={-5} cy={-1} r={3} fill={C.critical} />
              <text x={-11} y={2} fontSize="9" fill={C.ink} textAnchor="end" fontWeight="600">Detected {hhmm(detectedAt)}</text>
            </g>

            {/* Shared time axis */}
            {geo.ticks.map((t) => (
              <text key={t.timestamp} x={geo.x(t.minute)} y={geo.height - 6} fontSize="8.5" fill={C.muted} textAnchor="middle" style={{ fontVariantNumeric: 'tabular-nums' }}>{hhmm(t.timestamp)}</text>
            ))}

            {/* Crosshair */}
            {hover && (
              <g pointerEvents="none">
                <line x1={geo.x(hover.reading.minute)} x2={geo.x(hover.reading.minute)} y1={TOP} y2={bottom} stroke={C.inkSecondary} strokeWidth="1" opacity="0.5" />
                {geo.panels.map((p) => (
                  <circle key={p.key} cx={geo.x(hover.reading.minute)} cy={p.y(hover.reading[p.key])} r="4" fill={C.series} stroke={C.surface} strokeWidth="2" />
                ))}
              </g>
            )}
          </svg>

          {hover && (
            <div className="absolute pointer-events-none z-10 bg-[#0d1626]/95 border border-white/15 rounded-lg px-2.5 py-1.5 shadow-xl text-[10px] font-mono tabular-nums whitespace-nowrap"
              style={hover.px > hover.width / 2 ? { right: hover.width - hover.px + 12, top: 48 } : { left: hover.px + 12, top: 48 }}>
              <p className="text-white font-semibold mb-0.5">{hover.reading.timestamp}</p>
              {PANELS.map((p) => <p key={p.key} className="text-white/70">{p.label}: <span className="text-white">{hover.reading[p.key]} {p.unit}</span></p>)}
              <p className="text-white/50 mt-0.5">{hover.reading.state}{hover.reading.flag ? ' · agent flag' : ''}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
