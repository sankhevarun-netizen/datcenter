// lib/nexus/thermal-model.js
//
// Estimated rack inlet temperatures for facilities with sensors on file
// (26_thermal_sensors covers MUM-1), and a CRAH-failure what-if.
//
// Baseline: each row has a cold-aisle sensor at the CRAH end (rack 1) and one
// at the far end (last rack). A rack's inlet is interpolated between them by
// position, plus a small load term — racks drawing more than the row average
// run slightly warmer. The load term is zero-mean within a row, so the
// estimate reproduces both sensor readings.
//
// Failure: a row's two CRAHs share one cold aisle, so they are treated as a
// pooled pair (the dataset rates CRAHs "N"). Losing one leaves the other to
// cool the whole row. The rise in inlet temperature is modelled from the
// surviving unit's utilisation:
//   + RISE_PER_UTIL °C per unit of extra utilisation while within rating,
//   + DEFICIT_PER_UTIL °C per unit of utilisation beyond its rating.
// These two constants are model assumptions, not dataset values; the UI
// labels every thermal figure as an estimate.
import { index, racksInRow, rowsOf, getComponent } from './data.js';

export const ASHRAE = Object.freeze({ recommendedMaxC: 27, allowableMaxC: 32 });
export const THERMAL_MODEL = Object.freeze({ LOAD_C_PER_KW: 0.02, RISE_PER_UTIL: 8, DEFICIT_PER_UTIL: 12 });
export const THERMAL_BINS = Object.freeze([
  { state: 'thermal-0', upTo: 22, label: 'Below 22 °C' },
  { state: 'thermal-1', upTo: 24, label: '22–24 °C' },
  { state: 'thermal-2', upTo: ASHRAE.recommendedMaxC, label: '24–27 °C' },
  { state: 'thermal-3', upTo: ASHRAE.allowableMaxC, label: '27–32 °C · above recommended' },
  { state: 'thermal-4', upTo: Infinity, label: '32 °C+ · above allowable' },
]);

const round = (v, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;
export const binFor = (c) => THERMAL_BINS.find((b) => c < b.upTo).state;

export const hasThermalData = (facilityId) => (index.sensorsByFacility.get(facilityId) ?? []).length > 0;

function rowSensors(facilityId, rowId) {
  const s = index.sensorsByRow.get(`${facilityId}:${rowId}`) ?? [];
  return {
    near: s.find((x) => x.location.endsWith('CRAH end')),
    far: s.find((x) => x.location.endsWith('far end')),
    supply: s.filter((x) => x.location === 'CRAH supply air'),
  };
}

/** The pair of CRAHs that cool a row, by the naming scheme CRAH-<row>-01/02. */
export function rowCrahs(rowId) {
  return ['01', '02'].map((n) => index.componentById.get(`CRAH-${rowId}-${n}`)).filter(Boolean);
}

/** What the surviving unit faces if `crahId` fails. */
export function crahFailover(crahId) {
  const failed = getComponent(crahId);
  const rowId = crahId.split('-')[1];
  const pair = rowCrahs(rowId);
  const remaining = pair.filter((c) => c.component_id !== crahId);
  const loadKw = pair.reduce((s, c) => s + c.current_load, 0);
  const capacityBefore = pair.reduce((s, c) => s + c.derated_capacity, 0);
  const capacityAfter = remaining.reduce((s, c) => s + c.derated_capacity, 0);
  const before = loadKw / capacityBefore;
  const after = capacityAfter > 0 ? loadKw / capacityAfter : Infinity;
  return {
    crahId,
    rowId,
    failedLabel: failed.label,
    survivors: remaining.map((c) => c.component_id),
    loadKw,
    survivorCapacityKw: capacityAfter,
    utilisationBeforePct: round(before * 100),
    utilisationAfterPct: round(after * 100),
    holds: after <= 1,
    riseC: round(THERMAL_MODEL.RISE_PER_UTIL * Math.max(0, after - before) + THERMAL_MODEL.DEFICIT_PER_UTIL * Math.max(0, after - 1)),
  };
}

/**
 * Inlet estimate per rack. Returns rows with their racks, sensors and, when
 * `failedCrah` is given, the post-failure temperatures for the affected row.
 */
export function thermalMap(facilityId, { failedCrah = null } = {}) {
  const failure = failedCrah ? crahFailover(failedCrah) : null;
  const rows = rowsOf(facilityId).map((row) => {
    const { near, far, supply } = rowSensors(facilityId, row.row_id);
    const racks = racksInRow(facilityId, row.row_id).slice().sort((a, b) => a.position_in_row - b.position_in_row);
    const occupied = racks.filter((r) => r.status === 'occupied');
    const meanKw = occupied.length ? occupied.reduce((s, r) => s + r.used_kw, 0) / occupied.length : 0;
    const n = Math.max(1, racks.length - 1);
    const rise = failure && failure.rowId === row.row_id ? failure.riseC : 0;
    const rackTemps = racks.map((r, i) => {
      const base = near.reading_c + ((far.reading_c - near.reading_c) * i) / n;
      // The load term applies between the end sensors only, so both readings hold exactly.
      const interior = i > 0 && i < racks.length - 1;
      const load = interior && r.status === 'occupied' ? THERMAL_MODEL.LOAD_C_PER_KW * (r.used_kw - meanKw) : 0;
      const baseline = round(base + load);
      return { rackId: r.rack_id, position: r.position_in_row, status: r.status, tenantId: r.tenant_id, usedKw: r.used_kw, baselineC: baseline, inletC: round(baseline + rise) };
    });
    const maxInlet = Math.max(...rackTemps.map((t) => t.inletC));
    return {
      rowId: row.row_id,
      hallId: row.hall_id,
      sensors: { nearC: near.reading_c, farC: far.reading_c, supply: supply.map((s) => ({ componentId: s.component_id, readingC: s.reading_c, setpointC: s.setpoint_c })) },
      maxInletC: maxInlet,
      marginC: round(ASHRAE.recommendedMaxC - maxInlet),
      racks: rackTemps,
    };
  });
  return { facilityId, failure, rows };
}

/** Rows ranked by thermal margin, and every CRAH whose loss the row cannot absorb. */
export function thermalSummary(facilityId) {
  const map = thermalMap(facilityId);
  const crahs = rowsOf(facilityId).flatMap((r) => rowCrahs(r.row_id));
  const exposed = crahs.map((c) => crahFailover(c.component_id)).filter((f) => !f.holds);
  return {
    tightestRows: [...map.rows].sort((a, b) => a.marginC - b.marginC).slice(0, 5).map((r) => ({ rowId: r.rowId, maxInletC: r.maxInletC, marginC: r.marginC })),
    exposedRows: [...new Set(exposed.map((f) => f.rowId))],
    exposedFailovers: exposed,
  };
}
