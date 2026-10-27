// lib/nexus/twin-model.test.mjs — Stage 4 view-model checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cascadeView, strandedView, capacityView, densityView, replayView, idleView } from './twin-model.js';
import { findStrandedCapacity, canAccommodate, densityReadiness } from './capacity-engine.js';
import { propagateChange } from './impact-engine.js';
import { index, racksOf } from './data.js';

const count = (states, state) => Object.values(states).filter((s) => s.state === state).length;

test('idle view: every one of the 480 racks and 148 components has a state', () => {
  const v = idleView('MUM-1');
  assert.equal(Object.keys(v.rackStates).length, 480);
  assert.equal(Object.keys(v.componentStates).length, 148);
  assert.equal(count(v.rackStates, 'free'), 113);
  assert.equal(count(v.rackStates, 'blocked'), 1);
});

test('Scene 1 view: Row K/P/Q cooling-limited, Row C space-limited, Hall 4 planned, rest dimmed', () => {
  const v = strandedView('MUM-1', findStrandedCapacity('MUM-1'));
  const rowState = (row) => v.rackStates[`MUM-1-${row}-01`].state;
  assert.equal(rowState('K'), 'stranded-cooling');
  assert.equal(rowState('P'), 'stranded-cooling');
  assert.equal(rowState('Q'), 'stranded-cooling');
  assert.equal(rowState('C'), 'stranded-space');
  for (const row of ['S', 'T', 'U', 'V', 'W', 'X']) assert.equal(rowState(row), 'planned');
  assert.equal(rowState('A'), 'dimmed');
  assert.ok(v.labels.some((l) => l.text === 'Row K · 380 kW cooling-limited'));
  assert.ok(v.labels.some((l) => l.text === 'Hall 4 · 480 kW planned headroom'));
});

test('Scene 2 view: 14 deployable racks green, the other 20 free Hall 4 positions amber, other halls grey', () => {
  const v = capacityView('MUM-1', canAccommodate({ facilityId: 'MUM-1', rackCount: 34, densityKw: 60 }));
  assert.equal(count(v.rackStates, 'deployable'), 14);
  assert.equal(count(v.rackStates, 'available'), 20);
  const hall4 = racksOf('MUM-1').filter((r) => r.hall_id === 'MUM-1-H4');
  assert.equal(count(v.rackStates, 'occupied-eligible'), hall4.filter((r) => r.status === 'occupied').length);
  assert.equal(count(v.rackStates, 'dimmed'), 480 - hall4.length);
  assert.ok(v.labels.some((l) => l.text === 'Hall 4 · 14 racks / 840 kW deployable'));
});

test('Scene 3 view: Row G racks changed, impacted components carry their status and hop, the rest dimmed', () => {
  const result = propagateChange({ facilityId: 'MUM-1', changes: [{ rowId: 'G', newDensityKw: 60 }] });
  const v = cascadeView('MUM-1', result);
  assert.equal(count(v.rackStates, 'changed'), 20);
  assert.equal(count(v.rackStates, 'dimmed'), 460);
  for (const i of result.impacts) {
    assert.equal(v.componentStates[i.componentId].state, i.status);
    assert.equal(v.componentStates[i.componentId].hop, i.hopDistance);
  }
  assert.equal(count(v.componentStates, 'dimmed'), 148 - result.impacts.length);
});

test('Scene 3 view: every flow line follows a real dependency edge, one hop outward', () => {
  const result = propagateChange({ facilityId: 'MUM-1', changes: [{ rowId: 'G', newDensityKw: 60 }] });
  const v = cascadeView('MUM-1', result);
  const hopOf = Object.fromEntries(result.impacts.map((i) => [i.componentId, i.hopDistance]));
  assert.ok(v.flowLines.length >= result.impacts.length);
  for (const line of v.flowLines) {
    const [from, to] = line.id.split('->');
    const fromHop = from.startsWith('ROW-') ? 0 : hopOf[from];
    assert.equal(hopOf[to] - fromHop, 1, line.id);
    const isEdge = [...(index.edgesFrom.get(from) ?? []), ...(index.edgesFrom.get(to) ?? [])]
      .some((e) => (e.source_component_id === from && e.target_component_id === to) || (e.source_component_id === to && e.target_component_id === from));
    assert.ok(isEdge, `${line.id} is not a dataset edge`);
  }
});

test('Scene 3 view: labels only on tight / exceeded / redundancy-lost components, plus the changed row', () => {
  const result = propagateChange({ facilityId: 'MUM-1', changes: [{ rowId: 'G', newDensityKw: 60 }] });
  const v = cascadeView('MUM-1', result);
  const problem = result.impacts.filter((i) => ['tight', 'exceeded', 'redundancy_lost'].includes(i.status)).map((i) => i.componentId).sort();
  assert.deepEqual(v.labels.filter((l) => !l.id.startsWith('row-')).map((l) => l.id).sort(), problem);
  assert.ok(v.labels.some((l) => l.text === 'Row G · 10 → 60 kW/rack'));
  assert.ok(v.labels.some((l) => l.text === 'UPS-1 135.1%'));
});

test('density view: Hall 4 green, everything else amber at 20 kW/rack', () => {
  const v = densityView('MUM-1', densityReadiness('MUM-1'));
  assert.equal(count(v.rackStates, 'band-green'), 120);
  assert.equal(count(v.rackStates, 'band-amber'), 360);
});

test('replay view: only the incident component is lit', () => {
  const v = replayView('MUM-1', index.incidentById.get('INC-2026-0318'));
  assert.equal(count(v.componentStates, 'alert'), 1);
});
