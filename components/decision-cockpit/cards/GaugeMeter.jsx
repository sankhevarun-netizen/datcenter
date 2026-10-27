'use client';

// Small semicircle gauge shared by ScoreCard. Score 0-100, where higher is
// always "better" in this app's scoring convention (matches the verdict
// thresholds already used in lib/decisionEngine.js: >=75 good, >=55 moderate).
const ZONES = [
  { from: 0, to: 55, color: '#C8102E' },
  { from: 55, to: 75, color: '#E87722' },
  { from: 75, to: 100, color: '#00B0A0' },
];

function point(cx, cy, r, scoreAt0to100) {
  const angle = Math.PI - (scoreAt0to100 / 100) * Math.PI; // 0 -> 180deg (left), 100 -> 0deg (right)
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

function arcPath(cx, cy, r, fromScore, toScore) {
  const p1 = point(cx, cy, r, fromScore);
  const p2 = point(cx, cy, r, toScore);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
}

export default function GaugeMeter({ score, size = 110 }) {
  const cx = size / 2;
  const cy = size / 2 + 4;
  const r = size / 2 - 12;
  const needle = point(cx, cy, r - 6, score);
  const color = score >= 75 ? '#00B0A0' : score >= 55 ? '#E87722' : '#C8102E';

  return (
    <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`}>
      {ZONES.map(z => (
        <path key={z.from} d={arcPath(cx, cy, r, z.from, z.to)} stroke={z.color} strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.85} />
      ))}
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#1A1F36" strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={3} fill="#1A1F36" />
      <text x={cx - r} y={cy + 13} textAnchor="middle" fontSize="8" fill="#9CA3AF">Weak</text>
      <text x={cx + r} y={cy + 13} textAnchor="middle" fontSize="8" fill="#9CA3AF">Strong</text>
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="15" fontWeight="800" fill={color}>{score}</text>
    </svg>
  );
}
