// lib/nexus/portfolio-brief.js
//
// The executive briefing for the portfolio view: the state of every site in
// one paragraph, from the same engines as the command centre.
import { guardedNarrate, NUMBER_RULES } from './guarded-narrate.js';
import { portfolioSummary } from './portfolio.js';
import { riskWatchlist } from './predictive-engine.js';
import { portfolioSiteRisk } from './site-risk-engine.js';
import { portfolioWater } from './water-engine.js';
import { fmtLakh, fmtUpTo } from './format.js';
import { monthLabel, timeLabel } from './time.js';

export const PORTFOLIO_SYSTEM_PROMPT = `You are the chief operating officer of a datacenter operator, writing the weekly executive briefing for the board. You are given figures the platform has already computed.

${NUMBER_RULES}

Write one paragraph, under 160 words, plain text. Open with the portfolio's scale and efficiency. Then the most urgent site, the outage risk that has not alarmed yet, the efficiency drift and its cost, water exposure, and the site under construction. Close with the two decisions that matter most this week.`;

export function buildPortfolioFacts() {
  const p = portfolioSummary();
  const t = p.totals;
  const risks = riskWatchlist();
  const silent = risks.find((r) => r.kind === 'component' && r.impact === 'outage' && !r.alert);
  const drift = risks.find((r) => r.kind === 'efficiency-drift');
  const site = portfolioSiteRisk();
  const water = portfolioWater();
  const blr = p.facilities.find((f) => !f.operational);
  const facts = {
    asOf: timeLabel(p.asOf),
    scale: `${t.facilities} facilities, ${t.operational} operating; ${fmtUpTo(t.designKw / 1000, 1)} MW design IT capacity; ${fmtUpTo(t.itLoadKw / 1000, 1)} MW IT load in ${monthLabel(p.month)}`,
    efficiency: `portfolio PUE ${t.pue}, renewable share ${t.renewablePct}%, availability ${t.availability12mPct}% over 12 months`,
    mostUrgentSite: `${site.sites[0].name}: site risk ${site.sites[0].composite} of 100 (${site.sites[0].band}); ${site.sites[0].grid.evidence.split('; ')[0]}`,
    openAlerts: `${t.alerts} open alerts, ${t.alertCounts.critical} critical and ${t.alertCounts.high} high`,
  };
  if (silent) facts.silentOutageRisk = `${silent.componentId} at ${silent.facilityId}: ${silent.failureMode.toLowerCase()}, no alarm yet; its redundant peer ${silent.commonModeWith.join(', ')} shares the fault; act by ${timeLabel(silent.actBy)}`;
  if (drift) facts.efficiencyDrift = `${drift.facilityId} PUE above last year since ${monthLabel(drift.since)}: ${fmtLakh(drift.cost.extraCostInrLakh)} so far, ${fmtLakh(drift.cost.annualRunRateInrLakh)} a year if uncorrected`;
  facts.water = `${water.totals.extremeStressSites.join(' and ')} draw ${water.totals.extremeStressFreshSharePct}% of the portfolio's freshwater from extremely high stress basins`;
  if (blr) {
    const energisation = site.grid.find((g) => g.id === blr.id)?.energisation;
    facts.underConstruction = `${blr.name}: ${fmtUpTo(blr.designKw / 1000, 1)} MW design, interconnection queue position ${blr.grid.queuePosition}${energisation ? `, estimated energisation ${energisation}` : ''}`;
  }
  return facts;
}

export function portfolioTemplate(f) {
  const parts = [
    `As of ${f.asOf}: ${f.scale}, at ${f.efficiency}.`,
    `Most urgent is ${f.mostUrgentSite}; there are ${f.openAlerts}.`,
  ];
  if (f.silentOutageRisk) parts.push(`The outage risk that has not alarmed yet is ${f.silentOutageRisk}.`);
  if (f.efficiencyDrift) parts.push(`Efficiency: ${f.efficiencyDrift}.`);
  parts.push(`Water: ${f.water}.`);
  if (f.underConstruction) parts.push(`Pipeline: ${f.underConstruction}.`);
  parts.push(`Decisions this week: approve the ${f.silentOutageRisk ? f.silentOutageRisk.split(' at ')[0] : 'priority'} replacement, and file the ${f.mostUrgentSite.split(':')[0]} grid load enhancement.`);
  return parts.join(' ');
}

export function narratePortfolio({ onText, offline = false, signal } = {}) {
  const facts = buildPortfolioFacts();
  return guardedNarrate({
    systemPrompt: PORTFOLIO_SYSTEM_PROMPT, facts, template: portfolioTemplate(facts),
    instruction: 'Write the briefing.', maxTokens: 420, onText, offline, signal, label: 'portfolio-brief',
  });
}
