// lib/nexus/impact-engine.js
//
// Scene 3: cascading impact of a load change through the dependency graph
// (05_dependencies). Pure, deterministic graph walk — no AI, no randomness.
//
// How load moves (all derived from the dataset, see lib/nexus/schema.js):
//   - A row's change is applied rack by rack; each rack's delta goes to the
//     PDU that feeds it (fed_by_pdu) and the CRAH that cools it (cooled_by_crah).
//   - Electrical deltas then walk upstream (against the supply->load edges):
//     PDU -> busway -> RPP -> UPS -> switchgear -> transformer -> utility feed.
//   - Thermal deltas walk CRAH -> chilled water loop.
//   - An N+1 pair whose members report the shared pair load (the UPS pairs)
//     takes a child's full delta as one group. Any other multi-parent split
//     (the 2N switchgear sides) divides the delta by the parents' current
//     load share — e.g. SWGR-A carries 3,740 of 6,800 kW, so it takes 55%.
//   - Standby or unmetered components (dataset current_load = 0: generators,
//     chillers, towers) carry no load in the walk; their effect is reported
//     through secondaryEffects instead.
import { getComponent, getFacility, getRow, componentsOf, racksInRow, index } from './data.js';

export const PHYSICS = Object.freeze({
  // kVA -> kW. Implied by the dataset: UPS-1 reports 2,132.2 kVA for the
  // 1,919 kW its RPPs carry; TX-1 reports 4,155.6 kVA for SWGR-A's 3,740 kW.
  POWER_FACTOR: 0.9,
  WATER_CP_KJ_PER_KG_K: 4.18,
  HOURS_PER_YEAR: 8760,
  // 08_secondary_effects note: "Energy delta assumes 47% average utilisation of the added load."
  AVERAGE_UTILISATION: 0.47,
  // Calibrated, not derived: the workbook gives no PUE formula. Its planted
  // Row G projection (PUE 1.58 -> 1.71) implies 2.594 kW of facility draw per
  // kW of IT added above a legacy row's rated density (supplementary cooling
  // and fan power for load the CRAHs were not built for). Load added within a
  // row's rating uses the facility's own PUE.
  OVER_RATING_MARGINAL_PUE: 2.594,
});

const TIGHT_FROM = 0.8;

/** Round half to even, matching how the workbook's expected results were produced. */
export function roundHalfEven(value, dp = 1) {
  const f = 10 ** dp;
  const x = value * f;
  const floor = Math.floor(x);
  const diff = x - floor;
  const EPS = 1e-9;
  let r;
  if (Math.abs(diff - 0.5) < EPS) r = floor % 2 === 0 ? floor : floor + 1;
  else r = Math.round(x);
  return r / f;
}

const isMetered = (c) => c.current_load > 0;
const isSharedGroupMember = (c) => c.redundancy === 'N+1' && c.redundantPeers.length > 0 && isMetered(c);
const groupKey = (c) => [c.component_id, ...c.redundantPeers].sort().join('|');

function chwDeltaT(loop) {
  const m = /delta-T\s*(\d+(?:\.\d+)?)\s*K/i.exec(loop.note || '');
  if (!m) throw new Error(`No delta-T in note for ${loop.component_id}`);
  return Number(m[1]);
}

// Conversions between the walk's kW basis and each component's reporting basis.
// UPS is reported in kW (its N+1 check is "one unit carries X kW"); transformers
// stay in their native kVA; chilled water loops are reported in LPM.
function reportingBasis(c) {
  const PF = PHYSICS.POWER_FACTOR;
  switch (c.component_type) {
    case 'ups':
      return { unit: 'kW', old: c.current_load * PF, derated: c.capacity * c.derate_factor * PF, fromKw: (kw) => kw, toKw: (v) => v };
    case 'transformer':
      return { unit: 'kVA', old: c.current_load, derated: c.capacity * c.derate_factor, fromKw: (kw) => kw / PF, toKw: (v) => v * PF };
    case 'chw_loop': {
      const lpmPerKw = 60 / (PHYSICS.WATER_CP_KJ_PER_KG_K * chwDeltaT(c));
      return { unit: 'LPM', old: c.current_load, derated: c.capacity * c.derate_factor, fromKw: (kw) => kw * lpmPerKw, toKw: (v) => v / lpmPerKw };
    }
    default:
      return { unit: c.unit, old: c.current_load, derated: c.capacity * c.derate_factor, fromKw: (kw) => kw, toKw: (v) => v };
  }
}

/** The metered components one step further from the load. */
function upstreamOf(id, chain) {
  const c = getComponent(id);
  const ids = chain === 'thermal' && c.component_type === 'rack_row'
    ? (index.edgesFrom.get(id) ?? []).filter((e) => e.chain === 'thermal').map((e) => e.target_component_id)
    : (index.edgesTo.get(id) ?? []).filter((e) => e.chain === chain).map((e) => e.source_component_id);
  // Rows are the load itself — never upstream (the row -> CRAH edge would otherwise loop back).
  return ids.filter((x) => {
    const p = getComponent(x);
    return p.component_type !== 'rack_row' && isMetered(p);
  });
}

/** Split a kW delta across parents: whole to a shared N+1 group, otherwise by current-load share. */
function splitAcross(parentIds, deltaKw) {
  if (parentIds.length === 0) return [];
  if (parentIds.length === 1) return [[parentIds[0], deltaKw]];
  const parents = parentIds.map(getComponent);
  if (parents.every(isSharedGroupMember) && new Set(parents.map(groupKey)).size === 1) {
    return parentIds.map((id) => [id, deltaKw]);
  }
  const loads = parents.map((p) => reportingBasis(p).toKw(reportingBasis(p).old));
  const total = loads.reduce((s, v) => s + v, 0);
  return parentIds.map((id, i) => [id, total > 0 ? (deltaKw * loads[i]) / total : deltaKw / parentIds.length]);
}

/** Level-by-level upstream walk. seeds: Map(id -> {deltaKw, chain}) at hop 1. */
function walk(seeds) {
  const totals = new Map(); // id -> { deltaKw, hop, chain }
  let frontier = new Map([...seeds].map(([id, s]) => [id, { ...s }]));
  let hop = 1;
  while (frontier.size > 0) {
    const next = new Map();
    const sentFromGroup = new Set();
    for (const [id, { deltaKw, chain }] of frontier) {
      const prev = totals.get(id);
      totals.set(id, { deltaKw: (prev?.deltaKw ?? 0) + deltaKw, hop: prev?.hop ?? hop, chain });

      const c = getComponent(id);
      let parents;
      if (isSharedGroupMember(c)) {
        // The group forwards its delta once, from the union of its members' parents.
        const key = groupKey(c);
        if (sentFromGroup.has(key)) continue;
        sentFromGroup.add(key);
        const members = [c.component_id, ...c.redundantPeers];
        parents = [...new Set(members.flatMap((m) => upstreamOf(m, chain)))];
      } else {
        parents = upstreamOf(id, chain);
      }
      for (const [pid, d] of splitAcross(parents, deltaKw)) {
        const acc = next.get(pid);
        next.set(pid, { deltaKw: (acc?.deltaKw ?? 0) + d, chain });
      }
    }
    frontier = next;
    hop += 1;
    if (hop > 50) throw new Error('Dependency walk did not terminate');
  }
  return totals;
}

function classify(c, newLoad, derated, failedIds) {
  if (isSharedGroupMember(c)) {
    const members = [c.component_id, ...c.redundantPeers].map(getComponent).filter((m) => !failedIds.has(m.component_id));
    const caps = members.map((m) => reportingBasis(m).derated);
    const full = caps.reduce((s, v) => s + v, 0);
    const survivor = members.length > 1 ? full - Math.max(...caps) : full;
    const utilisation = newLoad / (members.length > 1 ? survivor : full);
    if (newLoad > full) return { status: 'exceeded', utilisation };
    if (members.length <= 1 || newLoad > survivor) return { status: 'redundancy_lost', utilisation };
    return { status: utilisation >= TIGHT_FROM ? 'tight' : 'ok', utilisation };
  }
  const utilisation = newLoad / derated;
  if (utilisation > 1) return { status: 'exceeded', utilisation };
  return { status: utilisation >= TIGHT_FROM ? 'tight' : 'ok', utilisation };
}

function generatorAutonomyHours(facilityId) {
  for (const g of componentsOf(facilityId).filter((c) => c.component_type === 'generator')) {
    const m = /(\d+(?:\.\d+)?)\s*h\s+fuel autonomy/i.exec(g.note || '');
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * changes: [{ rowId, newDensityKw }] | [{ componentId, newLoad }] | [{ componentId, failed: true }]
 * newLoad is in the component's reporting basis (kW, kVA for transformers, LPM for chilled water).
 */
export function propagateChange({ facilityId, changes }) {
  const facility = getFacility(facilityId);
  const seeds = new Map();
  const addSeed = (id, deltaKw, chain) => {
    const s = seeds.get(id);
    seeds.set(id, { deltaKw: (s?.deltaKw ?? 0) + deltaKw, chain });
  };
  const failedIds = new Set();
  const rowChanges = [];
  let itDeltaKw = 0;
  let facilityDrawDeltaKw = 0;

  for (const change of changes) {
    if (change.rowId != null) {
      const row = getRow(facilityId, change.rowId);
      // Optional rackCount: only the first N positions of the row change.
      const rowRacks = racksInRow(facilityId, change.rowId)
        .filter((r) => r.status !== 'blocked')
        .sort((a, b) => a.position_in_row - b.position_in_row);
      const racks = change.rackCount > 0 ? rowRacks.slice(0, change.rackCount) : rowRacks;
      const oldKw = racks.reduce((s, r) => s + r.used_kw, 0);
      for (const r of racks) {
        const d = change.newDensityKw - r.used_kw;
        addSeed(r.fed_by_pdu, d, 'electrical');
        addSeed(r.cooled_by_crah, d, 'thermal');
      }
      const newKw = racks.length * change.newDensityKw;
      const deltaKw = newKw - oldKw;
      itDeltaKw += deltaKw;
      const marginal = change.newDensityKw > row.max_density_kw ? PHYSICS.OVER_RATING_MARGINAL_PUE : facility.pue;
      facilityDrawDeltaKw += deltaKw * marginal;
      rowChanges.push({
        rowId: change.rowId,
        componentId: `ROW-${change.rowId}`,
        rackCount: racks.length,
        oldDensityKw: roundHalfEven(oldKw / racks.length, 1),
        newDensityKw: change.newDensityKw,
        ratedDensityKw: row.max_density_kw,
        oldKw: roundHalfEven(oldKw, 1),
        newKw,
        deltaKw: roundHalfEven(deltaKw, 1),
      });
    } else if (change.componentId) {
      const c = getComponent(change.componentId);
      const basis = reportingBasis(c);
      if (change.failed) {
        failedIds.add(c.component_id);
        // A failed member of a shared N+1 group moves no load — its peer already
        // carries the pair load. Any other component with peers hands its load to them.
        if (!isSharedGroupMember(c) && c.redundantPeers.length > 0) {
          const loadKw = basis.toKw(basis.old);
          for (const p of c.redundantPeers) addSeed(p, loadKw / c.redundantPeers.length, c.chain === 'thermal' ? 'thermal' : 'electrical');
        }
      } else {
        const deltaKw = basis.toKw(change.newLoad - basis.old);
        for (const [pid, d] of splitAcross(upstreamOf(c.component_id, c.chain), deltaKw)) addSeed(pid, d, c.chain);
      }
    } else {
      throw new Error('Each change needs rowId or componentId');
    }
  }

  const totals = walk(seeds);

  const impacts = [];
  for (const [id, t] of totals) {
    const c = getComponent(id);
    const basis = reportingBasis(c);
    const newLoad = basis.old + basis.fromKw(t.deltaKw);
    const oldEval = classify(c, basis.old, basis.derated, new Set());
    const newEval = classify(c, newLoad, basis.derated, failedIds);
    impacts.push({
      componentId: id,
      label: c.label,
      componentType: c.component_type,
      chain: c.chain,
      hopDistance: t.hop,
      unit: basis.unit,
      capacity: c.capacity,
      deratedCapacity: roundHalfEven(basis.derated, 1),
      oldLoad: roundHalfEven(basis.old, 1),
      newLoad: roundHalfEven(newLoad, 1),
      oldUtilisationPct: roundHalfEven(oldEval.utilisation * 100, 1),
      newUtilisationPct: roundHalfEven(newEval.utilisation * 100, 1),
      status: newEval.status,
      _exactOld: basis.old,
      _exactNew: newLoad,
    });
  }
  for (const id of failedIds) {
    const c = getComponent(id);
    const basis = reportingBasis(c);
    impacts.push({
      componentId: id, label: c.label, componentType: c.component_type, chain: c.chain, hopDistance: 0, unit: basis.unit,
      capacity: c.capacity, deratedCapacity: roundHalfEven(basis.derated, 1), oldLoad: roundHalfEven(basis.old, 1), newLoad: 0,
      oldUtilisationPct: roundHalfEven((basis.old / basis.derated) * 100, 1), newUtilisationPct: 0, status: 'failed',
      outage: c.redundantPeers.length === 0, _exactOld: basis.old, _exactNew: 0,
    });
  }
  impacts.sort((a, b) => a.hopDistance - b.hopDistance || a.chain.localeCompare(b.chain) || a.componentId.localeCompare(b.componentId));

  const breakingPoints = impacts.filter((i) => i.status === 'exceeded');
  const redundancyLosses = impacts.filter((i) => i.status === 'redundancy_lost');

  // Upgrades from 06_upgrade_options. One option covers a whole shared group.
  const requiredUpgrades = [];
  const coveredGroups = new Set();
  const unresolved = [];
  for (const i of [...breakingPoints, ...redundancyLosses]) {
    const c = getComponent(i.componentId);
    if (isSharedGroupMember(c)) {
      const key = groupKey(c);
      if (coveredGroups.has(key)) continue;
      const option = [c.component_id, ...c.redundantPeers].map((m) => index.upgradeByComponent.get(m)).find(Boolean);
      if (option) { coveredGroups.add(key); requiredUpgrades.push(option); } else unresolved.push(i.componentId);
    } else {
      const option = index.upgradeByComponent.get(i.componentId);
      if (option) requiredUpgrades.push(option); else unresolved.push(i.componentId);
    }
  }
  const upgrades = requiredUpgrades.map((u) => ({
    componentId: u.component_id, description: u.description, newCapacity: u.new_capacity,
    costInrLakh: u.cost_inr_lakh, leadTimeWeeks: u.lead_time_weeks, blocksWhat: u.blocks_what,
  }));

  const verdict = unresolved.length > 0 ? 'not_feasible' : upgrades.length > 0 ? 'feasible_with_upgrades' : 'feasible';

  return {
    facilityId,
    verdict,
    rowChanges,
    failedComponents: [...failedIds],
    impacts: impacts.map(({ _exactOld, _exactNew, ...rest }) => rest),
    breakingPoints: breakingPoints.map(({ _exactOld, _exactNew, ...rest }) => rest),
    redundancyLosses: redundancyLosses.map(({ _exactOld, _exactNew, ...rest }) => rest),
    unresolvedComponents: unresolved,
    secondaryEffects: secondaryEffects({ facility, impacts, itDeltaKw, facilityDrawDeltaKw }),
    requiredUpgrades: upgrades,
    totalUpgradeCostInrLakh: upgrades.reduce((s, u) => s + u.costInrLakh, 0),
    criticalPathWeeks: upgrades.length ? Math.max(...upgrades.map((u) => u.leadTimeWeeks)) : 0,
  };
}

function beforeAfter(before, after, dp) {
  return { before: roundHalfEven(before, dp), after: roundHalfEven(after, dp), delta: roundHalfEven(roundHalfEven(after, dp) - roundHalfEven(before, dp), dp) };
}

function secondaryEffects({ facility, impacts, itDeltaKw, facilityDrawDeltaKw }) {
  const { HOURS_PER_YEAR, AVERAGE_UTILISATION } = PHYSICS;

  const loops = impacts.filter((i) => i.componentType === 'chw_loop');
  const chwFlowLpm = loops.length
    ? beforeAfter(loops.reduce((s, l) => s + l._exactOld, 0), loops.reduce((s, l) => s + l._exactNew, 0), 0)
    : null;

  // Annual IT energy at the stated average utilisation; baseline at the
  // workbook's reporting precision (0.01 GWh), deltas exact.
  const baselineKwh = roundHalfEven((facility.used_it_kw * HOURS_PER_YEAR * AVERAGE_UTILISATION) / 1e6, 2) * 1e6;
  const deltaKwh = itDeltaKw * HOURS_PER_YEAR * AVERAGE_UTILISATION;
  const annualEnergyGwh = {
    before: roundHalfEven(baselineKwh / 1e6, 2),
    after: roundHalfEven((baselineKwh + deltaKwh) / 1e6, 2),
    delta: roundHalfEven(deltaKwh / 1e6, 2),
  };
  const annualWaterLitres = {
    before: Math.round(baselineKwh * facility.wue_l_per_kwh),
    after: Math.round((baselineKwh + deltaKwh) * facility.wue_l_per_kwh),
    delta: Math.round(deltaKwh * facility.wue_l_per_kwh),
  };

  const drawBefore = facility.pue * facility.used_it_kw;
  const pue = beforeAfter(facility.pue, (drawBefore + facilityDrawDeltaKw) / (facility.used_it_kw + itDeltaKw), 2);

  // Fuel is fixed, so autonomy scales inversely with the backed (UPS) load the change flows through.
  const autonomy = generatorAutonomyHours(facility.facility_id);
  const seenGroups = new Set();
  let backedBefore = 0, backedAfter = 0;
  for (const i of impacts.filter((x) => x.componentType === 'ups')) {
    const key = groupKey(getComponent(i.componentId));
    if (seenGroups.has(key)) continue;
    seenGroups.add(key);
    backedBefore += i._exactOld;
    backedAfter += i._exactNew;
  }
  const generatorRuntimeHours = autonomy == null
    ? null
    : backedBefore > 0
      ? beforeAfter(autonomy, (autonomy * backedBefore) / backedAfter, 1)
      : beforeAfter(autonomy, autonomy, 1);

  return { chwFlowLpm, annualEnergyGwh, annualWaterLitres, pue, generatorRuntimeHours };
}
