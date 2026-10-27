'use client';
import { motion } from 'framer-motion';
import { MapPin, ArrowRight } from 'lucide-react';
import StatusBadge from '@/components/command-center/StatusBadge';

const RISK_TO_STATUS = { Low: 'healthy', Medium: 'warning', High: 'critical' };

export default function FacilityCard({ facility, onSelect, onOpenFacility, onHover }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onMouseEnter={() => onHover?.(facility.id)}
      onMouseLeave={() => onHover?.(null)}
      className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
      onClick={() => onSelect?.(facility)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.(facility); }}
      aria-label={`Open ${facility.name} details`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#1A1F36] truncate" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{facility.name}</p>
          <p className="text-[10px] text-[#9CA3AF] flex items-center gap-1 mt-0.5">
            <MapPin size={10} />{facility.city}, {facility.country}
          </p>
        </div>
        <StatusBadge status={facility.health} showDot size="xs" />
      </div>

      <div className="grid grid-cols-2 gap-2 my-3">
        <div className="bg-[#F0F2F5] rounded-lg px-2.5 py-2">
          <p className="text-[9px] text-[#9CA3AF]">Health Score</p>
          <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{facility.healthScore}</p>
        </div>
        <div className="bg-[#F0F2F5] rounded-lg px-2.5 py-2">
          <p className="text-[9px] text-[#9CA3AF]">Capacity</p>
          <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{facility.capacityMw} MW</p>
        </div>
        <div className="bg-[#F0F2F5] rounded-lg px-2.5 py-2">
          <p className="text-[9px] text-[#9CA3AF]">Renewable</p>
          <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{facility.renewablePct}%</p>
        </div>
        <div className="bg-[#F0F2F5] rounded-lg px-2.5 py-2">
          <p className="text-[9px] text-[#9CA3AF]">PUE</p>
          <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{facility.pue}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <StatusBadge status={RISK_TO_STATUS[facility.riskFlag]} label={`${facility.riskFlag} Risk`} size="xs" />
        <button
          onClick={(e) => { e.stopPropagation(); onOpenFacility?.(facility); }}
          className="flex items-center gap-1 text-[10px] font-bold text-[#005EB8] hover:text-[#00338D] transition-colors"
        >
          Open Facility <ArrowRight size={11} />
        </button>
      </div>
    </motion.div>
  );
}
