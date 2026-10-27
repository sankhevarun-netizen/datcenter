import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchNexusFacilities } from '../../modules/global-infrastructure/services/nexusFacilityService.js';
import { buildPortfolioFacts, portfolioTemplate } from './portfolio-brief.js';
import { allowedNumbers, safePrefix } from './guarded-narrate.js';
import { nexus } from './data.js';

const sites = fetchNexusFacilities();

test('the map adapter carries all six facilities with dataset values', () => {
  assert.equal(sites.length, nexus.facilities.length);
  for (const s of sites) {
    const f = nexus.facilities.find((x) => x.facility_id === s.id);
    assert.equal(s.latitude, f.lat);
    assert.equal(s.capacityMw, f.design_it_kw / 1000);
    assert.equal(s.renewablePct, f.renewable_pct);
  }
});

test('BLR-1 is under construction with no operating figures; NCR-1 is critical', () => {
  const blr = sites.find((s) => s.id === 'BLR-1');
  assert.equal(blr.status, 'Under Construction');
  assert.equal(blr.health, 'commissioning');
  assert.equal(blr.itLoadMw, 0);
  assert.equal(blr.queuePosition, 31);
  assert.equal(sites.find((s) => s.id === 'NCR-1').health, 'critical');
});

test('only MUM-1 links to the component twin', () => {
  assert.deepEqual(sites.filter((s) => s.hasComponentModel).map((s) => s.id), ['MUM-1']);
});

test('the executive briefing passes its own number guard and names both decisions', () => {
  const facts = buildPortfolioFacts();
  const text = portfolioTemplate(facts);
  assert.equal(safePrefix(text, allowedNumbers(facts), true).violation, false);
  assert.match(text, /approve the UPS-2 replacement/);
  assert.match(text, /Nexus NCR-1 grid load enhancement/);
});
