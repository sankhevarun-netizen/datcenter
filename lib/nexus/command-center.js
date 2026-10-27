// lib/nexus/command-center.js
//
// The command centre's view model: every tile, chart and list on the page,
// computed from the dataset through the shared engines. Widgets receive these
// as props and keep no figures of their own.
import { nexus, index, getFacility, componentTypeOf } from './data.js';
import { portfolioSummary } from './portfolio.js';
import { analyseIncident, incidentQueue } from './incident-engine.js';
import { riskWatchlist } from './predictive-engine.js';
import { cohortFor } from './benchmark-engine.js';
import { AS_OF, AS_OF_DATE, toMinutes, daysBetween, monthLabel } from './time.js';
import { fmtNumber, fmtUpTo, fmtLakh } from './format.js';

const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;
const sum = (xs, fn) => xs.reduce((s, x) => s + fn(x), 0);

export const REGIONS = [
  { name: 'West', facilities: ['MUM-1', 'MUM-2'] },
  { name: 'South', facilities: ['CHN-1', 'HYD-1', 'BLR-1'] },
  { name: 'North', facilities: ['NCR-1'] },
];

/** "5 h 34 min ago" style age from the dataset's now. */
export function ageLabel(ts) {
  const min = Math.max(0, toMinutes(AS_OF) - toMinutes(ts));
  if (min === 0) return 'now';
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${Math.floor(min / 1440)} d`;
}

function trendOf(first, last, { better }) {
  const diff = last - first;
  if (Math.abs(diff) < 1e-9) return { trend: 'flat', positive: true };
  const up = diff > 0;
  return { trend: up ? 'up' : 'down', positive: better === 'higher' ? up : !up };
}

// ── KPIs ────────────────────────────────────────────────────────────────────
function kpis(p) {
  const t = p.totals;
  const live = p.facilities.filter((f) => f.operational);
  const months = p.trend.slice(-12);
  const uptimeByMonth = months.map((m) => {
    const rows = nexus.timeseries.filter((x) => x.month === m.month);
    return round(sum(rows, (x) => x.uptime_pct) / rows.length, 3);
  });
  const energyMonths = [...new Set(nexus.energy.map((e) => e.month))].sort();
  const renewableByMonth = energyMonths.map((m) => {
    const rows = nexus.energy.filter((e) => e.month === m);
    return round((sum(rows, (e) => e.renewable_kwh) / sum(rows, (e) => e.total_kwh)) * 100, 1);
  });
  const emissionsByMonth = energyMonths.map((m) => round(sum(nexus.energy.filter((e) => e.month === m), (e) => e.emissions_tco2), 1));
  const drifting = riskWatchlist().filter((r) => r.kind === 'efficiency-drift');
  const tightest = live.filter((f) => f.grid).sort((a, b) => b.grid.utilisedPct - a.grid.utilisedPct)[0];
  const pueTrend = trendOf(months[0].pue, months.at(-1).pue, { better: 'lower' });
  const itTrend = trendOf(months[0].itLoadKw, months.at(-1).itLoadKw, { better: 'higher' });

  return [
    {
      id: 'pue', title: 'Portfolio PUE', value: fmtUpTo(t.pue, 3), unit: '',
      ...{ trend: pueTrend.trend, trendIsPositive: pueTrend.positive },
      trendValue: `${months.at(-1).pue - months[0].pue >= 0 ? '+' : ''}${fmtUpTo(months.at(-1).pue - months[0].pue, 3)}`,
      comparisonLabel: `vs ${monthLabel(months[0].month, true)}`,
      status: drifting.length ? 'warning' : 'healthy',
      sparklineData: months.map((m) => m.pue),
    },
    {
      id: 'it', title: 'IT load', value: fmtUpTo(t.itLoadKw / 1000, 1), unit: 'MW',
      trend: itTrend.trend, trendIsPositive: itTrend.positive,
      trendValue: `${fmtUpTo(((months.at(-1).itLoadKw - months[0].itLoadKw) / months[0].itLoadKw) * 100, 1)}%`,
      comparisonLabel: `vs ${monthLabel(months[0].month, true)}`,
      status: 'healthy',
      sparklineData: months.map((m) => m.itLoadKw),
    },
    {
      id: 'util', title: 'Utilisation', value: fmtUpTo(t.utilisationPct, 1), unit: '%',
      trend: 'flat', trendIsPositive: true, trendValue: `${fmtNumber(t.usedKw / 1000, 1)} MW`,
      comparisonLabel: `of ${fmtNumber(t.operationalDesignKw / 1000, 1)} MW live`,
      status: 'healthy',
      // Monthly IT load over operating design capacity.
      sparklineData: months.map((m) => round((m.itLoadKw / t.operationalDesignKw) * 100, 1)),
    },
    {
      id: 'avail', title: 'Availability', value: fmtUpTo(t.availability12mPct, 3), unit: '%',
      trend: 'flat', trendIsPositive: true, trendValue: `${t.incidents12m} incid.`,
      comparisonLabel: '12-month mean',
      status: 'healthy',
      sparklineData: uptimeByMonth,
    },
    {
      id: 'renewable', title: 'Renewable share', value: fmtUpTo(t.renewablePct, 1), unit: '%',
      trend: 'flat', trendIsPositive: true, trendValue: monthLabel(p.month, true),
      comparisonLabel: `peer median ${cohortFor('Renewable share (%)', 'Tier III').p50_median}%`,
      status: t.renewablePct >= cohortFor('Renewable share (%)', 'Tier III').p50_median ? 'healthy' : 'warning',
      sparklineData: renewableByMonth,
    },
    {
      id: 'alerts', title: 'Open alerts', value: String(t.alerts), unit: '',
      trend: 'flat', trendIsPositive: t.alertCounts.critical === 0,
      trendValue: `${t.alertCounts.critical} critical`,
      comparisonLabel: `${t.alertCounts.high} high`,
      status: t.alertCounts.critical ? 'critical' : t.alertCounts.high ? 'warning' : 'healthy',
      sparklineData: [t.alertCounts.low, t.alertCounts.medium, t.alertCounts.high, t.alertCounts.critical],
    },
    {
      id: 'grid', title: 'Grid headroom', value: fmtUpTo(t.gridHeadroomKw / 1000, 1), unit: 'MW',
      trend: 'flat', trendIsPositive: tightest.grid.utilisedPct < 90,
      trendValue: `${tightest.id} ${tightest.grid.utilisedPct}%`,
      comparisonLabel: 'of sanctioned',
      status: tightest.grid.utilisedPct >= 95 ? 'critical' : tightest.grid.utilisedPct >= 90 ? 'warning' : 'healthy',
      sparklineData: live.map((f) => f.grid.headroomKw),
    },
    {
      id: 'emissions', title: 'Scope 2 emissions', value: fmtNumber(t.emissionsTco2), unit: 'tCO₂',
      trend: trendOf(emissionsByMonth[0], emissionsByMonth.at(-1), { better: 'lower' }).trend,
      trendIsPositive: trendOf(emissionsByMonth[0], emissionsByMonth.at(-1), { better: 'lower' }).positive,
      trendValue: monthLabel(p.month, true), comparisonLabel: 'this month',
      status: 'healthy',
      sparklineData: emissionsByMonth,
    },
  ];
}

// ── portfolio map ───────────────────────────────────────────────────────────
function regions(p) {
  return REGIONS.map((r) => ({
    name: r.name,
    facilities: r.facilities.map((id) => p.facilities.find((f) => f.id === id)),
  }));
}

// ── incidents ───────────────────────────────────────────────────────────────
function incidents() {
  return incidentQueue().map((a) => {
    const x = analyseIncident({ alertId: a.alert_id });
    return {
      id: a.alert_id,
      severity: a.severity,
      status: a.status,
      title: a.message,
      facilityId: a.facility_id,
      site: getFacility(a.facility_id).name,
      componentId: a.component_id,
      age: ageLabel(a.raised_at),
      owner: a.owner_team,
      impact: x.impact,
      failureMode: x.why.failureMode,
      pattern: x.why.pattern.length ? `${x.why.rootCause?.split(' - ')[0]} — ${x.why.pattern.length} recorded ${x.why.pattern.length === 1 ? 'incident' : 'incidents'} across ${x.why.sites.length} ${x.why.sites.length === 1 ? 'site' : 'sites'}` : null,
      protection: x.who.protection?.detail ?? null,
      tenants: x.who.tenants.length,
      exposureInrLakh: x.who.totalExposureInrLakh,
      firstAction: x.do.steps[0] ? `${x.do.steps[0].action} (${x.do.steps[0].owner})` : null,
    };
  });
}

// ── infrastructure (component-level data exists for MUM-1) ──────────────────
const SYSTEMS = [
  { system: 'UPS', icon: 'Zap', types: ['ups'] },
  { system: 'Generators', icon: 'Flame', types: ['generator'] },
  { system: 'Transformers & switchgear', icon: 'Zap', types: ['transformer', 'switchgear', 'utility_feed'] },
  { system: 'Power distribution', icon: 'Network', types: ['rpp', 'busway', 'pdu'] },
  { system: 'Chilled-water plant', icon: 'Droplets', types: ['chiller', 'cooling_tower', 'chw_loop'] },
  { system: 'CRAH units', icon: 'Thermometer', types: ['crah'] },
];

function infrastructure(facilityId) {
  const comps = nexus.components.filter((c) => c.facility_id === facilityId);
  const alerts = (index.alertsByFacility.get(facilityId) ?? []).filter((a) => a.status !== 'resolved');
  const latest = new Map();
  for (const m of nexus.maintenance.filter((x) => x.facility_id === facilityId)) {
    const prev = latest.get(m.component_id);
    if (!prev || m.service_date > prev.service_date) latest.set(m.component_id, m);
  }
  return SYSTEMS.map((s) => {
    const list = comps.filter((c) => s.types.includes(c.component_type));
    const flagged = new Set([
      ...alerts.filter((a) => s.types.includes(componentTypeOf(a.component_id)) && a.severity !== 'low').map((a) => a.component_id),
      ...list.filter((c) => latest.get(c.component_id)?.outcome === 'Advisory raised').map((c) => c.component_id),
    ]);
    const metered = list.filter((c) => c.utilisation_pct > 0);
    const peak = metered.length ? metered.reduce((a, b) => (b.utilisation_pct > a.utilisation_pct ? b : a)) : null;
    const modes = [...new Set(list.map((c) => c.redundancy))];
    const risk = alerts.some((a) => flagged.has(a.component_id) && (a.severity === 'critical' || a.severity === 'high')) ? 'High'
      : flagged.size ? 'Medium' : 'Low';
    return {
      system: s.system,
      icon: s.icon,
      total: list.length,
      degraded: flagged.size,
      flagged: [...flagged],
      healthPct: list.length ? round(((list.length - flagged.size) / list.length) * 100, 1) : 100,
      peak: peak && { componentId: peak.component_id, utilisationPct: peak.utilisation_pct },
      redundancy: modes.join(' / '),
      failureRisk: risk,
    };
  });
}

// ── capacity ────────────────────────────────────────────────────────────────
function capacity(p) {
  const live = p.facilities.filter((f) => f.operational);
  const halls = index.hallsByFacility.get('MUM-1') ?? [];
  const coolingUsed = sum(halls, (h) => h.used_kw);
  const coolingCap = sum(halls, (h) => h.cooling_capacity_kw);
  return {
    usedKw: p.totals.usedKw,
    designKw: p.totals.operationalDesignKw,
    pipelineKw: p.totals.designKw - p.totals.operationalDesignKw,
    byFacility: live.map((f) => ({ id: f.id, name: f.name.replace('Nexus ', ''), usedKw: f.usedKw, designKw: f.designKw, utilisationPct: f.utilisationPct })),
    cooling: { facilityId: 'MUM-1', usedKw: coolingUsed, capacityKw: coolingCap, loadPct: round((coolingUsed / coolingCap) * 100, 1) },
    grid: live.map((f) => ({ id: f.id, name: f.name.replace('Nexus ', ''), headroomKw: f.grid.headroomKw, utilisedPct: f.grid.utilisedPct, note: f.grid.note })),
  };
}

// ── sustainability ──────────────────────────────────────────────────────────
function sustainability(p) {
  const month = p.month;
  const energy = nexus.energy.filter((e) => e.month === month);
  const water = nexus.water.filter((w) => w.month === month);
  const first = [...new Set(nexus.energy.map((e) => e.month))].sort()[0];
  const energyFirst = nexus.energy.filter((e) => e.month === first);
  const intensity = (rows) => (sum(rows, (e) => e.emissions_tco2) / sum(rows, (e) => e.total_kwh)) * 1000;
  const itKwh = sum(water, (w) => w.total_litres / w.measured_wue_l_per_kwh);
  const total = sum(energy, (e) => e.total_kwh);
  const renewable = sum(energy, (e) => e.renewable_kwh);
  return {
    pueTrend: p.trend.slice(-12).map((m) => ({ month: monthLabel(m.month, true), pue: m.pue })),
    peerMedianPue: cohortFor('PUE', 'Tier III').p50_median,
    carbonIntensity: { value: round(intensity(energy), 3), since: monthLabel(first, true), changePct: round(((intensity(energy) - intensity(energyFirst)) / intensity(energyFirst)) * 100, 1) },
    wue: { value: round(sum(water, (w) => w.total_litres) / itKwh, 2), peerMedian: cohortFor('WUE (L/kWh)', 'Tier III').p50_median },
    renewable: { pct: round((renewable / total) * 100, 1), renewableMwh: round(renewable / 1000), gridMwh: round((total - renewable) / 1000), month: monthLabel(month) },
  };
}

// ── side panel ──────────────────────────────────────────────────────────────
function upcomingMaintenance(days = 45) {
  const latest = new Map();
  for (const m of nexus.maintenance) {
    const prev = latest.get(m.component_id);
    if (!prev || m.service_date > prev.service_date) latest.set(m.component_id, m);
  }
  return [...latest.values()]
    .map((m) => ({ ...m, inDays: daysBetween(AS_OF_DATE, m.next_due) }))
    .filter((m) => m.inDays >= 0 && m.inDays <= days)
    .sort((a, b) => a.next_due.localeCompare(b.next_due))
    .map((m) => ({ id: m.maintenance_id, site: getFacility(m.facility_id).name, componentId: m.component_id, task: m.service_type, due: m.next_due, inDays: m.inDays }));
}

/** Every contract, with the largest exposure any open outage alert puts on it. */
export function tenantSla() {
  const exposures = new Map();
  for (const a of incidentQueue()) {
    const x = analyseIncident({ alertId: a.alert_id });
    if (x.who.totalExposureInrLakh === null) continue;
    for (const t of x.who.tenants) {
      const cur = exposures.get(t.tenantId);
      if (t.exposureInrLakh !== null && (!cur || t.exposureInrLakh > cur.exposureInrLakh)) {
        exposures.set(t.tenantId, { exposureInrLakh: t.exposureInrLakh, alertId: a.alert_id, componentId: a.component_id, alerts: [...(cur?.alerts ?? []), a.alert_id] });
      } else if (cur) cur.alerts.push(a.alert_id);
    }
  }
  return nexus.contracts.map((c) => {
    const e = exposures.get(c.tenant_id);
    const tenant = index.tenantById.get(c.tenant_id);
    return {
      contractId: c.contract_id,
      tenantId: c.tenant_id,
      name: c.tenant_name,
      facilityId: c.facility_id,
      workload: tenant?.workload_type,
      contractedKw: tenant?.contracted_kw,
      slaUptimePct: c.sla_uptime_pct,
      allowedDowntimeMinPerYear: round((1 - c.sla_uptime_pct / 100) * 8760 * 60),
      penaltyInrLakh: c.penalty_inr_lakh,
      thresholdHours: c.penalty_threshold_hours,
      exposureInrLakh: e?.exposureInrLakh ?? 0,
      worstAlert: e?.alertId ?? null,
      openOutageAlerts: e ? [...new Set(e.alerts)].length : 0,
    };
  }).sort((a, b) => b.exposureInrLakh - a.exposureInrLakh || a.contractId.localeCompare(b.contractId));
}

/** One line per site with any hazard at 4 or 5 of 5; the reference event is per site. */
function siteHazards() {
  const HAZARDS = [['cyclone_exposure', 'Cyclone'], ['flood_exposure', 'Flood'], ['heat_exposure', 'Heat']];
  return nexus.siteRisk
    .map((s) => {
      const high = HAZARDS.filter(([k]) => s[k] >= 4);
      if (!high.length) return null;
      const worst = Math.max(...high.map(([k]) => s[k]));
      return {
        id: s.facility_id,
        site: getFacility(s.facility_id).name,
        type: high.map(([k, label]) => `${label} ${s[k]}/5`).join(' · '),
        severity: worst >= 5 ? 'critical' : 'warning',
        worst,
        description: s.reference_event,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.worst - a.worst || a.id.localeCompare(b.id));
}

function summaryText(p, queue, risks) {
  const critical = queue.filter((a) => a.severity === 'critical');
  const silent = risks.filter((r) => r.kind === 'component' && r.impact === 'outage' && !r.alert);
  const drift = risks.filter((r) => r.kind === 'efficiency-drift');
  const parts = [
    `${p.totals.operational} of ${p.totals.facilities} sites operating at a portfolio PUE of ${fmtUpTo(p.totals.pue, 3)} and ${fmtUpTo(p.totals.availability12mPct, 3)}% availability over 12 months.`,
  ];
  for (const a of critical) parts.push(`${getFacility(a.facility_id).name} is critical: ${a.message.toLowerCase()}.`);
  for (const r of silent) parts.push(`${r.componentId} at ${getFacility(r.facilityId).name} shares the battery fault behind ${r.pattern.length} recorded incidents and has not alarmed yet.`);
  for (const r of drift) parts.push(`${getFacility(r.facilityId).name} PUE has drifted above last year since ${monthLabel(r.drift.from)}, costing ${fmtLakh(r.cost.extraCostInrLakh)} so far.`);
  return parts.join(' ');
}

export function commandCenterModel() {
  const p = portfolioSummary();
  const queue = incidentQueue();
  const risks = riskWatchlist();
  return {
    asOf: AS_OF,
    kpis: kpis(p),
    regions: regions(p),
    totals: p.totals,
    incidents: incidents(),
    infrastructure: { facilityId: 'MUM-1', facilityName: getFacility('MUM-1').name, systems: infrastructure('MUM-1') },
    capacity: capacity(p),
    sustainability: sustainability(p),
    risks,
    tenants: tenantSla(),
    context: {
      alerts: queue.slice(0, 5).map((a) => ({ id: a.alert_id, severity: a.severity, label: `${getFacility(a.facility_id).name}: ${a.message}`, time: ageLabel(a.raised_at) })),
      escalations: queue.filter((a) => a.status === 'escalated').map((a) => ({ id: a.alert_id, label: `${a.alert_id} · ${getFacility(a.facility_id).name}: ${a.note ?? a.message}`, time: ageLabel(a.raised_at) })),
      maintenance: upcomingMaintenance(),
      hazards: siteHazards(),
      summary: summaryText(p, queue, risks),
    },
  };
}
