// lib/nexus/copilot-context.js
//
// The operating record the copilot answers from, rendered as plain text from
// the same engines the dashboards use — so a chat answer and a tile never
// disagree. Rebuilt per request; it is small (a few KB).
import { portfolioSummary } from './portfolio.js';
import { riskWatchlist } from './predictive-engine.js';
import { tenantSla } from './command-center.js';
import { benchmarkFacility } from './benchmark-engine.js';
import { analyseIncident, incidentQueue } from './incident-engine.js';
import { nexus } from './data.js';
import { timeLabel, monthLabel } from './time.js';
import { fmtLakh, fmtNumber, fmtUpTo } from './format.js';

export function copilotContext() {
  const p = portfolioSummary();
  const t = p.totals;
  const lines = [];
  lines.push(`OPERATOR: Nexus Data Infrastructure. Record as of ${timeLabel(p.asOf)}.`);
  lines.push(`PORTFOLIO: ${t.facilities} facilities (${t.operational} operating), ${fmtNumber(t.designKw / 1000, 1)} MW design IT load, ${fmtNumber(t.usedKw / 1000, 1)} MW in use (${t.utilisationPct}% of operating capacity). Portfolio PUE ${t.pue} (${monthLabel(p.month)}), renewable share ${t.renewablePct}%, availability ${t.availability12mPct}% over 12 months, ${t.incidents12m} incidents in 12 months, ${t.alerts} open alerts.`);

  lines.push('FACILITIES:');
  for (const f of p.facilities) {
    if (!f.operational) {
      lines.push(`- ${f.name} (${f.id}), ${f.city}, ${f.state}, ${f.tier}: under construction, ${fmtNumber(f.designKw / 1000, 1)} MW design; grid connection ${f.grid.connectionStatus.toLowerCase()}, queue position ${f.grid.queuePosition}. ${f.grid.note}`);
      continue;
    }
    lines.push(`- ${f.name} (${f.id}), ${f.city}, ${f.state}, ${f.tier}: status ${f.health}; ${fmtNumber(f.usedKw)} of ${fmtNumber(f.designKw)} kW used (${f.utilisationPct}%); PUE ${f.latest.pue} and WUE ${f.latest.wue} L/kWh in ${monthLabel(f.latest.month)}; renewable ${f.renewablePct}%; grid ${fmtNumber(f.grid.headroomKw)} kW headroom (${f.grid.utilisedPct}% of sanctioned, ${f.grid.utility}); ${f.alerts.length} open alerts; ${f.tenants} tenants.`);
  }

  lines.push('OPEN ALERTS (most severe first):');
  for (const a of incidentQueue()) {
    const x = analyseIncident({ alertId: a.alert_id });
    const exposure = x.who.totalExposureInrLakh !== null ? ` Exposure if the chain drops: ${fmtLakh(x.who.totalExposureInrLakh)} across ${x.who.tenants.length} tenants.` : '';
    const pattern = x.why.pattern.length ? ` Same failure mode as earlier incident${x.why.pattern.length === 1 ? '' : 's'} ${x.why.pattern.map((i) => i.incidentId).join(', ')} (root cause then: ${x.why.rootCause?.split(' - ')[0]}).` : '';
    lines.push(`- ${a.alert_id} [${a.severity}, ${a.status}, ${a.owner_team}] ${a.facility_id} ${a.component_id}: ${a.message}. ${x.why.failureMode}.${pattern}${x.who.protection ? ` ${x.who.protection.detail}` : ''}${exposure} First step: ${x.do.steps[0]?.action}.`);
  }

  lines.push('PREDICTIVE WATCHLIST:');
  for (const r of riskWatchlist()) {
    if (r.kind === 'efficiency-drift') lines.push(`- ${r.title}: since ${monthLabel(r.since)}, ${fmtLakh(r.cost.extraCostInrLakh)} extra energy so far, ${fmtLakh(r.cost.annualRunRateInrLakh)} a year if uncorrected; rising ${r.drift.trend.slopePerMonth} a month${r.drift.trend.projectedBreachMonth ? `, projected to cross ${r.drift.trend.threshold} in ${monthLabel(r.drift.trend.projectedBreachMonth)}` : ''}.`);
    else if (r.kind === 'capacity-trend') lines.push(`- ${r.title}: ${r.signal}; ${r.trend.interventionWindowWeeks} weeks away.`);
    else lines.push(`- ${r.title} (${r.facilityId}): ${r.signal}${r.commonModeWith.length ? ` Common-mode with ${r.commonModeWith.join(', ')}.` : ''} Act by ${timeLabel(r.actBy)}.`);
  }

  lines.push('TENANT CONTRACTS:');
  for (const c of tenantSla()) {
    lines.push(`- ${c.name} at ${c.facilityId} (${c.workload}, ${fmtNumber(c.contractedKw)} kW): SLA ${c.slaUptimePct}%, ${c.allowedDowntimeMinPerYear} min downtime allowed a year, penalty ${fmtLakh(c.penaltyInrLakh)} once an outage passes ${c.thresholdHours} hours${c.exposureInrLakh ? `, current exposure ${fmtLakh(c.exposureInrLakh)} via ${c.worstAlert}` : ''}.`);
  }

  lines.push('PEER BENCHMARKS (share of Indian peers beaten):');
  for (const f of nexus.facilities) {
    const scored = benchmarkFacility(f.facility_id).filter((m) => m.score !== null);
    lines.push(`- ${f.facility_id}: ${scored.map((m) => `${m.label} ${fmtUpTo(m.value, m.dp)}${m.unit ? ` ${m.unit}` : ''} (${m.rank})`).join('; ')}.`);
  }

  lines.push('SITE HAZARDS:');
  for (const s of nexus.siteRisk) {
    lines.push(`- ${s.facility_id}: seismic zone ${s.seismic_zone}, flood ${s.flood_exposure}/5, cyclone ${s.cyclone_exposure}/5, heat ${s.heat_exposure}/5. ${s.reference_event}.`);
  }
  return lines.join('\n');
}

export function copilotSystemPrompt() {
  return `You are the K-Nexus operations copilot for Nexus Data Infrastructure. Answer from the operating record below.

${copilotContext()}

Rules:
- Use only facts and figures that appear in the record. Never invent a facility, tenant, person, incident or number. Do not calculate new figures; quote the ones given.
- Keep every figure with the alert, risk or tenant it belongs to. Earlier incidents describe what happened then, not the current state.
- If the record does not cover a question, say it is not in the operating record and suggest where to look (incident brief, predictive risk, capacity simulation).
- Never mention how your answers are produced, and never name any software, model or assistant.
- Be specific and brief: name facilities, components, tenants and owners. Plain text, no markdown symbols.`;
}
