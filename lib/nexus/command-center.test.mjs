import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandCenterModel, tenantSla, ageLabel } from './command-center.js';
import { copilotSystemPrompt } from './copilot-context.js';
import { portfolioSummary } from './portfolio.js';
import { nexus } from './data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const model = commandCenterModel();

test('command centre widgets read the dataset, not the old mock file', () => {
  for (const f of ['CommandCenterPage', 'KPIStrip', 'PortfolioHealthMap', 'IncidentCommandCenter', 'InfrastructureHealthMatrix', 'CapacityUtilization', 'SustainabilityIntel', 'AIOperationsFeed', 'ContextPanel']) {
    const src = readFileSync(join(root, 'components', 'command-center', `${f}.jsx`), 'utf8');
    assert.ok(!src.includes('command-center-mock'), `${f} still imports the mock data`);
  }
});

test('KPI values agree with the portfolio rollup', () => {
  const t = portfolioSummary().totals;
  const k = Object.fromEntries(model.kpis.map((x) => [x.id, x]));
  assert.equal(k.pue.value, String(t.pue));
  assert.equal(k.alerts.value, String(nexus.activeAlerts.length));
  assert.equal(k.alerts.status, 'critical');
  for (const x of model.kpis) assert.ok(x.sparklineData.length >= 2, `${x.id} sparkline`);
});

test('every facility appears exactly once on the health map', () => {
  const ids = model.regions.flatMap((r) => r.facilities.map((f) => f.id)).sort();
  assert.deepEqual(ids, nexus.facilities.map((f) => f.facility_id).sort());
});

test('incident rows cover the open queue, most severe first', () => {
  assert.equal(model.incidents.length, nexus.activeAlerts.filter((a) => a.status !== 'resolved').length);
  assert.equal(model.incidents[0].id, 'ALM-4792');
});

test('infrastructure matrix flags exactly the MUM-1 components with advisories or alerts', () => {
  const ups = model.infrastructure.systems.find((s) => s.system === 'UPS');
  assert.deepEqual(ups.flagged.sort(), ['UPS-1', 'UPS-2']);
  const crah = model.infrastructure.systems.find((s) => s.system === 'CRAH units');
  assert.deepEqual(crah.flagged, ['CRAH-K-01']);
  for (const s of model.infrastructure.systems) if (s.peak) assert.ok(s.peak.utilisationPct <= 100, s.system);
});

test('tenant SLA lists every contract, each tenant counted once at its largest exposure', () => {
  const rows = tenantSla();
  assert.equal(rows.length, nexus.contracts.length);
  const bfn = rows.find((r) => r.tenantId === 'TEN-02');
  assert.equal(bfn.exposureInrLakh, 680);
  assert.equal(bfn.allowedDowntimeMinPerYear, 26);
  for (const r of rows) assert.ok(r.exposureInrLakh === 0 || r.exposureInrLakh === r.penaltyInrLakh, r.contractId);
});

test('ages are measured from the dataset clock', () => {
  assert.equal(ageLabel('2026-09-29 03:14'), 'now');
  assert.equal(ageLabel('2026-09-28 21:40'), '5 h 34 min');
});

test('the copilot is briefed only with the Nexus portfolio', () => {
  const prompt = copilotSystemPrompt();
  for (const f of nexus.facilities) assert.ok(prompt.includes(f.facility_id), f.facility_id);
  for (const invented of ['Singapore', 'Frankfurt', 'Ashburn', '847 MW', '94.2']) assert.ok(!prompt.includes(invented), invented);
  assert.ok(prompt.includes('ALM-4819'));
});
