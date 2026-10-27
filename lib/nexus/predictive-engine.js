// lib/nexus/predictive-engine.js
//
// Predictive risk: conditions that are heading toward an outage or a cost
// before an alarm says so. Two detectors, both deterministic:
//
//   Efficiency drift  — each month's PUE (and WUE) against the same month a
//                       year earlier, so seasonality cancels out. A one-sided
//                       CUSUM on that year-on-year excess raises the drift; the
//                       drift window runs from the CUSUM's last reset (the
//                       change-point estimate) to the latest month.
//   Component risk    — open maintenance advisories, read against the incident
//                       record (same failure pattern elsewhere), the alert
//                       queue (has it alarmed yet?), and the redundancy graph
//                       (is the peer that would cover it at risk too?).
import { nexus, index, getFacility, componentTypeOf } from './data.js';
import { runbookFor, exposedRacks } from './incident-engine.js';
import { buildReplay } from './replay.js';
import { AS_OF, AS_OF_DATE, AS_OF_MONTH, addMonths, daysBetween, monthLabel } from './time.js';
import { cohortFor } from './benchmark-engine.js';

const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const hoursIn = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate() * 24;
};

/**
 * CUSUM settings. `allowance` is half the smallest shift worth acting on
 * (0.02 PUE ≈ 1.3% more facility energy at MUM-1's load); `decision` is three
 * allowances, which keeps single noisy months from raising a drift.
 */
export const DRIFT = {
  pue: { field: 'pue', allowance: 0.010, decision: 0.030, label: 'PUE', dp: 3 },
  wue: { field: 'wue_l_per_kwh', allowance: 0.05, decision: 0.15, label: 'WUE', dp: 2, unit: 'L/kWh' },
};

/** Year-on-year excess and CUSUM per month for one facility and measure. */
export function driftSeries(facilityId, measure = 'pue') {
  const cfg = DRIFT[measure];
  const months = index.timeseriesByFacility.get(facilityId) ?? [];
  const byMonth = new Map(months.map((t) => [t.month, t]));
  let s = 0;
  return months.flatMap((t) => {
    const base = byMonth.get(addMonths(t.month, -12));
    if (!base) return [];
    const excess = round(t[cfg.field] - base[cfg.field], 4);
    s = Math.max(0, s + excess - cfg.allowance);
    return [{ month: t.month, value: t[cfg.field], baseline: base[cfg.field], excess, cusum: round(s, 4), itLoadKw: t.it_load_kw, datasetFlag: t.flag }];
  });
}

/** Ordinary least squares on equally spaced points. r2 is the share of variance explained. */
export function fitTrend(ys) {
  const n = ys.length;
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  ys.forEach((y, i) => { sxy += (i - mx) * (y - my); sxx += (i - mx) ** 2; syy += (y - my) ** 2; });
  const slope = sxx ? sxy / sxx : 0;
  return { slope, intercept: my - slope * mx, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : 0 };
}

/** Trailing months fitted for the drift trend, and how far ahead it is projected. */
export const TREND = Object.freeze({ fitMonths: 6, horizonMonths: 12 });

const weeksUntil = (month) => Math.max(0, Math.round(daysBetween(AS_OF_DATE, `${month}-01`) / 7));

/**
 * Projection of a drifting measure: the deseasonalised excess (this month
 * against the same month last year) is fitted over the trailing months, then
 * added to the same month a year earlier to project each future month. The
 * threshold is the Tier III p75 — the line into the bottom quartile of peers.
 */
function projectDrift(facilityId, measure, series) {
  const cfg = DRIFT[measure];
  const tail = series.slice(-TREND.fitMonths);
  const { slope, r2 } = fitTrend(tail.map((p) => p.excess));
  const f = getFacility(facilityId);
  const metric = measure === 'pue' ? 'PUE' : 'WUE (L/kWh)';
  const threshold = cohortFor(metric, f.tier).p75;
  const byMonth = new Map((index.timeseriesByFacility.get(facilityId) ?? []).map((t) => [t.month, t[cfg.field]]));
  const lastExcess = tail.at(-1).excess;
  let breach = null;
  const path = [];
  for (let h = 1; h <= TREND.horizonMonths; h += 1) {
    const month = addMonths(AS_OF_MONTH, h);
    const base = byMonth.get(addMonths(month, -12)) ?? byMonth.get(addMonths(month, -24));
    if (base == null) continue;
    const value = round(base + lastExcess + slope * h, cfg.dp);
    path.push({ month, value });
    if (!breach && value >= threshold) breach = { month, value };
  }
  return {
    slopePerMonth: round(slope, 4),
    r2: round(r2, 2),
    confidence: r2 >= 0.7 ? 'high' : r2 >= 0.4 ? 'moderate' : 'low',
    monthsFitted: tail.length,
    threshold,
    thresholdBasis: `India ${f.tier} p75 — entry to the bottom quartile`,
    projectedBreachMonth: breach?.month ?? null,
    projectedBreachValue: breach?.value ?? null,
    interventionWindowWeeks: breach ? weeksUntil(breach.month) : null,
    path,
  };
}

/** The active drift, if any: alarmed, and still above zero at the latest month. */
export function detectDrift(facilityId, measure = 'pue') {
  const cfg = DRIFT[measure];
  const series = driftSeries(facilityId, measure);
  if (!series.length || series.at(-1).cusum === 0) return { series, drift: null };
  // Walk back to the last reset: the run since then is the drift window.
  let start = series.length - 1;
  while (start > 0 && series[start - 1].cusum > 0) start -= 1;
  const window = series.slice(start);
  const alarm = window.find((p) => p.cusum >= cfg.decision);
  if (!alarm) return { series, drift: null };
  return {
    series: series.map((p, i) => ({ ...p, inDrift: i >= start })),
    drift: { measure, from: window[0].month, to: window.at(-1).month, alarmMonth: alarm.month, months: window, trend: projectDrift(facilityId, measure, series) },
  };
}

/** Energy, cost and carbon the drift has cost so far, and its run-rate. */
function driftCost(facilityId, months) {
  const f = getFacility(facilityId);
  const energy = new Map((index.energyByFacility.get(facilityId) ?? []).map((e) => [e.month, e]));
  let kwh = 0, inr = 0, tco2 = 0;
  for (const p of months) {
    const extra = p.excess * p.itLoadKw * hoursIn(p.month);
    const e = energy.get(p.month);
    const tariff = e?.tariff_inr_kwh ?? f.tariff_inr_kwh;
    const gridShare = e ? e.grid_kwh / e.total_kwh : 1 - f.renewable_pct / 100;
    const carbon = e?.grid_carbon_kg_per_kwh ?? 0.71;
    kwh += extra;
    inr += extra * tariff;
    tco2 += (extra * gridShare * carbon) / 1000;
  }
  const recent = months.slice(-3);
  const meanExcess = recent.reduce((s, p) => s + p.excess, 0) / recent.length;
  const last = months.at(-1);
  const annualKwh = meanExcess * last.itLoadKw * 8760;
  return {
    extraKwh: round(kwh),
    extraCostInrLakh: round(inr / 1e5, 1),
    extraTco2: round(tco2, 1),
    meanExcess3m: round(meanExcess, 3),
    annualRunRateInrLakh: round((annualKwh * f.tariff_inr_kwh) / 1e5, 1),
  };
}

/** Replacement lead time that makes a failure unrecoverable within half a year. */
export const LONG_LEAD_WEEKS = 26;
const COOLING_TYPES = new Set(['crah', 'chiller', 'cooling_tower', 'chw_loop']);

/** Latest maintenance record per component. */
function latestService(facilityId) {
  const latest = new Map();
  for (const m of nexus.maintenance) {
    if (m.facility_id !== facilityId) continue;
    const prev = latest.get(m.component_id);
    if (!prev || m.service_date > prev.service_date) latest.set(m.component_id, m);
  }
  return [...latest.values()];
}

/** "Replacement advised within 6 months" → the date it falls due. */
function advisedBy(record) {
  const m = /within (\d+) months?/i.exec(record.findings);
  if (!m) return record.next_due;
  const [y, mo, d] = record.service_date.split('-');
  return `${addMonths(`${y}-${mo}`, Number(m[1]))}-${d}`;
}

function efficiencyRisks() {
  const out = [];
  for (const f of nexus.facilities) {
    for (const measure of ['pue', 'wue']) {
      const { drift } = detectDrift(f.facility_id, measure);
      if (!drift) continue;
      const cost = measure === 'pue' ? driftCost(f.facility_id, drift.months) : null;
      const cooling = (index.alertsByFacility.get(f.facility_id) ?? []).filter((a) => a.status !== 'resolved' && a.category === 'Cooling');
      const advisories = latestService(f.facility_id).filter((m) => m.outcome !== 'Passed' && COOLING_TYPES.has(componentTypeOf(m.component_id)));
      const peak = drift.months.reduce((a, b) => (b.excess > a.excess ? b : a));
      out.push({
        id: `DRIFT-${f.facility_id}-${measure.toUpperCase()}`,
        kind: 'efficiency-drift',
        facilityId: f.facility_id,
        componentId: null,
        title: `${DRIFT[measure].label} drifting above last year at ${f.name}`,
        signal: `${DRIFT[measure].label} ${peak.value} in ${monthLabel(peak.month)} against ${peak.baseline} a year earlier`,
        since: drift.from,
        drift: { ...drift, peak },
        cost,
        evidence: [
          { source: '22_timeseries', text: `Year-on-year excess above ${DRIFT[measure].allowance} for ${drift.months.length} months, ${drift.from} to ${drift.to}` },
          ...cooling.map((a) => ({ source: '20_active_alerts', text: `${a.alert_id} ${a.component_id}: ${a.message}`, alertId: a.alert_id })),
          ...advisories.map((m) => ({ source: '19_maintenance', text: `${m.component_id}, ${m.service_date}: ${m.findings}` })),
        ],
        linkedAlerts: cooling.map((a) => a.alert_id),
        impact: 'efficiency',
      });
    }
  }
  return out;
}

function componentRisks() {
  const out = [];
  const alertsByComponent = new Map();
  for (const a of nexus.activeAlerts) if (a.status !== 'resolved') alertsByComponent.set(`${a.facility_id}:${a.component_id}`, a);

  for (const f of nexus.facilities) {
    const advisories = latestService(f.facility_id).filter((m) => m.outcome !== 'Passed');
    const atRisk = new Set(advisories.map((m) => m.component_id));
    for (const m of advisories) {
      const componentId = m.component_id;
      const steps = runbookFor(componentId, m.findings);
      const runbook = steps[0];
      const pattern = runbook
        ? nexus.incidents.filter((i) => runbookFor(i.component_id, `${i.root_cause} ${i.description}`)[0]?.runbook_id === runbook.runbook_id)
        : [];
      const alert = alertsByComponent.get(`${f.facility_id}:${componentId}`) ?? null;
      const component = index.componentById.get(componentId);
      const peers = component?.facility_id === f.facility_id ? component.redundantPeers : [];
      const sharedPeers = peers.filter((p) => atRisk.has(p));
      const exposure = exposedRacks(f.facility_id, componentId);

      // Scheduled-versus-emergency cost, where the record holds both.
      const replayed = pattern.map((i) => i.incident_id).filter((id) => (index.telemetryByComponent.get(index.incidentById.get(id).component_id) ?? []).length);
      const scheduled = replayed.map((id) => buildReplay(id).scheduledCostInrLakh).find((v) => v !== null) ?? null;
      const emergency = pattern.length ? median(pattern.map((i) => i.cost_inr_lakh)) : null;

      const evidence = [{ source: '19_maintenance', text: `${m.service_date}: ${m.findings}` }];
      if (pattern.length) evidence.push({ source: '11_incidents', text: `${pattern.length} recorded ${pattern.length === 1 ? 'incident' : 'incidents'} of this failure mode: ${pattern.map((i) => `${i.incident_id} (${i.facility_id})`).join(', ')}` });
      if (alert) evidence.push({ source: '20_active_alerts', text: `${alert.alert_id}: ${alert.message}`, alertId: alert.alert_id });
      if ((component?.lead_time_weeks ?? 0) >= LONG_LEAD_WEEKS) evidence.push({ source: '04_components', text: `Replacement lead time ${component.lead_time_weeks} weeks (₹${component.replacement_cost_inr_lakh} lakh); a failure cannot be made good inside half a year` });
      if (sharedPeers.length) evidence.push({ source: '04_components', text: `Redundant peer ${sharedPeers.join(', ')} carries the same advisory — a common-mode risk to the ${component.redundancy} cover` });

      out.push({
        id: `RISK-${f.facility_id}-${componentId}`,
        kind: 'component',
        facilityId: f.facility_id,
        componentId,
        title: alert ? `${componentId}: ${runbook?.failure_mode ?? 'advisory'} now alarming` : `${componentId}: ${runbook?.failure_mode ?? 'advisory'} — no alarm yet`,
        signal: m.findings,
        failureMode: runbook?.failure_mode ?? null,
        since: m.service_date,
        actBy: advisedBy(m),
        alert: alert && { alertId: alert.alert_id, raisedAt: alert.raised_at, leadDays: daysBetween(m.service_date, alert.raised_at.slice(0, 10)) },
        commonModeWith: sharedPeers,
        pattern: pattern.map((i) => ({ incidentId: i.incident_id, facilityId: i.facility_id, costInrLakh: i.cost_inr_lakh, durationMin: i.duration_min })),
        cost: emergency !== null ? { scheduledInrLakh: scheduled, emergencyInrLakh: emergency } : null,
        exposure: exposure.mapped ? { racks: exposure.racks.length, tenants: new Set(exposure.racks.map((r) => r.tenant_id)).size } : null,
        evidence,
        linkedAlerts: alert ? [alert.alert_id] : [],
        impact: runbook?.impact ?? 'outage',
        runbookId: runbook?.runbook_id ?? null,
        leadTimeWeeks: component?.lead_time_weeks ?? null,
      });
    }
  }
  return out;
}

/** Maintenance past its due date as of the dataset's "now". */
export function overdueMaintenance(facilityId) {
  return latestService(facilityId)
    .filter((m) => m.next_due < AS_OF_DATE)
    .map((m) => ({ componentId: m.component_id, nextDue: m.next_due, daysOverdue: daysBetween(m.next_due, AS_OF_DATE), lastService: m.service_date }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/**
 * The watchlist, most urgent first: outage-class risks that have not alarmed
 * yet, then those that have, then efficiency drift, then the rest.
 */
/** Utilisation level beyond which a site has no practical room to grow. */
export const UTILISATION_CEILING_PCT = 90;

/** Sites whose IT load, on its 12-month trend, reaches the ceiling within the horizon. */
export function capacityRisks() {
  const out = [];
  for (const f of nexus.facilities.filter((x) => x.status === 'Operational')) {
    const months = (index.timeseriesByFacility.get(f.facility_id) ?? []).slice(-12);
    const { slope, r2 } = fitTrend(months.map((t) => t.utilisation_pct));
    const now = months.at(-1).utilisation_pct;
    if (slope <= 0) continue;
    const h = Math.ceil((UTILISATION_CEILING_PCT - now) / slope);
    if (h < 1 || h > TREND.horizonMonths) continue;
    const month = addMonths(AS_OF_MONTH, h);
    const grid = index.gridByFacility.get(f.facility_id);
    out.push({
      id: `CAP-${f.facility_id}`,
      kind: 'capacity-trend',
      facilityId: f.facility_id,
      componentId: null,
      title: `${f.name} reaches ${UTILISATION_CEILING_PCT}% utilisation by ${monthLabel(month)}`,
      signal: `Utilisation ${now}% rising ${round(slope, 2)} points a month over 12 months`,
      since: months[0].month,
      trend: { slopePerMonth: round(slope, 2), r2: round(r2, 2), confidence: r2 >= 0.7 ? 'high' : r2 >= 0.4 ? 'moderate' : 'low', projectedBreachMonth: month, interventionWindowWeeks: weeksUntil(month), threshold: UTILISATION_CEILING_PCT },
      evidence: [
        { source: '22_timeseries', text: `Utilisation ${months[0].utilisation_pct}% in ${monthLabel(months[0].month)} to ${now}% in ${monthLabel(months.at(-1).month)}` },
        { source: '15_grid', text: `${grid.headroom_kw.toLocaleString('en-IN')} kW grid headroom, ${round((grid.current_draw_kw / grid.sanctioned_load_kw) * 100, 1)}% of sanctioned load drawn` },
      ],
      linkedAlerts: (index.alertsByFacility.get(f.facility_id) ?? []).filter((a) => a.category === 'Capacity' || /Sanctioned/.test(a.message)).map((a) => a.alert_id),
      impact: 'capacity',
    });
  }
  return out;
}

export function riskWatchlist() {
  const items = [...componentRisks(), ...efficiencyRisks(), ...capacityRisks()];
  const rank = (r) => {
    if (r.kind === 'component' && r.impact === 'outage') return (r.alert ? 1 : 0) * 10 - r.pattern.length - (r.commonModeWith.length ? 1 : 0);
    if (r.kind === 'efficiency-drift') return 20;
    if (r.kind === 'capacity-trend') return 25 + (r.trend.interventionWindowWeeks ?? 0) / 100;
    return 30;
  };
  return items
    // High: an outage-class failure that has recurred, threatens both redundant
    // units at once, or cannot be replaced inside half a year if it fails.
    .map((r) => ({ ...r, priority: r.kind === 'component' && r.impact === 'outage' && (r.pattern.length >= 2 || r.commonModeWith.length || (r.leadTimeWeeks ?? 0) >= LONG_LEAD_WEEKS) ? 'high' : 'medium' }))
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}

export { AS_OF };
