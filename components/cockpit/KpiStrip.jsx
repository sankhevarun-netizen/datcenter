'use client';
import { motion } from 'framer-motion';
import { C, ICONS, TINTS, ENTER, enter } from './tokens';

export default function KpiStrip({ kpis }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))` }}>
      {kpis.map((k, i) => {
        const Icon = ICONS[k.icon];
        const tint = TINTS[k.tint];
        return (
          <motion.div
            key={k.label} {...enter(ENTER.kpiStart + i * ENTER.kpiStep)}
            className="bg-white rounded-xl flex items-center gap-4 px-5"
            style={{ height: 88, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(15,45,82,0.06)' }}
          >
            <span className="flex-shrink-0 rounded-full flex items-center justify-center" style={{ width: 52, height: 52, background: tint.bg }}>
              <Icon size={26} strokeWidth={2.2} style={{ color: tint.fg }} />
            </span>
            <div className="min-w-0">
              <p style={{ fontSize: 26, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{k.value}</p>
              <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.3, marginTop: 3 }}>{k.label}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
