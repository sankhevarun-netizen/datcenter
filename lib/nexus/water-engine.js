// lib/nexus/water-engine.js
//
// Water intelligence from 14_water, 16_state_policy and 21_benchmarks: how
// much each site draws, how much of it is fresh, how stressed its basin is,
// when demand peaks, and which reporting obligations apply.
import { nexus, index, getFacility } from './data.js';
import { benchmarkFacility } from './benchmark-engine.js';
import { PHYSICS } from './impact-engine.js';
import { AS_OF_DATE, daysBetween, monthLabel } from './time.js';

const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;
const sum = (xs, fn) => xs.reduce((s, x) => s + fn(x), 0);
const hoursIn = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate() * 24;
};

const WATER_TERMS = /water|wue/i;
const EXTREME = 'Extremely high';

/** Obligations whose reporting duty or detail concerns water. */
function waterObligations(facilityId) {
  return (index.policiesByFacility.get(facilityId) ?? [])
    .filter((p) => WATER_TERMS.test(p.reporting_obligation) || WATER_TERMS.test(p.detail))
    .map((p) => {
      const startsIn = daysBetween(AS_OF_DATE, p.effective_from);
      return {
        jurisdiction: p.jurisdiction,
        policy: p.policy,
        obligation: p.reporting_obligation,
        detail: p.detail,
        effectiveFrom: p.effective_from,
        inForce: startsIn <= 0,
        startsInDays: startsIn > 0 ? startsIn : null,
      };
    });
}

export function facilityWater(facilityId) {
  const f = getFacility(facilityId);
  const months = (index.waterByFacility.get(facilityId) ?? []).map((w) => {
    const avgLpm = w.total_litres / (hoursIn(w.month) * 60);
    return {
      month: w.month,
      wue: w.measured_wue_l_per_kwh,
      totalLitres: w.total_litres,
      freshLitres: w.freshwater_litres,
      treatedLitres: w.treated_litres,
      avgLpm: round(avgLpm, 1),
      peakLpm: w.peak_demand_lpm,
    };
  });
  const latestRow = (index.waterByFacility.get(facilityId) ?? []).at(-1);
  const bench = benchmarkFacility(facilityId).find((m) => m.key === 'wue');
  const alerts = (index.alertsByFacility.get(facilityId) ?? [])
    .filter((a) => a.status !== 'resolved' && (a.category === 'Water' || WATER_TERMS.test(a.message)));

  const base = {
    id: facilityId,
    name: f.name,
    city: f.city,
    lat: f.lat,
    lon: f.lon,
    operational: f.status === 'Operational',
    targetWue: f.wue_l_per_kwh,
    benchmark: { value: bench.value, basis: bench.basis, cohort: bench.cohort, score: bench.score, rank: bench.rank, median: bench.band.p50 },
    obligations: waterObligations(facilityId),
    alerts: alerts.map((a) => ({ alertId: a.alert_id, severity: a.severity, componentId: a.component_id, message: a.message, note: a.note })),
  };
  if (!months.length) return { ...base, months: [], latest: null, ytd: null, stress: null, peak: null };

  const latest = months.at(-1);
  const peak = months.reduce((a, b) => (b.peakLpm > a.peakLpm ? b : a));
  const total = sum(months, (m) => m.totalLitres);
  const treated = sum(months, (m) => m.treatedLitres);
  return {
    ...base,
    source: latestRow.source,
    stress: { index: latestRow.stress_index, label: latestRow.local_water_stress },
    months,
    latest,
    ytd: {
      from: months[0].month,
      to: latest.month,
      totalLitres: total,
      freshLitres: total - treated,
      treatedLitres: treated,
      treatedSharePct: round((treated / total) * 100, 1),
    },
    peak: { month: peak.month, lpm: peak.peakLpm, avgLpm: peak.avgLpm, ratio: round(peak.peakLpm / peak.avgLpm, 2) },
    againstTarget: round(latest.wue - f.wue_l_per_kwh, 3),
  };
}

export function portfolioWater() {
  const sites = nexus.facilities.map((f) => facilityWater(f.facility_id));
  const live = sites.filter((s) => s.ytd);
  const fresh = sum(live, (s) => s.ytd.freshLitres);
  const extreme = live.filter((s) => s.stress.label === EXTREME);
  const month = live[0].latest.month;
  // Portfolio WUE is litres over IT kWh, never an average of site WUEs.
  const itKwh = sum(live, (s) => s.latest.totalLitres / s.latest.wue);
  return {
    month,
    sites,
    totals: {
      wue: round(sum(live, (s) => s.latest.totalLitres) / itKwh, 3),
      ytdFrom: live[0].ytd.from,
      ytdTo: live[0].ytd.to,
      totalMl: round(sum(live, (s) => s.ytd.totalLitres) / 1e6, 1),
      freshMl: round(fresh / 1e6, 1),
      treatedSharePct: round((sum(live, (s) => s.ytd.treatedLitres) / sum(live, (s) => s.ytd.totalLitres)) * 100, 1),
      extremeStressSites: extreme.map((s) => s.id),
      extremeStressFreshSharePct: round((sum(extreme, (s) => s.ytd.freshLitres) / fresh) * 100, 1),
      alerts: sum(sites, (s) => s.alerts.length),
      obligationsStarting: sites.flatMap((s) => s.obligations.filter((o) => !o.inForce).map((o) => ({ ...o, facilityId: s.id }))),
    },
  };
}

export { monthLabel };

/**
 * Water consequence of adding IT load at a site, on the same basis as the
 * cascade engine's secondary effects: the added load runs at the dataset's
 * average utilisation, at the site's reported WUE. WUE itself is a ratio and
 * does not change with load; the site's annual water does.
 */
export function waterImpactOfChange({ facilityId, additionalLoadKw }) {
  const f = getFacility(facilityId);
  const site = facilityWater(facilityId);
  const addedItKwh = additionalLoadKw * PHYSICS.HOURS_PER_YEAR * PHYSICS.AVERAGE_UTILISATION;
  const additionalLitresPerYear = Math.round(addedItKwh * f.wue_l_per_kwh);
  const annualNow = site.ytd ? Math.round((site.ytd.totalLitres / site.months.length) * 12) : null;
  const stress = site.stress;
  return {
    facilityId,
    additionalLoadKw,
    additionalLitresPerYear,
    additionalFreshLitresPerYear: site.ytd ? Math.round(additionalLitresPerYear * (1 - site.ytd.treatedSharePct / 100)) : additionalLitresPerYear,
    annualLitresNow: annualNow,
    increasePct: annualNow ? round((additionalLitresPerYear / annualNow) * 100, 1) : null,
    wue: f.wue_l_per_kwh,
    newWue: f.wue_l_per_kwh,
    stressContextNote: stress
      ? `${stress.label} water stress (index ${stress.index}); ${site.ytd.treatedSharePct}% of current supply is treated recycle`
      : 'Not yet drawing water; design WUE applies',
    applicablePolicies: site.obligations.map((o) => `${o.jurisdiction} · ${o.policy}: ${o.obligation}`),
    reportableUnderPolicy: site.obligations.some((o) => /water|WUE/i.test(o.obligation)),
  };
}
