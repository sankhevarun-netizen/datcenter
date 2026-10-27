'use client';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Panel from './Panel';
import { C } from './tokens';

const STEP_COLORS = ['#1E3A8A', '#3B82F6', '#60A5FA', '#8B7CF6'];

export default function RoadmapPanel({ roadmap, delay, onAction }) {
  const n = roadmap.length;
  return (
    <Panel title="Strategic Roadmap" action="View Full Roadmap" delay={delay} onAction={onAction}>
      <div className="relative mt-2">
        {/* connecting line, navy → blue → violet */}
        <motion.div className="absolute h-[3px] rounded-full" style={{ top: 16.5, left: `${50 / n}%`, right: `${50 / n}%`, transformOrigin: 'left', background: `linear-gradient(90deg, ${STEP_COLORS.join(', ')})` }}
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: delay + 0.3, ease: 'easeOut' }} />
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {roadmap.map((p, i) => (
            <motion.li key={p.title} className="flex flex-col items-center px-3"
              style={{ borderLeft: i ? `1px solid ${C.border}` : 'none' }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: delay + 0.35 + i * 0.12 }}>
              <span className="rounded-full flex items-center justify-center relative" style={{ width: 36, height: 36, background: STEP_COLORS[i] ?? C.blue, color: '#FFFFFF', fontSize: 15, fontWeight: 600, boxShadow: '0 0 0 4px #FFFFFF' }}>{i + 1}</span>
              <div className="self-stretch mt-3">
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.window}</p>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text, lineHeight: 1.3, marginTop: 8, minHeight: 35 }}>{p.title}</p>
                <p className="flex gap-1 mt-2" style={{ fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
                  <ChevronRight size={13} className="flex-shrink-0 mt-[2px]" style={{ color: C.muted }} />
                  <span>{p.detail}</span>
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}
