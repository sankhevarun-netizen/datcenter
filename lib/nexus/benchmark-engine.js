// lib/nexus/benchmark-engine.js
//
// Where each facility sits against Indian peers (21_benchmarks). Peer
// percentiles are published at p10/p25/p50/p75/p90; a facility's position is
// interpolated linearly between those points and is never extrapolated past
// them — outside the band it is reported as "below p10" / "above p90".
//
// `score` is always "share of peers this facility does better than", so a
// higher score is better whichever way the metric runs.
import { index, getFacility, rowsOf } from './data.js';
import { findStrandedCapacity } from './capacity-engine.js';
import { AS_OF, daysBetween } from './time.js';

const POINTS = [10, 25, 50, 75, 90];
const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;

/** The metrics scored, in display order. `key` is stable; `metric` is the 21_benchmarks name. */
export const BENCHMARK_METRICS = [
  { key: 'pue', metric: 'PUE', label: 'PUE', unit: '', dp: 3, tiered: true },
  { key: 'wue', metric: 'WUE (L/kWh)', label: 'WUE', unit: 'L/kWh', dp: 2, tiered: true },
  { key: 'renewable', metric: 'Renewable share (%)', label: 'Renewable share', unit: '%', dp: 0 },
  { key: 'mttr', metric: 'MTTR (minutes)', label: 'MTTR', unit: 'min', dp: 0 },
  { key: 'utilisation', metric: 'Utilisation (%)', label: 'Utilisation', unit: '%', dp: 1 },
  { key: 'stranded', metric: 'Stranded capacity (%)', label: 'Stranded capacity', unit: '%', dp: 1 },
  { key: 'density', metric: 'Rack density (kW)', label: 'Average rack density', unit: 'kW', dp: 1 },
];

export function cohortFor(metric, tier) {
  const rows = [...index.benchmarkByMetric.get(metric) ?? []];
  return rows.find((r) => r.cohort === `India ${tier}`) ?? rows.find((r) => r.cohort === 'India all tiers') ?? rows[0];
}

/**
 * Raw position of `value` in the peer distribution (higher value → higher
 * position), interpolated between published percentiles.
 * @returns {{ position: number, outside: null|'below'|'above' }}
 */
export function percentileOf(value, band) {
  const vals = [band.p10, band.p25, band.p50_median, band.p75, band.p90];
  if (value < vals[0]) return { position: 10, outside: 'below' };
  if (value > vals[4]) return { position: 90, outside: 'above' };
  for (let i = 0; i < 4; i += 1) {
    if (value <= vals[i + 1]) {
      const span = vals[i + 1] - vals[i];
      const t = span === 0 ? 0 : (value - vals[i]) / span;
      return { position: POINTS[i] + t * (POINTS[i + 1] - POINTS[i]), outside: null };
    }
  }
  return { position: 90, outside: null };
}

/** Share of peers this facility beats (0–100), plus a plain-language rank. */
export function scoreAgainst(value, band) {
  const { position, outside } = percentileOf(value, band);
  const lowerIsBetter = /lower is better/i.test(band.direction);
  const contextOnly = /context only/i.test(band.direction);
  if (contextOnly) return { position: round(position), outside, score: null, rank: null };
  // Rank from the score as displayed, so the label never disagrees with the number.
  const score = round(lowerIsBetter ? 100 - position : position);
  const better = lowerIsBetter ? outside === 'below' : outside === 'above';
  const worse = lowerIsBetter ? outside === 'above' : outside === 'below';
  return {
    position: round(position),
    outside,
    score,
    rank: better ? 'top decile' : worse ? 'bottom decile'
      : score >= 75 ? 'top quartile' : score > 50 ? 'above median' : score === 50 ? 'at median' : score >= 25 ? 'below median' : 'bottom quartile',
  };
}

// ── facility values ─────────────────────────────────────────────────────────

/** Trailing-12-month PUE and WUE, energy-weighted from 22_timeseries. */
function trailing(facilityId) {
  const months = (index.timeseriesByFacility.get(facilityId) ?? []).slice(-12);
  if (!months.length) return null;
  const it = months.reduce((s, t) => s + t.it_load_kw, 0);
  return {
    pue: round(months.reduce((s, t) => s + t.facility_load_kw, 0) / it, 3),
    wue: round(months.reduce((s, t) => s + t.it_load_kw * t.wue_l_per_kwh, 0) / it, 3),
    from: months[0].month,
    to: months.at(-1).month,
  };
}

function mttr(facilityId) {
  const recent = (index.incidentsByFacility.get(facilityId) ?? [])
    .filter((i) => daysBetween(i.detected_at.slice(0, 10), AS_OF.slice(0, 10)) <= 365);
  if (!recent.length) return null;
  return { minutes: round(recent.reduce((s, i) => s + i.duration_min, 0) / recent.length), incidents: recent.length };
}

/** The value for each metric, with where it came from. Null value = not measurable from the dataset. */
export function facilityValues(facilityId) {
  const f = getFacility(facilityId);
  const operational = f.status === 'Operational';
  const ttm = operational ? trailing(facilityId) : null;
  const repair = operational ? mttr(facilityId) : null;
  const hasRows = rowsOf(facilityId).length > 0;
  const stranded = hasRows ? findStrandedCapacity(facilityId) : null;
  const unavailable = (why) => ({ value: null, basis: why });

  return {
    // Peer percentiles come from published annual disclosures, so the facility
    // is scored on its reported annual figure (like for like). The measured
    // trailing-12-month figure travels alongside as context.
    pue: ttm
      ? { value: f.pue, basis: 'Reported annual PUE', measured: { value: ttm.pue, basis: `Measured, trailing 12 months ${ttm.from} to ${ttm.to}` } }
      : { value: f.pue, basis: 'Design target' },
    wue: ttm
      ? { value: f.wue_l_per_kwh, basis: 'Reported annual WUE', measured: { value: ttm.wue, basis: `Measured, trailing 12 months ${ttm.from} to ${ttm.to}` } }
      : { value: f.wue_l_per_kwh, basis: 'Design target' },
    renewable: { value: f.renewable_pct, basis: operational ? 'Contracted PPA and on-site generation' : 'Contracted for energisation' },
    mttr: !operational
      ? unavailable('Not yet operating')
      : repair
        ? { value: repair.minutes, basis: `Mean of ${repair.incidents} ${repair.incidents === 1 ? 'incident' : 'incidents'} in the last 12 months` }
        : unavailable('No incidents in the last 12 months'),
    utilisation: operational ? { value: f.utilisation_pct, basis: 'Used IT load over design IT load' } : unavailable('Not yet operating'),
    stranded: stranded
      ? { value: round((stranded.structuralKw / f.design_it_kw) * 100, 1), basis: 'Structural stranded power over design IT load' }
      : unavailable(operational ? 'Row-level survey not on file' : 'Not yet operating'),
    density: operational ? { value: round(f.used_it_kw / f.racks, 1), basis: 'Used IT load over installed racks' } : unavailable('Not yet operating'),
  };
}

/** Every metric for one facility, scored against its cohort. */
export function benchmarkFacility(facilityId) {
  const f = getFacility(facilityId);
  const values = facilityValues(facilityId);
  return BENCHMARK_METRICS.map((m) => {
    const band = cohortFor(m.metric, f.tier);
    const { value, basis, measured = null } = values[m.key];
    return {
      ...m,
      cohort: band.cohort,
      direction: band.direction,
      band: { p10: band.p10, p25: band.p25, p50: band.p50_median, p75: band.p75, p90: band.p90 },
      value,
      basis,
      measured,
      cohortBasis: band.basis,
      ...(value === null ? { position: null, outside: null, score: null, rank: null } : scoreAgainst(value, band)),
    };
  });
}

/**
 * Every facility against every metric, plus a portfolio row: reported PUE and
 * WUE weighted by used IT load, renewable share weighted by design capacity,
 * utilisation as used over design across operating sites. The portfolio row is
 * scored against the Tier III cohort, where most of the estate sits.
 */
export function portfolioScorecard(facilityIds = null) {
  const ids = facilityIds ?? [...index.facilityById.keys()];
  const rows = ids.map((id) => ({ facilityId: id, name: getFacility(id).name, metrics: benchmarkFacility(id) }));
  const live = ids.map(getFacility).filter((f) => f.status === 'Operational');
  const used = live.reduce((s, f) => s + f.used_it_kw, 0);
  const design = live.reduce((s, f) => s + f.design_it_kw, 0);
  const weighted = (field, weight) => live.reduce((s, f) => s + f[field] * f[weight], 0) / live.reduce((s, f) => s + f[weight], 0);
  const values = {
    pue: round(weighted('pue', 'used_it_kw'), 3),
    wue: round(weighted('wue_l_per_kwh', 'used_it_kw'), 2),
    renewable: round(weighted('renewable_pct', 'design_it_kw'), 1),
    utilisation: round((used / design) * 100, 1),
  };
  const portfolio = BENCHMARK_METRICS.filter((m) => values[m.key] !== undefined).map((m) => {
    const band = cohortFor(m.metric, 'Tier III');
    return { ...m, cohort: band.cohort, value: values[m.key], basis: 'Portfolio, operating sites', ...scoreAgainst(values[m.key], band) };
  });
  return { rows, portfolio };
}
