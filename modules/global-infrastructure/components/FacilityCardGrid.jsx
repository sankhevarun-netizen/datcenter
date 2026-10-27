'use client';
import { ArrowDownUp } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import FacilityCard from './FacilityCard';
import { SkeletonCard } from './Skeleton';
import { SORT_OPTIONS, useSortedFacilities } from '../hooks/useSortedFacilities';

export default function FacilityCardGrid({ facilities = [], loading = true, onSelectFacility, onOpenFacility, onHoverFacility }) {
  const { sortId, setSortId, sorted } = useSortedFacilities(facilities);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-[#9CA3AF]">{facilities.length} facilities</p>
        <div className="flex items-center gap-2">
          <ArrowDownUp size={12} className="text-[#9CA3AF]" />
          <select
            value={sortId}
            onChange={(e) => setSortId(e.target.value)}
            aria-label="Sort facility cards"
            className="text-xs bg-white border border-[#D8DCE3] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#005EB8]/50"
          >
            {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>Sort: {o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {sorted.map(facility => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              onSelect={onSelectFacility}
              onOpenFacility={onOpenFacility}
              onHover={onHoverFacility}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
