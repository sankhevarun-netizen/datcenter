// Platform hardening: roles and permissions, and the metadata-only prompt rule.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { can, permissionsFor, roleFromUser, normaliseRole, ROLES } from '../auth/roles.js';
import { checkPrompt, MAX_TIMESTAMPS } from './prompt-policy.js';
import { guardedNarrate } from './guarded-narrate.js';
import { copilotSystemPrompt } from './copilot-context.js';
import { buildIncidentFacts } from './incident-brief.js';
import { analyseIncident, incidentQueue } from './incident-engine.js';
import { buildSwitchoverFacts } from './switchover-brief.js';
import { planSwitchover } from './switchover-engine.js';
import { nexus } from './data.js';

test('roles are cumulative: each holds everything the one below does', () => {
  for (let i = 1; i < ROLES.length; i += 1) {
    for (const p of permissionsFor(ROLES[i - 1])) assert.ok(can(ROLES[i], p), `${ROLES[i]} lacks ${p}`);
  }
});

test('operators run the floor but see no commercial figures, audit or costs', () => {
  assert.ok(can('operator', 'act:acknowledge'));
  assert.ok(!can('operator', 'view:commercial'));
  assert.ok(!can('operator', 'export:reports'));
  assert.ok(can('manager', 'export:reports'));
  assert.ok(!can('manager', 'view:audit'));
  assert.ok(can('partner', 'view:audit'));
  assert.ok(can('partner', 'view:costs'));
  assert.ok(!can('partner', 'manage:access'));
  assert.ok(can('admin', 'manage:access'));
});

test('unknown roles and permissions fail closed', () => {
  assert.equal(normaliseRole('superuser'), 'operator');
  assert.equal(roleFromUser({ app_metadata: {} }), 'operator');
  assert.equal(roleFromUser({ app_metadata: { role: 'partner' } }), 'partner');
  assert.ok(!can('admin', 'delete:everything'));
});

test('every brief and the copilot record pass the metadata-only check', () => {
  assert.ok(checkPrompt(copilotSystemPrompt()).ok);
  for (const a of incidentQueue()) assert.ok(checkPrompt(JSON.stringify(buildIncidentFacts(analyseIncident({ alertId: a.alert_id })))).ok, a.alert_id);
  const switchoverPlan = planSwitchover({ facilityId: 'MUM-1', componentId: 'UTIL-FEED-A', action: 'transfer_load', transferToId: 'UTIL-FEED-B', windowStart: '2026-10-10 02:00', durationHours: 4 });
  assert.ok(checkPrompt(JSON.stringify(buildSwitchoverFacts(switchoverPlan))).ok);
});

test('raw telemetry is refused', () => {
  assert.equal(checkPrompt(JSON.stringify(nexus.telemetryReplay.slice(0, 3))).ok, false);
  const stamps = Array.from({ length: MAX_TIMESTAMPS + 1 }, (_, i) => `2026-03-17 ${String(10 + i).padStart(2, '0')}:00`).join('\n');
  assert.equal(checkPrompt(stamps).ok, false);
});

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test('a brief whose facts carry raw readings is never sent', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response('', { status: 500 }); };
  const r = await guardedNarrate({ systemPrompt: 's', facts: { readings: nexus.telemetryReplay.slice(0, 2) }, template: 'T' });
  assert.equal(called, false);
  assert.equal(r.source, 'template');
  assert.match(r.withheld, /telemetry/);
});
