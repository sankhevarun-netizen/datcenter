'use client';
import { Gauge, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';
import Card, { ACCENTS } from './Card';

export default function MetricCard({ title, shaped, reason, accent = 'accent', onDoubleClick }) {
  if (!shaped?.primary) return null;
  const color = ACCENTS[accent] || ACCENTS.accent;

  return (
    <Card accent={color} onDoubleClick={onDoubleClick}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <Gauge size={13} style={{ color }} />
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{title}</p>
        </div>
        <div className="flex items-end gap-1 mb-2">
          <span className="text-2xl font-extrabold text-text-primary">{shaped.primary.value}</span>
          <span className="text-[10px] text-text-muted mb-1">{shaped.primary.unit} {shaped.primary.label.toLowerCase()}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {(shaped.metrics || []).map(m => (
            <div key={m.label}>
              <p className="text-[9px] text-text-muted">{m.label}</p>
              <p className="text-xs font-bold text-text-primary">{m.value}</p>
            </div>
          ))}
        </div>

        {shaped.trend && (
          <div className="flex-1 min-h-0">
            <p className="text-[8px] text-text-muted uppercase tracking-wide mb-0.5">{shaped.trendLabel}</p>
            <div style={{ height: 44 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={shaped.trend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
                  <Tooltip
                    formatter={(v) => [v, shaped.primary.label]}
                    labelFormatter={() => ''}
                    contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #D8DCE3' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {(shaped.verdict || reason) && (
          <div className="flex items-start gap-1.5 mt-2 px-2 py-1.5 rounded-lg" style={{ background: color + '0d' }}>
            <div className="flex-1 min-w-0">
              {shaped.verdict && <p className="text-[10px] font-semibold" style={{ color }}>{shaped.verdict}</p>}
              {reason && <p className="text-[9.5px] text-text-secondary leading-snug">{reason}</p>}
            </div>
            <ArrowRight size={11} className="text-text-muted flex-shrink-0 mt-0.5" />
          </div>
        )}
      </div>
    </Card>
  );
}
