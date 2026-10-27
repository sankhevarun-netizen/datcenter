// lib/nexus/prompt-policy.js
//
// Metadata-only: what reaches a model is computed facts and aggregates, never
// raw operational telemetry. This check runs on every prompt before it is
// sent. A prompt fails if it carries telemetry fields (the per-reading columns
// of 12_telemetry_replay and 26_thermal_sensors) or reads like a dump of
// timestamped rows.

const TELEMETRY_FIELDS = [
  'string_voltage_v', 'cell_temp_c', 'internal_resistance_mohm', 'state_of_health_pct',
  'reading_c', 'sensor_id', 'read_at',
];
const TIMESTAMP = /\b20\d\d-\d\d-\d\d[ T]\d\d:\d\d\b/g;
/** More timestamps than this in one prompt reads as a telemetry dump, not a brief. */
export const MAX_TIMESTAMPS = 12;

export function checkPrompt(text) {
  const s = String(text);
  const fields = TELEMETRY_FIELDS.filter((f) => s.includes(f));
  if (fields.length) return { ok: false, reason: `raw telemetry fields: ${fields.join(', ')}` };
  const stamps = (s.match(TIMESTAMP) ?? []).length;
  if (stamps > MAX_TIMESTAMPS) return { ok: false, reason: `${stamps} timestamps — reads as raw readings` };
  return { ok: true };
}
