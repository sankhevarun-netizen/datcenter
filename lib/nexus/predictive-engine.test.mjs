import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectDrift, driftSeries, riskWatchlist, overdueMaintenance, DRIFT, fitTrend, capacityRisks } from './predictive-engine.js';
import { buildRiskFacts, riskTemplate, narrateRisks } from './risk-brief.js';
import { allowedNumbers, safePrefix } from './guarded-narrate.js';
import { nexus, index } from './data.js';

const OPERATING = nexus.facilities.filter((f) => f.status === 'Operational').map((f) => f.facility_id);

test('the PUE detector flags exactly the months the dataset marks as drift', () => {
  for (const id of OPERATING) {
    const { series } = detectDrift(id, 'pue');
    const detected = series.filter((p) => p.inDrift).map((p) => p.month);
    const marked = (index.timeseriesByFacility.get(id) ?? []).filter((t) => t.flag).map((t) => t.month);
    assert.deepEqual(detected, marked, id);
  }
});

test('MUM-1 drift runs May to September 2026; no other site drifts', () => {
  const { drift } = detectDrift('MUM-1', 'pue');
  assert.equal(drift.from, '2026-05');
  assert.equal(drift.to, '2026-09');
  for (const id of OPERATING.filter((x) => x !== 'MUM-1')) assert.equal(detectDrift(id, 'pue').drift, null, id);
  for (const id of OPERATING) assert.equal(detectDrift(id, 'wue').drift, null, `${id} WUE`);
});

test('NCR-1 two-month bump stays below the decision threshold', () => {
  const peak = Math.max(...driftSeries('NCR-1', 'pue').map((p) => p.cusum));
  assert.ok(peak > 0 && peak < DRIFT.pue.decision, `peak CUSUM ${peak}`);
});

test('drift cost is the year-on-year excess times IT energy at the month tariff', () => {
  const r = riskWatchlist().find((x) => x.id === 'DRIFT-MUM-1-PUE');
  const kwh = r.drift.months.reduce((s, p) => {
    const [y, m] = p.month.split('-').map(Number);
    return s + p.excess * p.itLoadKw * new Date(Date.UTC(y, m, 0)).getUTCDate() * 24;
  }, 0);
  assert.equal(r.cost.extraKwh, Math.round(kwh));
  assert.ok(r.evidence.some((e) => e.alertId === 'ALM-4821'), 'cooling alert cited as evidence');
});

test('UPS-1 was flagged by its advisory 119 days before ALM-4819', () => {
  const r = riskWatchlist().find((x) => x.componentId === 'UPS-1');
  assert.equal(r.alert.alertId, 'ALM-4819');
  assert.equal(r.alert.leadDays, 119);
  assert.equal(r.pattern.length, 3);
});

test('UPS-2 leads the watchlist: same batch, no alarm, and it is the peer covering UPS-1', () => {
  const [first] = riskWatchlist();
  assert.equal(first.componentId, 'UPS-2');
  assert.equal(first.alert, null);
  assert.deepEqual(first.commonModeWith, ['UPS-1']);
  assert.equal(first.priority, 'high');
  assert.deepEqual(first.cost, { scheduledInrLakh: 4, emergencyInrLakh: 12.5 });
});

test('advisories with a stated window are due at its end', () => {
  const crah = riskWatchlist().find((x) => x.componentId === 'CRAH-K-01');
  assert.equal(crah.actBy, '2026-12-28'); // 2026-06-28 + 6 months
});

test('nothing is overdue on its latest service as of the dataset date', () => {
  for (const id of OPERATING) assert.deepEqual(overdueMaintenance(id), [], id);
});

test('watchlist is deterministic and its brief passes the number guard', async () => {
  const list = riskWatchlist();
  assert.deepEqual(riskWatchlist(), list);
  const facts = buildRiskFacts(list);
  const text = riskTemplate(facts);
  assert.equal(safePrefix(text, allowedNumbers(facts), true).violation, false);
  assert.ok(text.startsWith('UPS-2 at Nexus Mumbai-1'));
  const r = await narrateRisks(list, { offline: true });
  assert.equal(r.text, text);
});

test('MUM-1 drift: about 0.013 PUE a month after seasonality, crossing the bottom quartile in April 2027', () => {
  const t = detectDrift('MUM-1', 'pue').drift.trend;
  assert.ok(t.slopePerMonth > 0.012 && t.slopePerMonth < 0.014, `slope ${t.slopePerMonth}`);
  assert.equal(t.confidence, 'high');
  assert.equal(t.threshold, 1.75);
  assert.equal(t.projectedBreachMonth, '2027-04');
  assert.ok(t.interventionWindowWeeks > 0);
});

test('the April-June seasonal bump is never flagged as drift', () => {
  for (const id of OPERATING) {
    const flagged = detectDrift(id, 'pue').series.filter((p) => p.inDrift).map((p) => p.month);
    for (const m of ['2025-04', '2025-05', '2025-06']) assert.ok(!flagged.includes(m), `${id} ${m}`);
  }
});

test('least squares recovers a known line', () => {
  const t = fitTrend([1, 3, 5, 7]);
  assert.equal(t.slope, 2);
  assert.equal(t.r2, 1);
});

test('capacity trends project MUM-2 and NCR-1 past 90% within a year; HYD-1 has room', () => {
  const ids = capacityRisks().map((r) => r.facilityId);
  assert.deepEqual(ids, ['MUM-2', 'NCR-1']);
  for (const r of capacityRisks()) assert.ok(r.trend.interventionWindowWeeks > 0 && r.trend.interventionWindowWeeks <= 53);
});
