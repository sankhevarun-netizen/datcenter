// lib/nexus/cfe-engine.js — hourly carbon-free energy (CFE) matching.
//
// Annual (volumetric) renewable reporting adds up a year of clean generation
// against a year of load; it hides the hours when the two do not coincide.
// Hourly matching counts only the clean power used in the hour it was
// generated: min(solar, load) each hour. The gap between the two is the
// argument for 24/7 CFE, told in the operator's own numbers.
//
// Inputs: 27_hourly_generation (the proposed PPA against MUM-1's real load),
// 28_clean_energy_assets (the PPA and battery options) and 13_energy (today's
// certificate-based renewable share, the grid tariff). Nothing here is
// estimated by a model; every figure is computed from those rows.
import { index } from './data.js';

const round = (v, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const HOURS_PER_YEAR = 8760;
/** The overnight band: 19:00 to 06:00. */
export const isOvernight = (h) => h >= 19 || h < 6;

export const hourlyRows = (facilityId) => index.hourlyByFacility.get(facilityId) ?? [];
export const hasCfeData = (facilityId) => hourlyRows(facilityId).length > 0;
export const cleanAssets = (facilityId) => index.cleanAssetsByFacility.get(facilityId) ?? [];
export const ppaOf = (facilityId) => cleanAssets(facilityId).find((a) => a.asset_type === 'solar_ppa') ?? null;
export const batteriesOf = (facilityId) => cleanAssets(facilityId).filter((a) => a.asset_type === 'bess');

/** Today's reported renewable share and grid tariff, from 13_energy. */
export function currentPosition(facilityId) {
  const months = index.energyByFacility.get(facilityId) ?? [];
  const total = sum(months.map((m) => m.total_kwh));
  const renewable = sum(months.map((m) => m.renewable_kwh));
  const latest = months.at(-1);
  return {
    reportedRenewablePct: total ? round((renewable / total) * 100) : 0,
    gridTariffInrKwh: latest?.tariff_inr_kwh ?? null,
    gridCarbonKgPerKwh: latest?.grid_carbon_kg_per_kwh ?? null,
    period: months.length ? `${months[0].month} to ${latest.month}` : null,
    from: months[0]?.month ?? null,
    to: latest?.month ?? null,
    // Certificates carry no generation hour, so none of today's share can be shown hour by hour.
    hourlyVerifiedPct: 0,
  };
}

// Average per hour of day across the sample.
function profileOf(rows, extra = () => 0) {
  return Array.from({ length: 24 }, (_, hour) => {
    const hs = rows.filter((r) => r.hour_of_day === hour);
    const n = hs.length || 1;
    const load = sum(hs.map((r) => r.load_kw)) / n;
    const solar = sum(hs.map((r) => r.solar_generation_kw)) / n;
    const matched = sum(hs.map((r) => Math.min(r.solar_generation_kw, r.load_kw))) / n;
    const fromStorage = sum(hs.map(extra)) / n;
    return {
      hour, loadKw: Math.round(load), solarKw: Math.round(solar), matchedKw: Math.round(matched),
      storageKw: Math.round(fromStorage), gapKw: Math.round(load - matched - fromStorage),
      matchingPct: round(((matched + fromStorage) / load) * 100),
    };
  });
}

// The contiguous band (wrapping midnight) of hours matching below 10%.
function worstBand(profile) {
  const low = profile.map((p) => p.matchingPct < 10);
  if (!low.some(Boolean)) return null;
  let start = low.findIndex((v, h) => v && !low[(h + 23) % 24]);
  if (start < 0) start = 0;
  let end = start;
  while (low[(end + 1) % 24] && (end + 1) % 24 !== start) end = (end + 1) % 24;
  const hours = [];
  for (let h = start; ; h = (h + 1) % 24) { hours.push(h); if (h === end) break; }
  const band = profile.filter((p) => hours.includes(p.hour));
  return {
    startHour: start, endHour: (end + 1) % 24, hours: hours.length,
    avgMatchingPct: round(sum(band.map((p) => p.matchingPct)) / band.length),
  };
}

// Clean-power hours of the 24: the matched share of a day's load, in hours.
const cleanHours = (pct) => round((pct / 100) * 24);

/** The PPA scenario measured hour by hour against the same load, compared with annual reporting. */
export function matchingScore(facilityId, { rows = hourlyRows(facilityId) } = {}) {
  if (!rows.length) return null;
  const load = sum(rows.map((r) => r.load_kw));
  const solar = sum(rows.map((r) => r.solar_generation_kw));
  const matched = sum(rows.map((r) => Math.min(r.solar_generation_kw, r.load_kw)));
  const night = rows.filter((r) => isOvernight(r.hour_of_day));
  const nightMatched = sum(night.map((r) => Math.min(r.solar_generation_kw, r.load_kw)));
  const nightLoad = sum(night.map((r) => r.load_kw));
  const days = [...new Set(rows.map((r) => r.date))];
  const scale = HOURS_PER_YEAR / rows.length;
  const profile = profileOf(rows);
  const annualRecPct = round((solar / load) * 100);
  const hourlyMatchedPct = round((matched / load) * 100);
  return {
    facilityId,
    sample: { days: days.length, hours: rows.length, from: days[0], to: days.at(-1) },
    ppaKw: rows[0].ppa_capacity_kw,
    matchedPct: hourlyMatchedPct,
    unmatchedPct: round(100 - hourlyMatchedPct),
    overnightPct: round((nightMatched / nightLoad) * 100),
    cleanHours: cleanHours(hourlyMatchedPct),
    gridFallbackMwhPerYear: Math.round(((load - matched) * scale) / 1000),
    matchedMwhPerYear: Math.round((matched * scale) / 1000),
    loadMwhPerYear: Math.round((load * scale) / 1000),
    surplusMwhPerYear: Math.round((sum(rows.map((r) => Math.max(0, r.solar_generation_kw - r.load_kw))) * scale) / 1000),
    hourlyProfile: profile,
    worstHourBand: worstBand(profile),
    comparedToAnnualRec: { annualRecPct, hourlyMatchedPct, gap: round(annualRecPct - hourlyMatchedPct) },
  };
}

/**
 * Dispatch a battery against the PPA, day by day: charge from midday surplus
 * (within power and energy limits, half the round-trip loss on the way in),
 * then discharge into the deficit from 18:00 through the night into the next
 * morning (the other half of the loss on the way out). Deterministic.
 */
export function simulateStorage(rows, { capacityKwh, powerKw, roundTripPct = 88 }) {
  const leg = Math.sqrt(roundTripPct / 100);
  const byDay = new Map();
  for (const r of rows) {
    if (!byDay.has(r.date)) byDay.set(r.date, []);
    byDay.get(r.date).push(r);
  }
  const dates = [...byDay.keys()];
  const delivered = new Map(); // row key -> kW from storage
  const key = (r) => `${r.date} ${r.hour_of_day}`;
  dates.forEach((date, i) => {
    const day = byDay.get(date);
    const next = byDay.get(dates[i + 1]) ?? [];
    let soc = 0;
    for (const r of day) {
      const surplus = r.solar_generation_kw - r.load_kw;
      if (surplus > 0) soc = Math.min(capacityKwh, soc + Math.min(surplus, powerKw) * leg);
    }
    for (const r of [...day.filter((x) => x.hour_of_day >= 18), ...next.filter((x) => x.hour_of_day < 7)]) {
      const deficit = r.load_kw - Math.min(r.solar_generation_kw, r.load_kw) - (delivered.get(key(r)) ?? 0);
      const out = Math.max(0, Math.min(deficit, powerKw, soc * leg));
      soc -= out / leg;
      delivered.set(key(r), (delivered.get(key(r)) ?? 0) + out);
    }
  });
  return (r) => delivered.get(key(r)) ?? 0;
}

/** The PPA plus a battery: an asset from 28_clean_energy_assets, or a size from the slider. */
export function matchingWithStorage(facilityId, storage) {
  const rows = hourlyRows(facilityId);
  if (!rows.length) return null;
  const asset = typeof storage === 'string' ? batteriesOf(facilityId).find((b) => b.asset_id === storage) : null;
  const reference = batteriesOf(facilityId).find((b) => b.capacity_kwh > 0 && b.cost_inr_lakh > 0 && b.asset_id.endsWith('-A')) ?? batteriesOf(facilityId)[0];
  const spec = asset
    ? { capacityKwh: asset.capacity_kwh, powerKw: asset.power_kw, roundTripPct: asset.round_trip_efficiency_pct, costInrLakh: asset.cost_inr_lakh, assetId: asset.asset_id, leadTimeWeeks: asset.lead_time_weeks }
    : {
      capacityKwh: storage.capacityKwh,
      powerKw: storage.powerKw ?? storage.capacityKwh / 4,
      roundTripPct: storage.roundTripPct ?? reference?.round_trip_efficiency_pct ?? 88,
      // Cost scales with the reference battery's ₹ per kWh.
      costInrLakh: reference ? round((reference.cost_inr_lakh / reference.capacity_kwh) * storage.capacityKwh, 0) : null,
      assetId: null,
      leadTimeWeeks: reference?.lead_time_weeks ?? null,
    };
  const before = matchingScore(facilityId, { rows });
  const fromStorage = spec.capacityKwh > 0 ? simulateStorage(rows, spec) : () => 0;
  const load = sum(rows.map((r) => r.load_kw));
  const added = sum(rows.map(fromStorage));
  const night = rows.filter((r) => isOvernight(r.hour_of_day));
  const nightLoad = sum(night.map((r) => r.load_kw));
  const nightClean = sum(night.map((r) => Math.min(r.solar_generation_kw, r.load_kw) + fromStorage(r)));
  const profile = profileOf(rows, fromStorage);
  const scale = HOURS_PER_YEAR / rows.length;
  const addedMwhPerYear = (added * scale) / 1000;
  // Stored solar replaces grid power at the grid tariff, and costs the PPA tariff grossed up for losses.
  const { gridTariffInrKwh } = currentPosition(facilityId);
  const ppa = ppaOf(facilityId);
  const savingPerKwh = gridTariffInrKwh != null && ppa ? gridTariffInrKwh - ppa.tariff_inr_kwh / (spec.roundTripPct / 100) : null;
  const annualSavingLakh = savingPerKwh != null ? (addedMwhPerYear * 1000 * savingPerKwh) / 1e5 : null;
  return {
    facilityId,
    storage: spec,
    matchedPctBefore: before.matchedPct,
    matchedPctAfter: round(((before.matchedPct / 100) * load + added) / load * 100),
    overnightPctBefore: before.overnightPct,
    overnightPctAfter: round((nightClean / nightLoad) * 100),
    cleanHoursBefore: before.cleanHours,
    cleanHoursAfter: cleanHours(((before.matchedPct / 100) * load + added) / load * 100),
    additionalMatchedMwhPerYear: Math.round(addedMwhPerYear),
    capexInrLakh: spec.costInrLakh,
    savingInrPerKwh: savingPerKwh != null ? round(savingPerKwh, 2) : null,
    annualSavingInrLakh: annualSavingLakh != null ? round(annualSavingLakh, 0) : null,
    paybackYears: annualSavingLakh > 0 && spec.costInrLakh ? round(spec.costInrLakh / annualSavingLakh) : null,
    hourlyProfile: profile,
  };
}

/** The storm day against the rest of the sample. */
export function cloudyDayStressTest(facilityId) {
  const rows = hourlyRows(facilityId);
  if (!rows.length) return null;
  const solarByDay = new Map();
  for (const r of rows) solarByDay.set(r.date, (solarByDay.get(r.date) ?? 0) + r.solar_generation_kw);
  const worstDate = [...solarByDay.entries()].sort((a, b) => a[1] - b[1])[0][0];
  const pct = (rs) => round((sum(rs.map((r) => Math.min(r.solar_generation_kw, r.load_kw))) / sum(rs.map((r) => r.load_kw))) * 100);
  const midday = (rs) => rs.filter((r) => r.hour_of_day >= 11 && r.hour_of_day <= 14);
  const normal = rows.filter((r) => r.date !== worstDate);
  const cloudy = rows.filter((r) => r.date === worstDate);
  const fallback = (rs) => sum(rs.map((r) => r.load_kw - Math.min(r.solar_generation_kw, r.load_kw))) / [...new Set(rs.map((r) => r.date))].length;
  return {
    date: worstDate,
    sky: cloudy[0].sky,
    normalMatchingPct: pct(normal),
    cloudyDayMatchingPct: pct(cloudy),
    normalMiddayPct: pct(midday(normal)),
    cloudyMiddayPct: pct(midday(cloudy)),
    gridFallbackIncreaseMwh: Math.round((fallback(cloudy) - fallback(normal)) / 1000),
    solarDropPct: round((1 - solarByDay.get(worstDate) / (sum(normal.map((r) => r.solar_generation_kw)) / (normal.length / 24))) * 100),
  };
}
