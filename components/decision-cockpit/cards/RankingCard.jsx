'use client';
import { ListOrdered } from 'lucide-react';
import Card, { ACCENTS } from './Card';

const PIN_COLORS = ['#00338D', '#005EB8', '#00B0A0'];

export default function RankingCard({ title, shaped, reason, accent = 'navy', onDoubleClick }) {
  if (!shaped?.items?.length) return null;
  const color = ACCENTS[accent] || ACCENTS.navy;
  const top3 = shaped.items.slice(0, 3);

  return (
    <Card accent={color} onDoubleClick={onDoubleClick}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2.5">
          <ListOrdered size={13} style={{ color }} />
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{title}</p>
        </div>

        <div className="space-y-1.5 mb-2.5">
          {top3.map((item, i) => (
            <div key={item.name} className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ background: PIN_COLORS[i] }}
              >
                {i + 1}
              </span>
              <span className="text-[10.5px] text-text-primary font-medium leading-tight truncate flex-1">{item.name}</span>
              <span className="text-[10px] font-bold flex-shrink-0" style={{ color }}>{item.score}</span>
            </div>
          ))}
        </div>

        {/* Abstract illustrative map — deterministic pin placement, not real geo-coordinates */}
        <div className="relative flex-1 rounded-xl overflow-hidden mb-1.5" style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F2F5 100%)', minHeight: 70 }}>
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 70">
            <path d="M0,45 Q25,30 50,42 T100,38 L100,70 L0,70 Z" fill="#DCEBFF" opacity="0.6" />
          </svg>
          {top3.map((item, i) => (
            <div
              key={item.name}
              className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-full"
              style={{ left: `${item.pin?.x ?? 30 + i * 20}%`, top: `${item.pin?.y ?? 30 + i * 10}%` }}
            >
              <span className="text-[8px] font-bold text-white rounded-full w-4 h-4 flex items-center justify-center" style={{ background: PIN_COLORS[i] }}>
                {i + 1}
              </span>
            </div>
          ))}
        </div>

        {reason && <p className="text-[9.5px] text-text-muted leading-snug">{reason}</p>}
      </div>
    </Card>
  );
}
