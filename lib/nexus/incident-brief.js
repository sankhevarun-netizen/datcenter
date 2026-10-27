// lib/nexus/incident-brief.js
//
// Incident analysis → facts → a four-part brief (what, why, who, do). The
// facts are display-ready strings built from analyseIncident(); the narrator
// may only restate them, and the template says the same thing deterministically.
import { guardedNarrate, NUMBER_RULES } from './guarded-narrate.js';
import { fmtKw, fmtLakh, fmtDuration } from './format.js';
import { timeLabel } from './time.js';

export const IMPACT_LABEL = {
  outage: 'Outage risk',
  capacity: 'Capacity constraint',
  compliance: 'Compliance breach',
  efficiency: 'Efficiency loss',
};

export const INCIDENT_SYSTEM_PROMPT = `You are the duty operations lead at a datacenter operator, briefing the incident bridge. You are given facts the platform has already computed.

${NUMBER_RULES}

Write four short paragraphs, each starting with its label and a colon: "What happened:", "Why:", "Who is exposed:", "What to do:". Plain text, no markdown, no bullet points. Under 170 words in total.
Lead with the facility and component. Name the root-cause pattern and where else it has occurred. State whether redundancy holds. Close with the first action and its owner.`;

const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const within = (min) => (min >= 1440 ? `${fmtDuration(min).replace(/ 0 minutes/, '')}` : fmtDuration(min));

export function buildIncidentFacts(a) {
  const facts = {
    event: `${a.componentId} at ${a.facilityName}: ${a.what.headline}`,
    raised: timeLabel(a.detectedAt),
    classification: IMPACT_LABEL[a.impact],
    status: `${a.status}${a.owner ? `, owned by ${a.owner}` : ''}`,
  };
  if (a.what.rating) {
    facts.componentRating = `${a.what.rating.capacity} ${a.what.rating.unit} rated, carrying ${a.what.rating.load} ${a.what.rating.unit} (${a.what.rating.utilisationPct}%), ${a.what.rating.redundancy} redundancy`;
  }
  if (a.why.failureMode) facts.failureMode = a.why.failureMode;
  if (a.why.pattern.length) {
    const key = a.why.rootCause?.split(' - ')[0];
    facts.rootCausePattern = `${key}: ${a.why.pattern.length} recorded ${a.why.pattern.length === 1 ? 'incident' : 'incidents'} across ${list(a.why.sites)} (${list(a.why.pattern.map((p) => p.incidentId))})`;
  }
  if (a.why.probableCause) facts.probableCause = `${a.why.probableCause.cause} (${a.why.probableCause.confidence} confidence: ${a.why.probableCause.basis})`;
  if (a.what.replay?.leadMinutes) {
    facts.earlierWarning = `In ${a.what.replay.incidentId} the telemetry signal preceded operator detection by ${fmtDuration(a.what.replay.leadMinutes)}`;
  }
  if (a.why.findings.length) facts.maintenanceFinding = `${a.why.findings[0].date}: ${a.why.findings[0].findings}`;

  if (a.who.protection) facts.redundancy = a.who.protection.detail;
  if (a.who.mapped) facts.exposedLoad = `${a.who.racks} racks, ${fmtKw(a.who.itKw)} of IT load`;
  else if (a.who.scope === 'site') facts.exposedLoad = 'Site-wide plant: every tenant at the facility depends on it';
  else facts.exposedLoad = 'Rack-level mapping for this site is not on file';

  if (a.who.recorded) {
    facts.recordedOutcome = `${a.who.recorded.tenantsAffected} ${a.who.recorded.tenantsAffected === 1 ? 'tenant' : 'tenants'} affected over ${fmtDuration(a.who.recorded.durationMin)}; recorded cost ${fmtLakh(a.who.recorded.costInrLakh)}`;
  } else if (a.who.totalExposureInrLakh !== null && a.who.tenants.length) {
    facts.outageAssumption = `${fmtDuration(a.who.outage.minutes)} (${a.who.outage.basis.toLowerCase()})`;
    facts.tenantExposure = a.who.tenants.map((t) => `${t.name}: ${!t.contract ? 'no contract on file' : t.exposureInrLakh > 0 ? `${fmtLakh(t.exposureInrLakh)} penalty, past its ${t.contract.thresholdHours}-hour threshold` : `no penalty, under its ${t.contract.thresholdHours}-hour threshold`}`);
    facts.totalContractualExposure = fmtLakh(a.who.totalExposureInrLakh);
    const clause = a.who.tenants.find((t) => t.contract)?.contract.notificationClause;
    if (clause) facts.notificationClause = `${clause}, if it becomes service-affecting`;
  }
  if (a.who.obligations.length) {
    facts.reportingObligations = a.who.obligations.map((o) => `${o.jurisdiction}, ${o.policy}: ${o.obligation}`);
  } else if (a.who.tenants.length && !facts.tenantExposure) {
    facts.tenantsAffected = a.who.tenants.map((t) => t.name);
  }

  if (a.do.steps.length) {
    const [first, ...rest] = a.do.steps;
    facts.firstAction = `${first.action} — ${first.owner}, within ${within(first.withinMin)}`;
    facts.nextActions = rest.map((s) => `${s.action} (${s.owner})`);
  }
  if (a.do.supply && (a.impact === 'outage' || a.impact === 'capacity')) {
    facts.partSupply = `${a.do.supply.leadTimeWeeks} weeks lead time from ${a.do.supply.vendor} (${a.do.supply.origin})${a.do.supply.singleSource ? ', single source' : ''}, ${a.do.supply.sparesOnSite === 0 ? 'no spares on site' : `${a.do.supply.sparesOnSite} on site`}`;
  }
  return facts;
}

export function incidentTemplate(a, f) {
  const what = `What happened: ${f.event}, raised ${f.raised}. ${f.classification}; ${f.status}.`;
  const whyParts = [
    f.failureMode ? `${f.failureMode}.` : '',
    f.rootCausePattern ? `This matches ${f.rootCausePattern}.` : 'No earlier incident in the record matches this pattern.',
    f.earlierWarning ? `${f.earlierWarning}.` : '',
    f.maintenanceFinding ? `Last finding, ${f.maintenanceFinding}` : '',
  ].filter(Boolean);
  let whoParts;
  if (f.reportingObligations) {
    whoParts = [`The breach is reportable: ${list(f.reportingObligations)}.`];
  } else {
    whoParts = [
      f.redundancy ?? '',
      `${f.exposedLoad}.`,
      f.recordedOutcome ? `${f.recordedOutcome}.`
        : f.totalContractualExposure ? `If the chain drops for ${f.outageAssumption}, contractual exposure is ${f.totalContractualExposure}, led by ${f.tenantExposure[0]}.`
          : f.tenantsAffected ? `Tenants affected: ${list(f.tenantsAffected)}.` : '',
    ].filter(Boolean);
  }
  const doParts = [
    f.firstAction ? `${f.firstAction}.` : 'No runbook is on file for this condition.',
    f.partSupply ? `Part supply: ${f.partSupply}.` : '',
  ].filter(Boolean);
  const whoLabel = a.kind === 'incident' ? 'Who was exposed' : 'Who is exposed';
  return [what, `Why: ${whyParts.join(' ')}`, `${whoLabel}: ${whoParts.join(' ')}`, `What to do: ${doParts.join(' ')}`].join('\n\n');
}

export function narrateIncident(analysis, { onText, offline = false, signal } = {}) {
  const facts = buildIncidentFacts(analysis);
  return guardedNarrate({
    systemPrompt: INCIDENT_SYSTEM_PROMPT,
    facts,
    template: incidentTemplate(analysis, facts),
    instruction: 'Write the brief.',
    maxTokens: 420,
    onText,
    offline,
    signal,
    label: 'incident-brief',
    engagement: analysis.facilityId,
    knowledgeQuery: `${analysis.why?.rootCause ?? analysis.what?.headline ?? ''} failure recovery`,
  });
}
