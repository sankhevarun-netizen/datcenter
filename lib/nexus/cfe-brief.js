// lib/nexus/cfe-brief.js — hourly CFE position → facts → a guarded brief.
import { guardedNarrate, NUMBER_RULES } from './guarded-narrate.js';
import { getFacility } from './data.js';
import { fmtLakh } from './format.js';
import { monthLabel, timeLabel } from './time.js';

const hh = (h) => `${String(h).padStart(2, '0')}:00`;

export const PRECEDENT = 'Princeton Digital Group’s MU1 campus in Mumbai: India’s first hourly carbon-free energy matching scheme, with Tata Power Renewable Energy and Flexidao, 2026.';

export const CFE_SYSTEM_PROMPT = `You are the energy lead at a datacenter operator, briefing the board on carbon-free power. You are given figures the platform has already computed.

${NUMBER_RULES}

Write one paragraph, under 140 words, plain text. Start with the gap between annual renewable reporting and hour-by-hour matching for the proposed solar PPA. Say where in the day the gap sits. Cite the Mumbai precedent as given. Close with what the battery changes and what it costs, and be plain that tariff savings alone do not repay it.`;

/** @param {{ today, score, storage, cloudy }} p computed by lib/nexus/cfe-engine.js */
export function buildCfeFacts({ facilityId, today, score, storage, cloudy }) {
  const band = score.worstHourBand;
  return {
    site: getFacility(facilityId).name,
    reportedToday: `${today.reportedRenewablePct}% renewable from ${monthLabel(today.from).split(' ')[0]} to ${monthLabel(today.to)}, backed by certificates with no generation hour, so none of it can be shown hour by hour`,
    proposedPpa: `${(score.ppaKw / 1000).toFixed(1)} MW solar PPA`,
    annualVolumetric: `${score.comparedToAnnualRec.annualRecPct}% of load on an annual basis, the figure an annual report would show`,
    hourlyMatched: `${score.comparedToAnnualRec.hourlyMatchedPct}% matched hour by hour`,
    gap: `${score.comparedToAnnualRec.gap} percentage points hidden by annual reporting`,
    gapWindow: band ? `${hh(band.startHour)} to ${hh(band.endHour)}, where matching averages ${band.avgMatchingPct}%` : null,
    cloudyDay: `on ${timeLabel(cloudy.date)}, a ${cloudy.sky} day, midday matching fell to ${cloudy.cloudyMiddayPct}%`,
    precedent: PRECEDENT,
    battery: storage ? {
      size: `${(storage.storage.capacityKwh / 1000).toFixed(0)} MWh battery`,
      overnight: `overnight matching from ${storage.overnightPctBefore}% to ${storage.overnightPctAfter}%`,
      total: `hourly matching from ${storage.matchedPctBefore}% to ${storage.matchedPctAfter}%`,
      capex: storage.capexInrLakh != null ? fmtLakh(storage.capexInrLakh) : null,
      payback: storage.paybackYears != null ? `pays back in ${storage.paybackYears} years on tariff savings alone` : 'does not pay back on tariff savings alone',
    } : null,
  };
}

export function cfeTemplate(f) {
  const parts = [
    `${f.site} reports ${f.reportedToday}.`,
    `The proposed ${f.proposedPpa} would cover ${f.annualVolumetric}; measured hourly, it delivers ${f.hourlyMatched}: ${f.gap}.`,
  ];
  if (f.gapWindow) parts.push(`The gap sits in the window from ${f.gapWindow}.`);
  parts.push(`Cloud matters too: ${f.cloudyDay}.`);
  parts.push(`The precedent exists: ${f.precedent}`);
  if (f.battery) parts.push(`A ${f.battery.size} would take ${f.battery.overnight} and ${f.battery.total}${f.battery.capex ? `, for ${f.battery.capex}` : ''}. It ${f.battery.payback}, so the case is the 24/7 clean-power commitment hyperscale tenants now ask for.`);
  return parts.join(' ');
}

export function narrateCfe(p, { onText, offline = false, signal } = {}) {
  const facts = buildCfeFacts(p);
  return guardedNarrate({
    systemPrompt: CFE_SYSTEM_PROMPT, facts, template: cfeTemplate(facts),
    instruction: 'Write the clean-energy brief.', maxTokens: 360, onText, offline, signal, label: 'cfe-brief', engagement: p.facilityId,
  });
}
