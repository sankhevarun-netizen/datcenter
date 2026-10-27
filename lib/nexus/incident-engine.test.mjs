import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseIncident, exposedRacks, incidentQueue, runbookFor, slaClock } from './incident-engine.js';
import { buildIncidentFacts, incidentTemplate, narrateIncident } from './incident-brief.js';
import { allowedNumbers, safePrefix } from './guarded-narrate.js';
import { nexus } from './data.js';

const ups = analyseIncident({ alertId: 'ALM-4819' });

test('ALM-4819 is the INC-2026-0318 battery pattern, seen at three sites', () => {
  assert.equal(ups.impact, 'outage');
  assert.equal(ups.why.failureMode, 'Battery string degradation');
  assert.deepEqual(ups.why.pattern.map((p) => p.incidentId), ['INC-2026-0318', 'INC-2025-1104', 'INC-2025-0812']);
  assert.deepEqual(ups.why.sites, ['MUM-1', 'HKG-EXT', 'NCR-1']);
  assert.equal(ups.what.replay.leadMinutes, 332);
  assert.equal(ups.why.findings[0].maintenanceId, 'MNT-0001');
});

test('UPS-2 carries UPS-1, so the exposure is a second-failure risk', () => {
  assert.equal(ups.who.protection.state, 'redundant');
  assert.deepEqual(ups.who.protection.peers, ['UPS-2']);
});

test('exposed tenants are exactly the tenants on racks downstream of UPS-1', () => {
  const { racks } = exposedRacks('MUM-1', 'UPS-1');
  const expected = [...new Set(racks.map((r) => r.tenant_id))].sort();
  assert.deepEqual(ups.who.tenants.map((t) => t.tenantId).sort(), expected);
  assert.equal(ups.who.racks, racks.length);
});

test('a penalty triggers only if the pattern-median outage passes the tenant threshold', () => {
  assert.equal(ups.who.outage.minutes, 260); // median of 383, 260, 255
  for (const t of ups.who.tenants) {
    const c = t.contract;
    assert.equal(t.exposureInrLakh, 260 / 60 > c.thresholdHours ? c.penaltyInrLakh : 0, t.tenantId);
    assert.equal(c.hoursToBreak, Math.round((c.thresholdHours - 260 / 60) * 100) / 100);
  }
  // Sarvam AI Labs has a 6-hour threshold, so a 4 h 20 min outage costs it nothing.
  assert.equal(ups.who.tenants.find((t) => t.tenantId === 'TEN-03').exposureInrLakh, 0);
  assert.equal(ups.who.totalExposureInrLakh, ups.who.tenants.reduce((s, t) => s + t.exposureInrLakh, 0));
});

test('probable cause: the battery batch, high confidence, corroborated by maintenance', () => {
  assert.equal(ups.why.probableCause.cause, 'Battery batch Q4-2023, vendor A');
  assert.equal(ups.why.probableCause.confidence, 'high');
  assert.match(ups.why.probableCause.basis, /3 of 3 matching incidents/);
});

test('blast radius names the affected rows', () => {
  const rows = [...new Set(exposedRacks('MUM-1', 'UPS-1').racks.map((r) => r.row_id))].sort();
  assert.deepEqual(ups.who.rows, rows);
});

test('the SLA clock counts down to notification and each penalty threshold', () => {
  const at0 = slaClock(ups, 0);
  const at150 = slaClock(ups, 150);
  const bfn = (c) => c.find((x) => x.tenantId === 'TEN-02');
  assert.equal(bfn(at0).notifyLeftMin, 30);
  assert.equal(bfn(at0).breakLeftMin, 120);
  assert.equal(bfn(at150).breached, true);
  assert.equal(at0[0].breakLeftMin, Math.min(...at0.map((x) => x.breakLeftMin)));
});

test('an early-warning alert has not started the notification clock', () => {
  for (const t of ups.who.tenants) {
    assert.equal(t.contract.notifyBy, null);
    assert.equal(t.contract.notifyWithinMin, 30);
  }
});

test('analysis is deterministic', () => {
  assert.deepEqual(analyseIncident({ alertId: 'ALM-4819' }), ups);
});

test('capacity and compliance alerts are never priced as outages', () => {
  const grid = analyseIncident({ alertId: 'ALM-4792' });
  assert.equal(grid.impact, 'capacity');
  assert.equal(grid.who.totalExposureInrLakh, null);
  const wue = analyseIncident({ alertId: 'ALM-4780' });
  assert.equal(wue.impact, 'compliance');
  assert.ok(wue.who.obligations.some((o) => o.jurisdiction === 'Tamil Nadu'));
});

test('a CRAH is covered by its row partner', () => {
  const crah = analyseIncident({ alertId: 'ALM-4821' });
  assert.deepEqual(crah.who.protection.peers, ['CRAH-K-02']);
});

test('distribution equipment at an unmapped site is not attributed to tenants', () => {
  const pdu = analyseIncident({ alertId: 'ALM-4808' });
  assert.equal(pdu.who.scope, 'unattributed');
  assert.equal(pdu.who.tenants.length, 0);
});

test('a resolved incident reports its recorded outcome, not a hypothetical penalty', () => {
  const inc = analyseIncident({ incidentId: 'INC-2026-0215' });
  assert.equal(inc.who.recorded.durationMin, 400);
  assert.equal(inc.who.totalExposureInrLakh, null);
});

test('every queued alert analyses, with a runbook and a template brief', () => {
  const queue = incidentQueue();
  assert.equal(queue.length, nexus.activeAlerts.filter((a) => a.status !== 'resolved').length);
  assert.equal(queue[0].severity, 'critical');
  for (const a of queue) {
    const analysis = analyseIncident({ alertId: a.alert_id });
    assert.ok(analysis.do.steps.length > 0, a.alert_id);
    const facts = buildIncidentFacts(analysis);
    const text = incidentTemplate(analysis, facts);
    for (const label of ['What happened:', 'Why:', 'Who is exposed:', 'What to do:']) assert.ok(text.includes(label), `${a.alert_id} ${label}`);
    // The template itself must pass the number guard it backs up.
    assert.equal(safePrefix(text, allowedNumbers(facts), true).violation, false, `${a.alert_id}: template uses a figure not in its facts`);
  }
});

test('runbook lookup matches on alert wording', () => {
  assert.equal(runbookFor('CT-2', 'WUE 2.51 against 2.45 target')[0].runbook_id, 'RB-CT-WUE');
  assert.equal(runbookFor('CT-1', 'Make-up water flow below expected')[0].runbook_id, 'RB-CT-WTR');
});

test('offline brief returns the template with no network', async () => {
  globalThis.fetch = async () => { throw new Error('network used'); };
  const r = await narrateIncident(ups, { offline: true });
  assert.equal(r.source, 'template');
  assert.ok(r.text.startsWith('What happened: UPS-1 at Nexus Mumbai-1'));
});
