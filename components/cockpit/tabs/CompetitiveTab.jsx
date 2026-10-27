'use client';
import Panel from '../Panel';
import { C, ICONS, TINTS } from '../tokens';

// Level → fill and label; colour always ships with its word.
const LEVEL = {
  3: { label: 'Strong', bg: '#1E3A8A', fg: '#FFFFFF' },
  2: { label: 'Partial', bg: '#93BDF0', fg: '#0F2D52' },
  1: { label: 'Limited', bg: '#EEF3FA', fg: '#8FA8C8' },
};
const THREAT = {
  High: { fg: '#B42318', bg: '#FDECEC' },
  Medium: { fg: '#B54708', bg: '#FEF3E2' },
  Low: { fg: '#047857', bg: '#E7F7EF' },
};

function Heatmap({ c, delay }) {
  return (
    <Panel title="Capability Comparison" action={null} delay={delay}>
      <div className="flex items-center gap-4 -mt-1 mb-3" style={{ fontSize: 12, color: C.text2 }}>
        {[3, 2, 1].map((l) => (
          <span key={l} className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-[3px]" style={{ background: LEVEL[l].bg, border: l === 1 ? `1px solid ${C.border}` : 'none' }} />{LEVEL[l].label}</span>
        ))}
      </div>
      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: `200px repeat(${c.capabilities.length}, minmax(0, 1fr))`, gridTemplateRows: `auto repeat(${c.players.length}, minmax(0, 1fr))`, gap: 5 }}>
        <span />
        {c.capabilities.map((cap) => (
          <span key={cap} className="flex items-end justify-center text-center pb-1" style={{ fontSize: 12, fontWeight: 600, color: C.text2, lineHeight: 1.25 }}>{cap}</span>
        ))}
        {c.players.map((p) => [
          <span key={`${p.name}-n`} className="flex items-center rounded-md px-3"
            style={{ fontSize: 13.5, fontWeight: p.self ? 700 : 500, color: p.self ? C.navyBlue : C.text, background: p.self ? C.tint : 'transparent', borderLeft: p.self ? `3px solid ${C.blue}` : '3px solid transparent' }}>{p.name}</span>,
          ...p.levels.map((l, i) => (
            <span key={`${p.name}-${i}`} className="flex items-center justify-center rounded-md" title={`${p.name} — ${c.capabilities[i]}: ${LEVEL[l].label}`}
              style={{ background: LEVEL[l].bg, color: LEVEL[l].fg, fontSize: 12, fontWeight: 600, outline: p.self ? `2px solid ${C.blue}` : 'none', outlineOffset: -2 }}>
              {LEVEL[l].label}
            </span>
          )),
        ])}
      </div>
      <p className="mt-3" style={{ fontSize: 11, color: C.muted }}>{c.note}</p>
    </Panel>
  );
}

export default function CompetitiveTab({ data, delay = 0 }) {
  const c = data.competitive;
  return (
    <div className="h-full grid gap-4" style={{ gridTemplateRows: 'minmax(0, 1.25fr) minmax(0, 1fr)' }}>
      <div className="grid gap-4 min-h-0" style={{ gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)' }}>
        <Heatmap c={c} delay={delay} />
        <Panel title="Where Tata Power Stands" action={null} delay={delay + 0.1}>
          <div className="flex-1 flex flex-col gap-3">
            {c.advantages.map((a) => {
              const Icon = ICONS[a.icon];
              const t = TINTS[a.tint];
              return (
                <div key={a.title} className="flex-1 flex gap-3 rounded-lg" style={{ background: t.card, padding: 14 }}>
                  <Icon size={24} strokeWidth={2.2} className="flex-shrink-0 mt-0.5" style={{ color: t.fg }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{a.title}</p>
                    <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.5, marginTop: 4 }}>{a.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
      <Panel title="Competitor Profiles" action={null} delay={delay + 0.25}>
        <div className="flex-1 grid grid-cols-3 gap-3" style={{ gridTemplateRows: 'repeat(2, minmax(0, 1fr))' }}>
          {c.profiles.map((p) => (
            <div key={p.name} className="rounded-lg flex flex-col" style={{ border: `1px solid ${C.border}`, padding: 14 }}>
              <div className="flex items-center justify-between gap-2">
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.name}</p>
                <span className="rounded-full px-2.5 py-0.5 whitespace-nowrap" style={{ fontSize: 11.5, fontWeight: 600, color: THREAT[p.threat].fg, background: THREAT[p.threat].bg }}>{p.threat} threat</span>
              </div>
              <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.5, marginTop: 6 }}>{p.angle}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
