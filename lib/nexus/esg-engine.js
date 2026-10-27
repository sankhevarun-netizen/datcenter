// lib/nexus/esg-engine.js
//
// Audit-ready disclosure figures from metered energy (13_energy) and water
// (14_water). Every figure carries its formula and the cells it came from, so
// an auditor can trace it back to the workbook. Ratios are always computed
// from totals (sum over sum), never averaged across months or sites.
import { nexus, index, getFacility } from './data.js';

const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;
const sum = (xs, fn) => xs.reduce((s, x) => s + fn(x), 0);
const GJ_PER_MWH = 3.6;
const STRESSED = new Set(['High', 'Extremely high']);

export const ENERGY_MONTHS = [...new Set(nexus.energy.map((e) => e.month))].sort();

/** The metered base for a set of sites and months. */
function ledger(facilityIds, from, to) {
  const inRange = (r) => facilityIds.includes(r.facility_id) && r.month >= from && r.month <= to;
  const energy = nexus.energy.filter(inRange);
  const water = nexus.water.filter(inRange);
  return { energy, water };
}

/** Workbook row numbers (header is row 1) of the given records, as ranges: "2–10, 20–28". */
function rowRanges(sheetRows, picked) {
  const nums = picked.map((r) => sheetRows.indexOf(r) + 2).sort((a, b) => a - b);
  const out = [];
  for (const n of nums) {
    const last = out.at(-1);
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');
}

/**
 * How each figure is obtained: read straight from metered sums, derived from
 * metered ratios (IT energy via measured PUE or WUE), or dependent on a
 * reference factor (the national grid carbon intensity).
 */
const CONFIDENCE = {
  measured: 'Metered: sum of monthly readings, no estimation',
  derived: 'Derived from metered readings and the measured monthly ratio',
  reference: 'Metered energy × a published reference factor',
};
const FIGURE_CONFIDENCE = {
  itEnergyMwh: 'derived', pue: 'derived', wue: 'derived', carbonIntensity: 'derived', scope2Tco2: 'reference',
};

function figures(facilityIds, from, to) {
  const { energy, water } = ledger(facilityIds, from, to);
  if (!energy.length) return null;
  const totalKwh = sum(energy, (e) => e.total_kwh);
  // IT energy = facility energy / measured PUE, month by month.
  const itKwh = sum(energy, (e) => e.total_kwh / e.measured_pue);
  const renewableKwh = sum(energy, (e) => e.renewable_kwh);
  const gridKwh = sum(energy, (e) => e.grid_kwh);
  const reusedKwh = sum(energy, (e) => e.energy_reused_kwh);
  const litres = sum(water, (w) => w.total_litres);
  const fresh = sum(water, (w) => w.freshwater_litres);
  const treated = sum(water, (w) => w.treated_litres);
  const stressed = sum(water.filter((w) => STRESSED.has(w.local_water_stress)), (w) => w.total_litres);
  const waterItKwh = sum(water, (w) => w.total_litres / w.measured_wue_l_per_kwh);
  const tco2 = sum(energy, (e) => e.emissions_tco2);
  const src = (sheet, fields) => {
    const picked = sheet === '13_energy' ? energy : water;
    return { sheet, fields, facilities: facilityIds, from, to, rows: picked.length, rowRanges: rowRanges(sheet === '13_energy' ? nexus.energy : nexus.water, picked) };
  };

  const out = {
    renewableMwh: { label: 'Renewable energy procured or generated', unit: 'MWh', value: round(renewableKwh / 1000, 1), formula: 'Σ renewable_kwh ÷ 1,000', source: src('13_energy', ['renewable_kwh']) },
    totalEnergyMwh: { label: 'Total energy consumed', unit: 'MWh', value: round(totalKwh / 1000, 1), formula: 'Σ total_kwh ÷ 1,000', source: src('13_energy', ['total_kwh']) },
    totalEnergyGj: { label: 'Total energy consumed', unit: 'GJ', value: round((totalKwh / 1000) * GJ_PER_MWH), formula: 'Σ total_kwh ÷ 1,000 × 3.6', source: src('13_energy', ['total_kwh']) },
    renewableGj: { label: 'From renewable sources', unit: 'GJ', value: round((renewableKwh / 1000) * GJ_PER_MWH), formula: 'Σ renewable_kwh ÷ 1,000 × 3.6', source: src('13_energy', ['renewable_kwh']) },
    gridGj: { label: 'From non-renewable sources (grid)', unit: 'GJ', value: round((gridKwh / 1000) * GJ_PER_MWH), formula: 'Σ grid_kwh ÷ 1,000 × 3.6', source: src('13_energy', ['grid_kwh']) },
    itEnergyMwh: { label: 'IT equipment energy', unit: 'MWh', value: round(itKwh / 1000, 1), formula: 'Σ (total_kwh ÷ measured_pue) ÷ 1,000', source: src('13_energy', ['total_kwh', 'measured_pue']) },
    pue: { label: 'Power usage effectiveness (PUE)', unit: '', value: round(totalKwh / itKwh, 3), formula: 'Σ total energy ÷ Σ IT energy', source: src('13_energy', ['total_kwh', 'measured_pue']) },
    ref: { label: 'Renewable energy factor (REF)', unit: '', value: round(renewableKwh / totalKwh, 3), formula: 'Σ renewable_kwh ÷ Σ total_kwh', source: src('13_energy', ['renewable_kwh', 'total_kwh']) },
    erf: { label: 'Energy reuse factor (ERF)', unit: '', value: round(reusedKwh / totalKwh, 3), formula: 'Σ energy_reused_kwh ÷ Σ total_kwh', source: src('13_energy', ['energy_reused_kwh', 'total_kwh']) },
    waterWithdrawnKl: { label: 'Water withdrawn', unit: 'kL', value: round(litres / 1000), formula: 'Σ total_litres ÷ 1,000', source: src('14_water', ['total_litres']) },
    thirdPartyWaterKl: { label: 'Third-party (municipal) fresh water', unit: 'kL', value: round(fresh / 1000), formula: 'Σ freshwater_litres ÷ 1,000', source: src('14_water', ['freshwater_litres']) },
    treatedWaterKl: { label: 'Treated and recycled water', unit: 'kL', value: round(treated / 1000), formula: 'Σ treated_litres ÷ 1,000', source: src('14_water', ['treated_litres']) },
    stressedWaterKl: { label: 'Water withdrawn in areas of high water stress', unit: 'kL', value: round(stressed / 1000), formula: 'Σ total_litres where local_water_stress is High or Extremely high', source: src('14_water', ['total_litres', 'local_water_stress']) },
    wue: { label: 'Water usage effectiveness (WUE)', unit: 'L/kWh', value: round(litres / waterItKwh, 3), formula: 'Σ total_litres ÷ Σ IT energy', source: src('14_water', ['total_litres', 'measured_wue_l_per_kwh']) },
    scope2Tco2: { label: 'Scope 2 emissions (location-based)', unit: 'tCO₂e', value: round(tco2, 1), formula: 'Σ grid_kwh × grid_carbon_kg_per_kwh ÷ 1,000', source: src('13_energy', ['grid_kwh', 'grid_carbon_kg_per_kwh']) },
    carbonIntensity: { label: 'Emissions per MWh of IT energy', unit: 'tCO₂e/MWh', value: round(tco2 / (itKwh / 1000), 3), formula: 'Scope 2 ÷ IT energy (MWh)', source: src('13_energy', ['emissions_tco2', 'total_kwh', 'measured_pue']) },
    energyCostLakh: { label: 'Energy cost', unit: '₹ lakh', value: round(sum(energy, (e) => e.cost_inr_lakh), 1), formula: 'Σ cost_inr_lakh', source: src('13_energy', ['cost_inr_lakh']) },
  };
  for (const [k, f] of Object.entries(out)) {
    const level = FIGURE_CONFIDENCE[k] ?? 'measured';
    f.confidence = level;
    f.confidenceNote = CONFIDENCE[level];
  }
  return out;
}

const NOT_ON_FILE = (label, why) => ({ label, unit: '', value: null, formula: null, source: null, gap: why });

/**
 * Framework line items. `key` names a figure above; a `gap` marks a required
 * item the dataset does not hold — reported as such, never estimated.
 */
export const FRAMEWORKS = {
  BRSR: {
    id: 'BRSR',
    name: 'SEBI BRSR · Principle 6 (environment)',
    jurisdiction: 'National',
    lines: [
      { ref: 'EI-1', item: 'Total energy consumption', key: 'totalEnergyGj' },
      { ref: 'EI-1', item: 'of which renewable', key: 'renewableGj' },
      { ref: 'EI-1', item: 'of which non-renewable', key: 'gridGj' },
      { ref: 'EI-1', item: 'Energy intensity per rupee of turnover', gap: 'Turnover is not in the operating dataset; finance supplies it at filing.' },
      { ref: 'EI-3', item: 'Water withdrawal — third-party', key: 'thirdPartyWaterKl' },
      { ref: 'EI-3', item: 'Water withdrawal — total', key: 'waterWithdrawnKl' },
      { ref: 'EI-3', item: 'Water recycled and reused', key: 'treatedWaterKl' },
      { ref: 'EI-6', item: 'Scope 2 emissions', key: 'scope2Tco2' },
      { ref: 'EI-6', item: 'Scope 1 emissions (diesel generation)', gap: 'Generator fuel burn is not metered in the dataset.' },
      { ref: 'LI-1', item: 'Water withdrawn in areas of water stress', key: 'stressedWaterKl' },
    ],
  },
  EED: {
    id: 'EED',
    name: 'EU Energy Efficiency Directive · data centre indicators',
    jurisdiction: 'European Union (reference)',
    lines: [
      { ref: 'Annex VII', item: 'Total energy consumption', key: 'totalEnergyMwh' },
      { ref: 'Annex VII', item: 'IT equipment energy', key: 'itEnergyMwh' },
      { ref: 'Annex VII', item: 'Power usage effectiveness', key: 'pue' },
      { ref: 'Annex VII', item: 'Water usage effectiveness', key: 'wue' },
      { ref: 'Annex VII', item: 'Energy reuse factor', key: 'erf' },
      { ref: 'Annex VII', item: 'Renewable energy factor', key: 'ref' },
      { ref: 'Annex VII', item: 'Total water input', key: 'waterWithdrawnKl' },
    ],
  },
  GRESB: {
    id: 'GRESB',
    name: 'GRESB Real Estate · energy, GHG and water',
    jurisdiction: 'Voluntary',
    lines: [
      { ref: 'EN1', item: 'Energy consumption', key: 'totalEnergyMwh' },
      { ref: 'EN1', item: 'Renewable energy procured or generated', key: 'renewableMwh' },
      { ref: 'GH1', item: 'Scope 2 GHG emissions (location-based)', key: 'scope2Tco2' },
      { ref: 'GH1', item: 'Scope 1 GHG emissions', gap: 'Generator fuel burn is not metered in the dataset.' },
      { ref: 'WT1', item: 'Water withdrawal', key: 'waterWithdrawnKl' },
      { ref: 'WT1', item: 'Water recycled', key: 'treatedWaterKl' },
      { ref: 'WS1', item: 'Waste by disposal route', gap: 'Waste is not recorded in the operating dataset.' },
    ],
  },
  KA: {
    id: 'KA',
    name: 'Karnataka Sustainable Data Centre Policy 2026-31',
    jurisdiction: 'Karnataka',
    lines: [
      { ref: 'Plant-wise', item: 'Power usage effectiveness', key: 'pue' },
      { ref: 'Plant-wise', item: 'Water usage effectiveness', key: 'wue' },
      { ref: 'Incentive', item: 'Treated water used', key: 'treatedWaterKl' },
    ],
  },
};

/** Which facilities a framework binds, from 16_state_policy.applies_to. */
export function scopeOf(frameworkId) {
  const fw = FRAMEWORKS[frameworkId];
  const policy = nexus.statePolicy.find((p) => p.jurisdiction === fw.jurisdiction.replace(' (reference)', ''));
  const operating = nexus.facilities.filter((f) => f.status === 'Operational').map((f) => f.facility_id);
  if (!policy || policy.applies_to === 'All' || policy.applies_to === 'Reference') return { facilities: operating, policy };
  return { facilities: policy.applies_to.split(/[,;]/).map((s) => s.trim()), policy };
}

function lineItems(fw, figs) {
  return fw.lines.map((l) => (l.gap ? { ref: l.ref, item: l.item, ...NOT_ON_FILE(l.item, l.gap) } : { ref: l.ref, item: l.item, ...(figs ? figs[l.key] : NOT_ON_FILE(l.item, 'No metered data in the period')) }));
}

/**
 * @param {{ framework: 'BRSR'|'EED'|'KA', from?: string, to?: string, facilityIds?: string[] }} opts
 */
export function buildDisclosure({ framework, from = ENERGY_MONTHS[0], to = ENERGY_MONTHS.at(-1), facilityIds }) {
  const fw = FRAMEWORKS[framework];
  const scope = scopeOf(framework);
  const ids = facilityIds ?? scope.facilities;
  const metered = ids.filter((id) => (index.energyByFacility.get(id) ?? []).length);
  const pending = ids.filter((id) => !metered.includes(id));
  const total = metered.length ? figures(metered, from, to) : null;

  return {
    framework: fw,
    policy: scope.policy && { policy: scope.policy.policy, obligation: scope.policy.reporting_obligation, effectiveFrom: scope.policy.effective_from, appliesTo: scope.policy.applies_to },
    period: { from, to, months: ENERGY_MONTHS.filter((m) => m >= from && m <= to).length },
    facilities: ids.map((id) => ({ id, name: getFacility(id).name, metered: metered.includes(id), status: getFacility(id).status })),
    pending: pending.map((id) => ({ id, name: getFacility(id).name, reason: `${getFacility(id).status}; no metered energy or water in the period. Design PUE ${getFacility(id).pue}, design WUE ${getFacility(id).wue_l_per_kwh}.` })),
    lines: lineItems(fw, total),
    readinessScore: (() => {
      const ls = lineItems(fw, total);
      return Math.round((ls.filter((l) => l.value !== null).length / ls.length) * 100);
    })(),
    byFacility: metered.map((id) => ({ id, name: getFacility(id).name, figures: figures([id], from, to) })),
    gaps: fw.lines.filter((l) => l.gap).map((l) => ({ item: l.item, why: l.gap })),
    totals: total,
  };
}

/** Rows for the monthly ledger appendix (and the workbook export). */
export function ledgerRows({ from = ENERGY_MONTHS[0], to = ENERGY_MONTHS.at(-1), facilityIds }) {
  const { energy, water } = ledger(facilityIds, from, to);
  return energy.map((e) => {
    const w = water.find((x) => x.facility_id === e.facility_id && x.month === e.month);
    return {
      facility_id: e.facility_id, month: e.month,
      total_kwh: e.total_kwh, it_kwh: Math.round(e.total_kwh / e.measured_pue), renewable_kwh: e.renewable_kwh, grid_kwh: e.grid_kwh,
      energy_reused_kwh: e.energy_reused_kwh, measured_pue: e.measured_pue, emissions_tco2: e.emissions_tco2,
      total_litres: w?.total_litres ?? null, freshwater_litres: w?.freshwater_litres ?? null, treated_litres: w?.treated_litres ?? null,
      measured_wue_l_per_kwh: w?.measured_wue_l_per_kwh ?? null, local_water_stress: w?.local_water_stress ?? null,
    };
  });
}
