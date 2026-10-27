import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDisclosure, ledgerRows, ENERGY_MONTHS, FRAMEWORKS } from './esg-engine.js';
import { buildEsgFacts, esgTemplate } from './esg-brief.js';
import { pdfSafe } from './pdf-pack.js';
import { allowedNumbers, safePrefix } from './guarded-narrate.js';
import { nexus } from './data.js';

const brsr = buildDisclosure({ framework: 'BRSR' });
const operating = nexus.facilities.filter((f) => f.status === 'Operational').map((f) => f.facility_id);

test('BRSR covers every operating site over the full metered period', () => {
  assert.deepEqual(brsr.facilities.map((f) => f.id).sort(), [...operating].sort());
  assert.equal(brsr.period.from, ENERGY_MONTHS[0]);
  assert.equal(brsr.period.months, ENERGY_MONTHS.length);
});

test('totals reconcile with 13_energy and 14_water', () => {
  const kwh = nexus.energy.reduce((s, e) => s + e.total_kwh, 0);
  const litres = nexus.water.reduce((s, w) => s + w.total_litres, 0);
  assert.equal(brsr.totals.totalEnergyMwh.value, Math.round((kwh / 1000) * 10) / 10);
  assert.equal(brsr.totals.waterWithdrawnKl.value, Math.round(litres / 1000));
  // Each GJ figure is rounded on its own, so the parts may differ from the total by one.
  assert.ok(Math.abs(brsr.totals.renewableGj.value + brsr.totals.gridGj.value - brsr.totals.totalEnergyGj.value) <= 1);
});

test('annual PUE is total over IT energy, not the mean of monthly PUEs', () => {
  const rows = nexus.energy;
  const it = rows.reduce((s, e) => s + e.total_kwh / e.measured_pue, 0);
  const total = rows.reduce((s, e) => s + e.total_kwh, 0);
  const meanOfMonths = rows.reduce((s, e) => s + e.measured_pue, 0) / rows.length;
  assert.equal(brsr.totals.pue.value, Math.round((total / it) * 1000) / 1000);
  assert.notEqual(brsr.totals.pue.value, Math.round(meanOfMonths * 1000) / 1000);
});

test('every disclosed figure names its formula and source sheet; gaps say why', () => {
  for (const fw of Object.keys(FRAMEWORKS)) {
    for (const l of buildDisclosure({ framework: fw }).lines) {
      if (l.value === null) assert.ok(l.gap, `${fw} ${l.item} has neither a value nor a reason`);
      else {
        assert.ok(l.formula, `${fw} ${l.item} formula`);
        assert.match(l.source.sheet, /^1[34]_(energy|water)$/);
        assert.ok(l.source.rows > 0);
      }
    }
  }
});

test('no facility exports heat, so ERF is zero; scope 1 is a declared gap', () => {
  const eed = buildDisclosure({ framework: 'EED' });
  assert.equal(eed.lines.find((l) => l.item === 'Energy reuse factor').value, 0);
  assert.ok(brsr.gaps.some((g) => /Scope 1/.test(g.item)));
});

test('Karnataka scopes BLR-1 only, which has nothing metered to disclose yet', () => {
  const ka = buildDisclosure({ framework: 'KA' });
  assert.deepEqual(ka.facilities.map((f) => f.id), ['BLR-1']);
  assert.equal(ka.totals, null);
  assert.equal(ka.pending.length, 1);
  assert.ok(ka.lines.every((l) => l.value === null));
  assert.match(esgTemplate(buildEsgFacts(ka)), /once the site is energised/);
});

test('a shorter period sums only its months', () => {
  const q3 = buildDisclosure({ framework: 'EED', from: '2026-07', to: '2026-09' });
  const kwh = nexus.energy.filter((e) => e.month >= '2026-07').reduce((s, e) => s + e.total_kwh, 0);
  assert.equal(q3.totals.totalEnergyMwh.value, Math.round((kwh / 1000) * 10) / 10);
  assert.equal(ledgerRows({ from: '2026-07', to: '2026-09', facilityIds: operating }).length, 3 * operating.length);
});

test('the executive summary passes its own number guard', () => {
  const facts = buildEsgFacts(brsr);
  assert.equal(safePrefix(esgTemplate(facts), allowedNumbers(facts), true).violation, false);
});

test('PDF text is reduced to the standard font character set', () => {
  assert.equal(pdfSafe('₹4 lakh, tCO₂e, Σ total'), 'Rs 4 lakh, tCO2e, sum of total');
});

test('every figure cites its workbook rows and a confidence basis', () => {
  const d = buildDisclosure({ framework: 'EED', facilityIds: ['MUM-1'] });
  assert.equal(d.readinessScore, 100); // MUM-1: nine months, no gaps
  for (const l of d.lines) {
    assert.match(l.source.rowRanges, /^\d+(–\d+)?(, \d+(–\d+)?)*$/, l.item);
    assert.ok(['measured', 'derived', 'reference'].includes(l.confidence), l.item);
  }
  assert.equal(d.lines.find((l) => l.item === 'Total energy consumption').source.rowRanges, '2–10');
});

test('readiness falls with each gap: GRESB lacks scope 1 and waste', () => {
  const g = buildDisclosure({ framework: 'GRESB' });
  assert.equal(g.readinessScore, Math.round((5 / 7) * 100));
  assert.equal(buildDisclosure({ framework: 'KA' }).readinessScore, 0);
});
