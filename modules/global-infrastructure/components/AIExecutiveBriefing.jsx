'use client';
import { Sparkles } from 'lucide-react';
import { SkeletonBlock } from './Skeleton';
import { buildExecutiveBriefing } from '../utils/executiveBriefing';

/**
 * Renders a dynamically-generated narrative. Used directly for the global
 * AI Executive Briefing (computes its own lines from buildExecutiveBriefing)
 * and reused for the Regional AI Summary by passing pre-built `lines` from
 * buildRegionalBriefing — same card, same `.ai-output` typography, no
 * second narrative component.
 */
export default function AIExecutiveBriefing({
  facilities = [],
  prevByDc = {},
  loading = true,
  lines: linesOverride = null,
  title = 'AI Executive Briefing',
  subtitle = 'Generated from the current filtered view',
}) {
  if (loading || facilities.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5">
        <SkeletonBlock height="h-3" width="w-40" className="mb-4" />
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} height="h-3" className="mb-2" />)}
      </div>
    );
  }

  const lines = linesOverride ?? buildExecutiveBriefing(facilities, {}, prevByDc);

  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[#00338D] flex items-center justify-center flex-shrink-0">
          <Sparkles size={13} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{title}</p>
          <p className="text-[10px] text-[#9CA3AF]">{subtitle}</p>
        </div>
      </div>
      <div className="ai-output">
        {lines.length === 0 ? (
          <p className="text-xs text-[#9CA3AF]">No facilities match the current filters.</p>
        ) : (
          <ul>
            {lines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
