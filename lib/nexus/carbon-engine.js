// lib/nexus/carbon-engine.js — Scope 2 from 13_energy, and the embodied
// carbon already spent on capacity that sits stranded.
//
// Scope 2 (location-based): grid kWh × the national grid factor recorded in
// 13_energy (0.71 kg/kWh). Embodied carbon: published facility-infrastructure
// intensity applied to the structurally stranded kW from 03_rows.
import { index } from './data.js';

const round = (v, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/**
 * Facility (building, electrical, mechanical) embodied carbon at construction,
 * excluding IT equipment: ~1,829 tCO2e per MW. Wadenstein & Vanderbauwhede,
 * Life Cycle Analysis for Emissions of Scientific Computing Centres (2025),
 * drawing on Lin et al. (2023).
 */
export const EMBODIED = Object.freeze({
  tco2PerKw: 1.829,
  source: 'Wadenstein & Vanderbauwhede, Life Cycle Analysis for Emissions of Scientific Computing Centres (2025), after Lin et al. (2023): ~1,829 tCO2e per MW of facility infrastructure at construction, excluding IT equipment.',
});

/** Monthly Scope 2 and the total over the recorded period. */
export function scope2Emissions(facilityId) {
  const ms = index.energyByFacility.get(facilityId) ?? [];
  if (!ms.length) return null;
  const monthly = ms.map((m) => ({
    month: m.month,
    gridKwh: m.grid_kwh,
    renewableKwh: m.renewable_kwh,
    gridTco2: round((m.grid_kwh * m.grid_carbon_kg_per_kwh) / 1000),
    avoidedTco2: round((m.renewable_kwh * m.grid_carbon_kg_per_kwh) / 1000),
    recordedTco2: m.emissions_tco2,
  }));
  const factor = ms.at(-1).grid_carbon_kg_per_kwh;
  const gridTco2 = round(sum(monthly.map((m) => m.gridTco2)));
  const avoided = round(sum(monthly.map((m) => m.avoidedTco2)));
  return {
    facilityId,
    period: `${ms[0].month} to ${ms.at(-1).month}`,
    months: ms.length,
    emissionFactorKgPerKwh: factor,
    gridEmissionsTco2: gridTco2,
    renewableEmissionsAvoidedTco2: avoided,
    netTco2: gridTco2,
    annualisedNetTco2: Math.round((gridTco2 * 12) / ms.length),
    // Annual facility load on the same basis, so scenarios compare like for like.
    annualisedLoadMwh: Math.round((sum(ms.map((m) => m.total_kwh)) * 12) / ms.length / 1000),
    monthly,
    methodology: `Location-based Scope 2: grid kWh × ${factor} kg CO2/kWh (Indian national grid average, as recorded in 13_energy). Renewable kWh is shown as avoided, not netted.`,
  };
}

/** Tonnes avoided per year by clean MWh used in the hour it is generated. */
export const tco2ForMwh = (mwh, factorKgPerKwh) => Math.round((mwh * 1000 * factorKgPerKwh) / 1000);

/** Embodied carbon already spent on capacity that stays stranded, from 03_rows. */
export function embodiedCarbonOfStranded(facilityId) {
  const rows = (index.rowsByFacility.get(facilityId) ?? []).filter((r) => r.stranded_classification === 'structural' && r.stranded_kw > 0);
  const strandedKw = sum(rows.map((r) => r.stranded_kw));
  const t = Math.round(strandedKw * EMBODIED.tco2PerKw);
  return {
    facilityId,
    strandedKw,
    rows: rows.map((r) => ({ rowId: r.row_id, kw: r.stranded_kw, binding: r.binding_constraint })),
    intensityTco2PerKw: EMBODIED.tco2PerKw,
    estimatedEmbodiedTco2: t,
    // Recovering the capacity avoids building the same kW again.
    equivalentNewBuildAvoidedTco2: t,
    source: EMBODIED.source,
  };
}

/**
 * Annual location-based Scope 2 if a given share of load were matched hour by
 * hour with clean power: load × (1 − share) × grid factor. The annual load is
 * the CFE sample's, which reconciles with 13_energy.
 */
export function scope2Scenario({ loadMwhPerYear, cleanSharePct, factorKgPerKwh }) {
  const gridMwh = loadMwhPerYear * (1 - cleanSharePct / 100);
  return { gridMwhPerYear: Math.round(gridMwh), tco2PerYear: Math.round(gridMwh * factorKgPerKwh) };
}
