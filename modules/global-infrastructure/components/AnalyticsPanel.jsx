'use client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { SkeletonBlock } from './Skeleton';
import TopFacilitiesList from './TopFacilitiesList';
import { ChartCard, CustomTooltip } from './ChartPrimitives';
import {
  buildRiskDistribution,
  buildHealthDistribution,
  buildUtilizationByRegion,
  rankFacilities,
} from '../utils/portfolioAnalytics';

const REGION_COLORS = { Americas: '#005EB8', EMEA: '#00338D', APAC: '#00B0A0', MiddleEast: '#E87722' };

export default function AnalyticsPanel({ facilities = [], regionRollups = [], loading = true, onHoverFacility }) {
  if (loading || facilities.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 h-48">
            <SkeletonBlock height="h-3" width="w-24" className="mb-4" />
            <SkeletonBlock height="h-32" width="w-full" />
          </div>
        ))}
      </div>
    );
  }

  const regionalDistribution = regionRollups.map(r => ({ name: r.region, value: r.facilityCount, color: REGION_COLORS[r.region] ?? '#9CA3AF' }));
  const capacityByRegion = regionRollups.map(r => ({ name: r.region, value: r.capacityMw }));
  const facilitiesByRegion = regionRollups.map(r => ({ name: r.region, value: r.facilityCount }));
  const utilizationByRegion = buildUtilizationByRegion(regionRollups);
  const healthDistribution = buildHealthDistribution(facilities);
  const riskDistribution = buildRiskDistribution(facilities);

  const topLargest = rankFacilities(facilities, { metric: 'capacityMw', n: 10 });
  const topRenewable = rankFacilities(facilities, { metric: 'renewablePct', n: 10 });
  const topCapacityConsumers = rankFacilities(
    facilities.map(f => ({ ...f, drawMw: Math.round(f.capacityMw * (f.utilizationPct / 100)) })),
    { metric: 'drawMw', n: 10 }
  );
  const lowestPue = rankFacilities(facilities, { metric: 'pue', direction: 'asc', n: 10 });
  const highestCarbon = rankFacilities(facilities, { metric: 'carbonMt', n: 10 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <ChartCard title="Regional Distribution">
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={regionalDistribution} innerRadius={32} outerRadius={55} dataKey="value" strokeWidth={0}>
                {regionalDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {regionalDistribution.map(r => (
              <span key={r.name} className="flex items-center gap-1 text-[10px] text-[#6B7280]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />{r.name}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Capacity by Region (MW)">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={capacityByRegion} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Bar dataKey="value" fill="#005EB8" radius={[3, 3, 0, 0]} />
              <Tooltip content={<CustomTooltip suffix=" MW" />} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Facilities by Region">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={facilitiesByRegion} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Bar dataKey="value" fill="#00338D" radius={[3, 3, 0, 0]} />
              <Tooltip content={<CustomTooltip />} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Average Utilization (%)">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={utilizationByRegion} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Bar dataKey="value" fill="#005EB8" radius={[3, 3, 0, 0]} />
              <Tooltip content={<CustomTooltip suffix="%" />} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Health Distribution">
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <TopFacilitiesList title="Top 10 Largest Facilities" rows={topLargest} unit=" MW" onHoverFacility={onHoverFacility} />
        <TopFacilitiesList title="Top Renewable Facilities" rows={topRenewable} unit="%" onHoverFacility={onHoverFacility} />
        <TopFacilitiesList title="Top Capacity Consumers" rows={topCapacityConsumers} unit=" MW" onHoverFacility={onHoverFacility} />
        <TopFacilitiesList title="Lowest PUE" rows={lowestPue} unit="" onHoverFacility={onHoverFacility} />
        <TopFacilitiesList title="Highest Carbon Sites" rows={highestCarbon} unit=" t/yr" onHoverFacility={onHoverFacility} />
      </div>
    </div>
  );
}
