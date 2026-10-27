// lib/nexus/replay.test.mjs — Scene 4 and display formatting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReplay } from './replay.js';
import { fmtLakh, fmtInr, fmtDuration, fmtKw } from './format.js';

test('Scene 4: agent flag at 22:40 on 17 March, operator detection at 04:12 on 18 March', () => {
  const r = buildReplay('INC-2026-0318');
  assert.equal(r.flaggedAt, '2026-03-17 22:40');
  assert.equal(r.detectedAt, '2026-03-18 04:12');
});

test('Scene 4: lead time is 5 hours 32 minutes, computed from the two timestamps', () => {
  const r = buildReplay('INC-2026-0318');
  assert.equal(r.leadMinutes, 332);
  assert.equal(fmtDuration(r.leadMinutes), '5 hours 32 minutes');
});

test('Scene 4: ₹4 lakh scheduled versus ₹18 lakh emergency', () => {
  const r = buildReplay('INC-2026-0318');
  assert.equal(r.scheduledCostInrLakh, 4);
  assert.equal(r.emergencyCostInrLakh, 18);
});

test('Scene 4: all 37 telemetry readings in time order, plus same-batch pattern incidents', () => {
  const r = buildReplay('INC-2026-0318');
  assert.equal(r.readings.length, 37);
  for (let i = 1; i < r.readings.length; i++) assert.ok(r.readings[i].minute > r.readings[i - 1].minute);
  assert.deepEqual(r.patternIncidents.map((p) => p.incidentId).sort(), ['INC-2025-0812', 'INC-2025-1104']);
});

test('formatting matches how the scenes are read out', () => {
  assert.equal(fmtLakh(250), '₹250 lakh (₹2.50 crore)');
  assert.equal(fmtLakh(18), '₹18 lakh');
  assert.equal(fmtInr(4896000), '₹49 lakh');
  assert.equal(fmtInr(64000000), '₹6.4 crore');
  assert.equal(fmtKw(1320), '1,320 kW');
});
