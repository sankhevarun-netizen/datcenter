'use client';
import { Sparkles, Globe2 } from 'lucide-react';
import RegionSummary from './RegionSummary';
import AIInsightCard from './AIInsightCard';
import { SkeletonBlock } from './Skeleton';
import {
  topRegionsByCount,
  highestCapacityRegions,
  lowestCarbonRegions,
} from '../utils/portfolioAnalytics';

export default function IntelligencePanel({ facilities = [], regionRollups = [], insights = [], selectedFacility = null, loading = true }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} height="h-16" />)}
      </div>
    );
  }

  const topRegions = topRegionsByCount(regionRollups).map(r => ({ region: r.region, value: r.facilityCount }));
  const highestCapacity = highestCapacityRegions(regionRollups).map(r => ({ region: r.region, value: r.capacityMw }));
  const lowestCarbon = lowestCarbonRegions(facilities).map(r => ({ region: r.region, value: r.avgCarbonMt }));

  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5 space-y-5 sticky top-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#00338D]/10 flex items-center justify-center flex-shrink-0">
          <Globe2 size={13} className="text-[#00338D]" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Global Summary</p>
          <p className="text-[10px] text-[#9CA3AF]">{facilities.length} facilities · {regionRollups.length} regions</p>
        </div>
      </div>

      {selectedFacility && (
        <div className="bg-[#F0F2F5] rounded-xl p-3 border border-[#D8DCE3]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Selected</p>
          <p className="text-xs font-bold text-[#1A1F36]">{selectedFacility.name}</p>
          <p className="text-[10px] text-[#9CA3AF]">{selectedFacility.city}, {selectedFacility.country}</p>
        </div>
      )}

      <RegionSummary title="Top Regions" rows={topRegions} valueSuffix=" sites" />
      <RegionSummary title="Highest Capacity Regions" rows={highestCapacity} valueSuffix=" MW" />
      <RegionSummary title="Lowest Carbon Regions" rows={lowestCarbon} valueSuffix=" tCO₂/site" />

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={11} className="text-[#005EB8]" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Global AI Summary</p>
        </div>
        <div className="space-y-2">
          {insights.map(insight => <AIInsightCard key={insight.id} insight={insight} />)}
        </div>
      </div>
    </div>
  );
}
