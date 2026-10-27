'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { Server, AlertTriangle, ChevronRight, MapPin } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { mockDatacenters, mockPortfolios } from '@/data/mock/index';

const REGION_COLORS = { APAC: '#005EB8', EMEA: '#00338D', Americas: '#00B0A0' };
const STATUS_CONFIG = {
  healthy:  { label: 'Healthy',  color: '#00B0A0', bg: '#F0FDF4' },
  degraded: { label: 'Degraded', color: '#E87722', bg: '#FFFBEB' },
  critical: { label: 'Critical', color: '#C8102E', bg: '#FEF2F2' },
};

function HealthBar({ pct }) {
  const color = pct >= 95 ? '#00B0A0' : pct >= 80 ? '#E87722' : '#C8102E';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 rounded-full bg-[#D8DCE3] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{pct}</span>
    </div>
  );
}

function DCRow({ dc, index }) {
  const router = useRouter();
  const sc = STATUS_CONFIG[dc.status] || STATUS_CONFIG.healthy;
  const rc = REGION_COLORS[dc.region] || '#00338D';
  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => router.push(`/datacenters/${dc.id}`)}
      className="border-b border-[#F0F2F5] hover:bg-[#F8FAFC] cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: rc + '15' }}>
            <Server size={14} style={{ color: rc }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{dc.name}</p>
            <p className="text-xs text-[#9CA3AF] flex items-center gap-1"><MapPin size={10} />{dc.city}, {dc.country}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: rc + '15', color: rc }}>{dc.region}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
      </td>
      <td className="px-4 py-3 w-40"><HealthBar pct={dc.healthScore} /></td>
      <td className="px-4 py-3 text-sm text-[#1A1F36] font-mono">{dc.totalCapacityMW} MW</td>
      <td className="px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full bg-[#D8DCE3] overflow-hidden">
              <div className="h-full rounded-full bg-[#005EB8]" style={{ width: `${dc.utilizationPercent}%` }} />
            </div>
            <span className="text-xs font-bold text-[#1A1F36]">{dc.utilizationPercent}%</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {dc.activeIncidents > 0 ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-[#C8102E]">
            <AlertTriangle size={10} /> {dc.activeIncidents}
          </span>
        ) : (
          <span className="text-[10px] text-[#00B0A0] font-bold">None</span>
        )}
      </td>
      <td className="px-4 py-3">
        <ChevronRight size={14} className="text-[#9CA3AF] group-hover:text-[#00338D] transition-colors" />
      </td>
    </motion.tr>
  );
}

function DatacentersContent() {
  const searchParams = useSearchParams();
  const portfolioId = searchParams.get('portfolio');
  const [regionFilter, setRegionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  const portfolio = portfolioId ? mockPortfolios.find(p => p.id === portfolioId) : null;

  const filtered = mockDatacenters.filter(dc => {
    if (portfolio && !portfolio.facilities.includes(dc.id)) return false;
    if (regionFilter !== 'All' && dc.region !== regionFilter) return false;
    if (statusFilter !== 'All' && dc.status !== statusFilter) return false;
    if (search && !dc.name.toLowerCase().includes(search.toLowerCase()) && !dc.city.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <CCLayout title="Datacenters">
      <div className="p-6 space-y-4">
        {portfolio && (
          <div className="bg-[#00338D]/5 border border-[#00338D]/15 rounded-xl px-4 py-3 flex items-center gap-2">
            <Server size={14} className="text-[#00338D]" />
            <span className="text-sm text-[#00338D] font-semibold">Filtered to: {portfolio.name}</span>
            <a href="/datacenters" className="ml-auto text-xs text-[#005EB8] hover:underline">Clear filter</a>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Facilities', value: '12' },
            { label: 'Healthy', value: String(mockDatacenters.filter(d => d.status === 'healthy').length) },
            { label: 'Degraded', value: String(mockDatacenters.filter(d => d.status === 'degraded').length) },
            { label: 'Active Incidents', value: String(mockDatacenters.reduce((s, d) => s + d.activeIncidents, 0)) },
          ].map((s, i) => (
            <div key={s.label} className="bg-white rounded-xl border border-[#D8DCE3] p-3 text-center">
              <p className="text-2xl font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</p>
              <p className="text-xs text-[#9CA3AF] font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#D8DCE3] p-3 flex flex-wrap gap-3 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or city..."
            className="flex-1 min-w-48 text-sm text-[#1A1F36] placeholder:text-[#9CA3AF] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#005EB8]/50 transition-colors" />
          <div className="flex gap-1">
            {['All', 'APAC', 'EMEA', 'Americas'].map(r => (
              <button key={r} onClick={() => setRegionFilter(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${regionFilter === r ? 'bg-[#00338D] text-white' : 'bg-[#F0F2F5] text-[#6B7280] hover:bg-[#D8DCE3]'}`}>{r}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {['All', 'healthy', 'degraded'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${statusFilter === s ? 'bg-[#00338D] text-white' : 'bg-[#F0F2F5] text-[#6B7280] hover:bg-[#D8DCE3]'}`}>{s === 'All' ? 'All Status' : s}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D8DCE3] bg-[#F8FAFC]">
                {['Datacenter', 'Region', 'Status', 'Health Score', 'Capacity', 'Utilization', 'Incidents', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((dc, i) => <DCRow key={dc.id} dc={dc} index={i} />)}
            </tbody>
          </table>
        </div>
      </div>
    </CCLayout>
  );
}

export default function DatacentersPage() {
  return (
    <Suspense fallback={<CCLayout title="Datacenters"><div className="p-6 text-[#9CA3AF]">Loading...</div></CCLayout>}>
      <DatacentersContent />
    </Suspense>
  );
}
