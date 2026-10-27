import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPatternGraph, similarPatterns } from './pattern-graph.js';
import { nexus } from './data.js';

const g = buildPatternGraph();
const ids = new Set(g.nodes.map((n) => n.id));

test('every edge joins two nodes in the graph', () => {
  for (const e of g.edges) {
    assert.ok(ids.has(e.source), e.source);
    assert.ok(ids.has(e.target), e.target);
  }
});

test('every incident and open alert appears once, linked to a pattern and a site', () => {
  for (const i of nexus.incidents) assert.ok(ids.has(`incident:${i.incident_id}`), i.incident_id);
  for (const a of nexus.activeAlerts.filter((x) => x.status !== 'resolved')) assert.ok(ids.has(`alert:${a.alert_id}`), a.alert_id);
  const evidence = g.nodes.filter((n) => ['incident', 'alert', 'advisory'].includes(n.kind));
  for (const n of evidence) {
    const out = g.edges.filter((e) => e.source === n.id).map((e) => e.relation).sort();
    assert.deepEqual(out, ['at site', 'matches pattern'], n.id);
  }
});

test('the battery pattern links three sites and three recorded incidents', () => {
  const p = similarPatterns({ facilityId: 'MUM-1', componentId: 'UPS-1', text: 'Battery string B resistance trending up' });
  assert.deepEqual(p.sites.sort(), ['HKG-EXT', 'MUM-1', 'NCR-1']);
  assert.equal(p.incidents.length, 3);
});

test('from UPS-1, the live match elsewhere is the UPS-2 advisory', () => {
  const p = similarPatterns({ facilityId: 'MUM-1', componentId: 'UPS-1', text: 'Battery string B resistance trending up', excludeId: 'ALM-4819' });
  assert.deepEqual(p.liveElsewhere.map((x) => `${x.kind}:${x.componentId}`), ['advisory:UPS-2']);
});

test('the battery pattern is supplied by the vendor named in its root cause', () => {
  const pattern = g.nodes.find((n) => n.id === 'pattern:RB-UPS-BAT');
  const vendor = g.edges.find((e) => e.source === pattern.id && e.relation === 'supplied by');
  assert.equal(vendor.target, 'vendor:Vendor A');
});

test('the graph is rebuilt identically every time', () => {
  assert.deepEqual(buildPatternGraph(), g);
});
