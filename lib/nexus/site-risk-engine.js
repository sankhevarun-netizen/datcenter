// lib/nexus/site-risk-engine.js
//
// Site risk per facility from 15_grid, 24_site_risk, 14_water and
// 25_supply_chain. Every sub-score is 0 (benign) to 100 (severe) and every
// formula is stated here, so a score can always be traced to its cells.
//
//   grid      70% load pressure + 30% feed reliability.
//             Load pressure: 0 at 30% of sanctioned load drawn, 100 at 100%, so a
//             site with headroom still carries some grid exposure.
//             Reliability: 10 per feed trip in 12 months + half the mean trip minutes.
//             A site still in the interconnection queue scores 2.5 per queue place.
//   hazard    BIS seismic zone (II→2 … V→5), flood, cyclone, heat (each 1–5):
//             20 × (60% worst + 40% mean).
//   water     the basin stress index (0–100) from 14_water.
//
//   composite 60% of the weighted mean (grid 40%, hazard 35%, water 25%;
//             re-weighted over parts that exist) + 40% of the worst part, so
//             one severe exposure is never averaged away.
import { nexus, index, getFacility } from './data.js';

export const WEIGHTS = Object.freeze({ grid: 0.4, hazard: 0.35, water: 0.25 });
export const BLEND = Object.freeze({ mean: 0.6, worst: 0.4 });
export const BANDS = Object.freeze([
  { band: 'critical', from: 80 },
  { band: 'high', from: 65 },
  { band: 'elevated', from: 45 },
  { band: 'low', from: 0 },
]);
const SEISMIC = { II: 2, III: 3, IV: 4, V: 5 };

const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;
const clamp = (v) => Math.max(0, Math.min(100, v));
const EQUIPMENT = { ups: 'UPS', rpp: 'RPP', pdu: 'PDU', crah: 'CRAH', chw_loop: 'Chilled-water loop', cooling_tower: 'Cooling tower' };
export const equipmentLabel = (type) => EQUIPMENT[type] ?? type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
export const bandFor = (score) => BANDS.find((b) => score >= b.from).band;

function gridScore(facilityId) {
  const g = index.gridByFacility.get(facilityId);
  const s = index.siteRiskByFacility.get(facilityId);
  const utilisedPct = round((g.current_draw_kw / g.sanctioned_load_kw) * 100, 1);
  if (g.connection_status !== 'Connected') {
    const score = clamp(g.queue_position * 2.5);
    return {
      score: round(score, 1),
      utilisedPct: null,
      parts: { queue: round(score, 1) },
      evidence: `In the interconnection queue at position ${g.queue_position}. ${g.note}`,
    };
  }
  const load = clamp(((utilisedPct - 30) / 70) * 100);
  const reliability = clamp((s.grid_trips_12m ?? 0) * 10 + (s.avg_trip_min ?? 0) / 2);
  return {
    score: round(0.7 * load + 0.3 * reliability, 1),
    utilisedPct,
    parts: { load: round(load, 1), reliability: round(reliability, 1) },
    evidence: `${utilisedPct}% of ${g.sanctioned_load_kw.toLocaleString('en-IN')} kW sanctioned load drawn (${g.utility}); ${s.grid_trips_12m} feed trips in 12 months averaging ${s.avg_trip_min} min. ${g.note}`,
  };
}

function hazardScore(facilityId) {
  const s = index.siteRiskByFacility.get(facilityId);
  const levels = { seismic: SEISMIC[s.seismic_zone], flood: s.flood_exposure, cyclone: s.cyclone_exposure, heat: s.heat_exposure };
  const vals = Object.values(levels);
  const worst = Math.max(...vals);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const [worstKey] = Object.entries(levels).find(([, v]) => v === worst);
  return {
    score: round(20 * (0.6 * worst + 0.4 * mean), 1),
    levels,
    seismicZone: s.seismic_zone,
    worst: worstKey,
    evidence: s.reference_event,
  };
}

function waterScore(facilityId) {
  const w = (index.waterByFacility.get(facilityId) ?? []).at(-1);
  if (!w) return null;
  return { score: w.stress_index, label: w.local_water_stress, evidence: `${w.local_water_stress} basin stress, ${w.source.toLowerCase()}` };
}

export function siteRisk(facilityId) {
  const f = getFacility(facilityId);
  const parts = { grid: gridScore(facilityId), hazard: hazardScore(facilityId), water: waterScore(facilityId) };
  const present = Object.entries(parts).filter(([, v]) => v);
  const weight = present.reduce((s, [k]) => s + WEIGHTS[k], 0);
  const mean = present.reduce((s, [k, v]) => s + WEIGHTS[k] * v.score, 0) / weight;
  const [worstPart, worstVal] = present.reduce((a, [k, v]) => (v.score > a[1] ? [k, v.score] : a), ['', -1]);
  const composite = round(BLEND.mean * mean + BLEND.worst * worstVal, 1);
  return {
    id: facilityId,
    name: f.name,
    city: f.city,
    status: f.status,
    ...parts,
    composite,
    band: bandFor(composite),
    driver: worstPart,
  };
}

export function portfolioSiteRisk() {
  const sites = nexus.facilities.map((f) => siteRisk(f.facility_id)).sort((a, b) => b.composite - a.composite);
  const grid = nexus.grid.map((g) => ({
    id: g.facility_id,
    name: getFacility(g.facility_id).name,
    utility: g.utility,
    voltageKv: g.voltage_kv,
    sanctionedKw: g.sanctioned_load_kw,
    drawKw: g.current_draw_kw,
    headroomKw: g.headroom_kw,
    utilisedPct: round((g.current_draw_kw / g.sanctioned_load_kw) * 100, 1),
    feeds: g.feed_count,
    status: g.connection_status,
    queuePosition: g.queue_position,
    note: g.note,
    energisation: /energisation\s+([^.]+)/i.exec(g.note)?.[1] ?? null,
  }));
  const supply = [...nexus.supplyChain]
    .map((s) => ({
      type: s.component_type,
      vendor: s.vendor,
      origin: s.origin_country,
      singleSource: s.single_source === 'yes',
      leadWeeks: s.lead_time_weeks,
      sparesOnSite: s.spares_on_site,
      note: s.disruption_note,
      imported: s.origin_country !== 'India',
      // Exposure: long lead, one supplier, nothing on the shelf.
      exposure: round(clamp((s.lead_time_weeks / 34) * 60 + (s.single_source === 'yes' ? 30 : 0) + (s.spares_on_site === 0 ? 10 : 0)), 0),
    }))
    .sort((a, b) => b.exposure - a.exposure);
  return {
    sites,
    grid,
    supply,
    totals: {
      gridConstrained: grid.filter((g) => g.status === 'Connected' && g.utilisedPct >= 90).map((g) => g.id),
      queued: grid.filter((g) => g.status !== 'Connected').map((g) => ({ id: g.id, position: g.queuePosition, energisation: g.energisation })),
      singleSourceImported: supply.filter((s) => s.singleSource && s.imported).map((s) => s.type),
      highestRisk: sites[0],
    },
  };
}
