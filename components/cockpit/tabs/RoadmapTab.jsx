'use client';
import { motion } from 'framer-motion';
import { CheckCircle2, Flag } from 'lucide-react';
import Panel from '../Panel';
import { C } from '../tokens';

const PHASE_COLORS = ['#1E3A8A', '#3B82F6', '#60A5FA', '#8B7CF6'];
const PHASE_SPAN = [[0, 6], [6, 15], [15, 30], [30, 48]];

function Gantt({ r, phases, delay }) {
  const pct = (m) => `${(m / r.months) * 100}%`;
  const ticks = Array.from({ length: r.months / 6 + 1 }, (_, i) => i * 6);
  return (
    <Panel title="48-Month Implementation Plan" action={null} delay={delay}>
      <div className="flex-1 min-h-0 flex flex-col">
        {/* phase band */}
        <div className="flex ml-[260px] mb-2" style={{ gap: 3 }}>
          {PHASE_SPAN.map(([a, b], i) => (
            <div key={i} className="rounded-md px-2.5 py-1.5" style={{ width: `calc(${((b - a) / r.months) * 100}% - 3px)`, background: `${PHASE_COLORS[i]}14`, borderTop: `3px solid ${PHASE_COLORS[i]}` }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: PHASE_COLORS[i] }}>Phase {i + 1} · {phases[i].window}</p>
              <p style={{ fontSize: 12, color: C.text, lineHeight: 1.3 }}>{phases[i].title}</p>
            </div>
          ))}
        </div>
        {/* milestones */}
        <div className="relative ml-[260px] h-10">
          {r.milestones.map((m) => (
            // Labels at the ends of the axis anchor inward so they stay on the panel.
            <div key={m.label} className={`absolute top-0 flex flex-col ${m.month >= r.months ? 'items-end -translate-x-full' : m.month <= 0 ? 'items-start' : 'items-center -translate-x-1/2'}`} style={{ left: pct(m.month) }}>
              <span className="whitespace-nowrap rounded px-1.5" style={{ fontSize: 11.5, fontWeight: 600, color: C.navyBlue, background: '#FFFFFF' }}>
                <Flag size={11} className="inline -mt-0.5 mr-1" />{m.label}
              </span>
              <span className="w-2.5 h-2.5 rotate-45 mt-1" style={{ background: C.navyBlue, marginRight: m.month >= r.months ? -5 : 0 }} />
            </div>
          ))}
        </div>
        {/* workstreams */}
        <div className="relative flex-1 min-h-0 flex flex-col justify-around">
          <div className="absolute inset-y-0 right-0 left-[260px] pointer-events-none">
            {ticks.map((t) => <span key={t} className="absolute inset-y-0 w-px" style={{ left: pct(t), background: t % 12 === 0 ? '#E2E9F2' : '#F0F4F9' }} />)}
            {r.milestones.map((m) => <span key={m.label} className="absolute inset-y-0 border-l border-dashed" style={{ left: pct(m.month), borderColor: '#9DB7DA' }} />)}
          </div>
          {r.workstreams.map((w, i) => (
            <div key={w.name} className="relative flex items-center">
              <span className="w-[260px] flex-shrink-0 pr-4 text-right" style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{w.name}</span>
              <div className="relative flex-1 h-6">
                <motion.span className="absolute inset-y-0 rounded-md flex items-center px-2 origin-left"
                  style={{ left: pct(w.start), width: pct(w.end - w.start), background: PHASE_COLORS[w.phase - 1] }}
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: delay + 0.3 + i * 0.06, ease: 'easeOut' }}>
                  <span className="whitespace-nowrap" style={{ fontSize: 11, color: '#FFFFFF', fontWeight: 600 }}>M{w.start}–{w.end}</span>
                </motion.span>
              </div>
            </div>
          ))}
        </div>
        {/* axis */}
        <div className="relative ml-[260px] h-5 mt-1">
          {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2" style={{ left: pct(t), fontSize: 11.5, color: C.text2 }}>{t === 0 ? 'Month 0' : t}</span>)}
        </div>
      </div>
    </Panel>
  );
}

export default function RoadmapTab({ data, delay = 0 }) {
  const r = data.roadmapDetail;
  return (
    <div className="h-full grid gap-4" style={{ gridTemplateRows: 'minmax(0, 1.2fr) minmax(0, 1fr)' }}>
      <Gantt r={r} phases={data.roadmap} delay={delay} />
      <div className="grid grid-cols-4 gap-4 min-h-0">
        {data.roadmap.map((p, i) => (
          <Panel key={p.title} title={p.title} action={null} delay={delay + 0.25 + i * 0.08}>
            <div className="flex items-center gap-2 -mt-1">
              <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: PHASE_COLORS[i], color: '#FFFFFF', fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: PHASE_COLORS[i] }}>{p.window}</span>
            </div>
            <p className="mt-2" style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{p.detail}</p>
            <div className="rounded-lg mt-3" style={{ background: C.tint, padding: '10px 12px' }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: 0.4 }}>Stage gate</p>
              <p style={{ fontSize: 12.5, color: C.text, lineHeight: 1.45, marginTop: 2 }}>{r.phases[i].gate}</p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {r.phases[i].kpis.map((k) => (
                <li key={k} className="flex gap-2" style={{ fontSize: 12.5, color: C.text, lineHeight: 1.4 }}>
                  <CheckCircle2 size={15} className="flex-shrink-0 mt-[1px]" style={{ color: C.green }} />{k}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}
