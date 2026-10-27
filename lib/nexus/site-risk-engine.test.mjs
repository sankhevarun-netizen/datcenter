import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteRisk, portfolioSiteRisk, WEIGHTS, BLEND, bandFor } from './site-risk-engine.js';
import { buildSiteRiskFacts, siteRiskTemplate, narrateSiteRisk } from './site-risk-brief.js';
import { allowedNumbers, safePrefix } from './guarded-narrate.js';
import { nexus } from './data.js';

const p = portfolioSiteRisk();

test('weights sum to one and the blend sums to one', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 1);
  assert.equal(BLEND.mean + BLEND.worst, 1);
});

test('NCR-1 carries the highest grid risk and the highest composite', () => {
  const byGrid = [...p.sites].filter((s) => s.grid.utilisedPct !== null).sort((a, b) => b.grid.score - a.grid.score);
  assert.equal(byGrid[0].id, 'NCR-1');
  assert.equal(p.sites[0].id, 'NCR-1');
  assert.equal(p.sites[0].band, 'critical');
});

test('CHN-1 has the highest cyclone exposure; HYD-1 the lowest composite', () => {
  const cyclone = Math.max(...p.sites.map((s) => s.hazard.levels.cyclone));
  assert.deepEqual(p.sites.filter((s) => s.hazard.levels.cyclone === cyclone).map((s) => s.id), ['CHN-1']);
  assert.equal(p.sites.at(-1).id, 'HYD-1');
});

test('BLR-1 is scored on its queue position and has no water score', () => {
  const b = siteRisk('BLR-1');
  assert.equal(b.grid.utilisedPct, null);
  assert.equal(b.grid.score, 31 * 2.5);
  assert.equal(b.water, null);
  assert.deepEqual(p.totals.queued, [{ id: 'BLR-1', position: 31, energisation: 'Q1 2028' }]);
});

test('composite is reproducible from its parts', () => {
  for (const s of p.sites) {
    const parts = { grid: s.grid.score, hazard: s.hazard.score, ...(s.water ? { water: s.water.score } : {}) };
    const w = Object.keys(parts).reduce((a, k) => a + WEIGHTS[k], 0);
    const mean = Object.entries(parts).reduce((a, [k, v]) => a + WEIGHTS[k] * v, 0) / w;
    const expected = Math.round((BLEND.mean * mean + BLEND.worst * Math.max(...Object.values(parts))) * 10) / 10;
    assert.equal(s.composite, expected, s.id);
    assert.equal(s.band, bandFor(s.composite));
  }
});

test('grid-constrained sites are those drawing 90% or more of sanctioned load', () => {
  const expected = nexus.grid.filter((g) => g.connection_status === 'Connected' && g.current_draw_kw / g.sanctioned_load_kw >= 0.9).map((g) => g.facility_id).sort();
  assert.deepEqual([...p.totals.gridConstrained].sort(), expected);
});

test('supply exposure ranks long-lead single-source imports first', () => {
  assert.equal(p.supply[0].type, 'chiller');
  assert.ok(p.supply.slice(0, 2).every((s) => s.singleSource && s.imported));
});

test('the site-risk brief passes its own number guard', async () => {
  const facts = buildSiteRiskFacts(p);
  const text = siteRiskTemplate(facts);
  assert.equal(safePrefix(text, allowedNumbers(facts), true).violation, false);
  assert.ok(text.startsWith('Nexus NCR-1 carries the highest site risk'));
  assert.equal((await narrateSiteRisk(p, { offline: true })).text, text);
});
