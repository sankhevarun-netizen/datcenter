// lib/nexus/site-risk-brief.js — site risk → facts → a guarded brief.
import { guardedNarrate, NUMBER_RULES } from './guarded-narrate.js';
import { getFacility } from './data.js';
import { equipmentLabel } from './site-risk-engine.js';
import { fmtNumber } from './format.js';

export const SITE_RISK_SYSTEM_PROMPT = `You are the chief risk officer of a datacenter operator, briefing the board on site and supply risk. You are given scores and facts the platform has already computed.

${NUMBER_RULES}

Write one paragraph, under 140 words, plain text. Lead with the highest-risk site and what drives it. Then the grid constraint that blocks growth, then the supply-chain dependency that would slow a recovery. Close with one decision for the board.`;

const PART = { grid: 'grid', hazard: 'natural hazard', water: 'water stress' };

export function buildSiteRiskFacts(p) {
  const top = p.sites[0];
  const constrained = p.grid.filter((g) => p.totals.gridConstrained.includes(g.id)).sort((a, b) => b.utilisedPct - a.utilisedPct);
  const queued = p.totals.queued[0];
  const worstSupply = p.supply.filter((s) => s.singleSource && s.imported);
  return {
    highestRisk: {
      site: top.name,
      score: `${top.composite} of 100 (${top.band})`,
      driver: `${PART[top.driver]} (${top[top.driver].score} of 100)`,
      grid: top.grid.evidence,
      hazard: `seismic zone ${top.hazard.seismicZone}, worst exposure ${top.hazard.worst} at ${top.hazard.levels[top.hazard.worst]} of 5; ${top.hazard.evidence}`,
    },
    ranking: p.sites.map((s) => `${s.name}: ${s.composite} (${s.band}, driven by ${PART[s.driver]})`),
    gridConstrained: constrained.map((g) => `${g.name}: ${g.utilisedPct}% of sanctioned load drawn, ${fmtNumber(g.headroomKw)} kW headroom (${g.utility})`),
    ...(queued ? { interconnection: `${getFacility(queued.id).name} is at position ${queued.position} in the interconnection queue; energisation ${queued.energisation}` } : {}),
    singleSourceImports: worstSupply.map((s) => `${equipmentLabel(s.type)}: ${s.vendor}, ${s.origin}, ${s.leadWeeks} weeks, ${s.sparesOnSite === 0 ? 'no spares held' : `${s.sparesOnSite} spare held`}`),
  };
}

export function siteRiskTemplate(f) {
  const parts = [
    `${f.highestRisk.site} carries the highest site risk at ${f.highestRisk.score}, driven by ${f.highestRisk.driver}: ${f.highestRisk.grid.split('; ')[0]}.`,
    `Growth is grid-bound at ${f.gridConstrained.map((g) => g.split(':')[0]).join(' and ')}${f.interconnection ? `, and ${f.interconnection}` : ''}.`,
    `Recovery from a major plant failure depends on single-source imports: ${f.singleSourceImports.slice(0, 2).join('; ')}.`,
    `Decision for the board: fund the ${f.gridConstrained[0]?.split(':')[0] ?? f.highestRisk.site} load enhancement and pre-position a spare ${f.singleSourceImports[0]?.split(':')[0].toLowerCase() ?? 'critical unit'}.`,
  ];
  return parts.join(' ');
}

export function narrateSiteRisk(p, { onText, offline = false, signal } = {}) {
  const facts = buildSiteRiskFacts(p);
  return guardedNarrate({
    systemPrompt: SITE_RISK_SYSTEM_PROMPT, facts, template: siteRiskTemplate(facts),
    instruction: 'Write the risk brief.', maxTokens: 340, onText, offline, signal, label: 'site-risk-brief',
    knowledgeQuery: 'grid power connection access moat site risk water stress India data centre',
  });
}
