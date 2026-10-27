'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, MapPin, AlertTriangle, TrendingUp, DollarSign, Users, ChevronRight } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { mockPortfolios } from '@/data/mock/index';

const REGION_COLORS = { APAC: '#005EB8', EMEA: '#00338D', Americas: '#00B0A0' };

function ScoreGauge({ label, value, size = 48 }) {
  const color = value >= 90 ? '#00B0A0' : value >= 80 ? '#E87722' : '#C8102E';
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#D8DCE3" strokeWidth={4} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
        </div>
      </div>
      <span className="text-[9px] text-[#9CA3AF] font-medium uppercase tracking-wide">{label}</span>
    </div>
  );
}

function PortfolioCard({ portfolio, onClick }) {
  const regionColor = REGION_COLORS[portfolio.region] || '#00338D';
  const statusConfig = {
    'on-track': { label: 'On-track', color: '#00B0A0', bg: '#F0FDF4' },
    'at-risk':  { label: 'At-risk',  color: '#E87722', bg: '#FFFBEB' },
    'critical': { label: 'Critical', color: '#C8102E', bg: '#FEF2F2' },
  }[portfolio.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm hover:shadow-md hover:border-[#CBD5E1] transition-all cursor-pointer overflow-hidden"
    >
      <div className="h-1 w-full" style={{ backgroundColor: regionColor }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-[#1A1F36] text-sm truncate" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{portfolio.name}</h3>
              {portfolio.activeIncidents > 0 && (
                <span className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 bg-[#FEF2F2] text-[#C8102E] text-[10px] font-bold rounded-full">
                  <AlertTriangle size={9} /> {portfolio.activeIncidents}
                </span>
              )}
            </div>
            <p className="text-[#6B7280] text-xs leading-relaxed line-clamp-2">{portfolio.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 ml-3 flex-shrink-0">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: regionColor + '15', color: regionColor }}>{portfolio.region}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}>{statusConfig.label}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <ScoreGauge label="Health" value={portfolio.healthScore} />
          <ScoreGauge label="Schedule" value={portfolio.scheduleScore} />
          <ScoreGauge label="Cost" value={portfolio.costScore} />
          <ScoreGauge label="Resource" value={portfolio.resourceScore} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[#F0F2F5] rounded-xl p-3">
            <p className="text-[10px] text-[#9CA3AF] font-medium mb-0.5">Capacity</p>
            <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{portfolio.totalCapacityMW} MW</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-[#D8DCE3] overflow-hidden">
              <div className="h-full rounded-full bg-[#005EB8]" style={{ width: `${portfolio.utilizationPercent}%` }} />
            </div>
            <p className="text-[10px] text-[#9CA3AF] mt-0.5">{portfolio.utilizationPercent}% utilized</p>
          </div>
          <div className="bg-[#F0F2F5] rounded-xl p-3">
            <p className="text-[10px] text-[#9CA3AF] font-medium mb-0.5">Financials</p>
            <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{portfolio.annualRevenue}</p>
            <p className="text-[10px] text-[#9CA3AF]">revenue / yr</p>
            <p className="text-[10px] text-[#6B7280] mt-0.5">{portfolio.totalInvestment} invested</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MapPin size={11} className="text-[#9CA3AF]" />
            <span className="text-xs text-[#6B7280]">{portfolio.facilities.length} facilities</span>
          </div>
          <div className="flex gap-1">
            {portfolio.keyClients.slice(0, 2).map(c => (
              <span key={c} className="text-[9px] px-1.5 py-0.5 bg-[#00338D]/8 text-[#00338D] rounded-full font-medium">{c}</span>
            ))}
            {portfolio.keyClients.length > 2 && (
              <span className="text-[9px] px-1.5 py-0.5 bg-[#F0F2F5] text-[#9CA3AF] rounded-full">+{portfolio.keyClients.length - 2}</span>
            )}
          </div>
          <ChevronRight size={14} className="text-[#9CA3AF]" />
        </div>
      </div>
    </motion.div>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const [regionFilter, setRegionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = mockPortfolios.filter(p => {
    if (regionFilter !== 'All' && p.region !== regionFilter) return false;
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalMW = mockPortfolios.reduce((s, p) => s + p.totalCapacityMW, 0);
  const totalInvestment = '$4.2B';
  const totalRevenue = '$1.9B';
  const avgHealth = Math.round(mockPortfolios.reduce((s, p) => s + p.healthScore, 0) / mockPortfolios.length);

  return (
    <CCLayout title="Portfolio Explorer">
      <div className="p-6 space-y-6">
        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Portfolio Health', value: `${avgHealth}/100`, sub: 'weighted avg', icon: TrendingUp, color: '#00B0A0' },
            { label: 'Total Facilities', value: '12', sub: 'across 6 portfolios', icon: Building2, color: '#005EB8' },
            { label: 'Total Investment', value: totalInvestment, sub: 'committed capital', icon: DollarSign, color: '#00338D' },
            { label: 'Annual Revenue', value: totalRevenue, sub: 'contracted', icon: Users, color: '#7C3AED' },
          ].map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.color + '15' }}>
                  <Icon size={18} style={{ color: kpi.color }} />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF] font-medium">{kpi.label}</p>
                  <p className="text-xl font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{kpi.value}</p>
                  <p className="text-[10px] text-[#9CA3AF]">{kpi.sub}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 flex flex-wrap items-center gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search portfolios..."
            className="flex-1 min-w-48 text-sm text-[#1A1F36] placeholder:text-[#9CA3AF] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#005EB8]/50 transition-colors" />
          <div className="flex gap-1">
            {['All', 'APAC', 'EMEA', 'Americas'].map(r => (
              <button key={r} onClick={() => setRegionFilter(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${regionFilter === r ? 'bg-[#00338D] text-white' : 'bg-[#F0F2F5] text-[#6B7280] hover:bg-[#D8DCE3]'}`}>{r}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {['All', 'on-track', 'at-risk'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${statusFilter === s ? 'bg-[#00338D] text-white' : 'bg-[#F0F2F5] text-[#6B7280] hover:bg-[#D8DCE3]'}`}>{s === 'All' ? 'All Status' : s}</button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <PortfolioCard key={p.id} portfolio={p}
              onClick={() => router.push(`/datacenters?portfolio=${p.id}`)} />
          ))}
        </div>
      </div>
    </CCLayout>
  );
}
