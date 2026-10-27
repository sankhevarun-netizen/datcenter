import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thermalMap, crahFailover, thermalSummary, binFor, ASHRAE } from './thermal-model.js';
import { thermalView } from './twin-model.js';
import { analyseIncident } from './incident-engine.js';
import { buildFacts, templateNarration, allowedNumbers, safePrefix } from './narrator.js';
import { nexus } from './data.js';

const base = thermalMap('MUM-1');

test('the estimate reproduces both cold-aisle sensor readings in every row', () => {
  for (const row of base.rows) {
    assert.equal(row.racks[0].inletC, row.sensors.nearC, `${row.rowId} near end`);
    assert.equal(row.racks.at(-1).inletC, row.sensors.farC, `${row.rowId} far end`);
  }
});

test('every rack is within the recommended inlet limit today', () => {
  for (const row of base.rows) assert.ok(row.maxInletC < ASHRAE.recommendedMaxC, row.rowId);
});

test('a CRAH loss in Row A is absorbed; in Row K it is not', () => {
  const a = crahFailover('CRAH-A-01');
  assert.equal(a.holds, true);
  assert.deepEqual(a.survivors, ['CRAH-A-02']);
  const k = crahFailover('CRAH-K-01');
  assert.equal(k.holds, false);
  assert.equal(k.loadKw, 180);
  assert.equal(k.survivorCapacityKw, 99);
});

test('failure heats only its own row, and more load means more heat', () => {
  const failed = thermalMap('MUM-1', { failedCrah: 'CRAH-K-01' });
  for (const row of failed.rows) {
    const before = base.rows.find((r) => r.rowId === row.rowId);
    if (row.rowId === 'K') assert.ok(row.maxInletC > before.maxInletC);
    else assert.equal(row.maxInletC, before.maxInletC, row.rowId);
  }
  assert.ok(crahFailover('CRAH-K-01').riseC > crahFailover('CRAH-A-01').riseC);
});

test('exposed rows are exactly those whose surviving CRAH cannot carry the row', () => {
  const s = thermalSummary('MUM-1');
  const expected = nexus.rows.filter((r) => r.facility_id === 'MUM-1')
    .filter((r) => !crahFailover(`CRAH-${r.row_id}-01`).holds || !crahFailover(`CRAH-${r.row_id}-02`).holds)
    .map((r) => r.row_id);
  assert.deepEqual(s.exposedRows, expected);
  assert.ok(s.exposedRows.includes('K'));
});

test('the incident brief now reports Row K as exposed, not covered', () => {
  const crah = analyseIncident({ alertId: 'ALM-4821' });
  assert.equal(crah.who.protection.state, 'exposed');
  assert.match(crah.who.protection.detail, /99 kW rating/);
});

test('thermal view colours every rack and marks the failed unit', () => {
  const view = thermalView('MUM-1', thermalMap('MUM-1', { failedCrah: 'CRAH-K-01' }));
  assert.equal(Object.keys(view.rackStates).length, nexus.racks.length);
  assert.equal(view.componentStates['CRAH-K-01'].state, 'failed');
  assert.equal(binFor(40), 'thermal-4');
});

test('thermal narration passes the number guard, with and without a failure', () => {
  for (const failedCrah of [null, 'CRAH-K-01']) {
    const result = { map: thermalMap('MUM-1', { failedCrah }), summary: thermalSummary('MUM-1') };
    const facts = buildFacts('thermal', result);
    const text = templateNarration('thermal', facts);
    assert.equal(safePrefix(text, allowedNumbers(facts), true).violation, false, String(failedCrah));
  }
});
