'use client';
import { TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';

const CATEGORY_CONFIG = {
  risk: { Icon: AlertTriangle, iconColor: 'text-[#C8102E]', bg: 'bg-[#C8102E]/8', border: 'border-[#C8102E]/15' },
  opportunity: { Icon: Lightbulb, iconColor: 'text-[#00B0A0]', bg: 'bg-[#00B0A0]/8', border: 'border-[#00B0A0]/15' },
  trend: { Icon: TrendingUp, iconColor: 'text-[#005EB8]', bg: 'bg-[#005EB8]/8', border: 'border-[#005EB8]/15' },
};

export default function AIInsightCard({ insight }) {
  const cfg = CATEGORY_CONFIG[insight.category] ?? CATEGORY_CONFIG.trend;
  const { Icon } = cfg;

  return (
    <div className={`border rounded-xl p-3 ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-start gap-2.5">
        <Icon size={14} className={`${cfg.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#1A1F36] text-xs leading-snug">{insight.title}</p>
          <p className="text-[10px] text-[#6B7280] mt-1 leading-relaxed">{insight.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 bg-white/60 rounded-full overflow-hidden">
              <div className="h-full bg-[#005EB8] rounded-full" style={{ width: `${insight.confidence}%` }} />
            </div>
            <span className="text-[9px] text-[#9CA3AF] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {insight.confidence}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
