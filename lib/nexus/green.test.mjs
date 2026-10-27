// Green energy and water circularity: every figure computed from the dataset,
// and the new sheets stay connected to 13_energy and 14_water.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nexus, index } from './data.js';
import { matchingScore, matchingWithStorage, cloudyDayStressTest, currentPosition, hourlyRows } from './cfe-engine.js';
import { circularityPosition, whatIfIncreasedTreatment } from './water-circularity-engine.js';
import { scope2Emissions, embodiedCarbonOfStranded } from './carbon-engine.js';
import { recommendedActions } from './procurement-advisor.js';

const hoursIn = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate() * 24; };

test('27_hourly_generation: load reconciles with 13_energy; solar follows the Mumbai day', () => {
  const rows = hourlyRows('MUM-1');
  assert.equal(rows.length, 30 * 24);
  for (const r of rows) {
    const e = index.energyByFacility.get('MUM-1').find((x) => x.month === r.date.slice(0, 7));
    const avg = e.total_kwh / hoursIn(e.month);
    assert.ok(Math.abs(r.load_kw / avg - 1) <= 0.036, `${r.timestamp} load within the cooling swing of the month average`);
    if (r.hour_of_day < 6 || r.hour_of_day >= 19) assert.equal(r.solar_generation_kw, 0, r.timestamp);
    assert.equal(r.matched_kw, Math.min(r.solar_generation_kw, r.load_kw));
    assert.equal(r.unmatched_kw, r.load_kw - r.matched_kw);
  }
});

test('today: 22% renewable from certificates, none of it verifiable hour by hour', () => {
  const t = currentPosition('MUM-1');
  const ms = index.energyByFacility.get('MUM-1');
  const share = ms.reduce((s, m) => s + m.renewable_kwh, 0) / ms.reduce((s, m) => s + m.total_kwh, 0);
  assert.equal(t.reportedRenewablePct, Math.round(share * 1000) / 10);
  assert.equal(t.hourlyVerifiedPct, 0);
  assert.equal(t.gridTariffInrKwh, ms.at(-1).tariff_inr_kwh);
});

test('PPA: annual volumetric ~72%, hourly 35–40%, gap 25–35 points, overnight under 10%', () => {
  const s = matchingScore('MUM-1');
  assert.ok(s.comparedToAnnualRec.annualRecPct >= 70 && s.comparedToAnnualRec.annualRecPct <= 75);
  assert.ok(s.matchedPct >= 35 && s.matchedPct <= 40);
  assert.ok(s.comparedToAnnualRec.gap >= 25 && s.comparedToAnnualRec.gap <= 35);
  assert.ok(s.overnightPct < 10);
  assert.ok(s.worstHourBand.startHour >= 17 && s.worstHourBand.endHour <= 7);
  assert.deepEqual(matchingScore('MUM-1'), s, 'deterministic');
});

test('storage: the sized battery takes overnight to 50–60%; the 4 MWh pilot barely moves it', () => {
  const big = matchingWithStorage('MUM-1', 'BESS-MUM-1-A');
  assert.ok(big.overnightPctAfter >= 50 && big.overnightPctAfter <= 60, `${big.overnightPctAfter}`);
  assert.ok(big.matchedPctAfter >= 60 && big.matchedPctAfter <= 70, `${big.matchedPctAfter}`);
  assert.equal(big.capexInrLakh, nexus.cleanEnergyAssets.find((a) => a.asset_id === 'BESS-MUM-1-A').cost_inr_lakh);
  const pilot = matchingWithStorage('MUM-1', 'BESS-MUM-1-PILOT');
  assert.ok(pilot.overnightPctAfter < 5);
  // More storage never lowers matching, and the slider prices from the reference battery.
  const a = matchingWithStorage('MUM-1', { capacityKwh: 40000 }), b = matchingWithStorage('MUM-1', { capacityKwh: 80000 });
  assert.ok(b.matchedPctAfter >= a.matchedPctAfter);
  assert.equal(b.capexInrLakh, Math.round(12750 * (80000 / 120000)));
});

test('cloudy day: a real drop, midday under 20%', () => {
  const c = cloudyDayStressTest('MUM-1');
  assert.equal(c.date, '2026-07-16');
  assert.ok(c.cloudyMiddayPct < 20 && c.normalMiddayPct > 90);
  assert.ok(c.cloudyDayMatchingPct < c.normalMatchingPct);
});

test('Scope 2 recomputes the recorded emissions; stranded embodied carbon uses the 640 kW of structural stranding', () => {
  const s = scope2Emissions('MUM-1');
  for (const m of s.monthly) assert.ok(Math.abs(m.gridTco2 - m.recordedTco2) < 0.2, m.month);
  const e = embodiedCarbonOfStranded('MUM-1');
  assert.equal(e.strandedKw, 640);
  assert.equal(e.estimatedEmbodiedTco2, Math.round(640 * 1.829));
});

test('water circularity: from 14_water; applicable policy only, no invented threshold', () => {
  const p = circularityPosition('MUM-1');
  const ms = index.waterByFacility.get('MUM-1');
  assert.equal(p.treatedSharePct, Math.round((ms.reduce((s, m) => s + m.treated_litres, 0) / ms.reduce((s, m) => s + m.total_litres, 0)) * 1000) / 10);
  assert.equal(p.incentiveLinked, false);
  assert.ok(p.policies.some((x) => x.jurisdiction === 'Maharashtra'));
  assert.ok(circularityPosition('CHN-1').policies.some((x) => x.jurisdiction === 'Tamil Nadu'));
  const w = whatIfIncreasedTreatment('MUM-1', 40);
  assert.equal(w.newFreshwaterLitres, p.freshwaterLitresPerYear - w.litresSaved);
  const beyond = whatIfIncreasedTreatment('MUM-1', 90);
  assert.ok(beyond.shortfallLitres > 0, 'on-site levers cannot reach 90%');
});

test('advisor: a deterministic ranking with the sized battery first', () => {
  const list = recommendedActions('MUM-1');
  assert.equal(list[0].id, 'BESS-MUM-1-A');
  assert.ok(list.some((a) => a.id === 'ppa') && list.some((a) => a.id === 'stranded') && list.some((a) => a.category === 'water'));
  assert.deepEqual(recommendedActions('MUM-1'), list);
});

test('Scope 2 scenarios share the 13_energy annual load, so today recomputes to the recorded figure', async () => {
  const { scope2Scenario } = await import('./carbon-engine.js');
  const s = scope2Emissions('MUM-1');
  const today = scope2Scenario({ loadMwhPerYear: s.annualisedLoadMwh, cleanSharePct: currentPosition('MUM-1').reportedRenewablePct, factorKgPerKwh: s.emissionFactorKgPerKwh });
  assert.ok(Math.abs(today.tco2PerYear - s.annualisedNetTco2) / s.annualisedNetTco2 < 0.01);
});
