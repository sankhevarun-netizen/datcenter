// lib/nexus/risk-brief.js
//
// The predictive watchlist → facts → a short "before it breaks" brief,
// streamed through the number guard with a deterministic template behind it.
import { guardedNarrate, NUMBER_RULES } from './guarded-narrate.js';
import { getFacility } from './data.js';
import { fmtLakh, fmtNumber } from './format.js';
import { monthLabel, timeLabel } from './time.js';

export const RISK_SYSTEM_PROMPT = `You are the head of datacenter operations writing the morning risk note. You are given risks the platform has already detected and costed.

${NUMBER_RULES}

Write one paragraph, under 140 words, plain text — no markdown, no lists. Lead with the risk most likely to cause an outage that has not alarmed yet. Explain why it matters in one sentence. Then cover the efficiency drift and its cost. Close with the single action to take this week.`;

const day = (d) => timeLabel(d);

function describe(r) {
  const site = getFacility(r.facilityId).name;
  if (r.kind === 'capacity-trend') {
    return {
      risk: `${site} utilisation is rising ${r.trend.slopePerMonth} points a month`,
      projection: `reaches ${r.trend.threshold}% in ${monthLabel(r.trend.projectedBreachMonth)}, ${r.trend.interventionWindowWeeks} weeks away`,
      evidence: r.evidence.map((e) => e.text),
    };
  }
  if (r.kind === 'efficiency-drift') {
    const t = r.drift.trend;
    return {
      risk: `${r.drift.measure.toUpperCase()} at ${site} has run above the same month last year since ${monthLabel(r.drift.from)}`,
      trend: `rising ${t.slopePerMonth} a month after seasonality (${t.confidence} confidence, fit ${t.r2})`,
      ...(t.projectedBreachMonth ? { projectedBreach: `projected to cross ${t.threshold} (${t.thresholdBasis}) in ${monthLabel(t.projectedBreachMonth)}, ${t.interventionWindowWeeks} weeks away` } : {}),
      peak: `${r.signal}`,
      costSoFar: `${fmtLakh(r.cost.extraCostInrLakh)} of extra energy (${fmtNumber(r.cost.extraKwh)} kWh, ${fmtNumber(r.cost.extraTco2, 1)} tCO2) since ${monthLabel(r.drift.from)}`,
      annualRunRate: `${fmtLakh(r.cost.annualRunRateInrLakh)} a year if it continues`,
      relatedEvidence: r.evidence.slice(1).map((e) => e.text),
    };
  }
  return {
    risk: `${r.componentId} at ${site} shows ${(r.failureMode ?? 'an open maintenance advisory').toLowerCase()}`,
    finding: r.signal,
    advisoryDate: day(r.since),
    alarmed: r.alert ? `yes — ${r.alert.alertId}, ${r.alert.leadDays} days after the advisory` : 'not yet',
    ...(r.pattern.length ? { samePatternBefore: `${r.pattern.length} recorded incidents (${r.pattern.map((p) => `${p.incidentId} at ${p.facilityId}`).join(', ')})` } : {}),
    ...(r.commonModeWith.length ? { commonMode: `its redundant peer ${r.commonModeWith.join(', ')} carries the same advisory, so the redundancy that would cover it shares the fault` } : {}),
    ...(r.cost?.scheduledInrLakh != null ? { scheduledVersusEmergency: `${fmtLakh(r.cost.scheduledInrLakh)} scheduled against ${fmtLakh(r.cost.emergencyInrLakh)} median emergency response` } : {}),
    ...(r.exposure ? { downstream: `${r.exposure.racks} racks, ${r.exposure.tenants} tenants` } : {}),
    actBy: day(r.actBy),
  };
}

export function buildRiskFacts(watchlist) {
  const outage = watchlist.filter((r) => r.kind === 'component' && r.impact === 'outage');
  const silent = outage.filter((r) => !r.alert);
  const drift = watchlist.filter((r) => r.kind === 'efficiency-drift');
  const capacity = watchlist.filter((r) => r.kind === 'capacity-trend');
  return {
    risksWatched: `${watchlist.length}`,
    outageRisksNotYetAlarming: `${silent.length}`,
    leadingRisk: watchlist[0] ? describe(watchlist[0]) : null,
    otherOutageRisks: outage.filter((r) => r !== watchlist[0]).map((r) => describe(r)),
    efficiencyDrift: drift.map((r) => describe(r)),
    capacityTrends: capacity.map((r) => describe(r)),
  };
}

export function riskTemplate(f) {
  const lead = f.leadingRisk;
  if (!lead) return 'No risk is building ahead of an alarm in the current data.';
  const parts = [];
  parts.push(`${lead.risk}${lead.advisoryDate ? ` (maintenance advisory, ${lead.advisoryDate})` : ''}${lead.alarmed === 'not yet' ? ' and has not alarmed yet' : ''}.`);
  if (lead.commonMode) parts.push(`It matters because ${lead.commonMode}.`);
  if (lead.samePatternBefore) parts.push(`The same failure mode is behind ${lead.samePatternBefore}.`);
  if (lead.scheduledVersusEmergency) parts.push(`Acting now costs ${lead.scheduledVersusEmergency}.`);
  const alarmed = f.otherOutageRisks.find((r) => r.alarmed !== 'not yet');
  if (alarmed) parts.push(`${alarmed.risk.split(' shows ')[0]} showed the same signs and alarmed ${alarmed.alarmed.split(', ')[1]}.`);
  for (const d of f.efficiencyDrift) parts.push(`${d.risk}, costing ${d.costSoFar} — ${d.annualRunRate}${d.projectedBreach ? `; it is ${d.projectedBreach}` : ''}.`);
  if (f.capacityTrends.length) parts.push(`Capacity: ${f.capacityTrends.map((c) => `${c.risk} and ${c.projection}`).join('; ')}.`);
  if (lead.actBy) parts.push(`This week: schedule the ${lead.risk.split(' at ')[0]} work before ${lead.actBy}.`);
  return parts.join(' ');
}

export function narrateRisks(watchlist, { onText, offline = false, signal } = {}) {
  const facts = buildRiskFacts(watchlist);
  return guardedNarrate({
    systemPrompt: RISK_SYSTEM_PROMPT,
    facts,
    template: riskTemplate(facts),
    instruction: 'Write the risk note.',
    maxTokens: 360,
    onText,
    offline,
    signal,
    label: 'risk-brief',
    knowledgeQuery: 'predictive maintenance equipment degradation cooling efficiency drift',
  });
}
