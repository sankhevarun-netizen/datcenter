// lib/nexus/incident-engine.js
//
// Incident intelligence: for an active alert or a recorded incident, answer
// four questions from the dataset alone — what happened, why, who is exposed,
// and what to do. Every figure is computed here; the brief only narrates it.
//
//   what  the alert or incident record, the component's rating and load,
//         and the telemetry window when one exists (reused from replay.js)
//   why   the failure mode (23_runbooks), the root-cause pattern across
//         11_incidents, and the component's maintenance findings
//   who   racks downstream of the component (05_dependencies + 04_racks),
//         whether redundant peers carry the load (impact-engine failure
//         walk), and each tenant's contractual exposure (10_contracts)
//   do    the runbook steps with due times, the upgrade option and the
//         supply line for the part (06_upgrade_options, 25_supply_chain)
import { nexus, index, getFacility, componentTypeOf, racksOf } from './data.js';
import { propagateChange } from './impact-engine.js';
import { buildReplay } from './replay.js';
import { cohortFor } from './benchmark-engine.js';
import { crahFailover } from './thermal-model.js';
import { addMinutes } from './time.js';

const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const causeKey = (rootCause) => rootCause.split(' - ')[0].trim();
const HOURS_PER_YEAR = 8760;

/** Runbook for a component and a piece of text (alert message, root cause). */
export function runbookFor(componentId, text) {
  const steps = index.runbooksByType.get(componentTypeOf(componentId)) ?? [];
  const hit = steps.find((s) => s.match_terms.split('|').some((t) => text.toLowerCase().includes(t.trim().toLowerCase())));
  return hit ? steps.filter((s) => s.runbook_id === hit.runbook_id).sort((a, b) => a.step - b.step) : [];
}

/** Recorded incidents sharing a failure pattern: same root-cause family, or the same runbook. */
function patternFor({ componentId, text, linkedIncident }) {
  if (linkedIncident?.root_cause) {
    const key = causeKey(linkedIncident.root_cause);
    return nexus.incidents.filter((i) => i.root_cause && causeKey(i.root_cause) === key);
  }
  const runbook = runbookFor(componentId, text)[0]?.runbook_id;
  if (!runbook) return [];
  return nexus.incidents.filter((i) => runbookFor(i.component_id, `${i.root_cause} ${i.description}`)[0]?.runbook_id === runbook);
}

/** "Within 30 min of detection" → 30. */
function notifyMinutes(clause) {
  const m = /(\d+)\s*(min|minute|hour|hr|h)\b/i.exec(clause ?? '');
  if (!m) return null;
  return /^h/i.test(m[2]) ? Number(m[1]) * 60 : Number(m[1]);
}

/** Components downstream of `componentId` within its facility's graph. */
function downstream(componentId) {
  const isCrah = (id) => index.componentById.get(id)?.component_type === 'crah';
  const seen = new Set();
  const stack = [componentId];
  while (stack.length) {
    const id = stack.pop();
    for (const e of index.edgesFrom.get(id) ?? []) {
      // rack_row → CRAH carries heat back toward the plant; CRAH → rack_row is the only
      // thermal edge into the load. Neither should be walked through the row.
      if (index.componentById.get(id)?.component_type === 'rack_row') continue;
      if (isCrah(id) && e.target_component_id.startsWith('ROW-')) continue;
      if (!seen.has(e.target_component_id)) {
        seen.add(e.target_component_id);
        stack.push(e.target_component_id);
      }
    }
  }
  return seen;
}

// Plant that serves a whole site: where no component graph exists, every
// tenant at the facility sits behind it. Distribution-level equipment (PDU,
// busway, CRAH) cannot be attributed to tenants without the graph.
const SITE_WIDE = new Set(['utility_feed', 'transformer', 'switchgear', 'generator', 'ups', 'chiller', 'cooling_tower', 'chw_loop']);

/**
 * Racks whose power or cooling passes through `componentId`. Only MUM-1 has a
 * component graph in the dataset; elsewhere `mapped` is false.
 */
export function exposedRacks(facilityId, componentId) {
  const component = index.componentById.get(componentId);
  if (!component || component.facility_id !== facilityId) return { mapped: false, racks: [] };
  const occupied = racksOf(facilityId).filter((r) => r.status === 'occupied');
  if (component.component_type === 'rack_row') {
    return { mapped: true, racks: occupied.filter((r) => `ROW-${r.row_id}` === componentId) };
  }
  const below = downstream(componentId);
  below.add(componentId);
  return { mapped: true, racks: occupied.filter((r) => below.has(r.fed_by_pdu) || below.has(r.cooled_by_crah)) };
}

/** Recorded peers, or for a CRAH its row partner (CRAH-K-01 ↔ CRAH-K-02). */
function peersOf(component) {
  if (component.redundantPeers.length) return component.redundantPeers;
  if (component.component_type !== 'crah') return [];
  const row = component.component_id.split('-').slice(0, 2).join('-');
  return [...index.componentById.values()]
    .filter((c) => c.component_type === 'crah' && c.component_id !== component.component_id && c.component_id.startsWith(`${row}-`))
    .map((c) => c.component_id);
}

function protection(facilityId, componentId, mapped) {
  if (!mapped) return { state: 'unknown', peers: [], overloaded: [], detail: 'Component topology for this site is not on file.' };
  const c = index.componentById.get(componentId);
  const peers = peersOf(c);
  // A row's CRAH pair shares one cold aisle: the question is whether the
  // surviving unit can cool the whole row on its own.
  if (c.component_type === 'crah') {
    const f = crahFailover(componentId);
    return f.holds
      ? { state: 'redundant', peers, overloaded: [], detail: `${f.survivors.join(' and ')} can cool Row ${f.rowId} alone at ${f.utilisationAfterPct}% of its rating. No outage unless a second failure follows.` }
      : {
        state: 'exposed', peers,
        overloaded: f.survivors.map((id) => ({ componentId: id, utilisationPct: f.utilisationAfterPct })),
        detail: `If it fails, ${f.survivors.join(' and ')} must cool Row ${f.rowId}'s ${f.loadKw} kW alone — ${f.utilisationAfterPct}% of its ${f.survivorCapacityKw} kW rating. Estimated inlet rise ${f.riseC} °C.`,
      };
  }
  const result = propagateChange({ facilityId, changes: [{ componentId, failed: true }] });
  if (result.breakingPoints.length) {
    return {
      state: 'exposed',
      peers,
      overloaded: result.breakingPoints.map((b) => ({ componentId: b.componentId, utilisationPct: b.newUtilisationPct })),
      detail: 'If it fails, the remaining equipment cannot carry the load.',
    };
  }
  return {
    state: peers.length ? 'redundant' : 'single-path',
    peers,
    overloaded: [],
    detail: peers.length
      ? `Load transfers to ${peers.join(' and ')}${c.redundancy && c.redundancy !== 'N' ? ` (${c.redundancy})` : ''}. No outage unless a second failure follows.`
      : 'No redundant peer is recorded for this component.',
  };
}

// The notification clock starts at a service-affecting incident, not at an
// early-warning alert, so notifyBy is set only when `clockStarted`.
function tenantExposure({ facilityId, componentType, racks, mapped, outageMinutes, detectedAt, priced, clockStarted }) {
  let tenants;
  if (mapped) tenants = [...new Set(racks.map((r) => r.tenant_id).filter(Boolean))].map((id) => index.tenantById.get(id));
  else if (SITE_WIDE.has(componentType)) tenants = nexus.tenants.filter((t) => t.facility_id === facilityId);
  else tenants = [];
  const hours = outageMinutes / 60;

  return tenants.map((t) => {
    const own = racks.filter((r) => r.tenant_id === t.tenant_id);
    const contract = (index.contractsByTenant.get(t.tenant_id) ?? []).find((c) => c.facility_id === facilityId);
    const notify = notifyMinutes(contract?.notification_clause);
    // The contract penalty triggers once an outage runs past penalty_threshold_hours.
    const exposure = contract && priced ? (hours > contract.penalty_threshold_hours ? contract.penalty_inr_lakh : 0) : null;
    return {
      tenantId: t.tenant_id,
      name: t.name,
      workload: t.workload_type,
      racks: mapped ? own.length : null,
      itKw: mapped ? round(own.reduce((s, r) => s + r.used_kw, 0), 1) : null,
      contract: contract && {
        contractId: contract.contract_id,
        slaUptimePct: contract.sla_uptime_pct,
        allowedDowntimeHoursPerYear: round((1 - contract.sla_uptime_pct / 100) * HOURS_PER_YEAR, 2),
        penaltyInrLakh: contract.penalty_inr_lakh,
        thresholdHours: contract.penalty_threshold_hours,
        hoursToBreak: priced ? round(contract.penalty_threshold_hours - hours, 2) : null,
        notificationClause: contract.notification_clause,
        notifyWithinMin: notify,
        notifyBy: clockStarted && notify !== null ? addMinutes(detectedAt, notify) : null,
      },
      exposureInrLakh: exposure,
    };
  }).sort((a, b) => (b.exposureInrLakh ?? 0) - (a.exposureInrLakh ?? 0));
}

function latestFindings(componentId, facilityId) {
  return (index.maintenanceByComponent.get(componentId) ?? [])
    .filter((m) => m.facility_id === facilityId && m.outcome !== 'Passed')
    .sort((a, b) => b.service_date.localeCompare(a.service_date))
    .slice(0, 2)
    .map((m) => ({ maintenanceId: m.maintenance_id, date: m.service_date, findings: m.findings, outcome: m.outcome, nextDue: m.next_due }));
}

/**
 * @param {{ alertId?: string, incidentId?: string }} ref
 */
export function analyseIncident({ alertId, incidentId }) {
  const alert = alertId ? index.alertById.get(alertId) : null;
  const incident = incidentId ? index.incidentById.get(incidentId) : null;
  if (!alert && !incident) throw new Error(`Unknown alert or incident: ${alertId ?? incidentId}`);

  const record = alert ?? incident;
  const facilityId = record.facility_id;
  const facility = getFacility(facilityId);
  const componentId = record.component_id;
  const componentType = componentTypeOf(componentId);
  const component = index.componentById.get(componentId);
  const detectedAt = alert ? alert.raised_at : incident.detected_at;
  const text = alert ? `${alert.message} ${alert.note ?? ''}` : `${incident.root_cause} ${incident.description}`;

  // An alert may name the incident whose signature it matches.
  const linkedId = alert?.note?.match(/INC-\d{4}-\d{4}/)?.[0];
  const linkedIncident = incident ?? (linkedId ? index.incidentById.get(linkedId) : null);

  // ── why ──
  const pattern = patternFor({ componentId, text, linkedIncident });
  const steps = runbookFor(componentId, text);
  const impact = steps[0]?.impact ?? 'outage';
  const sites = [...new Set(pattern.map((i) => i.facility_id))];

  // ── who ──
  // Contract penalties are priced only for outage-class conditions; capacity,
  // compliance and efficiency alerts list who is affected without a penalty.
  const { mapped, racks } = exposedRacks(facilityId, componentId);
  const guard = impact === 'outage' ? protection(facilityId, componentId, mapped) : null;
  const durations = pattern.map((i) => i.duration_min);
  const mttrMedian = cohortFor('MTTR (minutes)', facility.tier).p50_median;
  const outage = impact !== 'outage' ? null : durations.length
    ? { minutes: median(durations), basis: `Median of ${durations.length} matching ${durations.length === 1 ? 'incident' : 'incidents'}` }
    : { minutes: mttrMedian, basis: 'Indian peer median time to repair' };
  // Alerts are priced as exposure if the chain drops; a resolved incident
  // reports what the record says happened instead.
  const tenants = tenantExposure({
    facilityId, componentType, racks, mapped, outageMinutes: outage?.minutes ?? 0, detectedAt,
    priced: impact === 'outage' && Boolean(alert), clockStarted: !alert,
  });
  const obligations = impact === 'compliance'
    ? (index.policiesByFacility.get(facilityId) ?? []).map((p) => ({ jurisdiction: p.jurisdiction, policy: p.policy, obligation: p.reporting_obligation }))
    : [];

  // ── probable cause: the most frequent root-cause family among matching
  // incidents, corroborated (or not) by this component's maintenance findings.
  const findings = latestFindings(componentId, facilityId);
  const families = new Map();
  for (const i of pattern) if (i.root_cause) families.set(causeKey(i.root_cause), (families.get(causeKey(i.root_cause)) ?? 0) + 1);
  const [topCause, topCount] = [...families].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const corroborated = findings.some((m) => runbookFor(componentId, m.findings)[0]?.runbook_id === steps[0]?.runbook_id);
  const probableCause = topCause ? {
    cause: topCause,
    confidence: topCount >= 2 && corroborated ? 'high' : topCount >= 2 || corroborated ? 'moderate' : 'low',
    basis: `${topCount} of ${pattern.length} matching ${pattern.length === 1 ? 'incident' : 'incidents'} share this root cause${corroborated ? '; the latest maintenance finding on this component points the same way' : '; no maintenance finding on this component corroborates it'}`,
  } : null;

  // ── do ──
  const supply = index.supplyByComponentType.get(componentType) ?? null;
  const upgrade = index.upgradeByComponent.get(componentId) ?? null;

  // ── what (telemetry window when the incident has one) ──
  let replay = null;
  if (linkedIncident && (index.telemetryByComponent.get(linkedIncident.component_id) ?? []).some((t) => t.facility_id === linkedIncident.facility_id)) {
    replay = buildReplay(linkedIncident.incident_id);
  }

  return {
    kind: alert ? 'alert' : 'incident',
    id: alert ? alert.alert_id : incident.incident_id,
    facilityId,
    facilityName: facility.name,
    componentId,
    componentType,
    componentLabel: component?.facility_id === facilityId ? component.label : componentId,
    severity: record.severity,
    detectedAt,
    status: alert ? alert.status : 'resolved',
    owner: alert?.owner_team ?? steps[0]?.owner_team ?? null,
    what: {
      headline: alert ? alert.message : incident.description,
      note: alert?.note ?? incident?.note ?? null,
      category: alert?.category ?? null,
      rating: component?.facility_id === facilityId
        ? { capacity: component.capacity, unit: component.unit, load: component.current_load, utilisationPct: component.utilisation_pct, redundancy: component.redundancy }
        : null,
      resolvedAt: incident?.resolved_at ?? null,
      durationMin: incident?.duration_min ?? null,
      replay: replay && { incidentId: replay.incident.incident_id, flaggedAt: replay.flaggedAt, detectedAt: replay.detectedAt, leadMinutes: replay.leadMinutes },
    },
    why: {
      failureMode: steps[0]?.failure_mode ?? null,
      rootCause: linkedIncident?.root_cause ?? pattern[0]?.root_cause ?? null,
      probableCause,
      pattern: pattern.map((i) => ({
        incidentId: i.incident_id, facilityId: i.facility_id, componentId: i.component_id,
        detectedAt: i.detected_at, durationMin: i.duration_min, costInrLakh: i.cost_inr_lakh,
        isThisFacility: i.facility_id === facilityId,
      })),
      sites,
      findings,
    },
    impact,
    who: {
      mapped,
      scope: mapped ? 'components' : SITE_WIDE.has(componentType) ? 'site' : 'unattributed',
      protection: guard,
      racks: mapped ? racks.length : null,
      rows: mapped ? [...new Set(racks.map((r) => r.row_id))].sort() : null,
      itKw: mapped ? round(racks.reduce((s, r) => s + r.used_kw, 0), 1) : null,
      outage,
      tenants,
      obligations,
      recorded: incident ? { tenantsAffected: incident.tenants_affected, costInrLakh: incident.cost_inr_lakh, durationMin: incident.duration_min } : null,
      totalExposureInrLakh: impact === 'outage' && alert ? round(tenants.reduce((s, t) => s + (t.exposureInrLakh ?? 0), 0), 1) : null,
      earliestNotifyBy: tenants.map((t) => t.contract?.notifyBy).filter(Boolean).sort()[0] ?? null,
    },
    do: {
      runbookId: steps[0]?.runbook_id ?? null,
      steps: steps.map((s) => ({ step: s.step, action: s.action, owner: s.owner_team, withinMin: s.within_min, dueAt: addMinutes(detectedAt, s.within_min) })),
      upgrade: upgrade && { description: upgrade.description, costInrLakh: upgrade.cost_inr_lakh, leadTimeWeeks: upgrade.lead_time_weeks },
      supply: supply && {
        vendor: supply.vendor, origin: supply.origin_country, singleSource: supply.single_source === 'yes',
        leadTimeWeeks: supply.lead_time_weeks, sparesOnSite: supply.spares_on_site, note: supply.disruption_note,
      },
    },
  };
}

/** Everything the incident list needs, most severe first. */
export function incidentQueue() {
  const order = ['critical', 'high', 'medium', 'low'];
  return [...nexus.activeAlerts]
    .filter((a) => a.status !== 'resolved')
    .sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || b.raised_at.localeCompare(a.raised_at));
}

/**
 * The SLA clock once a condition becomes service-affecting: for each exposed
 * tenant, minutes left to notify and to the penalty threshold after
 * `elapsedMinutes`. Pure — the caller supplies the elapsed time.
 */
export function slaClock(analysis, elapsedMinutes) {
  return analysis.who.tenants.filter((t) => t.contract).map((t) => {
    const breakAt = t.contract.thresholdHours * 60;
    return {
      tenantId: t.tenantId,
      name: t.name,
      notifyLeftMin: t.contract.notifyWithinMin !== null ? t.contract.notifyWithinMin - elapsedMinutes : null,
      breakLeftMin: breakAt - elapsedMinutes,
      breached: elapsedMinutes > breakAt,
      penaltyInrLakh: t.contract.penaltyInrLakh,
      thresholdHours: t.contract.thresholdHours,
    };
  }).sort((a, b) => a.breakLeftMin - b.breakLeftMin);
}
