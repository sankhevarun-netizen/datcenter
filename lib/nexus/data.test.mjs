// lib/nexus/data.test.mjs — Stage 1 verification.
// Run with: npm run test:nexus
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nexus, index, getFacility, getRow, getComponent, racksOf, racksInRow, rowsOf } from './data.js';
import { REQUIRED_FIELDS } from './schema.js';
import checks from '../../data/nexus/fixtures/checks.json';

const round1 = (n) => Math.round(n * 10) / 10;
const sum = (list, field) => list.reduce((s, x) => s + x[field], 0);

test('480 racks load, and their loads sum to exactly 6,800 kW', () => {
  assert.equal(nexus.racks.length, 480);
  assert.equal(round1(sum(nexus.racks, 'used_kw')), 6800);
  assert.equal(round1(sum(racksOf('MUM-1'), 'used_kw')), getFacility('MUM-1').used_it_kw);
});

test('148 components, each with a position', () => {
  assert.equal(nexus.components.length, 148);
  assert.equal(nexus.componentPositions.length, 148);
  for (const c of nexus.components) assert.ok(c.position, `no position for ${c.component_id}`);
});

test('220 dependency edges (dataset is authoritative), split 120 electrical / 100 thermal', () => {
  assert.equal(nexus.dependencies.length, 220);
  assert.equal(nexus.dependencies.filter((d) => d.chain === 'electrical').length, 120);
  assert.equal(nexus.dependencies.filter((d) => d.chain === 'thermal').length, 100);
});

test('every source_component_id and target_component_id resolves to a real component', () => {
  for (const d of nexus.dependencies) {
    assert.ok(index.componentById.has(d.source_component_id), `unresolved source ${d.source_component_id}`);
    assert.ok(index.componentById.has(d.target_component_id), `unresolved target ${d.target_component_id}`);
  }
});

test('every rack resolves to its row, hall, PDU and CRAH', () => {
  for (const r of nexus.racks) {
    assert.ok(getRow(r.facility_id, r.row_id));
    assert.ok(index.hallById.has(r.hall_id), `unknown hall ${r.hall_id}`);
    assert.equal(getComponent(r.fed_by_pdu).component_type, 'pdu', `${r.rack_id} fed_by_pdu`);
    assert.equal(getComponent(r.cooled_by_crah).component_type, 'crah', `${r.rack_id} cooled_by_crah`);
    if (r.tenant_id) assert.ok(index.tenantById.has(r.tenant_id), `unknown tenant ${r.tenant_id}`);
  }
});

test('rack loads roll up to each row total, and each row has a rack_row graph node', () => {
  for (const row of rowsOf('MUM-1')) {
    assert.equal(round1(sum(racksInRow('MUM-1', row.row_id), 'used_kw')), row.used_kw, `row ${row.row_id}`);
    assert.equal(racksInRow('MUM-1', row.row_id).length, row.rack_count, `row ${row.row_id} rack count`);
    assert.equal(getComponent(`ROW-${row.row_id}`).component_type, 'rack_row');
  }
});

test('every component peer and upgrade option references a real component', () => {
  for (const c of nexus.components) for (const p of c.redundantPeers) assert.ok(index.componentById.has(p), `${c.component_id} peer ${p}`);
  for (const u of nexus.upgradeOptions) assert.ok(index.componentById.has(u.component_id), `upgrade ${u.component_id}`);
});

test('every record has the fields documented as required in schema.js', () => {
  for (const [collection, fields] of Object.entries(REQUIRED_FIELDS)) {
    assert.ok(nexus[collection].length > 0, `${collection} is empty`);
    for (const record of nexus[collection]) {
      for (const f of fields) assert.ok(record[f] !== null && record[f] !== undefined, `${collection} record missing ${f}: ${JSON.stringify(record).slice(0, 80)}`);
    }
  }
});

test("the workbook's own 18_checks all read PASS", () => {
  assert.equal(checks.length, 17);
  for (const c of checks) assert.equal(c.status, 'PASS', c.check);
});

test('dataset is frozen — engines cannot mutate shared records', () => {
  assert.throws(() => { nexus.racks[0].used_kw = 0; });
  assert.throws(() => { nexus.racks.push({}); });
  assert.throws(() => { racksInRow('MUM-1', 'G').sort(() => 0); }, 'index arrays must be frozen too');
});

test('the incident and telemetry Scene 4 depends on are present', () => {
  assert.ok(index.incidentById.has('INC-2026-0318'));
  const flagged = nexus.telemetryReplay.filter((t) => t.flag);
  assert.ok(flagged.some((t) => t.timestamp === '2026-03-17 22:40'));
  assert.equal(index.incidentById.get('INC-2026-0318').detected_at, '2026-03-18 04:12');
});
