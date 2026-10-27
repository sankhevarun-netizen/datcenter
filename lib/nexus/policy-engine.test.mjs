import { test } from 'node:test';
import assert from 'node:assert/strict';
import { policyExposure, policyTimeline } from './policy-engine.js';
import { nexus } from './data.js';

test('BLR-1: Karnataka applies from commissioning and comes into force in two days', () => {
  const b = policyExposure('BLR-1');
  assert.equal(b.jurisdiction, 'Karnataka');
  const ka = b.obligations.find((o) => o.jurisdiction === 'Karnataka');
  assert.equal(ka.status, 'from-commissioning');
  assert.deepEqual(b.deadlinesApproaching.map((d) => [d.jurisdiction, d.inDays]), [['Karnataka', 2]]);
  assert.match(b.incentivesAvailable[0].eligibility, /treated water/);
});

test('CHN-1 can evidence its Tamil Nadu water assessment from metered water', () => {
  const tn = policyExposure('CHN-1').obligations.find((o) => o.jurisdiction === 'Tamil Nadu');
  assert.equal(tn.status, 'ready');
  assert.match(tn.evidence[0], /9 months metered/);
});

test('BRSR is only partly evidenced: turnover and scope 1 are not in the dataset', () => {
  for (const f of nexus.facilities.filter((x) => x.status === 'Operational')) {
    const brsr = policyExposure(f.facility_id).obligations.find((o) => o.jurisdiction === 'National');
    assert.equal(brsr.status, 'partial', f.facility_id);
    assert.ok(brsr.gaps.some((g) => /Scope 1/.test(g)));
  }
});

test('the EU EED reference binds no site; the timeline lists every policy in date order', () => {
  for (const f of nexus.facilities) assert.ok(!policyExposure(f.facility_id).obligations.some((o) => o.jurisdiction === 'European Union'));
  const t = policyTimeline();
  assert.equal(t.length, nexus.statePolicy.length);
  assert.deepEqual(t.map((x) => x.effectiveFrom), [...t.map((x) => x.effectiveFrom)].sort());
});
