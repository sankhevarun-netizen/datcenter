'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import IncidentRow from './IncidentRow';

const FILTERS = ['All', 'Critical', 'High', 'Medium', 'Low'];

export default function IncidentCommandCenter({ incidents, statuses = {}, onAcknowledge }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const filtered = activeFilter === 'All' ? incidents : incidents.filter((i) => i.severity === activeFilter.toLowerCase());
  const critical = incidents.filter((i) => i.severity === 'critical').length;

  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#D8DCE3]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <AlertCircle size={18} className="text-[#C8102E]" />
            {critical > 0 && <>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#C8102E] animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#C8102E]" />
            </>}
          </div>
          <h2 className="text-[#00338D] font-bold text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Live Incident Command Center</h2>
          <span className="px-2 py-0.5 rounded-full bg-[#C8102E] text-white text-[10px] font-bold">{incidents.length} OPEN</span>
          <Link href="/incidents" className="text-[11px] text-[#005EB8] hover:underline">All briefs →</Link>
        </div>
        <div className="flex items-center bg-[#F0F2F5] rounded-lg p-0.5 gap-0.5">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${activeFilter === f ? 'bg-[#00338D] text-white' : 'text-[#6B7280] hover:text-[#00338D]'}`}>
              {f}
              {f !== 'All' && <span className="ml-1 text-[10px] opacity-70">({incidents.filter((i) => i.severity === f.toLowerCase()).length})</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#D8DCE3]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#9CA3AF]">
            <AlertCircle size={28} className="mb-2" />
            <p className="text-sm">No alerts at this severity</p>
          </div>
        ) : (
          filtered.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} status={statuses[incident.id] ?? incident.status} onAcknowledge={() => onAcknowledge?.(incident.id)} />
          ))
        )}
      </div>
    </div>
  );
}
