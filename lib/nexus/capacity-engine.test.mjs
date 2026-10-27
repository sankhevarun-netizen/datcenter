// lib/nexus/capacity-engine.test.mjs — Stage 2 verification against PLAN.md §Stage 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStrandedCapacity, canAccommodate, densityReadiness } from './capacity-engine.js';
import { getRack } from './data.js';

const lakh = (inr) => Math.round(inr / 1e5);
const crore = (inr) => inr / 1e7;

test('Scene 1: structural stranded at MUM-1 is exactly 640 kW', () => {
  assert.equal(findStrandedCapacity('MUM-1').structuralKw, 640);
});

test('Scene 1: Row K 380 kW cooling-limited, Row C 190 kW space-limited, Rows P + Q 70 kW', () => {
  const byRow = Object.fromEntries(findStrandedCapacity('MUM-1').byRow.map((r) => [r.rowId, r]));
  assert.equal(byRow.K.strandedKw, 380);
  assert.equal(byRow.K.limitedBy, 'cooling');
  assert.equal(byRow.C.strandedKw, 190);
  assert.equal(byRow.C.limitedBy, 'space');
  assert.equal(byRow.P.strandedKw + byRow.Q.strandedKw, 70);
  assert.equal(byRow.P.strandedKw, 40);
  assert.equal(byRow.Q.strandedKw, 30);
});

test('Scene 1: Hall 4 planned headroom is 480 kW and kept separate from waste', () => {
  const s = findStrandedCapacity('MUM-1');
  assert.equal(s.plannedHeadroomKw, 480);
  assert.equal(s.unclassifiedKw, 0);
  const hall4 = s.byRow.filter((r) => r.hallId === 'MUM-1-H4');
  assert.equal(hall4.reduce((t, r) => t + r.strandedKw, 0), 480);
  assert.ok(hall4.every((r) => r.classification === 'planned headroom'));
});

test('Scene 1: ₹49 lakh annual carrying cost and ₹6.4 crore revenue opportunity', () => {
  const s = findStrandedCapacity('MUM-1');
  assert.equal(lakh(s.annualCarryingCostInr), 49);
  assert.equal(crore(s.revenueOpportunityInr), 6.4);
  assert.equal(s.capitalTiedUpInr, 640 * 80000);
});

test('Scene 2: canAccommodate(MUM-1, 34, 60) → space 34, power 22, cooling 14', () => {
  const r = canAccommodate({ facilityId: 'MUM-1', rackCount: 34, densityKw: 60 });
  assert.equal(r.maxBySpace, 34);
  assert.equal(r.maxByPower, 22);
  assert.equal(r.maxByCooling, 14);
});

test('Scene 2: cooling binds and 840 kW is deployable today', () => {
  const r = canAccommodate({ facilityId: 'MUM-1', rackCount: 34, densityKw: 60 });
  assert.equal(r.bindingConstraint, 'cooling');
  assert.equal(r.deployableKw, 840);
  assert.equal(r.feasible, false);
  assert.deepEqual(r.eligibleHalls, ['MUM-1-H4']);
});

test('Scene 2: deployable racks are 14 real, free Hall 4 racks and row allocations add up', () => {
  const r = canAccommodate({ facilityId: 'MUM-1', rackCount: 34, densityKw: 60 });
  assert.equal(r.deployableRacks.length, 14);
  assert.equal(new Set(r.deployableRacks).size, 14);
  for (const id of r.deployableRacks) {
    const rack = getRack(id);
    assert.equal(rack.status, 'free');
    assert.equal(rack.hall_id, 'MUM-1-H4');
  }
  assert.equal(r.rowBreakdown.reduce((s, x) => s + x.allocatedRacks, 0), 14);
  for (const row of r.rowBreakdown) {
    assert.ok(row.allocatedRacks <= row.freePositions);
    if (!row.eligible) assert.equal(row.limitedBy, 'density');
  }
});

test('Scene 2: shortfalls are reported without invented costs', () => {
  const r = canAccommodate({ facilityId: 'MUM-1', rackCount: 34, densityKw: 60 });
  const byResource = Object.fromEntries(r.requiredUpgrades.map((u) => [u.resource, u]));
  assert.equal(byResource.cooling.shortfallKw, (34 - 14) * 60);
  assert.equal(byResource.power.shortfallKw, (34 - 22) * 60);
  assert.equal(byResource.space, undefined);
  for (const u of r.requiredUpgrades) assert.equal(u.costInr, undefined);
});

test('a request within capacity is feasible and deploys exactly what was asked', () => {
  const r = canAccommodate({ facilityId: 'MUM-1', rackCount: 10, densityKw: 60 });
  assert.equal(r.feasible, true);
  assert.equal(r.deployableRacks.length, 10);
  assert.equal(r.deployableKw, 600);
});

test('densityReadiness: only Hall 4 rows clear the 50 kW AI bar; bands follow the plan', () => {
  const rows = densityReadiness('MUM-1');
  assert.equal(rows.length, 24);
  assert.deepEqual(rows.filter((r) => r.aiReady).map((r) => r.rowId), ['S', 'T', 'U', 'V', 'W', 'X']);
  for (const r of rows) {
    assert.equal(r.band, r.maxDensityKw >= 50 ? 'green' : r.maxDensityKw >= 20 ? 'amber' : 'red');
    assert.equal(r.gapKw, Math.max(0, 50 - r.maxDensityKw));
  }
});

test('deterministic: repeated calls return identical results', () => {
  assert.deepEqual(findStrandedCapacity('MUM-1'), findStrandedCapacity('MUM-1'));
  assert.deepEqual(canAccommodate({ facilityId: 'MUM-1', rackCount: 34, densityKw: 60 }), canAccommodate({ facilityId: 'MUM-1', rackCount: 34, densityKw: 60 }));
});

test('unknown facility and invalid input fail loudly', () => {
  assert.throws(() => findStrandedCapacity('NOPE'));
  assert.throws(() => canAccommodate({ facilityId: 'MUM-1', rackCount: 0, densityKw: 60 }));
});
