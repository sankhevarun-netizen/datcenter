// lib/nexus/twin-overlay.js — per-rack values the twin paints as a heatmap.
//
// One mechanism for every overlay: a value per rack, a domain and a colour
// ramp. The twin diffuses the values across the floor and tints each rack, so
// thermal, power and any later overlay look and behave the same. Pure: the
// values come from the dataset through the engines, never invented.
import { racksOf } from './data.js';
import { thermalMap, ASHRAE } from './thermal-model.js';

// Cold → hot. Reads correctly to a facilities engineer: blue is cool, green
// nominal, yellow warm, red at the limit.
export const HEAT_RAMP = Object.freeze([
  [0.0, '#0A1B3A'],
  [0.25, '#1E6FD9'],
  [0.45, '#22C9D6'],
  [0.62, '#3FD67A'],
  [0.78, '#F2D53C'],
  [0.9, '#F2873C'],
  [1.0, '#E63946'],
]);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** [r, g, b] (0–255) at t ∈ [0, 1] along the ramp. */
export function rampRgb(t, ramp = HEAT_RAMP) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < ramp.length; i++) {
    const [t1, c1] = ramp[i];
    if (x <= t1) {
      const [t0, c0] = ramp[i - 1];
      const k = (x - t0) / (t1 - t0 || 1);
      const a = hex(c0), b = hex(c1);
      return a.map((v, j) => Math.round(v + (b[j] - v) * k));
    }
  }
  return hex(ramp.at(-1)[1]);
}
export const rampHex = (t, ramp) => `#${rampRgb(t, ramp).map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** Estimated rack inlet temperature (°C), on the ASHRAE scale. */
export function thermalOverlay(facilityId, { failedCrah = null } = {}) {
  const map = thermalMap(facilityId, { failedCrah });
  const values = {};
  for (const row of map.rows) for (const r of row.racks) values[r.rackId] = r.inletC;
  const all = Object.values(values);
  return {
    kind: 'thermal',
    key: `thermal:${facilityId}:${failedCrah ?? 'none'}`,
    title: 'Estimated rack inlet temperature',
    unit: '°C',
    min: 18,
    max: ASHRAE.allowableMaxC,
    marks: [{ value: ASHRAE.recommendedMaxC, label: 'ASHRAE recommended' }, { value: ASHRAE.allowableMaxC, label: 'Allowable' }],
    values,
    observed: { min: Math.min(...all), max: Math.max(...all) },
    failure: map.failure,
  };
}

/** Rack power draw as a share of the rack's rated capacity (%). */
export function powerOverlay(facilityId) {
  const values = {};
  for (const r of racksOf(facilityId)) values[r.rack_id] = r.capacity_kw ? Math.round((r.used_kw / r.capacity_kw) * 1000) / 10 : 0;
  const all = Object.values(values);
  return {
    kind: 'power',
    key: `power:${facilityId}`,
    title: 'Rack power draw, share of rated capacity',
    unit: '%',
    min: 0,
    max: 100,
    marks: [{ value: 80, label: 'Planning limit' }],
    values,
    observed: { min: Math.min(...all), max: Math.max(...all) },
  };
}

/** Position on the ramp for one value. */
export const overlayT = (overlay, v) => (v - overlay.min) / (overlay.max - overlay.min);
