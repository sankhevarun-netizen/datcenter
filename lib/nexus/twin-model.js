// lib/nexus/twin-model.js
//
// Turns engine results into what the twin should show: a state per rack and
// per component, ripple timing (hop), flow lines along the active chain,
// floating labels and the points the camera should frame. Pure — the
// renderer (components/nexus/NexusTwin.jsx) only draws what this returns.
// Every number placed in a label comes straight from an engine result.
import { index, racksOf, racksInRow, componentsOf, getComponent, getHall, rowsOf } from './data.js';
import { binFor, ASHRAE, THERMAL_BINS } from './thermal-model.js';

export const LABEL_PRIORITY = { exceeded: 400, failed: 400, redundancy_lost: 350, tight: 300, focus: 500, info: 200 };

const pos = (c) => c.position;
const rowComponent = (rowId) => getComponent(`ROW-${rowId}`);
const rowCentroid = (rowId) => {
  const p = pos(rowComponent(rowId));
  return { x: p.x, y: 1, z: p.z };
};

function hallCentre(hallId, facilityId) {
  const racks = racksOf(facilityId).filter((r) => r.hall_id === hallId);
  const xs = racks.map((r) => r.x_m), zs = racks.map((r) => r.z_m);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: 2.6, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
}

function dimAll(facilityId) {
  return {
    rackStates: Object.fromEntries(racksOf(facilityId).map((r) => [r.rack_id, { state: 'dimmed' }])),
    componentStates: Object.fromEntries(componentsOf(facilityId).map((c) => [c.component_id, { state: 'dimmed' }])),
  };
}

/** Resting view: every rack and component in its everyday colour. */
export function idleView(facilityId, selectedRowId = null) {
  const rackStates = Object.fromEntries(racksOf(facilityId).map((r) => [
    r.rack_id,
    { state: r.row_id === selectedRowId ? 'selected' : r.status === 'free' ? 'free' : r.status === 'blocked' ? 'blocked' : 'neutral' },
  ]));
  const componentStates = Object.fromEntries(componentsOf(facilityId).map((c) => [c.component_id, { state: 'neutral' }]));
  return { rackStates, componentStates, flowLines: [], labels: [], focusPoints: null, legend: null };
}

/** Scene 1: rows with structural stranding in the waste colours, Hall 4 headroom shown separately. */
export function strandedView(facilityId, stranded) {
  const { rackStates, componentStates } = dimAll(facilityId);
  const labels = [];
  for (const row of stranded.byRow) {
    const state = row.classification === 'planned headroom'
      ? 'planned'
      : row.limitedBy === 'space' ? 'stranded-space' : 'stranded-cooling';
    for (const r of racksInRow(facilityId, row.rowId)) rackStates[r.rack_id] = { state };
    if (row.classification === 'structural') {
      labels.push({ id: `stranded-${row.rowId}`, position: rowCentroid(row.rowId), text: `Row ${row.rowId} · ${row.strandedKw} kW ${row.limitedBy}-limited`, tone: state, priority: LABEL_PRIORITY.focus });
    }
  }
  if (stranded.plannedHeadroomKw > 0) {
    const hallId = stranded.byRow.find((r) => r.classification === 'planned headroom')?.hallId;
    if (hallId) labels.push({ id: 'planned-headroom', position: hallCentre(hallId, facilityId), text: `${getHall(hallId).name} · ${stranded.plannedHeadroomKw} kW planned headroom`, tone: 'planned', priority: LABEL_PRIORITY.info });
  }
  const focusPoints = racksOf(facilityId).map((r) => ({ x: r.x_m, y: 0, z: r.z_m }));
  return {
    rackStates, componentStates, flowLines: [], labels, focusPoints,
    legend: [
      { state: 'stranded-cooling', label: 'Stranded — cooling-limited' },
      { state: 'stranded-space', label: 'Stranded — space-limited' },
      { state: 'planned', label: 'Planned headroom (not waste)' },
      { state: 'dimmed', label: 'No stranding' },
    ],
  };
}

/** Scene 2: deployable racks green, free-but-blocked amber, everything not part of the answer grey. */
export function capacityView(facilityId, fit) {
  const { rackStates, componentStates } = dimAll(facilityId);
  const deployable = new Set(fit.deployableRacks);
  const eligibleRows = new Set(fit.rowBreakdown.filter((r) => r.eligible).map((r) => r.rowId));
  for (const r of racksOf(facilityId)) {
    if (!eligibleRows.has(r.row_id)) continue;
    rackStates[r.rack_id] = { state: deployable.has(r.rack_id) ? 'deployable' : r.status === 'free' ? 'available' : 'occupied-eligible' };
  }
  const labels = fit.eligibleHalls.map((hallId) => ({
    id: `fit-${hallId}`,
    position: hallCentre(hallId, facilityId),
    text: `${getHall(hallId).name} · ${fit.deployableRackCount} racks / ${fit.deployableKw} kW deployable`,
    tone: 'deployable',
    priority: LABEL_PRIORITY.focus,
  }));
  const focusPoints = racksOf(facilityId).filter((r) => eligibleRows.has(r.row_id)).map((r) => ({ x: r.x_m, y: 0, z: r.z_m }));
  return {
    rackStates, componentStates, flowLines: [], labels, focusPoints: focusPoints.length ? focusPoints : null,
    legend: [
      { state: 'deployable', label: `Deployable today (${fit.deployableRackCount})` },
      { state: 'available', label: `Free, but ${fit.bindingConstraint} is exhausted` },
      { state: 'occupied-eligible', label: 'Occupied' },
      { state: 'dimmed', label: `Not rated for ${fit.densityKw} kW` },
    ],
  };
}

/** Density view: every row coloured by its rated density band. */
export function densityView(facilityId, readiness) {
  const { componentStates } = dimAll(facilityId);
  const bandByRow = Object.fromEntries(readiness.map((r) => [r.rowId, r.band]));
  const rackStates = Object.fromEntries(racksOf(facilityId).map((r) => [r.rack_id, { state: `band-${bandByRow[r.row_id]}` }]));
  const halls = new Map();
  for (const r of readiness) if (!halls.has(r.hallId)) halls.set(r.hallId, r);
  const labels = [...halls.values()].map((r) => ({
    id: `density-${r.hallId}`, position: hallCentre(r.hallId, facilityId), text: `${getHall(r.hallId).name} · ${r.maxDensityKw} kW/rack`, tone: `band-${r.band}`, priority: LABEL_PRIORITY.info,
  }));
  return {
    rackStates, componentStates, flowLines: [], labels, focusPoints: null,
    legend: [
      { state: 'band-green', label: '≥ 50 kW — AI ready' },
      { state: 'band-amber', label: '20–50 kW' },
      { state: 'band-red', label: '< 20 kW' },
    ],
  };
}

/** The components (or changed rows) that handed load to `impact` one hop earlier. */
function childrenOf(impact, affected, changedRows) {
  const id = impact.componentId;
  if (impact.chain === 'electrical') {
    return (index.edgesFrom.get(id) ?? [])
      .filter((e) => e.chain === 'electrical')
      .map((e) => e.target_component_id)
      .filter((t) => affected.has(t) || changedRows.has(t));
  }
  if (impact.componentType === 'crah') {
    return (index.edgesTo.get(id) ?? []).filter((e) => e.chain === 'thermal' && changedRows.has(e.source_component_id)).map((e) => e.source_component_id);
  }
  return (index.edgesFrom.get(id) ?? []).filter((e) => e.chain === 'thermal' && affected.has(e.target_component_id)).map((e) => e.target_component_id);
}

/** Scene 3: the cascade. Ripple by hop, dimmed elsewhere, flow lines along the walked edges. */
export function cascadeView(facilityId, result, { focusComponentId = null } = {}) {
  const { rackStates, componentStates } = dimAll(facilityId);
  const changedRows = new Set(result.rowChanges.map((r) => r.componentId));
  for (const rc of result.rowChanges) {
    for (const r of racksInRow(facilityId, rc.rowId)) rackStates[r.rack_id] = { state: 'changed', hop: 0 };
  }
  const affected = new Set(result.impacts.map((i) => i.componentId));
  for (const i of result.impacts) componentStates[i.componentId] = { state: i.status, hop: i.hopDistance };

  const flowLines = [];
  for (const i of result.impacts) {
    for (const childId of childrenOf(i, affected, changedRows)) {
      const from = changedRows.has(childId) ? rowCentroid(childId.replace('ROW-', '')) : pos(getComponent(childId));
      flowLines.push({ id: `${childId}->${i.componentId}`, from, to: pos(getComponent(i.componentId)), chain: i.chain, hop: i.hopDistance });
    }
  }

  const labels = [];
  for (const i of result.impacts) {
    if (!['tight', 'exceeded', 'redundancy_lost', 'failed'].includes(i.status)) continue;
    labels.push({
      id: i.componentId,
      position: pos(getComponent(i.componentId)),
      text: i.status === 'failed' ? `${i.componentId} failed` : `${i.componentId} ${i.newUtilisationPct}%`,
      tone: i.status,
      priority: LABEL_PRIORITY[i.status] + (i.componentId === focusComponentId ? 200 : 0),
      hop: i.hopDistance,
    });
  }
  for (const rc of result.rowChanges) {
    labels.push({ id: `row-${rc.rowId}`, position: rowCentroid(rc.rowId), text: `Row ${rc.rowId} · ${rc.oldDensityKw} → ${rc.newDensityKw} kW/rack`, tone: 'changed', priority: LABEL_PRIORITY.focus, hop: 0 });
  }

  const focusPoints = focusComponentId
    ? [pos(getComponent(focusComponentId))]
    : [...result.impacts.map((i) => pos(getComponent(i.componentId))), ...result.rowChanges.map((rc) => rowCentroid(rc.rowId))];

  return {
    rackStates, componentStates, flowLines, labels, focusPoints,
    legend: [
      { state: 'ok', label: 'OK' },
      { state: 'tight', label: 'Tight (80–100%)' },
      { state: 'exceeded', label: 'Exceeded' },
      { state: 'redundancy_lost', label: 'Redundancy lost' },
      { state: 'dimmed', label: 'Not affected' },
    ],
  };
}

/** Scene 4: the incident component under investigation. */
export function replayView(facilityId, incident) {
  const { rackStates, componentStates } = dimAll(facilityId);
  componentStates[incident.component_id] = { state: 'alert', hop: 0 };
  const c = getComponent(incident.component_id);
  return {
    rackStates, componentStates, flowLines: [],
    labels: [{ id: incident.incident_id, position: pos(c), text: `${incident.component_id} · ${incident.incident_id}`, tone: 'exceeded', priority: LABEL_PRIORITY.focus }],
    focusPoints: [pos(c)],
    legend: [{ state: 'alert', label: incident.description }],
  };
}

/** Static labels for orientation: hall names and the two equipment zones. */
export function orientationLabels(facilityId) {
  const halls = [...new Set(rowsOf(facilityId).map((r) => r.hall_id))];
  const labels = halls.map((hallId) => ({ id: `hall-${hallId}`, position: { ...hallCentre(hallId, facilityId), y: 0.05 }, text: getHall(hallId).name, tone: 'zone', priority: 50, floor: true }));
  const zoneCentre = (zone) => {
    const ps = componentsOf(facilityId).filter((c) => c.zone === zone).map(pos);
    if (!ps.length) return null;
    return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: 0.05, z: ps.reduce((s, p) => s + p.z, 0) / ps.length };
  };
  for (const [zone, text] of [['plant room', 'Plant room'], ['outdoor yard', 'Outdoor yard']]) {
    const p = zoneCentre(zone);
    if (p) labels.push({ id: `zone-${zone}`, position: p, text, tone: 'zone', priority: 40, floor: true });
  }
  return labels;
}

/**
 * Thermal: every rack coloured by its estimated inlet temperature. With a
 * failed CRAH, the affected row heats up, the failed unit is marked, and rows
 * past the recommended limit are labelled with their hottest inlet.
 */
export function thermalView(facilityId, map) {
  const { componentStates } = dimAll(facilityId);
  const rackStates = {};
  const labels = [];
  for (const row of map.rows) {
    for (const r of row.racks) rackStates[r.rackId] = { state: binFor(r.inletC) };
    if (row.maxInletC >= ASHRAE.recommendedMaxC || (map.failure && map.failure.rowId === row.rowId)) {
      labels.push({ id: `thermal-${row.rowId}`, position: rowCentroid(row.rowId), text: `Row ${row.rowId} · ${row.maxInletC} °C inlet`, tone: row.maxInletC >= ASHRAE.allowableMaxC ? 'exceeded' : row.maxInletC >= ASHRAE.recommendedMaxC ? 'tight' : 'ok', priority: LABEL_PRIORITY.focus });
    }
  }
  for (const c of componentsOf(facilityId).filter((x) => x.component_type === 'crah')) componentStates[c.component_id] = { state: 'neutral' };
  let focusPoints = null;
  if (map.failure) {
    const failed = getComponent(map.failure.crahId);
    componentStates[failed.component_id] = { state: 'failed', hop: 0 };
    for (const id of map.failure.survivors) componentStates[id] = { state: map.failure.holds ? 'tight' : 'exceeded', hop: 1 };
    labels.push({ id: `failed-${failed.component_id}`, position: pos(failed), text: `${failed.component_id} failed`, tone: 'failed', priority: LABEL_PRIORITY.failed });
    focusPoints = [pos(failed), rowCentroid(map.failure.rowId)];
  }
  return {
    rackStates, componentStates, flowLines: [], labels, focusPoints,
    legend: THERMAL_BINS.map((b) => ({ state: b.state, label: b.label })),
  };
}
