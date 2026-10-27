// lib/nexus/impact-engine.test.mjs — Stage 3 verification against 07_cascade_result / 08_secondary_effects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propagateChange, roundHalfEven } from './impact-engine.js';
import { findBreakingPoint } from './capacity-engine.js';
import { getComponent, racksInRow, nexus } from './data.js';
import expectedCascade from '../../data/nexus/fixtures/cascadeResult.json';
import expectedSecondary from '../../data/nexus/fixtures/secondaryEffects.json';

const rowG = () => propagateChange({ facilityId: 'MUM-1', changes: [{ rowId: 'G', newDensityKw: 60 }] });
const byId = (r) => Object.fromEntries(r.impacts.map((i) => [i.componentId, i]));

test('cascade matches 07_cascade_result exactly, component by component', () => {
  const impacts = byId(rowG());
  for (const e of expectedCascade) {
    const i = impacts[e.component_id];
    assert.ok(i, `missing ${e.component_id}`);
    assert.equal(i.label, e.label, e.component_id);
    assert.equal(i.chain, e.chain, e.component_id);
    assert.equal(i.hopDistance, e.hop_distance, `${e.component_id} hop`);
    assert.equal(i.capacity, e.capacity, `${e.component_id} capacity`);
    assert.equal(i.deratedCapacity, e.derated_capacity, `${e.component_id} derated`);
    assert.equal(i.oldLoad, e.old_load, `${e.component_id} old load`);
    assert.equal(i.newLoad, e.new_load, `${e.component_id} new load`);
    assert.equal(i.oldUtilisationPct, e.old_utilisation_pct, `${e.component_id} old %`);
    assert.equal(i.newUtilisationPct, e.new_utilisation_pct, `${e.component_id} new %`);
    assert.equal(i.status, e.status, `${e.component_id} status`);
  }
});

test('anything the walk reports beyond the expected sheet is ok (the B-side share)', () => {
  const expectedIds = new Set(expectedCascade.map((e) => e.component_id));
  const extras = rowG().impacts.filter((i) => !expectedIds.has(i.componentId));
  assert.deepEqual(extras.map((i) => i.componentId).sort(), ['SWGR-B', 'TX-2', 'UTIL-FEED-B']);
  for (const i of extras) assert.equal(i.status, 'ok');
});

test('Scene 3: exactly 5 exceeded, the UPS pair loses N+1, 4 tight', () => {
  const r = rowG();
  assert.deepEqual(r.breakingPoints.map((i) => i.componentId).sort(), ['BUSWAY-B2', 'CRAH-G-01', 'CRAH-G-02', 'PDU-G1', 'PDU-G2']);
  assert.deepEqual(r.redundancyLosses.map((i) => i.componentId).sort(), ['UPS-1', 'UPS-2']);
  assert.deepEqual(r.impacts.filter((i) => i.status === 'tight').map((i) => i.componentId).sort(), ['CHW-LOOP-1', 'RPP-2', 'SWGR-A', 'UTIL-FEED-A']);
});

test('Scene 3: secondary effects match 08_secondary_effects exactly', () => {
  const s = rowG().secondaryEffects;
  const want = Object.fromEntries(expectedSecondary.map((x) => [x.metric, x]));
  const pairs = [
    [s.chwFlowLpm, want['Chilled water flow']],
    [s.annualEnergyGwh, want['Annual energy']],
    [s.annualWaterLitres, want['Annual water']],
    [s.pue, want.PUE],
    [s.generatorRuntimeHours, want['Generator runtime at full backed load']],
  ];
  for (const [got, exp] of pairs) {
    assert.equal(got.before, exp.before, `${exp.metric} before`);
    assert.equal(got.after, exp.after, `${exp.metric} after`);
    assert.equal(got.delta, exp.delta, `${exp.metric} delta`);
  }
});

test('Scene 3: ₹250 lakh of upgrades, 16-week critical path, feasible with upgrades', () => {
  const r = rowG();
  assert.equal(r.totalUpgradeCostInrLakh, 250);
  assert.equal(r.criticalPathWeeks, 16);
  assert.equal(r.verdict, 'feasible_with_upgrades');
  assert.deepEqual(r.requiredUpgrades.map((u) => u.componentId).sort(), ['BUSWAY-B2', 'CRAH-G-01', 'CRAH-G-02', 'PDU-G1', 'PDU-G2', 'UPS-1']);
});

test('load accumulates correctly up a multi-level chain (hand-calculated)', () => {
  const impacts = byId(rowG());
  // PDU-G1: its own racks' current load plus each rack's increase to 60 kW.
  const g1Racks = racksInRow('MUM-1', 'G').filter((r) => r.fed_by_pdu === 'PDU-G1');
  const handPduG1 = g1Racks.reduce((s, r) => s + r.used_kw + (60 - r.used_kw), 0);
  assert.equal(impacts['PDU-G1'].newLoad, handPduG1);
  // Busway, RPP and the UPS pair each carry the full +1,000 kW row delta.
  assert.equal(impacts['BUSWAY-B2'].newLoad - impacts['BUSWAY-B2'].oldLoad, 1000);
  assert.equal(impacts['RPP-2'].newLoad - impacts['RPP-2'].oldLoad, 1000);
  assert.equal(roundHalfEven(impacts['UPS-1'].newLoad - impacts['UPS-1'].oldLoad, 1), 1000);
  // Above the UPS pair the 2N sides split by today's share: 3,740 / 6,800 = 55%.
  assert.equal(impacts['SWGR-A'].newLoad - impacts['SWGR-A'].oldLoad, 550);
  assert.equal(impacts['SWGR-B'].newLoad - impacts['SWGR-B'].oldLoad, 450);
});

test('redundancy loss is detected separately from a capacity breach', () => {
  const ups1 = byId(rowG())['UPS-1'];
  // 2,919 kW is over one unit (2,160) but inside the pair (4,320): N+1 lost, not exceeded.
  assert.equal(ups1.status, 'redundancy_lost');
  assert.ok(ups1.newLoad > ups1.deratedCapacity);
  assert.ok(ups1.newLoad < ups1.deratedCapacity * 2);
});

test('thermal chain propagates independently of the electrical chain', () => {
  const busway = getComponent('BUSWAY-B2');
  const r = propagateChange({ facilityId: 'MUM-1', changes: [{ componentId: 'BUSWAY-B2', newLoad: busway.current_load + 200 }] });
  assert.ok(r.impacts.length > 0);
  assert.ok(r.impacts.every((i) => i.chain === 'electrical'), 'an electrical-only change touched a thermal component');
  const thermalOnly = rowG().impacts.filter((i) => i.chain === 'thermal').map((i) => i.componentId).sort();
  assert.deepEqual(thermalOnly, ['CHW-LOOP-1', 'CRAH-G-01', 'CRAH-G-02']);
});

test('hop distances order the ripple outward from the changed row', () => {
  const hops = Object.fromEntries(rowG().impacts.map((i) => [i.componentId, i.hopDistance]));
  assert.deepEqual(
    ['PDU-G1', 'BUSWAY-B2', 'RPP-2', 'UPS-1', 'SWGR-A', 'TX-1', 'UTIL-FEED-A'].map((id) => hops[id]),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.deepEqual(['CRAH-G-01', 'CHW-LOOP-1'].map((id) => hops[id]), [1, 2]);
});

test('losing utility feed A pushes the whole facility onto feed B', () => {
  const r = propagateChange({ facilityId: 'MUM-1', changes: [{ componentId: 'UTIL-FEED-A', failed: true }] });
  const i = byId(r);
  assert.equal(i['UTIL-FEED-A'].status, 'failed');
  assert.equal(i['UTIL-FEED-B'].newLoad, 6800);
  assert.equal(i['UTIL-FEED-B'].status, 'exceeded');
});

test('findBreakingPoint: Row G breaks first at its CRAHs, one step above what they can cool', () => {
  const bp = findBreakingPoint({ facilityId: 'MUM-1', rowId: 'G' });
  const crah = getComponent('CRAH-G-01');
  const racksOnCrah = racksInRow('MUM-1', 'G').filter((r) => r.cooled_by_crah === 'CRAH-G-01').length;
  const handMax = Math.floor((crah.capacity * crah.derate_factor) / racksOnCrah);
  assert.equal(bp.constraintType, 'crah');
  assert.equal(bp.maxDensityKw, handMax);
  assert.equal(bp.breaksAtDensityKw, handMax + 1);
});

test('rackCount changes only the first N racks of the row', () => {
  const r = propagateChange({ facilityId: 'MUM-1', changes: [{ rowId: 'G', newDensityKw: 60, rackCount: 10 }] });
  const first10 = [...racksInRow('MUM-1', 'G')].sort((a, b) => a.position_in_row - b.position_in_row).slice(0, 10);
  const oldKw = first10.reduce((s, x) => s + x.used_kw, 0);
  assert.equal(r.rowChanges[0].rackCount, 10);
  assert.equal(r.rowChanges[0].newKw, 600);
  assert.equal(r.rowChanges[0].deltaKw, roundHalfEven(600 - oldKw, 1));
});

test('148-component graph walk completes in under 100 ms', () => {
  rowG();
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) rowG();
  assert.ok((performance.now() - t0) / 10 < 100);
});

test('deterministic and side-effect free', () => {
  const before = JSON.stringify(nexus.components);
  assert.deepEqual(rowG(), rowG());
  assert.equal(JSON.stringify(nexus.components), before);
});
