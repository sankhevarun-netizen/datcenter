// lib/nexus/twin-site.js — what the twin says about halls, plant and any
// clicked object. Every value comes from the dataset; status follows the worst
// open alert on equipment inside the area, as on the Live Status panel.
import { nexus, index, racksOf, componentsOf, getRack, getComponent, getFacility } from './data.js';
import { thermalMap } from './thermal-model.js';
import { AS_OF } from './time.js';

const STATUS_BY_SEVERITY = { critical: 'Critical', high: 'Warning', medium: 'Warning', low: 'Normal' };
const RANK = { Normal: 0, Warning: 1, Critical: 2 };
const worst = (alerts) => alerts.reduce((w, a) => (RANK[STATUS_BY_SEVERITY[a.severity]] > RANK[w] ? STATUS_BY_SEVERITY[a.severity] : w), 'Normal');
const round = (v, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const openAlerts = (facilityId) => nexus.activeAlerts.filter((a) => a.facility_id === facilityId && a.status !== 'resolved');
const posOf = (componentId) => index.positionById?.get?.(componentId) ?? nexus.componentPositions.find((p) => p.component_id === componentId) ?? null;
const inside = (p, b, pad = 0) => p && p.x_m >= b.x0 - pad && p.x_m <= b.x1 + pad && p.z_m >= b.z0 - pad && p.z_m <= b.z1 + pad;

/** Rack footprint of a hall, in metres. */
export function hallBounds(facilityId, hallId) {
  const rs = racksOf(facilityId).filter((r) => r.hall_id === hallId);
  return { x0: Math.min(...rs.map((r) => r.x_m)), x1: Math.max(...rs.map((r) => r.x_m)), z0: Math.min(...rs.map((r) => r.z_m)), z1: Math.max(...rs.map((r) => r.z_m)) };
}

/**
 * Alerts on equipment in a hall: its rows, the CRAHs and PDUs that serve its
 * racks (cooled_by_crah, fed_by_pdu), or components placed within it.
 */
function hallAlerts(facilityId, hallId, bounds) {
  const rowIds = new Set((index.rowsByFacility.get(facilityId) ?? []).filter((r) => r.hall_id === hallId).map((r) => r.row_id));
  const racks = racksOf(facilityId).filter((r) => r.hall_id === hallId);
  const serving = new Set(racks.flatMap((r) => [r.cooled_by_crah, r.fed_by_pdu]).filter(Boolean));
  return openAlerts(facilityId).filter((a) => {
    const m = /^ROW-([A-Z]+)$/.exec(a.component_id);
    if (m) return rowIds.has(m[1]);
    return serving.has(a.component_id) || inside(posOf(a.component_id), bounds, 2.5);
  });
}

export function hallSummaries(facilityId) {
  const thermal = thermalMap(facilityId);
  return nexus.halls.filter((h) => h.facility_id === facilityId).map((h) => {
    const bounds = hallBounds(facilityId, h.hall_id);
    const racks = racksOf(facilityId).filter((r) => r.hall_id === h.hall_id);
    const occupied = racks.filter((r) => r.status === 'occupied');
    const inlets = thermal.rows.filter((r) => r.hallId === h.hall_id).flatMap((r) => r.racks.map((x) => x.inletC));
    const alerts = hallAlerts(facilityId, h.hall_id, bounds);
    return {
      hallId: h.hall_id,
      name: h.name,
      bounds,
      racks: racks.length,
      occupied: occupied.length,
      circuitKw: h.power_circuit_kw,
      usedKw: h.used_kw,
      utilPct: round((h.used_kw / h.power_circuit_kw) * 100, 0),
      maxDensityKw: h.max_density_kw,
      coolingType: h.cooling_type,
      note: h.note,
      meanInletC: inlets.length ? round(sum(inlets) / inlets.length) : null,
      maxInletC: inlets.length ? Math.max(...inlets) : null,
      alerts,
      status: worst(alerts),
    };
  });
}

const PLANT_GROUPS = [
  { id: 'plant-power', title: 'Power plant', types: ['ups', 'switchgear'], zone: 'plant room' },
  { id: 'plant-cooling', title: 'Cooling plant', types: ['chiller', 'cooling_tower', 'chw_loop'] },
  { id: 'plant-backup', title: 'Generator yard', types: ['generator'] },
  { id: 'plant-intake', title: 'Utility intake', types: ['utility_feed', 'transformer'] },
];
const TYPE_LABEL = { ups: 'UPS', switchgear: 'switchgear', chiller: 'chillers', cooling_tower: 'cooling towers', chw_loop: 'CHW loops', generator: 'generators', utility_feed: 'utility feeds', transformer: 'transformers' };

/** Grouped plant summaries with an anchor at the group's centre. */
export function plantSummaries(facilityId) {
  const comps = componentsOf(facilityId);
  const alerts = openAlerts(facilityId);
  return PLANT_GROUPS.map((g) => {
    const members = comps.filter((c) => g.types.includes(c.component_type));
    if (!members.length) return null;
    const ps = members.map((c) => posOf(c.component_id)).filter(Boolean);
    const groupAlerts = alerts.filter((a) => members.some((c) => c.component_id === a.component_id));
    const counts = g.types.map((t) => [t, members.filter((c) => c.component_type === t).length]).filter(([, n]) => n);
    return {
      id: g.id,
      title: g.title,
      summary: counts.map(([t, n]) => `${n} ${TYPE_LABEL[t]}`).join(' · '),
      redundancy: [...new Set(members.map((c) => c.redundancy))].join(' / '),
      anchor: { x: sum(ps.map((p) => p.x_m)) / ps.length, y: Math.max(...ps.map((p) => p.y_m)) + 4, z: sum(ps.map((p) => p.z_m)) / ps.length },
      alerts: groupAlerts,
      status: worst(groupAlerts),
    };
  }).filter(Boolean);
}

/** Site headline figures for the outer view. */
export function siteSummary(facilityId) {
  const f = getFacility(facilityId);
  const latest = (index.timeseriesByFacility.get(facilityId) ?? []).at(-1);
  const alerts = openAlerts(facilityId);
  const bySeverity = (s) => alerts.filter((a) => a.severity === s).length;
  return {
    name: f.name,
    designMw: round(f.design_it_kw / 1000),
    usedMw: round(f.used_it_kw / 1000),
    utilPct: f.utilisation_pct,
    pue: latest ? latest.pue : f.pue,
    pueMonth: latest?.month ?? null,
    racks: f.racks,
    halls: f.halls,
    alerts: alerts.length,
    alertMix: { critical: bySeverity('critical'), high: bySeverity('high'), medium: bySeverity('medium'), low: bySeverity('low') },
    asOf: AS_OF,
  };
}

/** Content of the info card for a clicked rack, component or hall. */
export function describeObject(facilityId, kind, id) {
  if (kind === 'rack') {
    const r = getRack(id);
    const row = thermalMap(facilityId).rows.find((x) => x.rowId === r.row_id);
    const inlet = row?.racks.find((x) => x.rackId === r.rack_id)?.inletC ?? null;
    const util = r.capacity_kw ? round((r.used_kw / r.capacity_kw) * 100, 0) : 0;
    const status = r.status !== 'occupied' ? (r.status === 'free' ? 'Free' : 'Blocked')
      : util > 100 ? 'Exceeded' : (inlet != null && inlet >= 27) || util >= 90 ? 'Warning' : 'Normal';
    return {
      title: `Rack ${r.rack_id.replace(`${facilityId}-`, '')}`,
      subtitle: `${nexus.halls.find((h) => h.hall_id === r.hall_id)?.name ?? r.hall_id} · Row ${r.row_id}${r.tenant_id ? ` · ${r.tenant_id}` : ''}`,
      status,
      rows: [
        ['Power usage', `${r.used_kw} / ${r.capacity_kw} kW`],
        ['Inlet temperature (est.)', inlet != null ? `${inlet} °C` : '—'],
        ['Status', r.status.charAt(0).toUpperCase() + r.status.slice(1)],
        ['Utilisation', `${util}%${util > 100 ? ' · above rated capacity' : ''}`],
      ],
      bar: { label: 'Utilisation', pct: util },
    };
  }
  if (kind === 'component') {
    const c = getComponent(id);
    const alerts = openAlerts(facilityId).filter((a) => a.component_id === c.component_id);
    const util = c.derated_capacity ? round((c.current_load / c.derated_capacity) * 100, 0) : null;
    return {
      title: c.label,
      subtitle: `${c.component_id} · ${c.component_type.replace('_', ' ')}`,
      status: worst(alerts),
      rows: [
        ['Load', `${c.current_load} / ${c.derated_capacity} ${c.unit} (derated)`],
        ['Redundancy', `${c.redundancy}${c.redundant_peers ? ` · peer ${c.redundant_peers}` : ''}`],
        ['Replacement lead time', c.lead_time_weeks ? `${c.lead_time_weeks} weeks` : '—'],
        ...alerts.map((a) => [a.alert_id, a.message]),
      ],
      bar: util != null && c.current_load > 0 ? { label: 'Load of derated capacity', pct: util } : null,
    };
  }
  if (kind === 'hall') {
    const h = hallSummaries(facilityId).find((x) => x.hallId === id);
    return {
      title: h.name,
      subtitle: `${h.coolingType} · ${h.note}`,
      status: h.status,
      rows: [
        ['IT load', `${round(h.usedKw / 1000, 2)} of ${round(h.circuitKw / 1000, 2)} MW`],
        ['Racks', `${h.occupied} of ${h.racks} occupied`],
        ['Density limit', `${h.maxDensityKw} kW per rack`],
        ['Inlet temperature (est.)', h.meanInletC != null ? `${h.meanInletC} °C mean · ${h.maxInletC} °C max` : '—'],
        ...h.alerts.map((a) => [a.alert_id, a.message]),
      ],
      bar: { label: 'Power circuit used', pct: h.utilPct },
    };
  }
  if (kind === 'row') {
    const r = rowSummaries(facilityId).find((x) => x.rowId === id);
    return {
      title: `Row ${r.rowId}`,
      subtitle: `${nexus.halls.find((h) => h.hall_id === r.hallId)?.name ?? r.hallId} · ${r.binding === 'balanced' ? 'power and cooling balanced' : `${r.binding}-bound`}`,
      status: r.status,
      rows: [
        ['IT load', `${r.usedKw} of ${r.circuitKw} kW circuit`],
        ['Cooling capacity', `${r.coolingKw} kW`],
        ['Headroom', `${r.headroomKw} kW`],
        ['Racks', `${r.occupied} of ${r.racks} occupied${r.overRated ? ` · ${r.overRated} above rating` : ''}`],
        ['Inlet temperature (est.)', r.maxInletC != null ? `${r.maxInletC} °C max · ${r.marginC} °C margin` : '—'],
        ...r.alerts.map((a) => [a.alert_id, a.message]),
      ],
      bar: { label: 'Circuit used', pct: Math.round((r.usedKw / r.circuitKw) * 100) },
    };
  }
  if (kind === 'plant') {
    const p = plantSummaries(facilityId).find((x) => x.id === id);
    return {
      title: p.title,
      subtitle: p.summary,
      status: p.status,
      rows: [['Redundancy', p.redundancy], ...p.alerts.map((a) => [a.alert_id, a.message])],
      bar: null,
    };
  }
  return null;
}

// ── Rows and callout cards for the inner and heatmap views ─────────────────

/** Per row: load, headroom, binding constraint, hottest inlet and alerts. */
export function rowSummaries(facilityId) {
  const thermal = thermalMap(facilityId);
  const alerts = openAlerts(facilityId);
  const all = racksOf(facilityId);
  return (index.rowsByFacility.get(facilityId) ?? []).map((row) => {
    const racks = all.filter((r) => r.row_id === row.row_id);
    const serving = new Set(racks.flatMap((r) => [r.cooled_by_crah, r.fed_by_pdu]).filter(Boolean));
    const rowAlerts = alerts.filter((a) => a.component_id === `ROW-${row.row_id}` || serving.has(a.component_id));
    const over = racks.filter((r) => r.used_kw > r.capacity_kw).length;
    const tr = thermal.rows.find((x) => x.rowId === row.row_id);
    const status = over ? (worst(rowAlerts) === 'Critical' ? 'Critical' : 'Warning') : worst(rowAlerts);
    return {
      rowId: row.row_id,
      hallId: row.hall_id,
      racks: row.rack_count,
      occupied: row.racks_occupied,
      usedKw: row.used_kw,
      circuitKw: row.power_circuit_kw,
      coolingKw: row.cooling_capacity_kw,
      headroomKw: row.headroom_kw,
      binding: row.binding_constraint,
      marginC: row.thermal_margin_c,
      maxInletC: tr?.maxInletC ?? null,
      overRated: over,
      alerts: rowAlerts,
      status,
      anchor: { x: sum(racks.map((r) => r.x_m)) / racks.length, y: 2.7, z: sum(racks.map((r) => r.z_m)) / racks.length },
      // Row ends, for cards: alternating ends keep neighbouring rows' cards apart.
      ends: { west: { x: Math.min(...racks.map((r) => r.x_m)) - 0.6, z: sum(racks.map((r) => r.z_m)) / racks.length }, east: { x: Math.max(...racks.map((r) => r.x_m)) + 0.6, z: sum(racks.map((r) => r.z_m)) / racks.length } },
    };
  });
}

const rowEnd = (r, i) => ({ ...(i % 2 ? r.ends.east : r.ends.west), y: 2.4 });
const BIND = { balanced: 'balanced', power: 'power-bound', cooling: 'cooling-bound', space: 'space-bound' };
const rankPriority = (status) => ({ Normal: 0, Warning: 1, Exceeded: 2, Critical: 2 }[status] ?? 0) * 1000;

/** Outer view: one card per hall and per plant area. */
export function siteCallouts(facilityId) {
  return [
    ...hallSummaries(facilityId).map((h) => ({
      id: `hall:${h.hallId}`, kind: 'hall', ref: h.hallId, priority: 200 + rankPriority(h.status),
      anchor: { x: (h.bounds.x0 + h.bounds.x1) / 2, y: 3.6, z: (h.bounds.z0 + h.bounds.z1) / 2 },
      title: h.name, lines: [`${(h.usedKw / 1000).toFixed(2)} MW · ${h.racks} racks`], status: h.status,
    })),
    ...plantSummaries(facilityId).map((p) => ({
      id: `plant:${p.id}`, kind: 'plant', ref: p.id, priority: 150 + rankPriority(p.status), anchor: p.anchor, title: p.title, lines: [], status: p.status,
    })),
  ];
}

/** Inner view: one card per row of the hall. */
export function rowCallouts(facilityId, hallId) {
  // Alternate heights so neighbouring rows' cards do not cover each other.
  return rowSummaries(facilityId).filter((r) => r.hallId === hallId).map((r, i) => ({
    id: `row:${r.rowId}`, kind: 'row', ref: r.rowId, priority: rankPriority(r.status) + r.usedKw / 10, anchor: rowEnd(r, i),
    title: `Row ${r.rowId}`,
    lines: [
      `${r.usedKw} kW · ${r.occupied}/${r.racks} racks`,
      `${r.headroomKw} kW headroom · ${BIND[r.binding] ?? r.binding}`,
      ...(r.overRated ? [`${r.overRated} racks above rating`] : []),
    ],
    status: r.status,
  }));
}

const heatStatus = (overlay, max) => (overlay.kind === 'thermal'
  ? (max >= overlay.max ? 'Critical' : max >= overlay.marks[0].value ? 'Warning' : 'Normal')
  : (max > 100 ? 'Exceeded' : max >= overlay.marks[0].value ? 'Warning' : 'Normal'));
const fmt = (v) => Math.round(v * 10) / 10;

/** Heatmap view: per hall across the site, or per row within one hall. */
export function heatCallouts(facilityId, overlay, hallId = null) {
  const racks = racksOf(facilityId).filter((r) => overlay.values[r.rack_id] != null && (overlay.kind === 'thermal' || r.status === 'occupied'));
  const card = (id, kind, ref, title, list, anchor) => {
    const vals = list.map((r) => overlay.values[r.rack_id]);
    if (!vals.length) return null;
    const max = Math.max(...vals), mean = sum(vals) / vals.length;
    const status = heatStatus(overlay, max);
    const lines = overlay.kind === 'thermal'
      ? [`Inlet ${fmt(mean)} °C mean · ${fmt(max)} °C max`]
      : [`${fmt(mean)}% of rating on average`, `${fmt(max)}% highest rack`];
    return { id, kind, ref, title, lines, status, anchor, priority: rankPriority(status) + max };
  };
  if (!hallId) {
    return hallSummaries(facilityId).map((h) => card(`heat-hall:${h.hallId}`, 'hall', h.hallId, h.name,
      racks.filter((r) => r.hall_id === h.hallId),
      { x: (h.bounds.x0 + h.bounds.x1) / 2, y: 3, z: (h.bounds.z0 + h.bounds.z1) / 2 })).filter(Boolean);
  }
  return rowSummaries(facilityId).filter((r) => r.hallId === hallId).map((row, i) => card(`heat-row:${row.rowId}`, 'row', row.rowId, `Row ${row.rowId}`,
    racks.filter((r) => r.row_id === row.rowId), rowEnd(row, i))).filter(Boolean);
}
