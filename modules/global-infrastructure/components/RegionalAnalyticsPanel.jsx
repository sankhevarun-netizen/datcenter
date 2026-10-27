'use client';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { SkeletonBlock } from './Skeleton';
import TopFacilitiesList from './TopFacilitiesList';
import { ChartCard, CustomTooltip } from './ChartPrimitives';
import { capacityBandOf } from '../utils/facilityFilters';
import {
  buildHealthDistribution,
  buildRiskDistribution,
  buildGrowthTrend,
  rankFacilities,
} from '../utils/portfolioAnalytics';

const BAND_LABELS = { low: '< 80 MW', mid: '80–149 MW', high: '150 MW+' };

/** Regional counterpart to AnalyticsPanel — same ChartCard/Tooltip/Recharts language, framed per-facility instead of per-region since there's only one region in view. */
export default function RegionalAnalyticsPanel({ facilities = [], loading = true, onHoverFacility }) {
  if (loading || facilities.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 h-48">
            <SkeletonBlock height="h-3" width="w-24" className="mb-4" />
            <SkeletonBlock height="h-32" width="w-full" />
          </div>
        ))}
      </div>
    );
  }

  const capacityDistribution = ['low', 'mid', 'high'].map(band => ({
    name: BAND_LABELS[band],
    value: facilities.filter(f => capacityBandOf(f.capacityMw) === band).length,
  }));
  const healthDistribution = buildHealthDistribution(facilities);
  const riskDistribution = buildRiskDistribution(facilities);
  const utilizationByFacility = facilities.map(f => ({ name: f.city, value: f.utilizationPct }));
  const carbonByFacility = facilities.map(f => ({ name: f.city, value: f.carbonMt }));
  const growthTrend = buildGrowthTrend(facilities);

  const renewableRanked = rankFacilities(facilities, { metric: 'renewablePct', n: facilities.length });
  const pueRanked = rankFacilities(facilities, { metric: 'pue', direction: 'asc', n: facilities.length });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <ChartCard title="Capacity Distribution">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={capacityDistribution} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Bar dataKey="value" fill="#005EB8" radius={[3, 3, 0, 0]} />
              <Tooltip content={<CustomTooltip />} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Facility Health">
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={healthDistribution} innerRadius={32} outerRadius={55} dataKey="value" strokeWidth={0}>
                {healthDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {healthDistribution.map(r => (
              <span key={r.name} className="flex items-center gap-1 text-[10px] text-[#6B7280]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />{r.name}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Risk Distribution">
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={riskDistribution} innerRadius={32} outerRadius={55} dataKey="value" strokeWidth={0}>
                {riskDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {riskDistribution.map(r => (
              <span key={r.name} className="flex items-center gap-1 text-[10px] text-[#6B7280]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />{r.name}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Utilization by Facility (%)">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={utilizationByFacility} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Bar dataKey="value" fill="#005EB8" radius={[3, 3, 0, 0]} />
              <Tooltip content={<CustomTooltip suffix="%" />} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Growth Trend (Facilities Online)">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={growthTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="year" tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Line type="monotone" dataKey="facilities" stroke="#00338D" strokeWidth={2} dot={{ r: 2 }} />
              <Tooltip content={<CustomTooltip />} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Carbon Distribution (t/yr)">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={carbonByFacility} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Bar dataKey="value" fill="#C8102E" radius={[3, 3, 0, 0]} />
              <Tooltip content={<CustomTooltip suffix=" t/yr" />} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TopFacilitiesList title="Renewable % by Facility" rows={renewableRanked} unit="%" onHoverFacility={onHoverFacility} />
        <TopFacilitiesList title="Average PUE by Facility" rows={pueRanked} unit="" onHoverFacility={onHoverFacility} />
      </div>
    </div>
  );
}
