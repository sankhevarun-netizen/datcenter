'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { SERVICE_STAGES, PHASES } from '@/data/serviceRoute';

// Catmull-Rom -> cubic bezier with a gentle tension, so the route reads as one continuous smooth line.
function buildSmoothPath(points, tension = 8) {
  if (points.length < 2) return '';
  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;
    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(' ');
}

function phaseForIndex(i) {
  return PHASES.find(p => i >= p.from && i <= p.to) ?? PHASES[0];
}

const VIEW_W = 1600;
const VIEW_H = 580;
const PHASE_BAR_Y = 555;
const PATH_DURATION = 2.4;
const BAND_PAD = 30;

export default function ServiceRoute() {
  const [hovered, setHovered] = useState(null);
  const pathD = buildSmoothPath(SERVICE_STAGES);
  const hoveredStage = SERVICE_STAGES.find(s => s.key === hovered);
  const hoveredIndex = SERVICE_STAGES.findIndex(s => s.key === hovered);

  return (
    <div className="w-full h-full relative">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full block"
        fill="none"
      >
        <defs>
          <filter id="glow-green" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── subtle per-phase background bands ── */}
        {PHASES.map((phase, i) => {
          const start = SERVICE_STAGES[phase.from].x - (i === 0 ? BAND_PAD + 30 : BAND_PAD);
          const end = SERVICE_STAGES[phase.to].x + (i === PHASES.length - 1 ? BAND_PAD + 30 : BAND_PAD);
          return (
            <rect
              key={phase.id}
              x={start}
              y={0}
              width={end - start}
              height={VIEW_H}
              fill={phase.color}
              opacity={0.045}
            />
          );
        })}

        {/* ── the route line, drawn left → right on mount ── */}
        <motion.path
          d={pathD}
          stroke="#005EB8"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: PATH_DURATION, ease: 'easeInOut' }}
        />

        {/* ── phase group bar (FUND / DESIGN & BUILD / OPERATE / REFINANCE) ── */}
        {PHASES.map((phase, i) => {
          const start = SERVICE_STAGES[phase.from].x;
          const end = SERVICE_STAGES[phase.to].x;
          const mid = (start + end) / 2;
          const delay = (phase.from / (SERVICE_STAGES.length - 1)) * PATH_DURATION;
          return (
            <motion.g
              key={phase.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay }}
            >
              <line x1={start} y1={PHASE_BAR_Y} x2={end} y2={PHASE_BAR_Y} stroke="#D8DCE3" strokeWidth={1.5} />
              <polygon
                points={`${start},${PHASE_BAR_Y - 5} ${start + 5},${PHASE_BAR_Y} ${start},${PHASE_BAR_Y + 5} ${start - 5},${PHASE_BAR_Y}`}
                fill={phase.color}
                opacity={0.55}
              />
              <polygon
                points={`${end},${PHASE_BAR_Y - 5} ${end + 5},${PHASE_BAR_Y} ${end},${PHASE_BAR_Y + 5} ${end - 5},${PHASE_BAR_Y}`}
                fill={phase.color}
                opacity={0.55}
              />
              <text
                x={mid}
                y={PHASE_BAR_Y - 14}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                letterSpacing="1.5"
                fill={phase.color}
                style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
              >
                {phase.label}
              </text>
            </motion.g>
          );
        })}

        {/* ── stage dots + labels ── */}
        {SERVICE_STAGES.map((s, i) => {
          const delay = (i / (SERVICE_STAGES.length - 1)) * PATH_DURATION;
          const labelY = s.side === 'top' ? s.y - 34 : s.y + 46;
          const tickY1 = s.side === 'top' ? s.y - 26 : s.y + 14;
          const tickY2 = s.side === 'top' ? s.y - 8 : s.y + 32;
          const isHovered = hovered === s.key;

          return (
            <motion.g
              key={s.key}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay, ease: 'easeOut' }}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* leader tick from dot to label */}
              <line
                x1={s.x} y1={tickY1} x2={s.x} y2={tickY2}
                stroke="#CBD5E1"
                strokeDasharray="2,3"
                strokeWidth={1}
              />

              {/* glow halo for active services */}
              {s.active && (
                <motion.circle
                  cx={s.x}
                  cy={s.y}
                  r={9}
                  fill="#00B0A0"
                  opacity={0.35}
                  filter="url(#glow-green)"
                  animate={{ r: [9, 16, 9], opacity: [0.35, 0.05, 0.35] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.3 }}
                />
              )}

              {/* invisible larger hit area for easier hover */}
              <circle cx={s.x} cy={s.y} r={18} fill="transparent" />

              <circle
                cx={s.x}
                cy={s.y}
                r={isHovered ? 9.5 : s.active ? 8 : 7}
                fill={s.active ? '#00B0A0' : '#005EB8'}
                stroke={s.active ? '#6EE7B7' : '#90CDF4'}
                strokeWidth={isHovered ? 3 : 2}
                filter={s.active ? 'url(#glow-green)' : undefined}
                style={{ transition: 'r 0.15s ease, stroke-width 0.15s ease' }}
              />

              <text
                x={s.x}
                y={labelY}
                textAnchor="middle"
                fontSize="11.5"
                fontWeight="600"
                fill={s.active ? '#00875A' : '#374151'}
              >
                {wrapLabel(s.label).map((line, idx) => (
                  <tspan key={idx} x={s.x} dy={idx === 0 ? 0 : 13}>
                    {line}
                  </tspan>
                ))}
              </text>
            </motion.g>
          );
        })}

        {/* ── hover tooltip, drawn last so it sits above everything ── */}
        {hoveredStage && (() => {
          const tipW = 250;
          const tipH = 140;
          const phase = phaseForIndex(hoveredIndex);
          const tipX = Math.min(Math.max(hoveredStage.x - tipW / 2, 8), VIEW_W - tipW - 8);
          const placeBelow = hoveredStage.y < 160;
          const tipY = placeBelow
            ? Math.min(VIEW_H - tipH - 8, hoveredStage.y + 30)
            : Math.max(8, hoveredStage.y - tipH - 24);
          return (
            <foreignObject x={tipX} y={tipY} width={tipW} height={tipH} style={{ pointerEvents: 'none', overflow: 'visible' }}>
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                style={{
                  background: '#ffffff',
                  border: '1px solid #D8DCE3',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(26,31,54,0.14)',
                  padding: '10px 12px',
                  fontFamily: "'Inter', 'Segoe UI', sans-serif",
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span
                    style={{
                      width: 7, height: 7, borderRadius: 99,
                      background: hoveredStage.active ? '#00B0A0' : '#005EB8',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 800, fontSize: 12.5, color: '#1A1F36', lineHeight: 1.2 }}>
                    {hoveredStage.label}
                  </span>
                </div>
                <span
                  style={{
                    display: 'inline-block', fontSize: 9, fontWeight: 700,
                    color: phase.color, background: phase.color + '15',
                    borderRadius: 99, padding: '2px 7px', marginBottom: 5,
                  }}
                >
                  {phase.label}
                </span>
                <p style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 1.4, margin: 0 }}>
                  {hoveredStage.description}
                </p>
                {hoveredStage.active && (
                  <p style={{ fontSize: 9, color: '#00B0A0', fontWeight: 700, margin: '4px 0 0' }}>
                    ● Live agent running
                  </p>
                )}
              </div>
            </foreignObject>
          );
        })()}
      </svg>
    </div>
  );
}

// Break long labels onto two lines so they don't overlap neighboring stages.
function wrapLabel(label) {
  if (label.length <= 16) return [label];
  const words = label.split(' ');
  let line1 = '';
  let i = 0;
  while (i < words.length && (line1 + words[i]).length <= 16) {
    line1 += (line1 ? ' ' : '') + words[i];
    i++;
  }
  const line2 = words.slice(i).join(' ');
  return line2 ? [line1, line2] : [line1];
}
