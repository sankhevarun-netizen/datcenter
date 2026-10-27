'use client';
import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import Panel from './Panel';
import { C, ICONS, TINTS } from './tokens';

export default function InsightsPanel({ insights, delay, className = '', onAction }) {
  return (
    <Panel title="Key Insights" icon={Lightbulb} delay={delay} onAction={onAction} className={`h-full ${className}`}>
      <div className="flex-1 flex flex-col gap-3">
        {insights.map((it, i) => {
          const Icon = ICONS[it.icon];
          const tint = TINTS[it.tint];
          return (
            <motion.div key={it.title}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: delay + 0.25 + i * 0.08 }}
              className="flex-1 flex items-start gap-3 rounded-lg" style={{ background: tint.card, padding: 14 }}>
              <Icon size={26} strokeWidth={2.2} className="flex-shrink-0 mt-0.5" style={{ color: tint.fg }} />
              <div className="min-w-0">
                <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{it.title}</p>
                <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.45, marginTop: 4 }}>{it.text}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
