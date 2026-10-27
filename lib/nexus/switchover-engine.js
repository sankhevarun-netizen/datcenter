// lib/nexus/switchover-engine.js
//
// Switchover Planner: before taking a component offline, or transferring its
// load to a recorded peer, compute what the change touches, whether
// redundancy holds, who is exposed, the safest window, and a runbook.
//
// Pure, deterministic graph computation — no AI, no randomness. Reuses the
// existing engines exactly as incident-engine.js's own (private) protection()
// helper does: propagateChange() for the electrical/thermal graph walk,
// crahFailover() for CRAH pairs, exposedRacks() for downstream racks/tenants.
// `windowStart`/dates use this dataset's own "YYYY-MM-DD HH:mm" convention
// (see time.js), not ISO timestamps.
import { getFacility, index } from './data.js';
import { propagateChange, roundHalfEven } from './impact-engine.js';
import { exposedRacks, runbookFor } from './incident-engine.js';
import { crahFailover } from './thermal-model.js';
import { AS_OF, toMinutes, fromMinutes, timeLabel } from './time.js';
import loadProfile from '../../data/nexus/loadProfile.json';

export const SWITCHOVER_TYPES = ['utility_feed', 'ups', 'generator', 'chiller', 'pdu', 'crah'];
export class SwitchoverInputError extends Error {}

// Matches impact-engine.js's own (private, unexported) TIGHT_FROM.
const TIGHT = 0.8;

// Recorded peers, or for a CRAH its row partner (CRAH-K-01 <-> CRAH-K-02).
// Mirrors incident-engine.js's private peersOf() — duplicated because that
// one isn't exported.
function peersOf(component) {
  if (component.redundantPeers.length) return component.redundantPeers;
  if (component.component_type !== 'crah') return [];
  const row = component.component_id.split('-').slice(0, 2).join('-');
  return [...index.componentById.values()]
    .filter((c) => c.component_type === 'crah' && c.component_id !== component.component_id && c.component_id.startsWith(`${row}-`))
    .map((c) => c.component_id);
}

function validateInput({ facilityId, componentId, action, transferToId, windowStart, durationHours }) {
  let facility;
  try {
    facility = getFacility(facilityId);
  } catch {
    throw new SwitchoverInputError(`Unknown facility: ${facilityId}`);
  }

  const component = index.componentById.get(componentId);
  if (!component || component.facility_id !== facilityId) {
    return { facility, mapped: false };
  }

  if (!SWITCHOVER_TYPES.includes(component.component_type)) {
    throw new SwitchoverInputError(`Unsupported component type "${component.component_type}". Supported: ${SWITCHOVER_TYPES.join(', ')}.`);
  }
  if (action !== 'take_offline' && action !== 'transfer_load') {
    throw new SwitchoverInputError(`Unsupported action "${action}". Use "take_offline" or "transfer_load".`);
  }
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    throw new SwitchoverInputError(`durationHours must be a positive number, got ${durationHours}.`);
  }
  try {
    toMinutes(windowStart);
  } catch {
    throw new SwitchoverInputError(`windowStart must look like "YYYY-MM-DD HH:mm", got "${windowStart}".`);
  }

  const peers = peersOf(component);
  if (action === 'transfer_load') {
    if (!transferToId) throw new SwitchoverInputError('transfer_load requires transferToId.');
    if (!peers.includes(transferToId)) {
      throw new SwitchoverInputError(`"${transferToId}" is not a recorded peer of "${componentId}" (recorded peers: ${peers.join(', ') || 'none'}).`);
    }
  }

  return { facility, mapped: true, component, peers };
}

// Unifies the CRAH (crahFailover) and graph-walk (propagateChange) paths
// into one shape the verdict/runbook/UI can read without caring which branch
// ran — exactly the same branch incident-engine.js's protection() takes.
function buildImpact(facilityId, component) {
  if (component.component_type === 'crah') {
    const f = crahFailover(component.component_id);
    return {
      kind: 'crah',
      holds: f.holds,
      survivors: f.survivors,
      utilisationAfterPct: f.utilisationAfterPct,
      riseC: f.riseC,
      breakingPoints: f.holds ? [] : [{ componentId: f.survivors[0] ?? component.component_id, label: `Row ${f.rowId} CRAH pair`, newUtilisationPct: f.utilisationAfterPct }],
      redundancyLosses: [],
      requiredUpgrades: [],
      unresolvedComponents: [],
      generatorRuntimeHours: null,
      impacts: [],
      verdictHint: f.holds ? 'feasible' : 'not_feasible',
      crah: f,
    };
  }
  const result = propagateChange({ facilityId, changes: [{ componentId: component.component_id, failed: true }] });
  return {
    kind: 'graph',
    holds: result.breakingPoints.length === 0,
    survivors: [],
    utilisationAfterPct: null,
    riseC: null,
    breakingPoints: result.breakingPoints,
    redundancyLosses: result.redundancyLosses,
    requiredUpgrades: result.requiredUpgrades,
    unresolvedComponents: result.unresolvedComponents,
    generatorRuntimeHours: result.secondaryEffects.generatorRuntimeHours,
    impacts: result.impacts,
    verdictHint: result.verdict,
    raw: result,
  };
}

function tenantExposureFor(facilityId, racks, durationHours) {
  const tenantIds = [...new Set(racks.map((r) => r.tenant_id).filter(Boolean))];
  return tenantIds.map((tenantId) => {
    const tenant = index.tenantById.get(tenantId);
    const contract = (index.contractsByTenant.get(tenantId) ?? []).find((c) => c.facility_id === facilityId);
    const own = racks.filter((r) => r.tenant_id === tenantId);
    const itKw = roundHalfEven(own.reduce((s, r) => s + r.used_kw, 0), 1);
    const exceedsThreshold = Boolean(contract) && durationHours > contract.penalty_threshold_hours;
    return {
      tenantId,
      name: tenant.name,
      racksAffected: own.length,
      itKw,
      slaUptimePct: contract?.sla_uptime_pct ?? null,
      penaltyThresholdHours: contract?.penalty_threshold_hours ?? null,
      exposureInrLakh: exceedsThreshold ? contract.penalty_inr_lakh : 0,
      exposureBasis: !contract
        ? 'No contract on file for this tenant at this facility.'
        : exceedsThreshold
          ? `Window (${durationHours}h) exceeds the ${contract.penalty_threshold_hours}h contractual threshold — flat penalty applies.`
          : `Window (${durationHours}h) is within the ${contract.penalty_threshold_hours}h contractual threshold — no penalty.`,
      notificationClause: contract?.notification_clause ?? null,
      contractId: contract?.contract_id ?? null,
    };
  }).sort((a, b) => b.exposureInrLakh - a.exposureInrLakh);
}

// Open alerts on componentId/peers whose matched runbook classifies the
// failure mode as outage-impact (there is no literal "alert_class" field in
// this dataset — this is the same classification analyseIncident() uses).
function openOutageAlerts(facilityId, componentIds) {
  const ids = new Set(componentIds);
  return (index.alertsByFacility.get(facilityId) ?? [])
    .filter((a) => ids.has(a.component_id) && a.status === 'open')
    .filter((a) => (runbookFor(a.component_id, `${a.message} ${a.note ?? ''}`)[0]?.impact ?? 'outage') === 'outage');
}

function maintenanceNear(componentIds, windowStartMin, windowEndMin, bufferHours = 24) {
  const hits = [];
  for (const id of componentIds) {
    for (const m of index.maintenanceByComponent.get(id) ?? []) {
      const due = toMinutes(m.next_due);
      if (due >= windowStartMin - bufferHours * 60 && due <= windowEndMin + bufferHours * 60) hits.push(m);
    }
  }
  return hits;
}

function verdictFor({ component, peers, impact, tenants, durationHours, outageAlerts }) {
  const reasons = [];
  const noRecordedPeer = peers.length === 0;

  if (noRecordedPeer) {
    reasons.push({ code: 'no-redundancy', text: `${component.label} has no recorded redundant peer — a single point of failure for the duration of the window.`, componentIds: [component.component_id], recordIds: [] });
  }
  if (impact.kind === 'crah' && !impact.holds) {
    reasons.push({ code: 'thermal-exceeded', text: `The surviving CRAH cannot cool the row alone — estimated ${impact.utilisationAfterPct}% of its rating.`, componentIds: impact.survivors, recordIds: [] });
  }
  if (impact.breakingPoints.length > 0) {
    reasons.push({ code: 'over-capacity', text: `${impact.breakingPoints.length} component(s) exceed derated capacity after the change.`, componentIds: impact.breakingPoints.map((b) => b.componentId), recordIds: [] });
  }
  if (impact.unresolvedComponents.length > 0) {
    reasons.push({ code: 'unresolved', text: `${impact.unresolvedComponents.length} breaking point(s) have no upgrade option on file.`, componentIds: impact.unresolvedComponents, recordIds: [] });
  }
  if (impact.generatorRuntimeHours && impact.generatorRuntimeHours.after < durationHours) {
    reasons.push({ code: 'fuel-autonomy', text: `Generator runtime after the change (${impact.generatorRuntimeHours.after}h) is shorter than the requested window (${durationHours}h).`, componentIds: [], recordIds: [] });
  }
  if (outageAlerts.length > 0) {
    reasons.push({ code: 'open-outage-alert', text: `${outageAlerts.length} open outage-impact alert(s) on this asset or its peer overlap the window.`, componentIds: [...new Set(outageAlerts.map((a) => a.component_id))], recordIds: outageAlerts.map((a) => a.alert_id) });
  }

  if (reasons.length > 0) return { level: 'NO_GO', reasons };

  const conditions = [];
  if (!noRecordedPeer) {
    conditions.push({ code: 'redundancy-reduced', text: `Redundancy reduced to a single path for the duration of the window (peer: ${peers.join(', ')}).`, componentIds: peers, recordIds: [] });
  }
  if (impact.redundancyLosses.length > 0) {
    conditions.push({ code: 'redundancy-lost', text: `${impact.redundancyLosses.length} component(s) lose their spare margin after the change.`, componentIds: impact.redundancyLosses.map((r) => r.componentId), recordIds: [] });
  }
  if (impact.kind === 'crah' && impact.utilisationAfterPct / 100 >= TIGHT) {
    conditions.push({ code: 'tight-margin', text: `Surviving CRAH runs at ${impact.utilisationAfterPct}% of rating — above the ${Math.round(TIGHT * 100)}% tight threshold.`, componentIds: impact.survivors, recordIds: [] });
  }
  if (impact.kind === 'graph') {
    const tight = impact.impacts.filter((i) => i.status === 'tight');
    if (tight.length) conditions.push({ code: 'tight-margin', text: `${tight.length} component(s) run above the ${Math.round(TIGHT * 100)}% tight threshold after the change.`, componentIds: tight.map((i) => i.componentId), recordIds: [] });
  }
  if (impact.requiredUpgrades.length > 0) {
    conditions.push({ code: 'upgrade-required', text: `${impact.requiredUpgrades.length} upgrade(s) recommended (₹${roundHalfEven(impact.requiredUpgrades.reduce((s, u) => s + u.costInrLakh, 0), 1)} lakh total).`, componentIds: impact.requiredUpgrades.map((u) => u.componentId), recordIds: [] });
  }
  if (tenants.length > 0) {
    conditions.push({ code: 'tenant-notification', text: `${tenants.length} tenant(s) require contractual notification before this change.`, componentIds: [], recordIds: tenants.map((t) => t.contractId).filter(Boolean) });
  }

  if (conditions.length > 0) return { level: 'GO_WITH_CONDITIONS', reasons: conditions };
  return { level: 'GO', reasons: [{ code: 'clean', text: 'No redundancy loss on a live path, no capacity breach, no open outage-impact alerts, no tenant notification required.', componentIds: [], recordIds: [] }] };
}

// Weekday from pure epoch-minute arithmetic (matches time.js's Date.UTC
// basis): day 0 (1970-01-01) was a Thursday.
function isWeekend(minutes) {
  const dayIndex = Math.floor(minutes / 1440);
  const weekday = (dayIndex + 4) % 7; // 0 = Monday ... 6 = Sunday
  return weekday === 5 || weekday === 6;
}

export const SCORING = {
  tenantActivity: { maxPoints: 20, code: 'tenant-activity', text: 'Scheduled during an elevated tenant-activity window (placeholder profile).' },
  openAlert: { points: 35, code: 'open-alert', text: 'Open outage-impact alert overlaps this window on the asset or its peer.' },
  maintenanceConflict: { points: 15, code: 'maintenance-conflict', text: 'Booked maintenance on the asset or its peer falls inside/near this window.' },
  marginAfterChange: { maxPoints: 15, code: 'tight-margin', text: 'A survivor is close to its derated capacity after the change.' },
  autonomyExceeded: { points: 30, code: 'autonomy-exceeded', text: 'Window length exceeds generator runtime after the change.' },
};

export function candidateWindows({ asOf = AS_OF, horizonDays = 14, durationHours, slotHours = [0, 2, 4, 22] } = {}) {
  const asOfMin = toMinutes(asOf);
  const dayStart = asOfMin - (asOfMin % 1440);
  const windows = [];
  for (let day = 0; day < horizonDays; day++) {
    for (const h of slotHours) {
      const startMin = dayStart + day * 1440 + h * 60;
      if (startMin < asOfMin) continue;
      windows.push({ startMin, endMin: startMin + durationHours * 60 });
    }
  }
  return windows.sort((a, b) => a.startMin - b.startMin);
}

export function scoreWindow(window, ctx) {
  const { componentIds, facilityId, durationHours, worstUtilisationFraction, autonomyExceeded } = ctx;
  const factors = [];

  // a) Placeholder tenant-activity profile.
  const hours = [];
  for (let h = 0; h < durationHours; h++) hours.push(Math.floor(((window.startMin + h * 60) % 1440) / 60));
  const weekendFactor = isWeekend(window.startMin) ? loadProfile.weekendFactor : 1;
  const avgWeight = hours.reduce((s, h) => s + loadProfile.hourlyWeights[h] * weekendFactor, 0) / hours.length;
  const activityPenalty = roundHalfEven(avgWeight * SCORING.tenantActivity.maxPoints, 1);
  if (activityPenalty > 0) factors.push({ code: SCORING.tenantActivity.code, points: activityPenalty, text: SCORING.tenantActivity.text, recordIds: [] });

  // b) Open outage-impact alerts, duration-independent (no end time on file).
  const alerts = openOutageAlerts(facilityId, componentIds);
  const alertPenalty = alerts.length > 0 ? SCORING.openAlert.points : 0;
  if (alertPenalty > 0) factors.push({ code: SCORING.openAlert.code, points: alertPenalty, text: SCORING.openAlert.text, recordIds: alerts.map((a) => a.alert_id) });

  // c) Booked maintenance on the same redundancy pair.
  const conflicts = maintenanceNear(componentIds, window.startMin, window.endMin);
  const maintenancePenalty = conflicts.length > 0 ? SCORING.maintenanceConflict.points : 0;
  if (maintenancePenalty > 0) factors.push({ code: SCORING.maintenanceConflict.code, points: maintenancePenalty, text: SCORING.maintenanceConflict.text, recordIds: conflicts.map((m) => m.maintenance_id) });

  // d) Margin after change (duration-independent).
  const marginPenalty = worstUtilisationFraction > TIGHT ? roundHalfEven(Math.min(1, (worstUtilisationFraction - TIGHT) / (1 - TIGHT)) * SCORING.marginAfterChange.maxPoints, 1) : 0;
  if (marginPenalty > 0) factors.push({ code: SCORING.marginAfterChange.code, points: marginPenalty, text: SCORING.marginAfterChange.text, recordIds: [] });

  // e) Generator runtime vs window length (duration-independent).
  const autonomyPenalty = autonomyExceeded ? SCORING.autonomyExceeded.points : 0;
  if (autonomyPenalty > 0) factors.push({ code: SCORING.autonomyExceeded.code, points: autonomyPenalty, text: SCORING.autonomyExceeded.text, recordIds: [] });

  const score = Math.max(0, roundHalfEven(100 - (activityPenalty + alertPenalty + maintenancePenalty + marginPenalty + autonomyPenalty), 1));
  return { start: fromMinutes(window.startMin), end: fromMinutes(window.endMin), startLabel: timeLabel(fromMinutes(window.startMin)), score, factors };
}

// Deterministic pre/execute/verify/rollback procedure. NOT sourced from
// runbooks.json — that dataset is incident-response only (matched against
// alert/incident text), with no planned-maintenance procedures on file.
// Any matching incident-response runbook is still surfaced separately as
// "related guidance", not as the primary procedure.
function buildRunbook({ component, action, transferToId, peers, tenants }) {
  let order = 1;
  const steps = [];
  const push = (phase, action_, owner_team, within_min) => steps.push({ order: order++, phase, action: action_, owner_team, within_min, source: 'generated' });

  push('pre', `Confirm ${peers.length ? peers.join(' and ') : 'no recorded peer'} is healthy and has spare margin before proceeding.`, 'Electrical/Facilities', 15);
  push('pre', 'Confirm no open outage-impact alert on this asset or its peer.', 'NOC', 10);
  for (const t of tenants) {
    push('pre', `Notify ${t.name} per contract clause ("${t.notificationClause ?? 'no clause on file'}").`, 'Customer Ops', 30);
  }

  const executeText = action === 'take_offline'
    ? `Take ${component.label} offline for the planned window.`
    : `Transfer load from ${component.label} to ${transferToId}.`;
  push('execute', executeText, 'Electrical/Facilities', 30);

  push('verify', 'Hold for stabilization and confirm no new breaking points appear.', 'NOC', 15);
  push('verify', 'Confirm the verdict conditions above remain satisfied for the duration of the window.', 'NOC', 15);

  const executeSteps = steps.filter((s) => s.phase === 'execute');
  push('rollback', `Rollback trigger: a surviving path exceeds 100% of derated capacity, or a new outage-impact alert opens on the peer.`, 'NOC', 0);
  for (const es of [...executeSteps].reverse()) push('rollback', `Reverse: "${es.action}"`, es.owner_team, es.within_min);
  push('rollback', 'Confirm original configuration restored and all paths nominal.', 'NOC', 15);

  const related = runbookFor(component.component_id, 'planned switchover maintenance');
  return { steps, relatedIncidentGuidance: related };
}

export function planSwitchover({ facilityId, componentId, action, transferToId = null, windowStart, durationHours, asOf = AS_OF }) {
  const validated = validateInput({ facilityId, componentId, action, transferToId, windowStart, durationHours });
  const baseInput = { facilityId, componentId, action, transferToId, windowStart, durationHours, asOf };

  if (!validated.mapped) {
    return {
      input: { ...baseInput, label: null, componentType: null },
      mapped: false,
      verdict: null,
      impact: null,
      racks: { count: 0, itKw: 0 },
      tenants: [],
      totalExposureInrLakh: 0,
      windows: { recommended: null, ranked: [] },
      runbook: { steps: [], relatedIncidentGuidance: [] },
    };
  }

  const { component, peers } = validated;
  const impact = buildImpact(facilityId, component);
  const { racks } = exposedRacks(facilityId, componentId);
  const tenants = tenantExposureFor(facilityId, racks, durationHours);
  const totalExposureInrLakh = roundHalfEven(tenants.reduce((s, t) => s + t.exposureInrLakh, 0), 1);

  const componentIds = [componentId, ...peers];
  const outageAlerts = openOutageAlerts(facilityId, componentIds);
  const verdict = verdictFor({ component, peers, impact, tenants, durationHours, outageAlerts });

  const worstUtilisationFraction = impact.kind === 'crah'
    ? impact.utilisationAfterPct / 100
    : Math.max(0, ...impact.impacts.map((i) => i.newUtilisationPct / 100), 0);
  const autonomyExceeded = Boolean(impact.generatorRuntimeHours && impact.generatorRuntimeHours.after < durationHours);

  const candidates = candidateWindows({ asOf, durationHours });
  const scored = candidates
    .map((w) => scoreWindow(w, { componentIds, facilityId, durationHours, worstUtilisationFraction, autonomyExceeded }))
    .sort((a, b) => b.score - a.score || toMinutes(a.start) - toMinutes(b.start));
  const ranked = scored.slice(0, 5);

  const runbook = buildRunbook({ component, action, transferToId, peers, tenants });

  return {
    input: { ...baseInput, label: component.label, componentType: component.component_type },
    mapped: true,
    verdict,
    impact,
    peers,
    racks: { count: racks.length, itKw: roundHalfEven(racks.reduce((s, r) => s + r.used_kw, 0), 1) },
    tenants,
    totalExposureInrLakh,
    windows: { recommended: ranked[0] ?? null, ranked },
    runbook,
  };
}
