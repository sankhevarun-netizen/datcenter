'use client';
import { AlertTriangle, Zap, Shield, Waves, Activity, Landmark, Truck } from 'lucide-react';
import RiskHeatmap from './RiskHeatmap';
import { SkeletonBlock } from './Skeleton';
import { buildRiskHeatmap, buildRiskCategorySummary } from '../utils/portfolioAnalytics';

const CATEGORY_ICONS = {
  Weather: AlertTriangle,
  'Grid Stability': Zap,
  Cyber: Shield,
  Flood: Waves,
  Earthquake: Activity,
  Political: Landmark,
  'Supply Chain': Truck,
};

const LEVEL_COLOR = { Low: '#00B0A0', Medium: '#E87722', High: '#C8102E' };

export default function GlobalRiskPanel({ facilities = [], risksByDc = {}, loading = true }) {
  if (loading || facilities.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4">
        <SkeletonBlock height="h-3" width="w-32" className="mb-4" />
        <SkeletonBlock height="h-40" width="w-full" />
      </div>
    );
  }

  const heatmapRows = buildRiskHeatmap(facilities, risksByDc);
  const categorySummary = buildRiskCategorySummary(facilities, risksByDc);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {categorySummary.map(({ category, avgScore, level }) => {
          const Icon = CATEGORY_ICONS[category] ?? AlertTriangle;
          const color = LEVEL_COLOR[level];
          return (
            <div key={category} className="bg-white rounded-xl border border-[#D8DCE3] shadow-sm p-3 text-center">
              <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
                <Icon size={14} style={{ color }} />
              </div>
              <p className="text-[10px] text-[#9CA3AF] mb-0.5">{category}</p>
              <p className="text-sm font-bold" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{avgScore}</p>
              <p className="text-[9px] font-semibold" style={{ color }}>{level}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4">
        <p className="text-xs font-bold text-[#1A1F36] mb-3" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Risk Heatmap — Region x Category</p>
        <RiskHeatmap rows={heatmapRows} />
      </div>
    </div>
  );
}
