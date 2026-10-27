'use client';
import { motion } from 'framer-motion';
import { Leaf, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import CCLayout from '@/components/command-center/CCLayout';
import { mockSustainability } from '@/data/mock/index';

const CERT_COLORS = { 'LEED Platinum': '#4F46E5', 'LEED Gold': '#7C3AED', 'BREEAM Excellent': '#059669', 'ISO 14001': '#005EB8', 'ISO 50001': '#00338D', 'Energy Star': '#00B0A0', 'EU Code of Conduct': '#D97706', 'SS 564': '#6B7280', 'Estidama Pearl': '#E87722' };

const carbonTrend = [
  { month: 'Jun', tCO2: 3900 }, { month: 'Jul', tCO2: 3820 }, { month: 'Aug', tCO2: 3780 },
  { month: 'Sep', tCO2: 3700 }, { month: 'Oct', tCO2: 3650 }, { month: 'Nov', tCO2: 3620 },
  { month: 'Dec', tCO2: 3580 }, { month: 'Jan', tCO2: 3520 }, { month: 'Feb', tCO2: 3490 },
  { month: 'Mar', tCO2: 3450 }, { month: 'Apr', tCO2: 3420 }, { month: 'May', tCO2: 3400 },
];

function PUEBar({ value }) {
  const color = value < 1.4 ? '#00B0A0' : value < 1.6 ? '#E87722' : '#C8102E';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-6 rounded-t-sm transition-all" style={{ height: `${(value - 1) * 200}px`, backgroundColor: color, maxHeight: '80px' }} />
      <span className="text-[9px] font-mono font-bold" style={{ color }}>{value.toFixed(2)}</span>
    </div>
  );
}

function RenewableDonut({ pct, size = 60 }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#D8DCE3" strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#00B0A0" strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-bold text-[#00B0A0]">{pct}%</span>
      </div>
    </div>
  );
}

const avgPUE = (mockSustainability.reduce((s, d) => s + d.pue, 0) / mockSustainability.length).toFixed(2);
const avgRenewable = Math.round(mockSustainability.reduce((s, d) => s + d.renewablePct, 0) / mockSustainability.length);
const avgESG = Math.round(mockSustainability.reduce((s, d) => s + d.esgScore, 0) / mockSustainability.length);

export default function SustainabilityPage() {
  return (
    <CCLayout title="Sustainability">
      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Portfolio Avg PUE', value: avgPUE, good: parseFloat(avgPUE) < 1.5 },
            { label: 'Total Carbon', value: '42,800', sub: 'tCO₂/yr', good: null },
            { label: 'Renewable Mix', value: `${avgRenewable}%`, good: avgRenewable >= 60 },
            { label: 'Water Usage', value: '1.2M', sub: 'L/day', good: null },
            { label: 'ESG Score', value: `${avgESG}/100`, good: avgESG >= 80 },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-[#D8DCE3] p-3 text-center">
              <p className="text-xl font-bold" style={{ color: s.good === null ? '#1A1F36' : s.good ? '#00B0A0' : '#C8102E', fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</p>
              {s.sub && <p className="text-[10px] text-[#9CA3AF]">{s.sub}</p>}
              <p className="text-xs text-[#9CA3AF] font-medium mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* PUE comparison bar chart */}
        <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Leaf size={16} className="text-[#00B0A0]" />
            <h3 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>PUE Comparison — All Facilities</h3>
            <span className="ml-auto text-xs text-[#9CA3AF]">Industry avg: 1.58 (Uptime Institute 2024)</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockSustainability.map(s => ({ name: s.dcName.split(' ').slice(0, 2).join(' '), pue: s.pue, fill: s.pue < 1.4 ? '#00B0A0' : s.pue < 1.6 ? '#E87722' : '#C8102E' }))} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} />
              <YAxis domain={[1.1, 1.8]} tick={{ fontSize: 9, fill: '#9CA3AF' }} />
              <Tooltip formatter={(v) => [`${v} PUE`, 'PUE']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #D8DCE3' }} />
              <ReferenceLine y={1.58} stroke="#C8102E" strokeDasharray="5 3" label={{ value: 'Avg', position: 'insideTopRight', fontSize: 9, fill: '#C8102E' }} />
              <Bar dataKey="pue" radius={[4, 4, 0, 0]}>
                {mockSustainability.map((s, i) => (
                  <Cell key={i} fill={s.pue < 1.4 ? '#00B0A0' : s.pue < 1.6 ? '#E87722' : '#C8102E'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Per-DC sustainability cards */}
        <div>
          <h3 className="text-sm font-bold text-[#1A1F36] mb-3" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Per-Facility Sustainability</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {mockSustainability.map((s, i) => (
              <motion.div key={s.dcId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{s.dcName}</p>
                    <p className="text-2xl font-bold mt-0.5" style={{ color: s.pue < 1.4 ? '#00B0A0' : s.pue < 1.6 ? '#E87722' : '#C8102E', fontFamily: "'JetBrains Mono', monospace" }}>{s.pue.toFixed(2)}</p>
                    <p className="text-[10px] text-[#9CA3AF]">PUE</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <RenewableDonut pct={s.renewablePct} />
                    <p className="text-[9px] text-[#9CA3AF] mt-0.5">renewable</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="bg-[#F0F2F5] rounded-lg p-2">
                    <p className="text-[#9CA3AF] text-[10px]">Carbon</p>
                    <p className="font-bold text-[#1A1F36] font-mono">{s.carbonIntensity} tCO₂/MWh</p>
                  </div>
                  <div className="bg-[#F0F2F5] rounded-lg p-2">
                    <p className="text-[#9CA3AF] text-[10px]">WUE</p>
                    <p className="font-bold text-[#1A1F36] font-mono">{s.wue} L/kWh</p>
                  </div>
                </div>
                {s.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {s.certifications.map(c => (
                      <span key={c} className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: CERT_COLORS[c] || '#6B7280' }}>{c}</span>
                    ))}
                  </div>
                )}
                <div className="space-y-0.5">
                  {s.measures.slice(0, 2).map((m, j) => (
                    <p key={j} className="text-[10px] text-[#9CA3AF] flex gap-1.5"><span className="text-[#00B0A0]">✓</span>{m}</p>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Carbon trend */}
        <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={16} className="text-[#00B0A0]" />
            <h3 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Portfolio Carbon Emissions — 12 Month Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={carbonTrend}>
              <defs>
                <linearGradient id="carbonGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00B0A0" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00B0A0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis domain={[3300, 4000]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <Tooltip formatter={(v) => [`${v.toLocaleString()} tCO₂`, 'Emissions']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Area type="monotone" dataKey="tCO2" stroke="#00B0A0" strokeWidth={2} fill="url(#carbonGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Renewable roadmap */}
        <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1A1F36] mb-4" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Renewable Energy Roadmap</h3>
          <div className="relative">
            <div className="h-3 rounded-full bg-[#D8DCE3] overflow-hidden mb-6">
              <div className="h-full rounded-full bg-gradient-to-r from-[#00B0A0] to-[#005EB8]" style={{ width: '64%' }} />
            </div>
            <div className="flex justify-between text-xs">
              {[
                { label: 'Today', pct: '64%', color: '#00B0A0' },
                { label: '2027 Target', pct: '80%', color: '#005EB8' },
                { label: '2030 Target', pct: '100%', color: '#00338D' },
              ].map((m, i) => (
                <div key={i} className="text-center">
                  <p className="font-bold text-lg" style={{ color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>{m.pct}</p>
                  <p className="text-[#9CA3AF] text-[10px]">{m.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {[
                '2025: Hyderabad 50MW solar PPA signed',
                'Q3 2026: Frankfurt waste heat recovery expanded',
                '2027: Ashburn 100% renewable PPA renewal',
                '2028: Singapore green power procurement target',
                '2029: Mumbai rooftop solar Phase 2 completion',
                '2030: Portfolio net-zero carbon commitment',
              ].map((m, i) => <p key={i} className="text-[#6B7280] flex gap-1.5"><span className="text-[#005EB8]">→</span>{m}</p>)}
            </div>
          </div>
        </div>
      </div>
    </CCLayout>
  );
}
