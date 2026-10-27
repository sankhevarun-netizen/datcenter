// lib/nexus/local-copilot.js
//
// A grounded fallback for the copilot when no model key is configured.
// Matches a question's intent and formats an answer straight from the same
// engines the dashboards use — no invented facts, no model call. Covers the
// panel's four suggested questions plus close variants; anything else gets an
// honest "not matched" reply pointing at the right screen.
import { nexus, getFacility } from './data.js';
import { portfolioSummary, facilitySummary } from './portfolio.js';
import { incidentQueue, analyseIncident } from './incident-engine.js';
import { tenantSla } from './command-center.js';
import { fmtLakh, fmtNumber } from './format.js';
import { ageLabel } from './command-center.js';

function findFacility(text) {
  const t = text.toLowerCase();
  return nexus.facilities.find((f) =>
    t.includes(f.facility_id.toLowerCase()) ||
    t.includes(f.name.toLowerCase()) ||
    t.includes(f.city.toLowerCase())
  );
}

function facilityRiskAnswer(facilityId) {
  const f = facilitySummary(facilityId);
  if (!f.operational) {
    return `${f.name} is still under construction. Grid connection: ${f.grid?.connectionStatus ?? 'pending'}${f.grid?.queuePosition ? `, queue position ${f.grid.queuePosition}` : ''}.`;
  }
  const lines = [];
  lines.push(`${f.name} (${f.id}) has status ${f.health}${f.alerts.length ? ` with ${f.alerts.length} open alert${f.alerts.length === 1 ? '' : 's'}` : ', no open alerts'}.`);

  if (f.alerts.length) {
    lines.push('');
    lines.push('Open alerts, most severe first:');
    for (const a of f.alerts.slice(0, 5)) {
      const x = analyseIncident({ alertId: a.alert_id });
      const exposure = x.who.totalExposureInrLakh ? ` Exposure if the chain drops: ${fmtLakh(x.who.totalExposureInrLakh)} across ${x.who.tenants.length} tenant${x.who.tenants.length === 1 ? '' : 's'}.` : '';
      const pattern = x.why.pattern.length ? ` Same failure mode as ${x.why.pattern.map((i) => i.incidentId).join(', ')}.` : '';
      lines.push(`- ${a.alert_id} [${a.severity}] ${a.component_id}: ${a.message}.${pattern}${exposure}`);
    }
  }

  lines.push('');
  lines.push(`Grid headroom: ${fmtNumber(f.grid?.headroomKw ?? 0)} kW remaining (${f.grid?.utilisedPct ?? '—'}% of sanctioned load from ${f.grid?.utility ?? 'the utility'}).`);
  lines.push(`Utilisation: ${fmtNumber(f.usedKw)} of ${fmtNumber(f.designKw)} kW (${f.utilisationPct}%), ${f.tenants} tenants.`);
  return lines.join('\n');
}

function tenantSlaAnswer() {
  const rows = tenantSla().filter((t) => t.exposureInrLakh > 0).slice(0, 5);
  if (!rows.length) {
    return 'No tenant currently carries priced SLA exposure — every open alert is either non-outage or under the penalty threshold.';
  }
  const lines = ['Tenants with the most SLA exposure right now:'];
  for (const t of rows) {
    lines.push(`- ${t.name} at ${t.facilityId} (${t.workload}): ${fmtLakh(t.exposureInrLakh)} exposure, penalty triggers past ${t.thresholdHours}h downtime, via ${t.worstAlert}.`);
  }
  return lines.join('\n');
}

function alertsSummaryAnswer() {
  const queue = incidentQueue();
  if (!queue.length) return 'No open alerts across the portfolio right now.';
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const a of queue) bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  const lines = [
    `${queue.length} open alert${queue.length === 1 ? '' : 's'} across the portfolio: ${Object.entries(bySeverity).filter(([, n]) => n).map(([s, n]) => `${n} ${s}`).join(', ')}.`,
    '',
  ];
  for (const a of queue.slice(0, 6)) {
    lines.push(`- [${a.severity}] ${a.facility_id} ${a.component_id}: ${a.message} (${ageLabel(a.raised_at)})`);
  }
  return lines.join('\n');
}

function topActionsAnswer() {
  const queue = incidentQueue();
  const top = queue.slice(0, 3);
  if (!top.length) return 'No open alerts require action today.';
  const lines = ['Top actions today, most severe first:'];
  for (const a of top) {
    const x = analyseIncident({ alertId: a.alert_id });
    const step = x.do.steps[0];
    lines.push(`${lines.length}. ${a.facility_id} ${a.component_id} [${a.severity}]: ${step ? step.action : 'Review and triage'}${step?.owner ? ` — owner ${step.owner}` : ''}.`);
  }
  return lines.join('\n');
}

function portfolioAnswer() {
  const p = portfolioSummary();
  const t = p.totals;
  return [
    `Portfolio: ${t.facilities} facilities (${t.operational} operating), ${fmtNumber(t.designKw / 1000, 1)} MW design load, ${t.utilisationPct}% utilised.`,
    `PUE ${t.pue}, renewable share ${t.renewablePct}%, availability ${t.availability12mPct}% over 12 months.`,
    `${t.alerts} open alerts, ${t.incidents12m} incidents in the last 12 months, grid headroom ${fmtNumber(t.gridHeadroomKw)} kW.`,
  ].join('\n');
}

/**
 * Always returns a grounded answer string built from the real dataset —
 * never a blank or "I don't know" dead end. Matches the question's intent
 * where it can; otherwise falls back to the portfolio-wide picture plus a
 * nudge toward what it does know, so every question gets something useful.
 */
export function localCopilotAnswer(question) {
  const q = (question ?? '').toLowerCase();

  const facility = findFacility(q);
  if (facility) {
    // Named a specific facility — give its full risk picture regardless of
    // the rest of the question's phrasing.
    return facilityRiskAnswer(facility.facility_id);
  }

  if (/tenant.*(sla|exposure|penalty)|sla.*exposure|most.*exposure/.test(q)) {
    return tenantSlaAnswer();
  }

  if (/summar(y|ize|ise).*alert|open alert|all alert/.test(q)) {
    return alertsSummaryAnswer();
  }

  if (/top.*action|what should i do|priorit|next step/.test(q)) {
    return topActionsAnswer();
  }

  if (/incident|alert/.test(q)) {
    return alertsSummaryAnswer();
  }

  if (/sla|tenant|contract|penalty/.test(q)) {
    return tenantSlaAnswer();
  }

  // Unmatched phrasing: lead with the portfolio picture, then point at the
  // specific things this copilot can answer well.
  return [
    portfolioAnswer(),
    '',
    "Ask me about a specific facility (e.g. \"Nexus Mumbai-1\"), tenant SLA exposure, open alerts, or today's top actions for more detail.",
  ].join('\n');
}
