// Twin studio: overlays, site summaries and click cards come from the dataset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rampRgb, rampHex, thermalOverlay, powerOverlay, overlayT, HEAT_RAMP } from './twin-overlay.js';
import { hallSummaries, plantSummaries, siteSummary, describeObject } from './twin-site.js';
import { racksOf, componentsOf, nexus } from './data.js';
import { ASHRAE } from './thermal-model.js';

test('the heat ramp runs cold navy to hot red and clamps', () => {
  assert.equal(rampHex(0), HEAT_RAMP[0][1].toLowerCase());
  assert.equal(rampHex(1), HEAT_RAMP.at(-1)[1].toLowerCase());
  assert.deepEqual(rampRgb(-1), rampRgb(0));
  assert.deepEqual(rampRgb(2), rampRgb(1));
});

test('thermal overlay: every rack, on the ASHRAE scale; a CRAH failure heats its row', () => {
  const t = thermalOverlay('MUM-1');
  assert.equal(Object.keys(t.values).length, racksOf('MUM-1').length);
  assert.equal(t.max, ASHRAE.allowableMaxC);
  assert.ok(t.observed.max < ASHRAE.recommendedMaxC, 'today the facility runs inside the recommended band');
  const f = thermalOverlay('MUM-1', { failedCrah: 'CRAH-K-01' });
  assert.ok(f.observed.max > ASHRAE.recommendedMaxC);
  assert.notEqual(f.key, t.key, 'a new scenario gets a new cached texture');
  assert.ok(overlayT(t, t.min) === 0 && overlayT(t, t.max) === 1);
});

test('power overlay is used ÷ rated per rack, and shows the over-rated Row K racks', () => {
  const p = powerOverlay('MUM-1');
  for (const r of racksOf('MUM-1')) assert.equal(p.values[r.rack_id], Math.round((r.used_kw / r.capacity_kw) * 1000) / 10);
  assert.ok(Object.entries(p.values).some(([id, v]) => id.includes('-K-') && v > 100));
});

test('hall summaries reconcile with 02_halls and carry alert status', () => {
  const halls = hallSummaries('MUM-1');
  assert.equal(halls.length, 4);
  for (const h of halls) {
    const src = nexus.halls.find((x) => x.hall_id === h.hallId);
    assert.equal(h.usedKw, src.used_kw);
    assert.equal(h.racks, src.rack_count);
  }
  // ALM-4821 (CRAH-K-01, high) serves Row K in Hall 2.
  assert.equal(halls.find((h) => h.name === 'Hall 2').status, 'Warning');
  assert.ok(halls.find((h) => h.name === 'Hall 2').alerts.some((a) => a.alert_id === 'ALM-4821'));
  // UPS-1's battery alert lands on the power plant.
  assert.equal(plantSummaries('MUM-1').find((p) => p.id === 'plant-power').status, 'Warning');
  const s = siteSummary('MUM-1');
  assert.equal(s.alerts, nexus.activeAlerts.filter((a) => a.facility_id === 'MUM-1' && a.status !== 'resolved').length);
});

test('click cards: every rack, component and hall describes without gaps', () => {
  const check = (card) => {
    assert.ok(card?.title && card.status);
    for (const [k, v] of card.rows) assert.doesNotMatch(`${k} ${v}`, /undefined|NaN|null/);
  };
  for (const r of racksOf('MUM-1')) check(describeObject('MUM-1', 'rack', r.rack_id));
  for (const c of componentsOf('MUM-1').filter((x) => x.component_type !== 'rack_row')) check(describeObject('MUM-1', 'component', c.component_id));
  for (const h of hallSummaries('MUM-1')) check(describeObject('MUM-1', 'hall', h.hallId));
  for (const p of plantSummaries('MUM-1')) check(describeObject('MUM-1', 'plant', p.id));
  assert.equal(describeObject('MUM-1', 'rack', 'MUM-1-K-01').status, 'Exceeded');
});

test('cards: outer per hall and plant, inner per row, heatmap per hall or row', async () => {
  const { siteCallouts, rowCallouts, heatCallouts, rowSummaries } = await import('./twin-site.js');
  assert.equal(siteCallouts('MUM-1').filter((c) => c.kind === 'hall').length, 4);
  const rows = rowCallouts('MUM-1', 'MUM-1-H2');
  assert.equal(rows.length, 6);
  const k = rows.find((c) => c.title === 'Row K');
  assert.equal(k.status, 'Warning');
  assert.ok(k.lines.some((l) => l.includes('cooling-bound')) && k.lines.some((l) => l.includes('4 racks above rating')));
  // Row data reconciles with 03_rows.
  for (const r of rowSummaries('MUM-1')) {
    const src = nexus.rows.find((x) => x.facility_id === 'MUM-1' && x.row_id === r.rowId);
    assert.equal(r.usedKw, src.used_kw);
    assert.equal(r.headroomKw, src.headroom_kw);
  }
  assert.equal(heatCallouts('MUM-1', thermalOverlay('MUM-1')).length, 4);
  const failed = heatCallouts('MUM-1', thermalOverlay('MUM-1', { failedCrah: 'CRAH-K-01' }), 'MUM-1-H2');
  assert.equal(failed.find((c) => c.title === 'Row K').status, 'Critical');
  assert.equal(heatCallouts('MUM-1', powerOverlay('MUM-1')).find((c) => c.title === 'Hall 2').status, 'Exceeded');
});
