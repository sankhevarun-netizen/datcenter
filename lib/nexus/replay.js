// lib/nexus/replay.js
//
// Scene 4: a retrospective replay of an incident against its telemetry.
// The lead time is computed from two dataset timestamps — the first flagged
// telemetry reading and the incident's detected_at — never typed in.
import { index, nexus } from './data.js';
import { toMinutes } from './time.js';

// Dataset timestamps are 'YYYY-MM-DD HH:mm' in facility local time. Parsing
// them as UTC keeps arithmetic independent of the viewer's time zone.
export { toMinutes };

/** The scheduled-swap cost exists only in the 17_demo_script line for the replay scene. */
function scheduledCostLakh(incidentId) {
  const line = nexus.demoScript.find((s) => s.action?.includes(incidentId))?.['the line to say'];
  const m = line && /Rs\s*([\d.]+)\s*lakh scheduled/i.exec(line);
  return m ? Number(m[1]) : null;
}

export function buildReplay(incidentId) {
  const incident = index.incidentById.get(incidentId);
  if (!incident) throw new Error(`Unknown incident ${incidentId}`);
  const readings = (index.telemetryByComponent.get(incident.component_id) ?? [])
    .filter((t) => t.facility_id === incident.facility_id)
    .map((t) => ({ ...t, minute: toMinutes(t.timestamp) }))
    .sort((a, b) => a.minute - b.minute);

  const flagged = readings.find((t) => t.flag);
  const detectedMinute = toMinutes(incident.detected_at);
  const leadMinutes = flagged ? detectedMinute - flagged.minute : null;

  const patternIncidents = nexus.incidents
    .filter((i) => i.incident_id !== incidentId && i.root_cause && incident.root_cause && i.root_cause.split(' - ')[0] === incident.root_cause.split(' - ')[0])
    .map((i) => ({ incidentId: i.incident_id, componentId: i.component_id, detectedAt: i.detected_at, costInrLakh: i.cost_inr_lakh, description: i.description }));

  return {
    incident,
    readings,
    flaggedAt: flagged?.timestamp ?? null,
    flagNote: flagged?.flag ?? null,
    detectedAt: incident.detected_at,
    resolvedAt: incident.resolved_at,
    leadMinutes,
    emergencyCostInrLakh: incident.cost_inr_lakh,
    scheduledCostInrLakh: scheduledCostLakh(incidentId),
    patternIncidents,
  };
}
