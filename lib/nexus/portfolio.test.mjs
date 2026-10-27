import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facilitySummary, portfolioSummary } from './portfolio.js';
import { AS_OF, AS_OF_MONTH, addMonths, monthsBetween, daysBetween, monthLabel } from './time.js';
import { nexus } from './data.js';

test('as-of is the latest event in the dataset, not the wall clock', () => {
  assert.equal(AS_OF, '2026-09-29 03:14');
  assert.equal(AS_OF_MONTH, '2026-09');
});

test('month helpers', () => {
  assert.equal(addMonths('2026-11', 3), '2027-02');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(monthsBetween('2024-10', '2026-09'), 23);
  assert.equal(daysBetween('2026-09-01', '2026-09-29'), 28);
  assert.equal(monthLabel('2026-05'), 'May 2026');
});

test('facility summaries carry dataset values unchanged', () => {
  const m = facilitySummary('MUM-1');
  assert.equal(m.designKw, 10000);
  assert.equal(m.usedKw, 6800);
  assert.equal(m.latest.month, '2026-09');
  assert.equal(m.latest.flag, 'COOLING EFFICIENCY DRIFT');
  assert.equal(m.grid.headroomKw, 1256);
  assert.equal(m.trend.length, 12);
});

test('health follows the worst open alert; BLR-1 is commissioning', () => {
  assert.equal(facilitySummary('NCR-1').health, 'critical');
  assert.equal(facilitySummary('MUM-1').health, 'serious');
  assert.equal(facilitySummary('HYD-1').health, 'good');
  assert.equal(facilitySummary('BLR-1').health, 'commissioning');
  assert.equal(facilitySummary('BLR-1').latest, null);
});

test('portfolio totals are the sum of the facility values', () => {
  const p = portfolioSummary();
  const live = p.facilities.filter((f) => f.operational);
  assert.equal(p.totals.designKw, 67000);
  assert.equal(p.totals.operational, 5);
  assert.equal(p.totals.usedKw, live.reduce((s, f) => s + f.usedKw, 0));
  assert.equal(p.totals.alerts, nexus.activeAlerts.length);
  assert.equal(p.totals.tenants, nexus.tenants.length);
  const it = live.reduce((s, f) => s + f.latest.itLoadKw, 0);
  const fac = live.reduce((s, f) => s + f.latest.facilityLoadKw, 0);
  assert.equal(p.totals.pue, Math.round((fac / it) * 1000) / 1000);
});

test('portfolio alerts are ordered most severe first', () => {
  const p = portfolioSummary();
  assert.equal(p.alerts[0].alert_id, 'ALM-4792');
  assert.equal(p.alerts.at(-1).severity, 'low');
});
