/**
 * Pure aggregation functions over the facility dataset. No React, no
 * fetching — components/hooks call these to derive KPIs, region rollups,
 * and chart-ready series from the raw facility list.
 */

export function formatCompactNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function buildPortfolioKpis(facilities) {
  if (!facilities.length) return [];

  const countries = new Set(facilities.map(f => f.country)).size;
  const regions = new Set(facilities.map(f => f.region)).size;
  const totalCapacity = facilities.reduce((sum, f) => sum + f.capacityMw, 0);
  const totalServers = facilities.reduce((sum, f) => sum + (f.servers ?? 0), 0);
  const totalGpuClusters = facilities.reduce((sum, f) => sum + (f.gpuClusters ?? 0), 0);
  const avgUtilization = facilities.reduce((sum, f) => sum + (f.utilizationPct ?? 0), 0) / facilities.length;
  const avgPue = facilities.reduce((sum, f) => sum + f.pue, 0) / facilities.length;
  const avgRenewable = facilities.reduce((sum, f) => sum + f.renewablePct, 0) / facilities.length;
  const criticalSites = facilities.filter(f => f.health === 'critical').length;
  const maintenanceSites = facilities.filter(f => f.underMaintenance).length;
  const totalCarbon = facilities.reduce((sum, f) => sum + (f.carbonMt ?? 0), 0);

  return [
    { id: 'total-dcs', label: 'Total Data Centers', value: String(facilities.length) },
    { id: 'countries', label: 'Countries', value: String(countries) },
    { id: 'regions', label: 'Regions', value: String(regions) },
    { id: 'capacity', label: 'Est. Capacity', value: formatCompactNumber(totalCapacity), unit: 'MW', caption: 'Modelled estimate' },
    { id: 'servers', label: 'Est. Servers', value: formatCompactNumber(totalServers), caption: 'Modelled estimate' },
    { id: 'gpuClusters', label: 'Est. GPU Clusters', value: formatCompactNumber(totalGpuClusters), caption: 'Modelled estimate' },
    { id: 'utilization', label: 'Avg. Utilization', value: Math.round(avgUtilization).toString(), unit: '%' },
    { id: 'pue', label: 'Average PUE', value: avgPue.toFixed(2) },
    { id: 'renewable', label: 'Renewable Energy', value: Math.round(avgRenewable).toString(), unit: '%' },
    { id: 'critical', label: 'Critical Sites', value: String(criticalSites) },
    { id: 'maintenance', label: 'Under Maintenance', value: String(maintenanceSites) },
    { id: 'carbon', label: 'Est. Carbon Emissions', value: formatCompactNumber(totalCarbon), unit: 't/yr', caption: 'Modelled estimate' },
  ];
}

/**
 * Regional KPI strip — reuses buildPortfolioKpis (already generic over any
 * facility array) then drops the cards that don't make sense scoped to a
 * single region and reports carbon as a per-site average rather than a
 * portfolio total, per the Regional Intelligence KPI spec.
 */
export function buildRegionalKpis(facilities) {
  const base = buildPortfolioKpis(facilities);
  if (!facilities.length) return base;

  const avgCarbon = Math.round(facilities.reduce((s, f) => s + (f.carbonMt ?? 0), 0) / facilities.length);

  return base
    .filter(kpi => kpi.id !== 'regions')
    .map(kpi => kpi.id === 'carbon'
      ? { ...kpi, label: 'Avg. Carbon Emissions', value: formatCompactNumber(avgCarbon), caption: 'Modelled estimate, per site' }
      : kpi
    );
}

export function buildRegionRollups(facilities) {
  const byRegion = new Map();
  for (const f of facilities) {
    if (!byRegion.has(f.region)) byRegion.set(f.region, []);
    byRegion.get(f.region).push(f);
  }

  return Array.from(byRegion.entries()).map(([region, list]) => ({
    region,
    facilityCount: list.length,
    capacityMw: Math.round(list.reduce((s, f) => s + f.capacityMw, 0)),
    avgRenewablePct: Math.round(list.reduce((s, f) => s + f.renewablePct, 0) / list.length),
    avgPue: Math.round((list.reduce((s, f) => s + f.pue, 0) / list.length) * 100) / 100,
    avgUtilizationPct: Math.round(list.reduce((s, f) => s + (f.utilizationPct ?? 0), 0) / list.length),
    criticalCount: list.filter(f => f.health === 'critical').length,
  })).sort((a, b) => b.facilityCount - a.facilityCount);
}

export function buildRiskDistribution(facilities) {
  const counts = { Low: 0, Medium: 0, High: 0 };
  facilities.forEach(f => { counts[f.riskFlag] = (counts[f.riskFlag] ?? 0) + 1; });
  return [
    { name: 'Low', value: counts.Low, color: '#00B0A0' },
    { name: 'Medium', value: counts.Medium, color: '#E87722' },
    { name: 'High', value: counts.High, color: '#C8102E' },
  ];
}

export function topRegionsByCount(rollups, n = 3) {
  return [...rollups].sort((a, b) => b.facilityCount - a.facilityCount).slice(0, n);
}

export function highestCapacityRegions(rollups, n = 3) {
  return [...rollups].sort((a, b) => b.capacityMw - a.capacityMw).slice(0, n);
}

export function lowestCarbonRegions(facilities, n = 3) {
  const byRegion = new Map();
  for (const f of facilities) {
    if (!byRegion.has(f.region)) byRegion.set(f.region, { carbon: 0, count: 0 });
    const r = byRegion.get(f.region);
    r.carbon += f.carbonMt;
    r.count += 1;
  }
  return Array.from(byRegion.entries())
    .map(([region, { carbon, count }]) => ({ region, avgCarbonMt: Math.round((carbon / count) * 10) / 10 }))
    .sort((a, b) => a.avgCarbonMt - b.avgCarbonMt)
    .slice(0, n);
}

export function buildHealthDistribution(facilities) {
  const counts = { healthy: 0, warning: 0, critical: 0 };
  facilities.forEach(f => { counts[f.health] = (counts[f.health] ?? 0) + 1; });
  return [
    { name: 'Healthy', value: counts.healthy, color: '#00B0A0' },
    { name: 'Warning', value: counts.warning, color: '#E87722' },
    { name: 'Critical', value: counts.critical, color: '#C8102E' },
  ];
}

export function buildUtilizationByRegion(rollups) {
  return rollups.map(r => ({ name: r.region, value: r.avgUtilizationPct }));
}

/** Generic top/bottom-N facility ranker, reused by every "Top N" chart. */
export function rankFacilities(facilities, { metric, direction = 'desc', n = 10 }) {
  return [...facilities]
    .filter(f => f[metric] != null)
    .sort((a, b) => direction === 'desc' ? b[metric] - a[metric] : a[metric] - b[metric])
    .slice(0, n)
    .map(f => ({ id: f.id, name: f.name, region: f.region, value: f[metric] }));
}

/**
 * Averages each facility's monthly ESG trend into one portfolio-wide trend
 * line per month — input is { [dataCenterId]: EsgMonthlyRecord[] } from
 * useEsgPortfolio, scoped to whichever facilities are currently filtered.
 */
export function buildPortfolioEsgTrend(trendByDc, facilityIds) {
  const monthMap = new Map();
  for (const id of facilityIds) {
    const trend = trendByDc[id];
    if (!trend) continue;
    for (const rec of trend) {
      if (!monthMap.has(rec.month)) monthMap.set(rec.month, { month: rec.month, renewable: [], pue: [], carbon: [], wue: [] });
      const bucket = monthMap.get(rec.month);
      bucket.renewable.push(rec.renewablePct);
      bucket.pue.push(rec.pue);
      bucket.carbon.push(rec.carbonIntensityKgPerMwh);
      bucket.wue.push(rec.wue);
    }
  }
  const avg = (arr) => Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100;
  return Array.from(monthMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(b => ({ month: b.month, renewablePct: avg(b.renewable), pue: avg(b.pue), carbonIntensity: avg(b.carbon), wue: avg(b.wue) }));
}

export const RISK_CATEGORIES = ['Weather', 'Grid Stability', 'Cyber', 'Flood', 'Earthquake', 'Political', 'Supply Chain'];

/**
 * Builds a region x category average-risk-score matrix for the heatmap,
 * from { [dataCenterId]: RiskRecord[] } scoped to the current facility set.
 */
export function buildRiskHeatmap(facilities, risksByDc) {
  const regions = Array.from(new Set(facilities.map(f => f.region)));
  const cellFor = (region, category) => {
    const scores = facilities
      .filter(f => f.region === region)
      .flatMap(f => (risksByDc[f.id] ?? []).filter(r => r.category === category).map(r => r.score));
    if (!scores.length) return null;
    return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  };
  return regions.map(region => ({
    region,
    cells: RISK_CATEGORIES.map(category => ({ category, score: cellFor(region, category) })),
  }));
}

export function buildRiskCategorySummary(facilities, risksByDc) {
  return RISK_CATEGORIES.map(category => {
    const scores = facilities.flatMap(f => (risksByDc[f.id] ?? []).filter(r => r.category === category).map(r => r.score));
    const avgScore = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
    const level = avgScore >= 55 ? 'High' : avgScore >= 30 ? 'Medium' : 'Low';
    return { category, avgScore, level };
  });
}

/**
 * Cumulative facility count by commission year — a real "growth trend"
 * derived from each facility's actual identity.commissionedYear (carried
 * through onto the adapted facility as commissionedYear), rather than
 * fabricated time-series data.
 */
export function buildGrowthTrend(facilities) {
  const byYear = new Map();
  for (const f of facilities) {
    if (!f.commissionedYear) continue;
    byYear.set(f.commissionedYear, (byYear.get(f.commissionedYear) ?? 0) + 1);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  let cumulative = 0;
  return years.map(year => {
    cumulative += byYear.get(year);
    return { year: String(year), facilities: cumulative };
  });
}

/** Single best/worst facility by renewable %, for the ESG "leaders" callouts. */
export function buildSustainabilityLeaders(facilities) {
  if (!facilities.length) return { top: null, least: null };
  const sorted = [...facilities].sort((a, b) => b.renewablePct - a.renewablePct);
  return { top: sorted[0], least: sorted[sorted.length - 1] };
}

export function buildEnergyMix(facilities) {
  const avgRenewable = Math.round(facilities.reduce((s, f) => s + f.renewablePct, 0) / facilities.length);
  return [
    { name: 'Renewable', value: avgRenewable, color: '#00B0A0' },
    { name: 'Grid mix', value: 100 - avgRenewable, color: '#9CA3AF' },
  ];
}

export function buildFacilityAiSummary(facility) {
  const riskPhrase = facility.riskFlag === 'High'
    ? 'carries elevated risk and warrants close monitoring'
    : facility.riskFlag === 'Medium'
      ? 'shows moderate risk, within normal operating variance'
      : 'is operating within a low-risk profile';

  const buildPhrase = facility.status === 'Under Construction'
    ? 'currently under construction and not yet contributing capacity'
    : `online at an estimated ${facility.utilizationPct}% utilization`;

  return `${facility.name} ${riskPhrase}. The site is ${buildPhrase}, with a PUE of ${facility.pue} and ${facility.renewablePct}% renewable energy mix — ${
    facility.renewablePct >= 70 ? 'a strong sustainability position' : 'room to improve against portfolio leaders'
  }.`;
}

export function buildAiInsights(facilities, rollups) {
  if (!facilities.length) return [];

  const critical = facilities.filter(f => f.health === 'critical');
  const topRenewable = [...rollups].sort((a, b) => b.avgRenewablePct - a.avgRenewablePct)[0];
  const tightestPue = [...facilities].sort((a, b) => a.pue - b.pue)[0];
  const underConstruction = facilities.filter(f => f.status === 'Under Construction').length;

  const insights = [];

  if (critical.length) {
    insights.push({
      id: 'risk-concentration',
      title: `${critical.length} sites flagged critical risk`,
      description: `${critical.slice(0, 3).map(f => f.name).join(', ')}${critical.length > 3 ? ' and others' : ''} are running elevated alarm counts. Recommend prioritizing review in the next portfolio risk cycle.`,
      category: 'risk',
      confidence: 82,
    });
  }

  if (topRenewable) {
    insights.push({
      id: 'sustainability-leader',
      title: `${topRenewable.region} leads on renewable mix`,
      description: `Facilities in ${topRenewable.region} average ${topRenewable.avgRenewablePct}% renewable energy — the strongest regional sustainability profile in the portfolio.`,
      category: 'opportunity',
      confidence: 76,
    });
  }

  if (underConstruction) {
    insights.push({
      id: 'expansion-trend',
      title: `${underConstruction} campuses under construction`,
      description: `Active build-out across the portfolio signals continued capacity expansion. ${tightestPue ? `${tightestPue.name} currently holds the tightest PUE at ${tightestPue.pue}.` : ''}`,
      category: 'trend',
      confidence: 70,
    });
  }

  return insights;
}
