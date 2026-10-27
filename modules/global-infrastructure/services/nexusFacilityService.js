/**
 * Nexus portfolio → the flat Facility shape the global-infrastructure map and
 * panels consume (see ../types). Every value comes from lib/nexus: the
 * portfolio rollup, site risk and benchmarks, so the map, the command centre
 * and the briefings show the same numbers.
 */
import { facilitySummary } from '../../../lib/nexus/portfolio.js';
import { siteRisk } from '../../../lib/nexus/site-risk-engine.js';
import { benchmarkFacility } from '../../../lib/nexus/benchmark-engine.js';
import { nexus } from '../../../lib/nexus/data.js';
import { AS_OF_DATE, daysBetween } from '../../../lib/nexus/time.js';

// The map's marker colours: serious folds into warning; a site under
// construction is neutral grey.
const HEALTH = { critical: 'critical', serious: 'warning', warning: 'warning', good: 'healthy', commissioning: 'commissioning' };
const RISK_FLAG = { critical: 'High', high: 'High', elevated: 'Medium', low: 'Low' };

function maintenanceDue(facilityId, days = 30) {
  return nexus.maintenance.some((m) => m.facility_id === facilityId && daysBetween(AS_OF_DATE, m.next_due) >= 0 && daysBetween(AS_OF_DATE, m.next_due) <= days);
}

export function nexusFacility(facilityId) {
  const s = facilitySummary(facilityId);
  const risk = siteRisk(facilityId);
  const bench = Object.fromEntries(benchmarkFacility(facilityId).map((m) => [m.key, m]));
  const energy = nexus.energy.filter((e) => e.facility_id === facilityId);
  return {
    id: s.id,
    name: s.name,
    country: 'India',
    state: s.state,
    city: s.city,
    region: 'APAC',
    latitude: s.lat,
    longitude: s.lon,
    status: s.operational ? 'Active' : 'Under Construction',
    commissionedYear: Number(String(s.commissioned).slice(0, 4)),
    health: HEALTH[s.health],
    nexusHealth: s.health,
    riskFlag: RISK_FLAG[risk.band],
    riskScore: risk.composite,
    riskBand: risk.band,
    riskDriver: risk.driver,
    facilityType: s.tier,
    tier: s.tier,
    capacityMw: s.designKw / 1000,
    itLoadMw: s.latest ? s.latest.itLoadKw / 1000 : 0,
    pue: s.latest?.pue ?? s.reportedPue,
    wue: s.latest?.wue ?? s.reportedWue,
    renewablePct: s.renewablePct,
    utilizationPct: s.utilisationPct,
    carbonTco2Ytd: Math.round(energy.reduce((t, e) => t + e.emissions_tco2, 0)),
    racks: s.racks,
    tenants: s.tenants,
    openAlerts: s.alerts.length,
    criticalAlerts: s.alertCounts.critical,
    gridHeadroomKw: s.grid?.headroomKw ?? 0,
    gridUtilisedPct: s.grid?.utilisedPct ?? null,
    queuePosition: s.grid?.queuePosition ?? 0,
    underMaintenance: maintenanceDue(facilityId),
    pueRank: bench.pue.rank,
    renewableRank: bench.renewable.rank,
    hasComponentModel: nexus.components.some((c) => c.facility_id === facilityId),
    operator: 'Nexus Data Infrastructure',
  };
}

export function fetchNexusFacilities() {
  return nexus.facilities.map((f) => nexusFacility(f.facility_id));
}
