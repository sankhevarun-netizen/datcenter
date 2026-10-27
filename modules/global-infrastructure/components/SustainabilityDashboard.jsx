'use client';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Droplets, Leaf, Trophy, TrendingDown } from 'lucide-react';
import { SkeletonBlock } from './Skeleton';
import { buildPortfolioEsgTrend, buildEnergyMix, buildSustainabilityLeaders } from '../utils/portfolioAnalytics';

const CustomTooltip = ({ active, payload, label, suffix = '' }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#00338D] border border-white/10 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
        <p className="text-white/50 mb-0.5">{label}</p>
        <p className="font-bold text-[#005EB8]">{payload[0].value}{suffix}</p>
      </div>
    );
  }
  return null;
};

function TrendCard({ title, data, dataKey, color, suffix, domain }) {
  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4">
      <p className="text-xs font-bold text-[#1A1F36] mb-3" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{title}</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval={1} />
          <YAxis domain={domain} tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive />
          <Tooltip content={<CustomTooltip suffix={suffix} />} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SustainabilityDashboard({ facilities = [], trendByDc = {}, loading = true, showLeaders = false }) {
  if (loading || facilities.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 h-40">
            <SkeletonBlock height="h-3" width="w-24" className="mb-4" />
            <SkeletonBlock height="h-24" width="w-full" />
          </div>
        ))}
      </div>
    );
  }

  const facilityIds = facilities.map(f => f.id);
  const trend = buildPortfolioEsgTrend(trendByDc, facilityIds);
  const energyMix = buildEnergyMix(facilities);
  const avgRenewable = Math.round(facilities.reduce((s, f) => s + f.renewablePct, 0) / facilities.length);
  const totalWaterMl = Math.round(facilities.reduce((s, f) => s + (f.waterUsageMlPerYear ?? 0), 0));
  const { top: topFacility, least: leastFacility } = showLeaders ? buildSustainabilityLeaders(facilities) : {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <TrendCard title="Average PUE Trend" data={trend} dataKey="pue" color="#005EB8" domain={[1, 1.3]} />
        <TrendCard title="Renewable Energy Trend (%)" data={trend} dataKey="renewablePct" color="#00B0A0" suffix="%" domain={[0, 100]} />
        <TrendCard title="Carbon Intensity Trend" data={trend} dataKey="carbonIntensity" color="#C8102E" suffix=" kg/MWh" />
        <TrendCard title="Water Usage Effectiveness" data={trend} dataKey="wue" color="#005EB8" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 flex items-center gap-4">
          <Leaf size={20} className="text-[#00B0A0] flex-shrink-0" />
          <div>
            <p className="text-[10px] text-[#9CA3AF]">Portfolio Renewable Mix</p>
            <p className="text-xl font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{avgRenewable}%</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 flex items-center gap-4">
          <Droplets size={20} className="text-[#005EB8] flex-shrink-0" />
          <div>
            <p className="text-[10px] text-[#9CA3AF]">Annual Water Usage (estimate)</p>
            <p className="text-xl font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{totalWaterMl.toLocaleString()} ML</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4">
          <p className="text-[10px] text-[#9CA3AF] mb-2">Energy Mix</p>
          <div className="flex items-center gap-3">
            <PieChart width={64} height={64}>
              <Pie data={energyMix} innerRadius={18} outerRadius={30} dataKey="value" strokeWidth={0}>
                {energyMix.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
            <div className="space-y-1">
              {energyMix.map(e => (
                <div key={e.name} className="flex items-center gap-1.5 text-[10px] text-[#6B7280]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />{e.name}: <span className="font-bold text-[#1A1F36]">{e.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showLeaders && topFacility && leastFacility && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-[#00B0A0]/20 shadow-sm p-4 flex items-center gap-3">
            <Trophy size={18} className="text-[#00B0A0] flex-shrink-0" />
            <div>
              <p className="text-[10px] text-[#9CA3AF]">Top Sustainable Facility</p>
              <p className="text-sm font-bold text-[#1A1F36]">{topFacility.name}</p>
              <p className="text-[10px] text-[#00B0A0] font-semibold">{topFacility.renewablePct}% renewable</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-[#E87722]/20 shadow-sm p-4 flex items-center gap-3">
            <TrendingDown size={18} className="text-[#E87722] flex-shrink-0" />
            <div>
              <p className="text-[10px] text-[#9CA3AF]">Least Sustainable Facility</p>
              <p className="text-sm font-bold text-[#1A1F36]">{leastFacility.name}</p>
              <p className="text-[10px] text-[#E87722] font-semibold">{leastFacility.renewablePct}% renewable</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
