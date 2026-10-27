// node --import ./scripts/json-loader.mjs --test lib/nexus/switchover-engine.test.mjs
// (or: npm run test:nexus)
//
// Numbers below were hand-verified against data/nexus/{components,racks,
// tenants,contracts,activeAlerts,maintenance}.json directly (see the plan /
// session notes for the exact arithmetic):
//   - UTIL-FEED-A (current_load 3740 kW) and UTIL-FEED-B (current_load 3060
//     kW, derated_capacity 5100 kW) are a recorded 2N pair, not a shared N+1
//     group, so failing/transferring A adds a seed of 3740 kW onto B with no
//     further upstream edge to walk. B's new load = 6800 kW = 133.3% of its
//     5100 kW derated capacity -> propagateChange reports a breaking point.
//   - PDU-A1 (redundancy "N", redundant_peers null) has NO recorded peer, so
//     take_offline on it is an uncontested outage. exposedRacks('MUM-1',
//     'PDU-A1') returns its 10 occupied racks, all tenant TEN-01 (Aarav
//     Cloud Services), contract CON-01 (penalty_threshold_hours 4, flat
//     penalty_inr_lakh 410). A 6h window exceeds the 4h threshold, so the
//     flat (not prorated) penalty of 410 lakh applies.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { planSwitchover, scoreWindow, candidateWindows, SwitchoverInputError, SWITCHOVER_TYPES } from './switchover-engine.js';
import { index } from './data.js';
import { buildSwitchoverFacts, switchoverTemplate } from './switchover-brief.js';
import { checkPrompt } from './prompt-policy.js';
import { allowedNumbers } from './guarded-narrate.js';

const WINDOW = '2026-10-10 02:00';

function feedTransferInput() {
  return { facilityId: 'MUM-1', componentId: 'UTIL-FEED-A', action: 'transfer_load', transferToId: 'UTIL-FEED-B', windowStart: WINDOW, durationHours: 4 };
}

describe('1. Acceptance example: transfer load from Feed A to Feed B', () => {
  const result = planSwitchover(feedTransferInput());

  test('NO-GO: Feed B exceeds derated capacity at 133.3%', () => {
    assert.equal(result.verdict.level, 'NO_GO');
    const reason = result.verdict.reasons.find((r) => r.code === 'over-capacity');
    assert.ok(reason, 'expected an over-capacity reason');
    assert.equal(result.impact.breakingPoints.length, 1);
    assert.equal(result.impact.breakingPoints[0].componentId, 'UTIL-FEED-B');
    assert.equal(result.impact.breakingPoints[0].newUtilisationPct, 133.3);
  });

  test('a recommended window and a runbook are still returned', () => {
    assert.ok(result.windows.recommended);
    assert.ok(result.windows.ranked.length > 0 && result.windows.ranked.length <= 5);
    assert.ok(result.runbook.steps.length > 0);
  });
});

describe('2. NO-GO: take PDU-A1 offline — no recorded peer, real tenant exposure', () => {
  const result = planSwitchover({ facilityId: 'MUM-1', componentId: 'PDU-A1', action: 'take_offline', windowStart: WINDOW, durationHours: 6 });

  test('verdict is NO_GO for lack of redundancy', () => {
    assert.equal(result.verdict.level, 'NO_GO');
    assert.ok(result.verdict.reasons.some((r) => r.code === 'no-redundancy'));
  });

  test('exposes exactly the real racks/tenant/exposure for PDU-A1', () => {
    assert.equal(result.racks.count, 10);
    assert.equal(result.tenants.length, 1);
    assert.equal(result.tenants[0].tenantId, 'TEN-01');
    assert.equal(result.tenants[0].exposureInrLakh, 410);
    assert.equal(result.totalExposureInrLakh, 410);
  });

  test('transfer_load on PDU-A1 is rejected — no recorded peer', () => {
    assert.throws(() => planSwitchover({ facilityId: 'MUM-1', componentId: 'PDU-A1', action: 'transfer_load', transferToId: 'PDU-A2', windowStart: WINDOW, durationHours: 6 }), SwitchoverInputError);
  });
});

describe('3. Determinism', () => {
  test('two identical calls produce byte-identical JSON', () => {
    const a = planSwitchover(feedTransferInput());
    const b = planSwitchover(feedTransferInput());
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });
});

describe('4. Traceability', () => {
  test('every componentId and recordId in the result resolves to a real record', () => {
    const result = planSwitchover(feedTransferInput());
    const ids = [
      ...result.impact.breakingPoints.map((b) => b.componentId),
      ...result.peers,
      result.input.componentId,
    ];
    for (const id of ids) assert.ok(index.componentById.has(id), `${id} is not a known component`);
    for (const r of result.verdict.reasons) {
      for (const id of r.componentIds) assert.ok(index.componentById.has(id) || index.rackById.has(id), `${id} not traceable`);
    }
  });
});

describe('5. Validation', () => {
  const base = { facilityId: 'MUM-1', windowStart: WINDOW, durationHours: 2 };

  test('unsupported component type throws (transformer is a real, unsupported type)', () => {
    assert.throws(() => planSwitchover({ ...base, componentId: 'TX-1', action: 'take_offline' }), SwitchoverInputError);
  });

  test('unknown component — facility reports as unmapped, not a crash', () => {
    const result = planSwitchover({ ...base, componentId: 'NOPE-1', action: 'take_offline' });
    assert.equal(result.mapped, false);
  });

  test('transfer_load without a transfer target throws', () => {
    assert.throws(() => planSwitchover({ ...base, componentId: 'UTIL-FEED-A', action: 'transfer_load' }), SwitchoverInputError);
  });

  test('transfer target that is not a recorded peer throws', () => {
    assert.throws(() => planSwitchover({ ...base, componentId: 'UTIL-FEED-A', action: 'transfer_load', transferToId: 'UPS-1' }), SwitchoverInputError);
  });

  test('zero or negative duration throws', () => {
    assert.throws(() => planSwitchover({ ...base, componentId: 'UTIL-FEED-A', action: 'take_offline', durationHours: 0 }), SwitchoverInputError);
    assert.throws(() => planSwitchover({ ...base, componentId: 'UTIL-FEED-A', action: 'take_offline', durationHours: -3 }), SwitchoverInputError);
  });

  test('facility without a component graph returns mapped:false, not a throw', () => {
    const result = planSwitchover({ facilityId: 'MUM-2', componentId: 'ANYTHING', action: 'take_offline', windowStart: WINDOW, durationHours: 2 });
    assert.equal(result.mapped, false);
    assert.equal(result.verdict, null);
  });
});

describe('6. Window scoring', () => {
  test('a window overlapping a real open outage alert scores lower than a clean one', () => {
    const ctx = { componentIds: ['CRAH-K-01'], facilityId: 'MUM-1', durationHours: 2, worstUtilisationFraction: 0, autonomyExceeded: false };
    const during = scoreWindow({ startMin: 0, endMin: 120 }, ctx);
    assert.ok(during.factors.some((f) => f.code === 'open-alert'), 'expected the real ALM-4821 open alert on CRAH-K-01 to score a penalty');
  });

  test('candidateWindows only returns windows at/after asOf, sorted ascending', () => {
    const windows = candidateWindows({ asOf: '2026-10-01 06:00', horizonDays: 3, durationHours: 2 });
    assert.ok(windows.length > 0);
    for (let i = 1; i < windows.length; i++) assert.ok(windows[i].startMin >= windows[i - 1].startMin);
  });
});

describe('7. Runbook', () => {
  const result = planSwitchover(feedTransferInput());

  test('has pre, execute, verify and rollback phases', () => {
    const phases = new Set(result.runbook.steps.map((s) => s.phase));
    assert.deepEqual(phases, new Set(['pre', 'execute', 'verify', 'rollback']));
  });

  test('every execute step has a corresponding rollback step', () => {
    const executeCount = result.runbook.steps.filter((s) => s.phase === 'execute').length;
    const reversalCount = result.runbook.steps.filter((s) => s.phase === 'rollback' && s.action.startsWith('Reverse:')).length;
    assert.equal(reversalCount, executeCount);
  });
});

describe('8. Prompt safety', () => {
  const result = planSwitchover(feedTransferInput());

  test('facts pass checkPrompt (metadata-only guard) and only carry real computed numbers', () => {
    const facts = buildSwitchoverFacts(result);
    assert.equal(checkPrompt(JSON.stringify(facts)).ok, true);
    const allowed = allowedNumbers(facts);
    assert.ok(allowed.has(133.3));
  });

  test('switchoverTemplate works synchronously with no model involved', () => {
    const facts = buildSwitchoverFacts(result);
    const text = switchoverTemplate(result, facts);
    assert.ok(typeof text === 'string' && text.length > 0);
  });
});

describe('9. Supported types', () => {
  test('exactly the six documented component types are supported', () => {
    assert.deepEqual(SWITCHOVER_TYPES, ['utility_feed', 'ups', 'generator', 'chiller', 'pdu', 'crah']);
  });
});
