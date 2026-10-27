// lib/nexus/water-brief.js — water picture → facts → a guarded brief.
import { guardedNarrate, NUMBER_RULES } from './guarded-narrate.js';
import { getFacility } from './data.js';
import { fmtNumber } from './format.js';
import { monthLabel, timeLabel } from './time.js';

const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);

export const WATER_SYSTEM_PROMPT = `You are the sustainability lead at a datacenter operator, briefing the board on water. You are given figures the platform has already computed.

${NUMBER_RULES}

Write one paragraph, under 130 words, plain text. Lead with where water risk is concentrated. Name the worst site and why. Name the best practice in the portfolio. Close with the regulatory deadline and the one action it requires.`;

export function buildWaterFacts(p) {
  const live = p.sites.filter((s) => s.ytd);
  const worst = [...live].sort((a, b) => b.latest.wue - a.latest.wue)[0];
  const best = [...live].sort((a, b) => b.ytd.treatedSharePct - a.ytd.treatedSharePct)[0];
  const t = p.totals;
  const facts = {
    portfolioWue: `${t.wue} litres per IT kWh in ${monthLabel(p.month)}`,
    waterDrawn: `${fmtNumber(t.totalMl, 1)} megalitres from ${monthLabel(t.ytdFrom)} to ${monthLabel(t.ytdTo)}, ${fmtNumber(t.freshMl, 1)} megalitres of it fresh`,
    extremeStress: `${t.extremeStressSites.map((id) => getFacility(id).name).join(' and ')} sit in extremely high water-stress basins and draw ${t.extremeStressFreshSharePct}% of the portfolio's freshwater`,
    worstSite: {
      site: worst.name,
      wue: `${worst.latest.wue} litres per IT kWh in ${monthLabel(worst.latest.month)}, ${worst.benchmark.rank} against ${worst.benchmark.cohort} peers`,
      stress: `${lowerFirst(worst.stress.label)} basin stress (index ${worst.stress.index})`,
      treatedShare: `${worst.ytd.treatedSharePct}% treated water`,
      openAlerts: worst.alerts.map((a) => `${a.alertId}: ${a.message}`),
    },
    bestPractice: `${best.name} uses ${best.ytd.treatedSharePct}% treated water and runs at ${best.latest.wue} litres per IT kWh (${best.benchmark.rank})`,
    peakDemand: live.map((s) => `${s.name}: ${s.peak.lpm} LPM peak in ${monthLabel(s.peak.month)}`),
  };
  const starting = t.obligationsStarting[0];
  if (starting) {
    const site = p.sites.find((s) => s.id === starting.facilityId);
    facts.upcomingObligation = `${starting.jurisdiction} ${starting.policy} takes effect on ${timeLabel(starting.effectiveFrom)}, in ${starting.startsInDays} days, for ${site.name}: ${lowerFirst(starting.obligation)}; ${lowerFirst(starting.detail)}`;
    facts.upcomingSiteDesign = `${site.name} is designed for ${site.targetWue} litres per IT kWh (${site.benchmark.rank} against ${site.benchmark.cohort} peers)`;
  }
  return facts;
}

export function waterTemplate(f) {
  const parts = [
    `Water risk is concentrated where supply is scarcest: ${f.extremeStress}.`,
    `${f.worstSite.site} is the weakest at ${f.worstSite.wue}, in ${f.worstSite.stress}, with only ${f.worstSite.treatedShare}${f.worstSite.openAlerts.length ? ` and ${f.worstSite.openAlerts.length} open water alerts` : ''}.`,
    `${f.bestPractice}, the model to copy.`,
  ];
  if (f.upcomingObligation) parts.push(`${f.upcomingObligation}. ${f.upcomingSiteDesign}; plant-wise metering must be live from energisation.`);
  return parts.join(' ');
}

export function narrateWater(p, { onText, offline = false, signal } = {}) {
  const facts = buildWaterFacts(p);
  return guardedNarrate({
    systemPrompt: WATER_SYSTEM_PROMPT, facts, template: waterTemplate(facts),
    instruction: 'Write the water brief.', maxTokens: 320, onText, offline, signal, label: 'water-brief',
  });
}
