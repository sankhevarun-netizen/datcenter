'use client';
import { motion } from 'framer-motion';
import Panel from './Panel';
import { C } from './tokens';
import { INDIA_PATH, INDIA_VIEWBOX, project } from '@/data/cockpit/india-outline';

const LEVELS = {
  High: { color: C.green, label: 'High Opportunity', r: 7 },
  Medium: { color: C.blue, label: 'Medium', r: 6.5 },
  Emerging: { color: '#9CC3EE', label: 'Emerging', r: 5.5 },
};

// Label offset by side, in viewBox units.
const PLACE = {
  left: { dx: -11, anchor: 'end' },
  right: { dx: 11, anchor: 'start' },
  below: { dx: -6, anchor: 'end', dy: 24 },
};

export default function GeographyPanel({ geography, delay }) {
  const { width, height } = INDIA_VIEWBOX;
  return (
    <Panel title="Geographic Focus" action={null} delay={delay}>
      <div className="flex items-center gap-4 -mt-1 mb-1" style={{ fontSize: 12, color: C.text2 }}>
        {Object.entries(LEVELS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: v.color }} />{v.label}</span>
        ))}
      </div>
      <div className="relative flex-1 min-h-0">
        <svg viewBox={`-30 -6 ${width + 60} ${height + 12}`} className="absolute inset-0 w-full h-full" role="img" aria-label="India: opportunity by datacentre cluster">
          <defs>
            <linearGradient id="india-fill" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0" stopColor="#E6EFFB" />
              <stop offset="1" stopColor="#CFE0F6" />
            </linearGradient>
            <radialGradient id="focus-glow">
              <stop offset="0" stopColor={C.green} stopOpacity="0.45" />
              <stop offset="1" stopColor={C.green} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="dot-glow">
              <stop offset="0" stopColor={C.blue} stopOpacity="0.28" />
              <stop offset="1" stopColor={C.blue} stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d={INDIA_PATH} fill="url(#india-fill)" stroke="#AFC9EC" strokeWidth="1" strokeLinejoin="round" />
          {geography.map((g, i) => {
            const [x, y] = project(g.lon, g.lat);
            const lv = LEVELS[g.level];
            const pl = PLACE[g.label] ?? PLACE.right;
            const ty = y + (pl.dy ?? -2);
            return (
              <motion.g key={g.city} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: delay + 0.45 + i * 0.07 }}>
                <title>{`${g.city} — ${g.level}: ${g.note}`}</title>
                {g.primary && <circle cx={x} cy={y} r={30} fill="url(#focus-glow)" />}
                {!g.primary && g.level !== 'Emerging' && <circle cx={x} cy={y} r={16} fill="url(#dot-glow)" />}
                <circle cx={x} cy={y} r={lv.r + 2.5} fill="#FFFFFF" />
                <circle cx={x} cy={y} r={lv.r} fill={lv.color} />
                {g.primary && <circle cx={x} cy={y} r={2.2} fill="#FFFFFF" />}
                <text x={x + pl.dx} y={ty} textAnchor={pl.anchor} fontSize={15} fontWeight={700} fill={C.text}>{g.city}</text>
                <text x={x + pl.dx} y={ty + 15} textAnchor={pl.anchor} fontSize={13} fill={g.level === 'High' ? C.greenDeep : g.level === 'Medium' ? C.blue : C.text2}>{g.level}</text>
              </motion.g>
            );
          })}
        </svg>
      </div>
    </Panel>
  );
}
