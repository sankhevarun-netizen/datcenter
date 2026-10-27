// lib/nexus/pattern-graph.js
//
// Pattern memory across facilities: a graph built from the dataset that links
// every recorded incident, open alert and open maintenance advisory to the
// failure mode it shares (23_runbooks), the site it happened at, and the
// vendor behind the equipment (25_supply_chain). Deterministic — rebuilt from
// the workbook, never learned or stored elsewhere.
import { nexus, index, componentTypeOf } from './data.js';
import { runbookFor } from './incident-engine.js';
import { equipmentLabel } from './site-risk-engine.js';

export const PATTERN_CATEGORIES = [
  { id: 'facility', label: 'Site', color: '#005EB8' },
  { id: 'pattern', label: 'Failure pattern', color: '#B42318' },
  { id: 'incident', label: 'Recorded incident', color: '#C2410C' },
  { id: 'alert', label: 'Open alert', color: '#E87722' },
  { id: 'advisory', label: 'Maintenance advisory', color: '#7C3AED' },
  { id: 'vendor', label: 'Vendor', color: '#475569' },
];

const latestServiceByComponent = () => {
  const latest = new Map();
  for (const m of nexus.maintenance) {
    const key = `${m.facility_id}:${m.component_id}`;
    const prev = latest.get(key);
    if (!prev || m.service_date > prev.service_date) latest.set(key, m);
  }
  return [...latest.values()];
};

const plural = (n, word) => `${n} ${n === 1 ? word : word === 'advisory' ? 'advisories' : `${word}s`}`;

const facilityName = (id) => index.facilityById.get(id)?.name ?? `${id} (peer site)`;

/** Every piece of evidence, tagged with the runbook (failure pattern) it matches. */
function evidence() {
  const items = [];
  for (const i of nexus.incidents) {
    const rb = runbookFor(i.component_id, `${i.root_cause} ${i.description}`)[0];
    items.push({ kind: 'incident', id: i.incident_id, facilityId: i.facility_id, componentId: i.component_id, runbook: rb, date: i.detected_at.slice(0, 10), text: i.description, detail: i.root_cause, durationMin: i.duration_min });
  }
  for (const a of nexus.activeAlerts.filter((x) => x.status !== 'resolved')) {
    const rb = runbookFor(a.component_id, `${a.message} ${a.note ?? ''}`)[0];
    items.push({ kind: 'alert', id: a.alert_id, facilityId: a.facility_id, componentId: a.component_id, runbook: rb, date: a.raised_at.slice(0, 10), text: a.message, detail: a.note, severity: a.severity });
  }
  for (const m of latestServiceByComponent().filter((x) => x.outcome !== 'Passed')) {
    const rb = runbookFor(m.component_id, m.findings)[0];
    items.push({ kind: 'advisory', id: m.maintenance_id, facilityId: m.facility_id, componentId: m.component_id, runbook: rb, date: m.service_date, text: m.findings, detail: m.outcome });
  }
  return items.filter((x) => x.runbook);
}

export function buildPatternGraph() {
  const items = evidence();
  const nodes = new Map();
  const edges = [];
  const add = (node) => { if (!nodes.has(node.id)) nodes.set(node.id, node); return node.id; };
  const link = (source, target, relation) => edges.push({ source, target, relation });

  const byPattern = new Map();
  for (const it of items) {
    if (!byPattern.has(it.runbook.runbook_id)) byPattern.set(it.runbook.runbook_id, []);
    byPattern.get(it.runbook.runbook_id).push(it);
  }

  for (const [rbId, group] of byPattern) {
    const rb = group[0].runbook;
    const sites = [...new Set(group.map((g) => g.facilityId))];
    const counts = ['incident', 'alert', 'advisory'].map((k) => [k, group.filter((g) => g.kind === k).length]);
    const patternId = add({
      id: `pattern:${rbId}`, label: `${equipmentLabel(rb.component_type)} · ${rb.failure_mode}`, category: 'pattern',
      size: 8 + 2 * group.length, kind: 'pattern', runbookId: rbId, impact: rb.impact,
      description: `${rb.failure_mode} (${equipmentLabel(rb.component_type)}): ${counts.filter(([, n]) => n).map(([k, n]) => plural(n, k)).join(', ')} across ${plural(sites.length, 'site')}.`,
    });
    const supply = index.supplyByComponentType.get(rb.component_type);
    if (supply) {
      const vendorId = add({ id: `vendor:${supply.vendor}`, label: supply.vendor, category: 'vendor', size: 8, kind: 'vendor', description: `${supply.vendor}, ${supply.origin_country}. Supplies ${equipmentLabel(supply.component_type)} equipment; ${supply.lead_time_weeks} weeks lead time${supply.single_source === 'yes' ? ', single source' : ''}.` });
      link(patternId, vendorId, 'supplied by');
    }
    for (const it of group) {
      const siteId = add({ id: `facility:${it.facilityId}`, label: it.facilityId, category: 'facility', size: 12, kind: 'facility', facilityId: it.facilityId, description: facilityName(it.facilityId) });
      const nodeId = add({
        id: `${it.kind}:${it.id}`, label: it.kind === 'advisory' ? `${it.componentId} advisory` : it.id, category: it.kind, size: it.kind === 'incident' ? 7 : 6,
        kind: it.kind, ref: it.id, facilityId: it.facilityId, componentId: it.componentId,
        description: `${it.componentId} at ${facilityName(it.facilityId)}, ${it.date}: ${it.text}${it.detail ? ` (${it.detail})` : ''}`,
      });
      link(nodeId, patternId, 'matches pattern');
      link(nodeId, siteId, 'at site');
    }
  }
  return { nodes: [...nodes.values()], edges };
}

/**
 * Where else this failure mode shows up, for a component and the text that
 * describes its condition (alert message, root cause or finding).
 */
export function similarPatterns({ facilityId, componentId, text, excludeId = null }) {
  const rb = runbookFor(componentId, text)[0];
  if (!rb) return null;
  const all = evidence().filter((e) => e.runbook.runbook_id === rb.runbook_id && e.id !== excludeId);
  const others = all.filter((e) => !(e.facilityId === facilityId && e.componentId === componentId));
  return {
    runbookId: rb.runbook_id,
    failureMode: rb.failure_mode,
    componentType: componentTypeOf(componentId),
    sites: [...new Set(all.map((e) => e.facilityId))],
    incidents: all.filter((e) => e.kind === 'incident').map((e) => ({ id: e.id, facilityId: e.facilityId, componentId: e.componentId, date: e.date })),
    liveElsewhere: others.filter((e) => e.kind !== 'incident').map((e) => ({ kind: e.kind, id: e.id, facilityId: e.facilityId, componentId: e.componentId, date: e.date, text: e.text })),
  };
}
