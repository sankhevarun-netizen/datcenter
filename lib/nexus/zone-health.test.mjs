// Live Status panel: every figure from the record, nothing filled in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nexusZoneHealth } from './zone-health.js';
import { nexus, index } from './data.js';

const z = nexusZoneHealth('MUM-1');
const metric = (zone, label) => z[zone].metrics.find((m) => m.label.startsWith(label))?.value;

test('every metric has a value; uncovered zones are marked, not invented', () => {
  for (const [id, zone] of Object.entries(z)) {
    if (id === 'asOf') continue;
    for (const m of zone.metrics) assert.ok(m.value !== undefined && !String(m.value).includes('undefined'), `${id}: ${m.label}`);
  }
  assert.equal(z.soc.status, 'unmonitored');
  assert.equal(z.security.status, 'unmonitored');
  assert.deepEqual(z.soc.metrics, []);
});

test('figures reconcile with the dataset', () => {
  const racks = index.racksByFacility.get('MUM-1');
  assert.equal(metric('racks', 'Occupied'), `${racks.filter((r) => r.status === 'occupied').length} / ${racks.length}`);
  const latest = index.timeseriesByFacility.get('MUM-1').at(-1);
  assert.equal(metric('cooling', 'PUE'), latest.pue.toFixed(2));
  const open = nexus.activeAlerts.filter((a) => a.facility_id === 'MUM-1' && a.status !== 'resolved');
  assert.equal(metric('noc', 'Open alerts'), open.length);
  const inc = index.incidentsByFacility.get('MUM-1');
  assert.equal(metric('noc', 'MTTR'), `${Math.round(inc.reduce((a, i) => a + i.duration_min, 0) / inc.length)} min`);
});

test('zone status follows the worst open alert in that zone', () => {
  assert.equal(z.cooling.status, 'warning'); // ALM-4821 high
  assert.equal(z.power.status, 'warning'); // ALM-4819 medium, ALM-4817 low
  assert.ok(z.power.alerts.some((a) => a.startsWith('ALM-4819') && a.endsWith('(acknowledged)')));
});

test('a facility outside the record returns null', () => {
  assert.equal(nexusZoneHealth('NOPE-1'), null);
});
