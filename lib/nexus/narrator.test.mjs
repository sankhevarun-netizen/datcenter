// lib/nexus/narrator.test.mjs — the narrator can only repeat figures the engines computed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFacts, templateNarration, allowedNumbers, safePrefix, narrate, NARRATOR_SYSTEM_PROMPT } from './narrator.js';
import { findStrandedCapacity, canAccommodate, densityReadiness } from './capacity-engine.js';
import { propagateChange } from './impact-engine.js';
import { buildReplay } from './replay.js';

const scenes = {
  stranded_capacity: () => findStrandedCapacity('MUM-1'),
  capacity_check: () => canAccommodate({ facilityId: 'MUM-1', rackCount: 34, densityKw: 60 }),
  density_readiness: () => densityReadiness('MUM-1'),
  cascade_simulation: () => propagateChange({ facilityId: 'MUM-1', changes: [{ rowId: 'G', newDensityKw: 60 }] }),
  failure_simulation: () => propagateChange({ facilityId: 'MUM-1', changes: [{ componentId: 'UTIL-FEED-A', failed: true }] }),
  replay: () => buildReplay('INC-2026-0318'),
};

test('system prompt carries the plan\'s no-calculation rule verbatim', () => {
  assert.ok(NARRATOR_SYSTEM_PROMPT.includes('Use only the numbers present in the provided result object. Never calculate, estimate, infer or invent a figure. If a number is not in the object, do not mention it.'));
});

test('facts carry the planted demo figures, pre-formatted', () => {
  const s = JSON.stringify(buildFacts('stranded_capacity', scenes.stranded_capacity()));
  for (const want of ['640 kW', '₹49 lakh', '₹6.4 crore', '480 kW']) assert.ok(s.includes(want), want);
  const c = JSON.stringify(buildFacts('capacity_check', scenes.capacity_check()));
  for (const want of ['840 kW', '34 racks', '22 racks (1,320 kW)', '14 racks (840 kW)', '"cooling"']) assert.ok(c.includes(want), want);
  const k = JSON.stringify(buildFacts('cascade_simulation', scenes.cascade_simulation()));
  for (const want of ['₹250 lakh (₹2.50 crore)', '16 weeks', '1.58 to 1.71', '48 hours to 31.6 hours']) assert.ok(k.includes(want), want);
  const r = JSON.stringify(buildFacts('replay', scenes.replay()));
  for (const want of ['22:40 on 17 March', '04:12 on 18 March', '5 hours 32 minutes', '₹4 lakh', '₹18 lakh']) assert.ok(r.includes(want), want);
});

test('every template narration passes its own number guard', () => {
  for (const [intent, run] of Object.entries(scenes)) {
    const facts = buildFacts(intent, run());
    const text = templateNarration(intent, facts);
    assert.ok(text.length > 40, intent);
    const safe = safePrefix(text, allowedNumbers(facts), true);
    assert.equal(safe.violation, false, `${intent}: ${safe.offending}`);
    assert.ok(text.split(/\s+/).length < 120, `${intent} template over 120 words`);
  }
});

test('the guard rejects an invented figure and holds back a half-streamed one', () => {
  const allowed = allowedNumbers(buildFacts('capacity_check', scenes.capacity_check()));
  assert.equal(safePrefix('We can deploy 840 kW today.', allowed, true).violation, false);
  assert.equal(safePrefix('We can deploy 900 kW today.', allowed, true).violation, true);
  assert.equal(safePrefix('We can deploy 84', allowed).text, 'We can deploy ');
  assert.equal(safePrefix('Cooling allows 14 racks', allowed).text, 'Cooling allows 14 racks');
  assert.equal(safePrefix('Cooling allows 14', allowed).text, 'Cooling allows ');
  assert.equal(safePrefix('Costs ₹2.', allowed).text, 'Costs ₹');
});

test('demo mode narrates from the template with no network call', async () => {
  let shown = '';
  const r = await narrate({ intent: 'capacity_check', result: scenes.capacity_check(), demoMode: true, onText: (t) => { shown = t; } });
  assert.equal(r.source, 'template');
  assert.equal(shown, r.text);
});
