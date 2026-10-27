'use client';
import { Hexagon } from 'lucide-react';
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Tooltip } from 'recharts';
import Card, { ACCENTS } from './Card';

// Portfolio-wide view across EVERY computed module (not just the selected
// ones) — intentionally broader than the main cards above it.
export default function EvaluationSummaryCard({ evaluationSummary = [] }) {
  if (!evaluationSummary.length) return null;

  return (
    <Card accent={ACCENTS.navy} className="h-full">
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2">
          <Hexagon size={13} style={{ color: ACCENTS.navy }} />
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Evaluation Summary</p>
        </div>

        <div className="flex items-center gap-3 flex-1 min-h-0">
          <div style={{ width: 150, height: 150 }} className="flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={evaluationSummary} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
                <PolarGrid stroke="#D8DCE3" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fill: '#6B7280' }} />
                <Radar dataKey="score" stroke={ACCENTS.navy} fill={ACCENTS.navy} fillOpacity={0.18} />
                <Tooltip formatter={(v) => [`${v}/100`]} contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #D8DCE3' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 space-y-1.5 min-w-0">
            <p className="text-[8px] font-bold uppercase tracking-wide text-text-muted mb-1">Score breakdown</p>
            {evaluationSummary.map(s => (
              <div key={s.subject} className="flex items-center gap-2">
                <span className="text-[10px] text-text-secondary flex-1 truncate">{s.subject}</span>
                <div className="w-16 h-1.5 rounded-full bg-grey-bg overflow-hidden flex-shrink-0">
                  <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: ACCENTS.accent }} />
                </div>
                <span className="text-[9.5px] font-bold text-text-primary w-9 text-right flex-shrink-0">{s.score}/100</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
