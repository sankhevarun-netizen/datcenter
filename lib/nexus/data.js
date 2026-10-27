// lib/nexus/data.js
//
// The single loader for the Nexus dataset (data/nexus/*.json, produced by
// scripts/import-dataset.mjs). Everything is loaded once, indexed by id for
// O(1) lookup, and deep-frozen so no engine can mutate shared data — engines
// copy what they need. Field shapes are documented in ./schema.js.
import facilities from '../../data/nexus/facilities.json';
import halls from '../../data/nexus/halls.json';
import rows from '../../data/nexus/rows.json';
import racks from '../../data/nexus/racks.json';
import rawComponents from '../../data/nexus/components.json';
import componentPositions from '../../data/nexus/componentPositions.json';
import dependencies from '../../data/nexus/dependencies.json';
import upgradeOptions from '../../data/nexus/upgradeOptions.json';
import tenants from '../../data/nexus/tenants.json';
import contracts from '../../data/nexus/contracts.json';
import incidents from '../../data/nexus/incidents.json';
import telemetryReplay from '../../data/nexus/telemetryReplay.json';
import energy from '../../data/nexus/energy.json';
import water from '../../data/nexus/water.json';
import grid from '../../data/nexus/grid.json';
import statePolicy from '../../data/nexus/statePolicy.json';
import maintenance from '../../data/nexus/maintenance.json';
import activeAlerts from '../../data/nexus/activeAlerts.json';
import benchmarks from '../../data/nexus/benchmarks.json';
import timeseries from '../../data/nexus/timeseries.json';
import demoScript from '../../data/nexus/demoScript.json';
import runbooks from '../../data/nexus/runbooks.json';
import siteRisk from '../../data/nexus/siteRisk.json';
import supplyChain from '../../data/nexus/supplyChain.json';
import thermalSensors from '../../data/nexus/thermalSensors.json';
import hourlyGeneration from '../../data/nexus/hourlyGeneration.json';
import cleanEnergyAssets from '../../data/nexus/cleanEnergyAssets.json';
import waterReuse from '../../data/nexus/waterReuse.json';

function deepFreeze(value) {
  if (value instanceof Map) {
    // A frozen Map can still be .set(); freezing its values is what matters —
    // it stops callers sorting or splicing the shared index arrays in place.
    for (const v of value.values()) deepFreeze(v);
    return value;
  }
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

function indexBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (map.has(key)) throw new Error(`Duplicate key in dataset: ${key}`);
    map.set(key, item);
  }
  return map;
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export const rowKey = (facilityId, rowId) => `${facilityId}:${rowId}`;

const positionById = indexBy(componentPositions, (p) => p.component_id);

// Components gain a parsed peer list and their 04b position, joined once here.
const components = rawComponents.map((c) => {
  const p = positionById.get(c.component_id);
  return {
    ...c,
    redundantPeers: c.redundant_peers ? c.redundant_peers.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [],
    position: p ? { x: p.x_m, y: p.y_m, z: p.z_m } : null,
    zone: p ? p.zone : null,
  };
});

export const nexus = deepFreeze({
  facilities, halls, rows, racks, components, componentPositions, dependencies, upgradeOptions,
  tenants, contracts, incidents, telemetryReplay, energy, water, grid, statePolicy,
  maintenance, activeAlerts, benchmarks, timeseries, demoScript,
  runbooks, siteRisk, supplyChain, thermalSensors,
  hourlyGeneration, cleanEnergyAssets, waterReuse,
});

// 16_state_policy.applies_to holds facility ids ("MUM-1, MUM-2"), "All", or
// "Reference" (EU EED — a benchmark framework, binding on no Indian site).
function policyIndex() {
  const map = new Map(nexus.facilities.map((f) => [f.facility_id, []]));
  for (const p of nexus.statePolicy) {
    const scope = String(p.applies_to).trim();
    if (scope === 'Reference') continue;
    const ids = scope === 'All' ? [...map.keys()] : scope.split(/[,;]/).map((s) => s.trim());
    for (const id of ids) map.get(id)?.push(p);
  }
  return map;
}

export const index = deepFreeze({
  facilityById: indexBy(nexus.facilities, (f) => f.facility_id),
  hallById: indexBy(nexus.halls, (h) => h.hall_id),
  rowByKey: indexBy(nexus.rows, (r) => rowKey(r.facility_id, r.row_id)),
  rackById: indexBy(nexus.racks, (r) => r.rack_id),
  componentById: indexBy(nexus.components, (c) => c.component_id),
  positionById,
  upgradeByComponent: indexBy(nexus.upgradeOptions, (u) => u.component_id),
  tenantById: indexBy(nexus.tenants, (t) => t.tenant_id),
  contractById: indexBy(nexus.contracts, (c) => c.contract_id),
  incidentById: indexBy(nexus.incidents, (i) => i.incident_id),

  hallsByFacility: groupBy(nexus.halls, (h) => h.facility_id),
  rowsByFacility: groupBy(nexus.rows, (r) => r.facility_id),
  rowsByHall: groupBy(nexus.rows, (r) => r.hall_id),
  racksByFacility: groupBy(nexus.racks, (r) => r.facility_id),
  racksByRow: groupBy(nexus.racks, (r) => rowKey(r.facility_id, r.row_id)),
  componentsByFacility: groupBy(nexus.components, (c) => c.facility_id),
  edgesFrom: groupBy(nexus.dependencies, (d) => d.source_component_id),
  edgesTo: groupBy(nexus.dependencies, (d) => d.target_component_id),
  contractsByTenant: groupBy(nexus.contracts, (c) => c.tenant_id),
  maintenanceByComponent: groupBy(nexus.maintenance, (m) => m.component_id),
  telemetryByComponent: groupBy(nexus.telemetryReplay, (t) => t.component_id),
  incidentsByFacility: groupBy(nexus.incidents, (i) => i.facility_id),
  alertsByFacility: groupBy(nexus.activeAlerts, (a) => a.facility_id),
  energyByFacility: groupBy(nexus.energy, (e) => e.facility_id),
  waterByFacility: groupBy(nexus.water, (w) => w.facility_id),
  timeseriesByFacility: groupBy(nexus.timeseries, (t) => t.facility_id),
  gridByFacility: indexBy(nexus.grid, (g) => g.facility_id),
  alertById: indexBy(nexus.activeAlerts, (a) => a.alert_id),
  benchmarkByMetric: groupBy(nexus.benchmarks, (b) => b.metric),
  siteRiskByFacility: indexBy(nexus.siteRisk, (s) => s.facility_id),
  supplyByComponentType: indexBy(nexus.supplyChain, (s) => s.component_type),
  runbooksByType: groupBy(nexus.runbooks, (r) => r.component_type),
  sensorsByFacility: groupBy(nexus.thermalSensors, (s) => s.facility_id),
  sensorsByRow: groupBy(nexus.thermalSensors, (s) => rowKey(s.facility_id, s.row_id)),
  policiesByFacility: policyIndex(),
  hourlyByFacility: groupBy(nexus.hourlyGeneration, (h) => h.facility_id),
  cleanAssetsByFacility: groupBy(nexus.cleanEnergyAssets, (a) => a.facility_id),
  waterReuseByFacility: groupBy(nexus.waterReuse, (w) => w.facility_id),
});

function required(map, key, what) {
  const value = map.get(key);
  if (!value) throw new Error(`Unknown ${what}: ${key}`);
  return value;
}

export const getFacility = (facilityId) => required(index.facilityById, facilityId, 'facility');
export const getHall = (hallId) => required(index.hallById, hallId, 'hall');
export const getRow = (facilityId, rowId) => required(index.rowByKey, rowKey(facilityId, rowId), 'row');
export const getRack = (rackId) => required(index.rackById, rackId, 'rack');
export const getComponent = (componentId) => required(index.componentById, componentId, 'component');

// 04_components details MUM-1 only, but alerts and incidents at other sites
// name components in the same TYPE-IDENTIFIER scheme, so the type is read
// from the id prefix. Longest prefixes first.
const TYPE_PREFIXES = [
  ['UTIL-FEED', 'utility_feed'], ['CHW-LOOP', 'chw_loop'], ['CHILLER', 'chiller'], ['BUSWAY', 'busway'],
  ['SWGR', 'switchgear'], ['CRAH', 'crah'], ['UPS', 'ups'], ['RPP', 'rpp'], ['PDU', 'pdu'],
  ['GEN', 'generator'], ['ROW', 'rack_row'], ['TX', 'transformer'], ['CT', 'cooling_tower'],
];

export function componentTypeOf(componentId) {
  const hit = TYPE_PREFIXES.find(([prefix]) => componentId === prefix || componentId.startsWith(`${prefix}-`));
  return hit ? hit[1] : null;
}

export const rowsOf =(facilityId) => index.rowsByFacility.get(facilityId) ?? [];
export const racksOf = (facilityId) => index.racksByFacility.get(facilityId) ?? [];
export const racksInRow = (facilityId, rowId) => index.racksByRow.get(rowKey(facilityId, rowId)) ?? [];
export const componentsOf = (facilityId) => index.componentsByFacility.get(facilityId) ?? [];
