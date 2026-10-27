// lib/nexus/esg-brief.js — disclosure → facts → a guarded executive summary.
import { guardedNarrate, NUMBER_RULES } from './guarded-narrate.js';
import { fmtNumber, fmtUpTo } from './format.js';
import { monthLabel } from './time.js';

export const ESG_SYSTEM_PROMPT = `You are the head of sustainability reporting at a datacenter operator, writing the executive summary of a disclosure pack. You are given the disclosed figures.

${NUMBER_RULES}

Write one paragraph, under 110 words, plain text. State the period and scope, the headline energy and water figures, the efficiency ratios, and any item the pack cannot yet disclose and why.`;

export function buildEsgFacts(d) {
  const t = d.totals;
  const facts = {
    framework: d.framework.name,
    period: `${monthLabel(d.period.from)} to ${monthLabel(d.period.to)} (${d.period.months} months)`,
    scope: d.facilities.filter((f) => f.metered).map((f) => f.name),
    siteCount: (() => { const n = d.facilities.filter((f) => f.metered).length; return `${n} operating ${n === 1 ? 'site' : 'sites'}`; })(),
  };
  if (t) {
    Object.assign(facts, {
      energy: `${fmtNumber(t.totalEnergyMwh.value, 1)} MWh total, ${fmtNumber(t.itEnergyMwh.value, 1)} MWh to IT equipment`,
      pue: `${t.pue.value}`,
      renewableFactor: `${t.ref.value} (${fmtUpTo(t.ref.value * 100, 1)}% renewable)`,
      reuseFactor: `${t.erf.value}`,
      water: `${fmtNumber(t.waterWithdrawnKl.value)} kL withdrawn, ${fmtNumber(t.treatedWaterKl.value)} kL of it treated and recycled`,
      wue: `${t.wue.value} litres per IT kWh`,
      scope2: `${fmtNumber(t.scope2Tco2.value, 1)} tCO2e`,
    });
  }
  if (d.gaps.length) facts.notDisclosable = d.gaps.map((g) => `${g.item}: ${g.why}`);
  if (d.pending.length) facts.pendingSites = d.pending.map((p) => `${p.name}: ${p.reason}`);
  return facts;
}

export function esgTemplate(f) {
  if (!f.energy) {
    return `${f.framework}, ${f.period}. No in-scope site has metered energy or water yet. ${(f.pendingSites ?? []).join(' ')} The first plant-wise PUE and WUE report falls due once the site is energised.`;
  }
  const parts = [
    `${f.framework}, ${f.period}, covering ${f.siteCount}.`,
    `Energy: ${f.energy}, a PUE of ${f.pue}; renewable energy factor ${f.renewableFactor}; energy reuse factor ${f.reuseFactor}.`,
    `Water: ${f.water}, a WUE of ${f.wue}. Scope 2 emissions: ${f.scope2}.`,
  ];
  if (f.notDisclosable) parts.push(`Not disclosed from operating data: ${f.notDisclosable.map((g) => g.split(':')[0].toLowerCase()).join('; ')}.`);
  return parts.join(' ');
}

export function narrateEsg(d, { onText, offline = false, signal } = {}) {
  const facts = buildEsgFacts(d);
  return guardedNarrate({
    systemPrompt: ESG_SYSTEM_PROMPT, facts, template: esgTemplate(facts),
    instruction: 'Write the executive summary.', maxTokens: 300, onText, offline, signal, label: 'esg-brief',
  });
}
