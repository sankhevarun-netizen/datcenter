// Cross-sheet rules that keep the dataset believable as it grows: every
// authored sheet must agree with the sheets it touches. A failure here means
// the workbook contradicts itself somewhere a viewer could notice.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nexus, index, componentTypeOf, getRow } from './data.js';

const matches = (runbook, text) =>
  runbook.match_terms.split('|').some((t) => text.toLowerCase().includes(t.trim().toLowerCase()));

const runbookFor = (componentId, text) =>
  (index.runbooksByType.get(componentTypeOf(componentId)) ?? []).find((r) => matches(r, text));

test('every component id in alerts, incidents and components resolves to a type', () => {
  const ids = [
    ...nexus.components.map((c) => c.component_id),
    ...nexus.activeAlerts.map((a) => a.component_id),
    ...nexus.incidents.map((i) => i.component_id),
  ];
  for (const id of ids) assert.ok(componentTypeOf(id), `no type for ${id}`);
  for (const c of nexus.components) assert.equal(componentTypeOf(c.component_id), c.component_type, c.component_id);
});

test('every active alert and every incident has a runbook for its failure mode', () => {
  for (const a of nexus.activeAlerts) assert.ok(runbookFor(a.component_id, a.message), `no runbook for ${a.alert_id}`);
  for (const i of nexus.incidents) assert.ok(runbookFor(i.component_id, i.root_cause), `no runbook for ${i.incident_id}`);
});

test('every recorded incident was an outage-class failure mode', () => {
  // 11_incidents records service-affecting events, so each must map to an outage runbook.
  for (const i of nexus.incidents) assert.equal(runbookFor(i.component_id, i.root_cause).impact, 'outage', i.incident_id);
});

test('runbook steps are numbered 1..n and owned by teams that already own alerts', () => {
  const teams = new Set(nexus.activeAlerts.map((a) => a.owner_team));
  const byId = new Map();
  for (const r of nexus.runbooks) {
    assert.ok(teams.has(r.owner_team), `${r.runbook_id} step ${r.step}: unknown team ${r.owner_team}`);
    assert.ok(['outage', 'capacity', 'compliance', 'efficiency'].includes(r.impact), `${r.runbook_id}: impact ${r.impact}`);
    if (!byId.has(r.runbook_id)) byId.set(r.runbook_id, []);
    byId.get(r.runbook_id).push(r.step);
  }
  for (const [id, steps] of byId) assert.deepEqual(steps, steps.map((_, i) => i + 1), id);
});

test('supply lead times agree with the upgrade options for the same component type', () => {
  for (const u of nexus.upgradeOptions) {
    const supply = index.supplyByComponentType.get(componentTypeOf(u.component_id));
    assert.ok(supply, `no supply line for ${u.component_id}`);
    assert.equal(supply.lead_time_weeks, u.lead_time_weeks, u.component_id);
  }
});

test('supply chain covers every procured component type', () => {
  const types = new Set(nexus.components.map((c) => c.component_type));
  types.delete('rack_row');
  types.delete('utility_feed');
  for (const t of types) assert.ok(index.supplyByComponentType.has(t), t);
});

test('the battery vendor in 25_supply_chain is the one named in the incident root causes', () => {
  const ups = index.supplyByComponentType.get('ups');
  const batch = nexus.incidents.filter((i) => /battery batch/i.test(i.root_cause));
  assert.equal(batch.length, 3);
  for (const i of batch) assert.match(i.root_cause, new RegExp(ups.vendor, 'i'));
});

test('one site-risk record per facility; trips are blank only where the grid is not connected', () => {
  assert.deepEqual(nexus.siteRisk.map((s) => s.facility_id).sort(), nexus.facilities.map((f) => f.facility_id).sort());
  for (const s of nexus.siteRisk) {
    for (const k of ['flood_exposure', 'cyclone_exposure', 'heat_exposure']) assert.ok(s[k] >= 1 && s[k] <= 5, `${s.facility_id} ${k}`);
    const connected = index.gridByFacility.get(s.facility_id).connection_status === 'Connected';
    assert.equal(s.grid_trips_12m !== null, connected, s.facility_id);
  }
});

test("far-end inlet sensors read 27 C minus the row's thermal margin; near-end reads cooler", () => {
  for (const row of nexus.rows.filter((r) => r.facility_id === 'MUM-1')) {
    const sensors = index.sensorsByRow.get(`MUM-1:${row.row_id}`);
    const near = sensors.find((s) => s.location.endsWith('CRAH end'));
    const far = sensors.find((s) => s.location.endsWith('far end'));
    assert.equal(far.reading_c, Math.round((27 - row.thermal_margin_c) * 10) / 10, row.row_id);
    assert.ok(near.reading_c < far.reading_c, row.row_id);
    assert.equal(getRow('MUM-1', row.row_id).hall_id, far.hall_id);
  }
});

test('every sensor names a real CRAH, and the only supply-air excursion is the one ALM-4821 reports', () => {
  for (const s of nexus.thermalSensors) assert.equal(index.componentById.get(s.component_id)?.component_type, 'crah', s.sensor_id);
  const over = nexus.thermalSensors.filter((s) => s.setpoint_c !== null && s.reading_c > s.limit_c);
  assert.deepEqual(over.map((s) => s.component_id), ['CRAH-K-01']);
  const alert = index.alertById.get('ALM-4821');
  const excess = Math.round((over[0].reading_c - over[0].setpoint_c) * 10) / 10;
  assert.equal(alert.component_id, 'CRAH-K-01');
  assert.ok(alert.message.includes(`${excess}C`), alert.message);
});

const hoursIn = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate() * 24;
};
const tsMonth = (id, month) => nexus.timeseries.find((t) => t.facility_id === id && t.month === month);

test('each facility has 25 consecutive timeseries months, September 2024 to the as-of month', () => {
  const asOfMonth = nexus.activeAlerts.map((a) => a.raised_at).sort().at(-1).slice(0, 7);
  for (const [id, months] of index.timeseriesByFacility) {
    const labels = months.map((t) => t.month);
    assert.equal(labels.length, 25, id);
    assert.equal(new Set(labels).size, 25, `${id} repeats a month`);
    assert.equal(labels[0], '2024-09', id);
    assert.equal(labels.at(-1), asOfMonth, id);
  }
});

test('the pre-monsoon PUE bump sits in April to June', () => {
  // Every operating site runs its highest 2025 PUE between April and June.
  for (const [id, months] of index.timeseriesByFacility) {
    const y2025 = months.filter((t) => t.month.startsWith('2025'));
    const peak = y2025.reduce((a, b) => (b.pue > a.pue ? b : a));
    assert.ok(['2025-04', '2025-05', '2025-06'].includes(peak.month), `${id} peaks in ${peak.month}`);
  }
});

test('energy and water ledgers restate the timeseries month for month', () => {
  for (const e of nexus.energy) {
    const t = tsMonth(e.facility_id, e.month);
    assert.ok(t, `${e.facility_id} ${e.month}`);
    assert.equal(e.measured_pue, t.pue);
    assert.equal(e.total_kwh, Math.round(t.it_load_kw * hoursIn(e.month) * t.pue));
    assert.equal(e.renewable_kwh + e.grid_kwh, e.total_kwh);
  }
  for (const w of nexus.water) {
    const t = tsMonth(w.facility_id, w.month);
    assert.equal(w.measured_wue_l_per_kwh, t.wue_l_per_kwh);
    assert.equal(w.total_litres, Math.round(t.it_load_kw * hoursIn(w.month) * t.wue_l_per_kwh));
    assert.equal(w.treated_litres + w.freshwater_litres, w.total_litres);
    assert.ok(w.peak_demand_lpm > w.total_litres / (hoursIn(w.month) * 60), `${w.facility_id} ${w.month} peak below average`);
  }
});

test('renewable share in the ledger matches each facility', () => {
  for (const e of nexus.energy) {
    const share = Math.round((e.renewable_kwh / e.total_kwh) * 100);
    assert.equal(share, index.facilityById.get(e.facility_id).renewable_pct, `${e.facility_id} ${e.month}`);
  }
});

test('every metered component runs within its derated rating, and the sheet says so', () => {
  for (const c of nexus.components.filter((x) => x.current_load > 0)) {
    const derated = Math.round(c.capacity * c.derate_factor * 10) / 10;
    assert.equal(c.derated_capacity, derated, `${c.component_id} derated_capacity`);
    assert.ok(c.current_load <= c.derated_capacity, `${c.component_id} carries ${c.current_load} of ${c.derated_capacity} ${c.unit}`);
    assert.ok(Math.abs(c.utilisation_pct - (c.current_load / c.derated_capacity) * 100) < 0.1, `${c.component_id} utilisation_pct`);
  }
});

test('energy reuse never exceeds energy consumed', () => {
  for (const e of nexus.energy) assert.ok(e.energy_reused_kwh >= 0 && e.energy_reused_kwh <= e.total_kwh, `${e.facility_id} ${e.month}`);
});

test('policies attach to the facilities they name; EU EED binds no site', () => {
  const names = (id) => index.policiesByFacility.get(id).map((p) => p.jurisdiction);
  assert.ok(names('BLR-1').includes('Karnataka'));
  for (const f of nexus.facilities) {
    if (f.facility_id !== 'BLR-1') assert.ok(!names(f.facility_id).includes('Karnataka'), f.facility_id);
    assert.ok(names(f.facility_id).includes('National'), `${f.facility_id} misses SEBI BRSR`);
    assert.ok(!names(f.facility_id).includes('European Union'), f.facility_id);
  }
  assert.ok(names('CHN-1').includes('Tamil Nadu'));
});
