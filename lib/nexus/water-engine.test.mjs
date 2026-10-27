import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facilityWater, portfolioWater } from './water-engine.js';
import { buildWaterFacts, waterTemplate, narrateWater } from './water-brief.js';
import { allowedNumbers, safePrefix } from './guarded-narrate.js';
import { nexus } from './data.js';
import secondary from '../../data/nexus/fixtures/secondaryEffects.json';

const p = portfolioWater();

test('CHN-1 is the worst site for water use (highest WUE, lowest treated share); NCR-1 and CHN-1 sit in the most stressed basins', () => {
  const live = p.sites.filter((s) => s.ytd);
  const byWue = [...live].sort((a, b) => b.latest.wue - a.latest.wue);
  assert.equal(byWue[0].id, 'CHN-1');
  const byStress = [...live].sort((a, b) => b.stress.index - a.stress.index).map((s) => s.id);
  assert.deepEqual(byStress.slice(0, 2), ['NCR-1', 'CHN-1']);
  assert.equal(Math.min(...live.map((s) => s.ytd.treatedSharePct)), facilityWater('CHN-1').ytd.treatedSharePct);
  assert.deepEqual(facilityWater('CHN-1').alerts.map((a) => a.alertId).sort(), ['ALM-4780', 'ALM-4805']);
});

test('fresh plus treated equals total, every month and year to date', () => {
  for (const s of p.sites.filter((x) => x.ytd)) {
    for (const m of s.months) assert.equal(m.freshLitres + m.treatedLitres, m.totalLitres, `${s.id} ${m.month}`);
    assert.equal(s.ytd.freshLitres + s.ytd.treatedLitres, s.ytd.totalLitres, s.id);
    assert.ok(s.peak.lpm > s.peak.avgLpm, `${s.id} peak above average`);
  }
});

test('portfolio WUE is litres over IT energy, not a mean of site WUEs', () => {
  const rows = nexus.water.filter((w) => w.month === p.month);
  const litres = rows.reduce((s, w) => s + w.total_litres, 0);
  const itKwh = rows.reduce((s, w) => s + w.total_litres / w.measured_wue_l_per_kwh, 0);
  assert.equal(p.totals.wue, Math.round((litres / itKwh) * 1000) / 1000);
});

test('Karnataka binds BLR-1 only, and starts two days after the as-of date', () => {
  for (const s of p.sites) {
    const k = s.obligations.find((o) => o.jurisdiction === 'Karnataka');
    if (s.id === 'BLR-1') {
      assert.equal(k.inForce, false);
      assert.equal(k.startsInDays, 2);
    } else assert.equal(k, undefined, s.id);
  }
  assert.ok(facilityWater('CHN-1').obligations.some((o) => o.jurisdiction === 'Tamil Nadu'));
});

test('BLR-1 reports its design target, not operating figures', () => {
  const b = facilityWater('BLR-1');
  assert.equal(b.ytd, null);
  assert.equal(b.benchmark.basis, 'Design target');
});

test('the water brief passes its own number guard', async () => {
  const facts = buildWaterFacts(p);
  const text = waterTemplate(facts);
  assert.equal(safePrefix(text, allowedNumbers(facts), true).violation, false);
  assert.ok(text.includes('Nexus Chennai-1 is the weakest'));
  assert.equal((await narrateWater(p, { offline: true })).text, text);
});

test('adding 1,000 kW at MUM-1 costs the same water the cascade reports for Row G', async () => {
  const { waterImpactOfChange } = await import('./water-engine.js');
  const w = waterImpactOfChange({ facilityId: 'MUM-1', additionalLoadKw: 1000 });
  const expected = secondary.find((r) => r.metric === 'Annual water').delta;
  assert.equal(w.additionalLitresPerYear, expected); // 7,410,960 litres
  assert.equal(w.newWue, w.wue);
});

test('CHN-1 expansion is reportable under the Tamil Nadu water assessment; HYD-1 is not', async () => {
  const { waterImpactOfChange } = await import('./water-engine.js');
  assert.equal(waterImpactOfChange({ facilityId: 'CHN-1', additionalLoadKw: 500 }).reportableUnderPolicy, true);
  assert.equal(waterImpactOfChange({ facilityId: 'HYD-1', additionalLoadKw: 500 }).reportableUnderPolicy, false);
});
