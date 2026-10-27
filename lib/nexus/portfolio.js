// lib/nexus/portfolio.js
//
// One rollup per facility, and one for the portfolio, built only from the
// dataset. Every dashboard (command centre, global map, briefing export) reads
// these instead of keeping its own figures, so the same number is the same
// everywhere it appears.
import { nexus, index, getFacility } from './data.js';
import { AS_OF, AS_OF_MONTH, daysBetween } from './time.js';

/** Alert severities, most severe first, and the health status each implies. */
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const HEALTH_BY_SEVERITY = { critical: 'critical', high: 'serious', medium: 'warning', low: 'good' };
export const HEALTH_ORDER = ['critical', 'serious', 'warning', 'good', 'commissioning'];

const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;
const sum = (list, fn) => list.reduce((s, x) => s + fn(x), 0);

const isOpen = (alert) => alert.status !== 'resolved';

function health(operational, alerts, latest) {
  if (!operational) return 'commissioning';
  const worst = SEVERITIES.find((s) => alerts.some((a) => a.severity === s));
  const fromAlerts = worst ? HEALTH_BY_SEVERITY[worst] : 'good';
  if (fromAlerts === 'good' && latest?.flag) return 'warning';
  return fromAlerts;
}

export function facilitySummary(facilityId) {
  const f = getFacility(facilityId);
  const operational = f.status === 'Operational';
  const months = index.timeseriesByFacility.get(facilityId) ?? [];
  const last12 = months.slice(-12);
  const latest = months.at(-1) ?? null;
  const energy = (index.energyByFacility.get(facilityId) ?? []).at(-1) ?? null;
  const water = (index.waterByFacility.get(facilityId) ?? []).at(-1) ?? null;
  const g = index.gridByFacility.get(facilityId);
  const alerts = (index.alertsByFacility.get(facilityId) ?? []).filter(isOpen);
  const incidents12m = (index.incidentsByFacility.get(facilityId) ?? [])
    .filter((i) => daysBetween(i.detected_at.slice(0, 10), AS_OF.slice(0, 10)) <= 365);
  const tenants = nexus.tenants.filter((t) => t.facility_id === facilityId);

  return {
    id: f.facility_id,
    name: f.name,
    city: f.city,
    state: f.state,
    lat: f.lat,
    lon: f.lon,
    tier: f.tier,
    status: f.status,
    operational,
    commissioned: f.commissioned,
    designKw: f.design_it_kw,
    usedKw: f.used_it_kw,
    utilisationPct: f.utilisation_pct,
    halls: f.halls,
    racks: f.racks,
    reportedPue: f.pue,
    reportedWue: f.wue_l_per_kwh,
    renewablePct: f.renewable_pct,
    latest: latest && {
      month: latest.month,
      pue: latest.pue,
      wue: latest.wue_l_per_kwh,
      itLoadKw: latest.it_load_kw,
      facilityLoadKw: latest.facility_load_kw,
      uptimePct: latest.uptime_pct,
      flag: latest.flag,
    },
    availability12mPct: last12.length ? round(sum(last12, (t) => t.uptime_pct) / last12.length, 3) : null,
    energy: energy && {
      month: energy.month,
      totalKwh: energy.total_kwh,
      renewableKwh: energy.renewable_kwh,
      costInrLakh: energy.cost_inr_lakh,
      emissionsTco2: energy.emissions_tco2,
    },
    water: water && {
      month: water.month,
      wue: water.measured_wue_l_per_kwh,
      totalLitres: water.total_litres,
      stressIndex: water.stress_index,
      localStress: water.local_water_stress,
      peakDemandLpm: water.peak_demand_lpm,
    },
    grid: g && {
      utility: g.utility,
      sanctionedKw: g.sanctioned_load_kw,
      drawKw: g.current_draw_kw,
      headroomKw: g.headroom_kw,
      utilisedPct: round((g.current_draw_kw / g.sanctioned_load_kw) * 100, 1),
      queuePosition: g.queue_position,
      connectionStatus: g.connection_status,
      note: g.note,
    },
    alerts,
    alertCounts: Object.fromEntries(SEVERITIES.map((s) => [s, alerts.filter((a) => a.severity === s).length])),
    incidents12m: incidents12m.length,
    tenants: tenants.length,
    contractedKw: sum(tenants, (t) => t.contracted_kw),
    health: health(operational, alerts, latest),
    trend: last12.map((t) => ({ month: t.month, pue: t.pue, wue: t.wue_l_per_kwh, itLoadKw: t.it_load_kw, uptimePct: t.uptime_pct, flag: t.flag })),
  };
}

export function portfolioSummary() {
  const facilities = nexus.facilities.map((f) => facilitySummary(f.facility_id));
  const live = facilities.filter((f) => f.operational);
  const atMonth = live.filter((f) => f.latest?.month === AS_OF_MONTH);
  const itLoadKw = sum(atMonth, (f) => f.latest.itLoadKw);
  const facilityLoadKw = sum(atMonth, (f) => f.latest.facilityLoadKw);
  const energy = live.filter((f) => f.energy);
  const totalKwh = sum(energy, (f) => f.energy.totalKwh);

  // Portfolio PUE per month is energy-weighted (sum of facility load over sum
  // of IT load), never an average of facility PUEs.
  const months = [...new Set(live.flatMap((f) => f.trend.map((t) => t.month)))].sort();
  const trend = months.map((month) => {
    const rows = nexus.timeseries.filter((t) => t.month === month);
    return {
      month,
      pue: round(sum(rows, (t) => t.facility_load_kw) / sum(rows, (t) => t.it_load_kw), 3),
      itLoadKw: sum(rows, (t) => t.it_load_kw),
    };
  });

  const alerts = facilities.flatMap((f) => f.alerts);
  return {
    asOf: AS_OF,
    month: AS_OF_MONTH,
    facilities,
    totals: {
      facilities: facilities.length,
      operational: live.length,
      designKw: sum(facilities, (f) => f.designKw),
      operationalDesignKw: sum(live, (f) => f.designKw),
      usedKw: sum(live, (f) => f.usedKw),
      utilisationPct: round((sum(live, (f) => f.usedKw) / sum(live, (f) => f.designKw)) * 100, 1),
      itLoadKw,
      facilityLoadKw,
      pue: round(facilityLoadKw / itLoadKw, 3),
      renewablePct: round((sum(energy, (f) => f.energy.renewableKwh) / totalKwh) * 100, 1),
      emissionsTco2: round(sum(energy, (f) => f.energy.emissionsTco2), 1),
      energyCostInrLakh: round(sum(energy, (f) => f.energy.costInrLakh), 1),
      availability12mPct: round(sum(live, (f) => f.availability12mPct) / live.length, 3),
      alerts: alerts.length,
      alertCounts: Object.fromEntries(SEVERITIES.map((s) => [s, alerts.filter((a) => a.severity === s).length])),
      incidents12m: sum(facilities, (f) => f.incidents12m),
      tenants: sum(facilities, (f) => f.tenants),
      contractedKw: sum(facilities, (f) => f.contractedKw),
      gridHeadroomKw: sum(live, (f) => f.grid?.headroomKw ?? 0),
    },
    trend,
    alerts: [...alerts].sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || b.raised_at.localeCompare(a.raised_at)),
  };
}
