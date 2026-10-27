import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentileOf, scoreAgainst, benchmarkFacility, cohortFor, portfolioScorecard } from './benchmark-engine.js';

const tier3Pue = cohortFor('PUE', 'Tier III');

test('published percentile points map exactly', () => {
  assert.deepEqual(percentileOf(1.34, tier3Pue), { position: 10, outside: null });
  assert.deepEqual(percentileOf(1.61, tier3Pue), { position: 50, outside: null });
  assert.deepEqual(percentileOf(1.92, tier3Pue), { position: 90, outside: null });
});

test('values between points interpolate linearly; outside the band is never extrapolated', () => {
  assert.ok(Math.abs(percentileOf(1.545, tier3Pue).position - 37.5) < 1e-9);
  assert.deepEqual(percentileOf(1.2, tier3Pue), { position: 10, outside: 'below' });
  assert.deepEqual(percentileOf(2.1, tier3Pue), { position: 90, outside: 'above' });
});

test('score is the share of peers beaten, whichever way the metric runs', () => {
  assert.equal(scoreAgainst(1.34, tier3Pue).score, 90); // low PUE is good
  const renewable = cohortFor('Renewable share (%)', 'Tier III');
  assert.equal(scoreAgainst(78, renewable).score, 90); // high renewable share is good
  assert.equal(scoreAgainst(1.2, tier3Pue).rank, 'top decile');
  assert.equal(scoreAgainst(2.1, tier3Pue).rank, 'bottom decile');
  assert.equal(scoreAgainst(1.61, tier3Pue).rank, 'at median');
});

test('context-only metrics are positioned but not scored', () => {
  const density = scoreAgainst(14.6, cohortFor('Rack density (kW)', 'Tier III'));
  assert.equal(density.position, 50);
  assert.equal(density.score, null);
});

test('MUM-1 is scored on its reported PUE 1.58: between p25 and p50 of Tier III', () => {
  const pue = benchmarkFacility('MUM-1').find((m) => m.key === 'pue');
  assert.equal(pue.value, 1.58);
  assert.equal(pue.cohort, 'India Tier III');
  assert.equal(pue.position, 44); // 25 + (1.58 - 1.48) / (1.61 - 1.48) × 25
  assert.equal(pue.score, 56);
  assert.match(pue.measured.basis, /trailing 12 months/);
  assert.match(pue.cohortBasis, /disclosures/);
});

test('HYD-1 is the efficiency leader: top quartile on PUE, WUE and renewables', () => {
  const m = Object.fromEntries(benchmarkFacility('HYD-1').map((x) => [x.key, x]));
  for (const k of ['pue', 'wue', 'renewable']) assert.equal(m[k].rank, 'top quartile', k);
});

test('missing evidence is reported, not estimated', () => {
  const hyd = Object.fromEntries(benchmarkFacility('HYD-1').map((x) => [x.key, x]));
  assert.equal(hyd.mttr.value, null);
  assert.equal(hyd.mttr.basis, 'No incidents in the last 12 months');
  assert.equal(hyd.stranded.value, null);
  const blr = Object.fromEntries(benchmarkFacility('BLR-1').map((x) => [x.key, x]));
  assert.equal(blr.pue.basis, 'Design target');
  assert.equal(blr.pue.cohort, 'India Tier IV');
  assert.equal(blr.utilisation.value, null);
});

test('MUM-1 stranded share is the structural 640 kW over 10,000 kW design', () => {
  const s = benchmarkFacility('MUM-1').find((m) => m.key === 'stranded');
  assert.equal(s.value, 6.4);
});

test('portfolio scorecard: one row per facility and a weighted portfolio line', () => {
  const s = portfolioScorecard();
  assert.equal(s.rows.length, 6);
  const pue = s.portfolio.find((m) => m.key === 'pue');
  assert.ok(pue.value > 1.34 && pue.value < 1.74, `portfolio PUE ${pue.value}`);
  assert.ok(pue.rank);
});
