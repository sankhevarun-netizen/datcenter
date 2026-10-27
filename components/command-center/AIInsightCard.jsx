'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, AlertOctagon, ChevronDown, Sparkles } from 'lucide-react';

const SEV_CONFIG = {
  warning:  { Icon: AlertTriangle, iconColor: 'text-[#E87722]', bg: 'bg-[#E87722]/10', border: 'border-[#E87722]/20' },
  info:     { Icon: Info,          iconColor: 'text-[#005EB8]', bg: 'bg-[#005EB8]/10', border: 'border-[#005EB8]/20' },
  critical: { Icon: AlertOctagon,  iconColor: 'text-[#C8102E]', bg: 'bg-[#C8102E]/10', border: 'border-[#C8102E]/20' },
};

export default function AIInsightCard({ insight, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEV_CONFIG[insight.severity] ?? SEV_CONFIG.info;
  const { Icon } = cfg;

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${cfg.border} ${cfg.bg}`}>
      <div className="p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-2.5">
          <Icon size={15} className={`${cfg.iconColor} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-[#1A1F36] text-xs leading-snug">{insight.title}</p>
              <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0">
                <ChevronDown size={12} className="text-[#9CA3AF]" />
              </motion.div>
            </div>
            <p className={`text-[10px] text-[#6B7280] mt-1 ${!expanded ? 'line-clamp-2' : ''}`}>{insight.description}</p>

            {/* Confidence bar */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 bg-[#D8DCE3] rounded-full overflow-hidden">
                <div className="h-full bg-[#005EB8] rounded-full" style={{ width: `${insight.confidence}%` }} />
              </div>
              <span className="text-[10px] text-[#9CA3AF] font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{insight.confidence}% confidence</span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-black/5 space-y-2">
              <div className="bg-white/60 rounded-lg p-2.5">
                <p className="text-[10px] font-bold text-[#00338D] uppercase tracking-wider mb-1">Suggested Action</p>
                <p className="text-xs text-[#1A1F36] leading-relaxed">{insight.suggestedAction}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#9CA3AF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {insight.affectedFacility} · {insight.timestamp}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onAction?.(); }}
                  className="px-2.5 py-1 bg-[#00338D] hover:bg-[#002A73] text-white text-[10px] font-bold rounded-lg transition-colors"
                >
                  Take Action
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
