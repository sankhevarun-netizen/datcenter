// lib/nexus/switchover-brief.js
//
// A planSwitchover() result -> facts -> a short narrated brief. The facts
// are display-ready strings built from the already-computed result; the
// narrator may only restate them, and the template says the same thing
// deterministically. Follows incident-brief.js's exact shape.
import { guardedNarrate, NUMBER_RULES } from './guarded-narrate.js';
import { fmtKw, fmtLakh, fmtDuration } from './format.js';
import { timeLabel } from './time.js';

export const SWITCHOVER_SYSTEM_PROMPT = `You are the duty operations lead at a datacenter operator, briefing a planned switchover before it is executed. You are given facts the platform has already computed.

${NUMBER_RULES}

Write three short paragraphs, each starting with its label and a colon: "Plan:", "Risk:", "Before you proceed:". Plain text, no markdown, no bullet points. Under 130 words in total.
Lead with the action and the asset. State the verdict and why. Close with the first thing to do and its owner.`;

export function buildSwitchoverFacts(result) {
  if (!result.mapped) {
    return { topology: `No component graph on file for ${result.input.facilityId} — this planner only covers facilities with a mapped graph.` };
  }
  const { input, verdict, impact, racks, tenants, totalExposureInrLakh, windows, runbook, peers } = result;

  const facts = {
    action: `${input.action === 'take_offline' ? 'Take offline' : 'Transfer load'}: ${input.label}${input.transferToId ? ` to ${input.transferToId}` : ''}, for ${fmtDuration(input.durationHours * 60)} starting ${timeLabel(input.windowStart)}`,
    verdict: verdict.level.replace(/_/g, ' '),
    reasons: verdict.reasons.map((r) => r.text),
  };
  facts.redundancy = peers.length ? `Recorded peer(s): ${peers.join(', ')}` : 'No recorded redundant peer on file for this asset.';
  if (impact.kind === 'crah') {
    facts.thermal = `Surviving CRAH would run at ${impact.utilisationAfterPct}% of rating${impact.riseC ? `, estimated inlet rise ${impact.riseC}°C` : ''}.`;
  }
  if (impact.breakingPoints.length) {
    facts.breakingPoints = impact.breakingPoints.map((b) => `${b.componentId}: ${b.newUtilisationPct}%`);
  }
  facts.exposedLoad = racks.count ? `${racks.count} racks, ${fmtKw(racks.itKw)} of IT load` : 'No racks downstream of this asset.';
  if (tenants.length) {
    facts.tenantExposure = tenants.map((t) => `${t.name}: ${t.exposureInrLakh > 0 ? `${fmtLakh(t.exposureInrLakh)} penalty` : 'no penalty'} (${t.racksAffected} racks)`);
    facts.totalExposure = fmtLakh(totalExposureInrLakh);
  }
  if (windows.recommended) {
    facts.recommendedWindow = `${windows.recommended.startLabel}, score ${windows.recommended.score}/100`;
  }
  if (runbook.steps.length) {
    const first = runbook.steps[0];
    facts.firstAction = `${first.action} — ${first.owner_team}, within ${fmtDuration(first.within_min)}`;
  }
  return facts;
}

export function switchoverTemplate(result, f) {
  if (!result.mapped) return f.topology;
  const plan = `Plan: ${f.action}. Verdict: ${f.verdict}.`;
  const riskParts = [f.reasons.join(' '), f.redundancy, f.thermal ?? '', f.exposedLoad + '.'];
  if (f.tenantExposure) riskParts.push(`Total contractual exposure: ${f.totalExposure}, led by ${f.tenantExposure[0]}.`);
  const beforeParts = [f.firstAction ? `${f.firstAction}.` : 'No procedure step is on file.'];
  if (f.recommendedWindow) beforeParts.push(`Safest window in the next 14 days: ${f.recommendedWindow}.`);
  return [plan, `Risk: ${riskParts.filter(Boolean).join(' ')}`, `Before you proceed: ${beforeParts.join(' ')}`].join('\n\n');
}

export function narrateSwitchover(result, { onText, offline = false, signal } = {}) {
  const facts = buildSwitchoverFacts(result);
  return guardedNarrate({
    systemPrompt: SWITCHOVER_SYSTEM_PROMPT,
    facts,
    template: switchoverTemplate(result, facts),
    instruction: 'Write the brief.',
    maxTokens: 360,
    onText,
    offline,
    signal,
    label: 'switchover-brief',
    engagement: result.input.facilityId,
    knowledgeQuery: result.mapped ? `${result.input.componentType} switchover planned maintenance` : null,
  });
}
