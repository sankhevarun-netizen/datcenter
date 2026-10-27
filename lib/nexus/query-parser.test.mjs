// lib/nexus/query-parser.test.mjs — the six example queries from PLAN.md §Stage 5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocally, resolveQuery, parseQuery, matchComponent } from './query-parser.js';

const resolve = (q) => resolveQuery(parseLocally(q));

test('"Can we take 2MW at 60kW density?" → capacity check, 34 racks computed in JS', () => {
  const p = parseLocally('Can we take 2MW at 60kW density?');
  assert.equal(p.intent, 'capacity_check');
  assert.equal(p.requestedPowerValue, 2);
  assert.equal(p.requestedPowerUnit, 'MW');
  assert.equal(p.densityKw, 60);
  assert.equal(p.rackCount, null, 'the parser must not do the 2,000 / 60 arithmetic');
  assert.deepEqual(resolveQuery(p), { intent: 'capacity_check', params: { facilityId: 'MUM-1', rackCount: 34, densityKw: 60, requestedKw: 2000 } });
});

test('"Where can I put 30 racks at 40kW?" → capacity check for 30 racks', () => {
  assert.deepEqual(resolve('Where can I put 30 racks at 40kW?'), { intent: 'capacity_check', params: { facilityId: 'MUM-1', rackCount: 30, densityKw: 40, requestedKw: null } });
});

test('"Show me stranded capacity" → stranded', () => {
  assert.deepEqual(resolve('Show me stranded capacity'), { intent: 'stranded_capacity', params: { facilityId: 'MUM-1' } });
});

test('"What if Row G goes to 60kW?" → cascade on Row G', () => {
  assert.deepEqual(resolve('What if Row G goes to 60kW?'), { intent: 'cascade_simulation', params: { facilityId: 'MUM-1', rowId: 'G', densityKw: 60 } });
});

test('"Which rows are AI ready?" → density readiness', () => {
  assert.deepEqual(resolve('Which rows are AI ready?'), { intent: 'density_readiness', params: { facilityId: 'MUM-1' } });
});

test('"What happens if we lose utility feed A?" → failure of UTIL-FEED-A', () => {
  assert.deepEqual(resolve('What happens if we lose utility feed A?'), { intent: 'failure_simulation', params: { facilityId: 'MUM-1', componentId: 'UTIL-FEED-A' } });
});

test('component names map to real ids', () => {
  assert.equal(matchComponent('UPS 2'), 'UPS-2');
  assert.equal(matchComponent('transformer 1'), 'TX-1');
  assert.equal(matchComponent('chiller 1'), 'CHILLER-1');
  assert.equal(matchComponent('UTIL-FEED-B'), 'UTIL-FEED-B');
  assert.equal(matchComponent('the moon'), null);
});

test('missing information asks a clarifying question instead of guessing', () => {
  assert.ok(resolve('Can we take 2MW?').clarification);
  assert.ok(resolve('What if we lose it?').clarification);
  assert.ok(resolve('hello').clarification);
});

test('demo mode never calls the network', async () => {
  const p = await parseQuery('Show me stranded capacity', { demoMode: true });
  assert.equal(p.source, 'local');
  assert.equal(p.intent, 'stranded_capacity');
});
