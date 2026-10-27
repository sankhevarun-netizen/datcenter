// lib/nexus/capacity-engine.js
//
// Deterministic capacity answers computed from the Nexus dataset. No AI, no
// randomness, no clock — the same question always gets the same answer.
// Scenes 1 and 2 of the demo are answered here.
import { getFacility, getRow, rowsOf, racksInRow } from './data.js';
import { propagateChange } from './impact-engine.js';

// PLAN.md §Stage 2 economics. STANDBY_LOSS_FRACTION is the one input the plan
// leaves undefined: 1.5% of stranded capacity lost as no-load/standby losses,
// running all year, priced at the facility's own tariff from 01_facilities.
export const ECONOMICS = Object.freeze({
  CAPITAL_PER_KW_INR: 80000,
  DEPRECIATION_YEARS: 15,
  MAINTENANCE_RATE: 0.015,
  STANDBY_LOSS_FRACTION: 0.015,
  HOURS_PER_YEAR: 8760,
  REVENUE_PER_KW_YEAR_INR: 100000,
});

export const AI_READY_DENSITY_KW = 50;
const CONSTRAINTS = ['space', 'power', 'cooling'];

/** The plan's stranded definition, applied to one row's raw columns. */
function rowStranding(row) {
  const designSpaceKw = row.usable_positions * row.max_density_kw;
  const deployableKw = Math.min(row.power_circuit_kw, row.cooling_capacity_kw, designSpaceKw);
  const strandedKw = row.power_circuit_kw - deployableKw;
  let limitedBy = null;
  if (strandedKw > 0) {
    if (row.cooling_capacity_kw < designSpaceKw) limitedBy = 'cooling';
    else if (designSpaceKw < row.cooling_capacity_kw) limitedBy = 'space';
    else limitedBy = 'cooling and space';
  }
  return { designSpaceKw, deployableKw, strandedKw, limitedBy };
}

/**
 * Scene 1. Power capacity installed but unusable because cooling or space is
 * the limit. Only rows the dataset classifies 'structural' are counted as
 * waste; 'planned headroom' is deliberate provisioning, reported separately.
 */
export function findStrandedCapacity(facilityId) {
  const facility = getFacility(facilityId);
  const byRow = rowsOf(facilityId)
    .map((row) => ({
      rowId: row.row_id,
      hallId: row.hall_id,
      classification: row.stranded_classification,
      powerCircuitKw: row.power_circuit_kw,
      coolingCapacityKw: row.cooling_capacity_kw,
      usablePositions: row.usable_positions,
      maxDensityKw: row.max_density_kw,
      ...rowStranding(row),
    }))
    .filter((r) => r.strandedKw > 0)
    .sort((a, b) => b.strandedKw - a.strandedKw || a.rowId.localeCompare(b.rowId));

  const sumOf = (cls) => byRow.filter((r) => r.classification === cls).reduce((s, r) => s + r.strandedKw, 0);
  const structuralKw = sumOf('structural');
  const plannedHeadroomKw = sumOf('planned headroom');
  const unclassifiedKw = sumOf(null);

  const { CAPITAL_PER_KW_INR, DEPRECIATION_YEARS, MAINTENANCE_RATE, STANDBY_LOSS_FRACTION, HOURS_PER_YEAR, REVENUE_PER_KW_YEAR_INR } = ECONOMICS;
  const capitalTiedUpInr = structuralKw * CAPITAL_PER_KW_INR;
  const depreciationInr = capitalTiedUpInr / DEPRECIATION_YEARS;
  const maintenanceInr = capitalTiedUpInr * MAINTENANCE_RATE;
  const standbyLossInr = structuralKw * STANDBY_LOSS_FRACTION * HOURS_PER_YEAR * facility.tariff_inr_kwh;

  return {
    facilityId,
    structuralKw,
    plannedHeadroomKw,
    unclassifiedKw,
    byRow,
    capitalTiedUpInr,
    annualCarryingCostInr: depreciationInr + maintenanceInr + standbyLossInr,
    carryingCostBreakdownInr: { depreciationInr, maintenanceInr, standbyLossInr },
    revenueOpportunityInr: structuralKw * REVENUE_PER_KW_YEAR_INR,
    tariffInrPerKwh: facility.tariff_inr_kwh,
  };
}

/** Largest-remainder split of `total` across items by weight, each capped at item.cap. Deterministic. */
function apportion(total, items) {
  const result = new Map(items.map((i) => [i.key, 0]));
  let remaining = total;
  let open = items.filter((i) => i.cap > 0);
  while (remaining > 0 && open.length > 0) {
    const weightSum = open.reduce((s, i) => s + i.weight, 0);
    const shares = open.map((i) => {
      const exact = weightSum > 0 ? (remaining * i.weight) / weightSum : remaining / open.length;
      return { item: i, exact, base: Math.min(Math.floor(exact), i.cap - result.get(i.key)) };
    });
    let given = shares.reduce((s, x) => s + x.base, 0);
    shares.forEach((x) => result.set(x.item.key, result.get(x.item.key) + x.base));
    const byRemainder = [...shares].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)) || a.item.key.localeCompare(b.item.key));
    for (const x of byRemainder) {
      if (given >= remaining) break;
      if (result.get(x.item.key) < x.item.cap) {
        result.set(x.item.key, result.get(x.item.key) + 1);
        given += 1;
      }
    }
    if (given === 0) break;
    remaining -= given;
    open = open.filter((i) => result.get(i.key) < i.cap);
  }
  return result;
}

/**
 * Scene 2. Can `rackCount` racks at `densityKw` each go into this facility?
 * Only rows rated for the density are eligible. Power and cooling headroom are
 * pooled per hall (a hall shares its busways and cooling plant), so each
 * hall contributes floor(pooled headroom / density) racks.
 */
export function canAccommodate({ facilityId, rackCount, densityKw }) {
  getFacility(facilityId);
  if (!(densityKw > 0) || !(rackCount > 0)) throw new Error('rackCount and densityKw must be positive');

  const rows = rowsOf(facilityId).map((row) => {
    const freeRacks = racksInRow(facilityId, row.row_id)
      .filter((r) => r.status === 'free')
      .sort((a, b) => a.position_in_row - b.position_in_row);
    return {
      row,
      eligible: row.max_density_kw >= densityKw,
      freeRacks,
      powerHeadroomKw: row.power_circuit_kw - row.used_kw,
      coolingHeadroomKw: row.cooling_capacity_kw - row.used_kw,
    };
  });

  const halls = new Map();
  for (const r of rows.filter((x) => x.eligible)) {
    if (!halls.has(r.row.hall_id)) halls.set(r.row.hall_id, []);
    halls.get(r.row.hall_id).push(r);
  }

  let maxBySpace = 0, maxByPower = 0, maxByCooling = 0;
  const hallResults = [];
  for (const [hallId, hallRows] of halls) {
    const space = hallRows.reduce((s, r) => s + r.freeRacks.length, 0);
    const powerKw = hallRows.reduce((s, r) => s + Math.max(0, r.powerHeadroomKw), 0);
    const coolingKw = hallRows.reduce((s, r) => s + Math.max(0, r.coolingHeadroomKw), 0);
    const limits = { space, power: Math.floor(powerKw / densityKw), cooling: Math.floor(coolingKw / densityKw) };
    maxBySpace += limits.space;
    maxByPower += limits.power;
    maxByCooling += limits.cooling;
    const canTake = Math.min(limits.space, limits.power, limits.cooling);
    const binding = CONSTRAINTS.reduce((a, b) => (limits[b] < limits[a] ? b : a));
    hallResults.push({ hallId, hallRows, limits, canTake, binding });
  }

  const limits = { space: maxBySpace, power: maxByPower, cooling: maxByCooling };
  const bindingConstraint = CONSTRAINTS.reduce((a, b) => (limits[b] < limits[a] ? b : a));
  const capacityRacks = hallResults.reduce((s, h) => s + h.canTake, 0);
  const deployableCount = Math.min(rackCount, capacityRacks);

  // Fill halls in id order, then spread each hall's racks across its rows in
  // proportion to their headroom on that hall's binding resource.
  const allocation = new Map();
  let toPlace = deployableCount;
  for (const h of [...hallResults].sort((a, b) => a.hallId.localeCompare(b.hallId))) {
    const n = Math.min(toPlace, h.canTake);
    toPlace -= n;
    const weightOf = (r) => (h.binding === 'space' ? r.freeRacks.length : h.binding === 'power' ? Math.max(0, r.powerHeadroomKw) : Math.max(0, r.coolingHeadroomKw));
    const split = apportion(n, h.hallRows.map((r) => ({ key: r.row.row_id, weight: weightOf(r), cap: r.freeRacks.length })));
    split.forEach((count, rowId) => allocation.set(rowId, count));
  }

  const deployableRacks = [];
  const rowBreakdown = rows.map((r) => {
    const allocated = allocation.get(r.row.row_id) ?? 0;
    deployableRacks.push(...r.freeRacks.slice(0, allocated).map((x) => x.rack_id));
    const hall = hallResults.find((h) => h.hallId === r.row.hall_id);
    return {
      rowId: r.row.row_id,
      hallId: r.row.hall_id,
      eligible: r.eligible,
      maxDensityKw: r.row.max_density_kw,
      freePositions: r.freeRacks.length,
      powerHeadroomKw: r.powerHeadroomKw,
      coolingHeadroomKw: r.coolingHeadroomKw,
      allocatedRacks: allocated,
      limitedBy: r.eligible ? hall.binding : 'density',
    };
  });

  const requiredUpgrades = CONSTRAINTS
    .filter((c) => limits[c] < rackCount)
    .map((c) => (c === 'space'
      ? { resource: 'space', shortfallRacks: rackCount - limits.space, description: `${rackCount - limits.space} more rack positions rated for ${densityKw} kW` }
      : { resource: c, shortfallKw: (rackCount - limits[c]) * densityKw, description: `${(rackCount - limits[c]) * densityKw} kW more ${c} headroom at ${densityKw} kW/rack` }));

  return {
    facilityId,
    requestedRacks: rackCount,
    requestedKw: rackCount * densityKw,
    densityKw,
    feasible: rackCount <= capacityRacks,
    maxBySpace,
    maxByPower,
    maxByCooling,
    bindingConstraint,
    deployableRackCount: deployableCount,
    deployableKw: deployableCount * densityKw,
    deployableRacks,
    eligibleHalls: hallResults.map((h) => h.hallId),
    rowBreakdown,
    requiredUpgrades,
  };
}

/**
 * How far can a row actually be pushed? Raises every rack in the row 1 kW at a
 * time from its current average density until the cascade engine reports a
 * component over its derated capacity.
 */
export function findBreakingPoint({ facilityId, rowId, maxDensityKw = 100 }) {
  getRow(facilityId, rowId);
  const racks = racksInRow(facilityId, rowId).filter((r) => r.status !== 'blocked');
  const currentDensity = racks.reduce((s, r) => s + r.used_kw, 0) / racks.length;
  let lastSafe = null;
  for (let density = Math.floor(currentDensity) + 1; density <= maxDensityKw; density += 1) {
    const result = propagateChange({ facilityId, changes: [{ rowId, newDensityKw: density }] });
    if (result.breakingPoints.length > 0) {
      const first = [...result.breakingPoints].sort((a, b) => a.hopDistance - b.hopDistance || b.newUtilisationPct - a.newUtilisationPct)[0];
      return {
        rowId,
        currentDensityKw: Math.round(currentDensity * 10) / 10,
        maxDensityKw: lastSafe,
        breaksAtDensityKw: density,
        firstConstraint: first.componentId,
        constraintType: first.componentType,
        constraintChain: first.chain,
      };
    }
    lastSafe = density;
  }
  return { rowId, currentDensityKw: Math.round(currentDensity * 10) / 10, maxDensityKw: lastSafe, breaksAtDensityKw: null, firstConstraint: null, constraintType: null, constraintChain: null };
}

/** Per-row density headroom against the AI-ready bar. */
export function densityReadiness(facilityId) {
  getFacility(facilityId);
  return rowsOf(facilityId).map((row) => {
    const maxDensityKw = row.max_density_kw;
    const aiReady = maxDensityKw >= AI_READY_DENSITY_KW;
    const gapKw = Math.max(0, AI_READY_DENSITY_KW - maxDensityKw);
    return {
      rowId: row.row_id,
      hallId: row.hall_id,
      maxDensityKw,
      aiReady,
      gapKw,
      band: maxDensityKw >= AI_READY_DENSITY_KW ? 'green' : maxDensityKw >= 20 ? 'amber' : 'red',
      upgradePath: aiReady
        ? `Rated for ${maxDensityKw} kW per rack — AI-ready today.`
        : `Rated for ${maxDensityKw} kW per rack. Reaching ${AI_READY_DENSITY_KW} kW needs +${gapKw} kW per rack of power and cooling across ${row.usable_positions} positions (${gapKw * row.usable_positions} kW for the row).`,
    };
  });
}
