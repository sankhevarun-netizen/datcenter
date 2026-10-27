// lib/nexus/zone-health.js — the facility's live status by zone, from the record.
//
// Feeds the Live Status panel beside the facility twin. Every figure comes
// from the dataset as of AS_OF. Zones the operating record does not cover
// (security operations, physical security) are reported as not monitored
// rather than filled in.
import { nexus, index } from './data.js';
import { AS_OF } from './time.js';

/** Racks in rows with less thermal margin than this count as hot. */
export const HOT_MARGIN_C = 3;

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : 0);
const SEVERITY_STATUS = { critical: 'critical', high: 'warning', medium: 'warning', low: 'operational' };
const RANK = { operational: 0, warning: 1, critical: 2 };

function zoneStatus(alerts) {
  return alerts.map((a) => SEVERITY_STATUS[a.severity] ?? 'operational')
    .reduce((worst, s) => (RANK[s] > RANK[worst] ? s : worst), 'operational');
}
const alertLine = (a) => `${a.alert_id} · ${a.component_id}: ${a.message}${a.status === 'acknowledged' ? ' (acknowledged)' : ''}`;

export function nexusZoneHealth(facilityId) {
  const comps = nexus.components.filter((c) => c.facility_id === facilityId);
  if (!comps.length) return null;
  const ofType = (t) => comps.filter((c) => c.component_type === t);
  const alerts = nexus.activeAlerts.filter((a) => a.facility_id === facilityId && a.status !== 'resolved');
  const alertsIn = (category) => alerts.filter((a) => a.category === category);
  const latest = (index.timeseriesByFacility.get(facilityId) ?? []).at(-1);
  const incidents = index.incidentsByFacility.get(facilityId) ?? [];
  const sensors = index.sensorsByFacility.get(facilityId) ?? [];
  const racks = index.racksByFacility.get(facilityId) ?? [];
  const rows = index.rowsByFacility.get(facilityId) ?? [];

  const ups = ofType('ups');
  const chillers = ofType('chiller');
  const loops = ofType('chw_loop');
  const crahs = ofType('crah');
  const powerAlerts = alertsIn('Power');
  const coolingAlerts = alertsIn('Cooling');
  const capacityAlerts = alertsIn('Capacity');

  const occupied = racks.filter((r) => r.status === 'occupied');
  const hotRows = new Set(rows.filter((r) => r.thermal_margin_c != null && r.thermal_margin_c < HOT_MARGIN_C).map((r) => r.row_id));
  const hotRacks = occupied.filter((r) => hotRows.has(r.row_id)).length;
  const inlet = sensors.map((s) => s.reading_c);
  const mttr = incidents.length ? Math.round(sum(incidents.map((i) => i.duration_min)) / incidents.length) : null;

  const upsLoad = pct(sum(ups.map((c) => c.current_load)), sum(ups.map((c) => c.derated_capacity)));
  // Chillers carry no load reading in the record; chilled-water loop flow does.
  const loopFlow = pct(sum(loops.map((c) => c.current_load)), sum(loops.map((c) => c.derated_capacity)));
  const rackUtil = pct(sum(occupied.map((r) => r.used_kw)), sum(occupied.map((r) => r.capacity_kw)));

  return {
    asOf: AS_OF,
    power: {
      status: zoneStatus(powerAlerts),
      metrics: [
        { label: 'UPS load (of derated)', value: `${upsLoad}%`, bar: upsLoad },
        { label: 'UPS modules', value: `${ups.length} · ${ups[0]?.redundancy ?? '—'}` },
        { label: 'Open power alerts', value: powerAlerts.length },
      ],
      alerts: powerAlerts.map(alertLine),
    },
    cooling: {
      status: zoneStatus(coolingAlerts),
      metrics: [
        { label: 'Chilled-water flow (of derated)', value: `${loopFlow}%`, bar: loopFlow },
        { label: 'Inlet temp, mean / max', value: inlet.length ? `${(sum(inlet) / inlet.length).toFixed(1)} / ${Math.max(...inlet).toFixed(1)} °C` : '—' },
        { label: `PUE (${latest?.month ?? '—'})`, value: latest ? latest.pue.toFixed(2) : '—' },
        { label: 'Chillers · CRAH units', value: `${chillers.length} · ${crahs.length}` },
      ],
      alerts: coolingAlerts.map(alertLine),
    },
    noc: {
      status: zoneStatus(alerts),
      metrics: [
        { label: 'Open alerts', value: alerts.length },
        { label: 'MTTR (recorded incidents)', value: mttr != null ? `${mttr} min` : 'No incidents' },
        { label: `Uptime (${latest?.month ?? '—'})`, value: latest ? `${latest.uptime_pct}%` : '—' },
        { label: 'Incidents on record', value: incidents.length },
      ],
      alerts: alerts.filter((a) => !['Power', 'Cooling', 'Capacity'].includes(a.category)).map(alertLine),
    },
    soc: { status: 'unmonitored', metrics: [], alerts: [], note: 'Security operations are not in the operating record.' },
    racks: {
      status: zoneStatus(capacityAlerts),
      metrics: [
        { label: 'Occupied', value: `${occupied.length} / ${racks.length}`, bar: pct(occupied.length, racks.length) },
        { label: 'Power used (occupied racks)', value: `${rackUtil}%`, bar: rackUtil },
        { label: `Hot racks (margin < ${HOT_MARGIN_C} °C)`, value: hotRacks },
      ],
      alerts: capacityAlerts.map(alertLine),
    },
    security: { status: 'unmonitored', metrics: [], alerts: [], note: 'Physical security is not in the operating record.' },
  };
}
