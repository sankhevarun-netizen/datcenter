// lib/nexus/procurement-advisor.js — one ranked list of actions, from the
// CFE, water-circularity, carbon and predictive engines. A sort, not a model.
//
// Score = 0.4 × matching gain + 0.4 × carbon avoided + 0.2 × water saved, each
// scaled to the largest value among the candidates (0–1). Cost and payback are
// shown beside the score; cost per point of impact breaks ties.
import { matchingScore, matchingWithStorage, currentPosition, ppaOf, batteriesOf, hasCfeData } from './cfe-engine.js';
import { circularityPosition } from './water-circularity-engine.js';
import { embodiedCarbonOfStranded, tco2ForMwh } from './carbon-engine.js';
import { riskWatchlist } from './predictive-engine.js';
import { index } from './data.js';

export const WEIGHTS = Object.freeze({ matching: 0.4, carbon: 0.4, water: 0.2 });
const round = (v, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;

export function recommendedActions(facilityId) {
  const actions = [];
  const today = currentPosition(facilityId);
  const factor = today.gridCarbonKgPerKwh ?? 0.71;

  if (hasCfeData(facilityId)) {
    const s = matchingScore(facilityId);
    const ppa = ppaOf(facilityId);
    // The PPA is assumed to replace today's certificate-backed supply, so only the
    // clean share above today's reported renewable share is new.
    const newCleanMwh = Math.max(0, ((s.matchedPct - today.reportedRenewablePct) / 100) * s.loadMwhPerYear);
    actions.push({
      id: 'ppa', category: 'procurement',
      action: `Contract the ${(ppa.power_kw / 1000).toFixed(1)} MW solar PPA with hourly metering`,
      detail: `${s.matchedPct}% hourly-matched clean power, verified hour by hour, instead of ${today.reportedRenewablePct}% from certificates.`,
      impact: { matchingPctGain: s.matchedPct, waterLitresSaved: 0, tco2Avoided: tco2ForMwh(newCleanMwh, factor), costInrLakh: 0 },
      paybackYears: null, leadTimeWeeks: ppa.lead_time_weeks, costNote: 'Contract, no capex',
    });
    for (const b of batteriesOf(facilityId)) {
      const r = matchingWithStorage(facilityId, b.asset_id);
      actions.push({
        id: b.asset_id, category: 'storage',
        action: `Add a ${(b.capacity_kwh / 1000).toFixed(0)} MWh / ${(b.power_kw / 1000).toFixed(0)} MW battery to the PPA`,
        detail: `Hourly matching ${r.matchedPctBefore}% → ${r.matchedPctAfter}%; overnight ${r.overnightPctBefore}% → ${r.overnightPctAfter}%.`,
        impact: { matchingPctGain: round(r.matchedPctAfter - r.matchedPctBefore), waterLitresSaved: 0, tco2Avoided: tco2ForMwh(r.additionalMatchedMwhPerYear, factor), costInrLakh: r.capexInrLakh },
        paybackYears: r.paybackYears, leadTimeWeeks: b.lead_time_weeks, costNote: null, requires: 'ppa',
      });
    }
  }

  // Cooling efficiency drift, as costed by the predictive engine.
  const drift = riskWatchlist().find((w) => w.kind === 'efficiency-drift' && w.facilityId === facilityId);
  if (drift) {
    const e = (index.energyByFacility.get(facilityId) ?? []).at(-1);
    const annualKwh = (drift.cost.annualRunRateInrLakh * 1e5) / (e?.tariff_inr_kwh ?? 8.5);
    const gridShare = e ? e.grid_kwh / e.total_kwh : 1;
    actions.push({
      id: 'drift', category: 'efficiency',
      action: 'Correct the cooling efficiency drift',
      detail: `PUE has run above last year; the excess costs ₹${drift.cost.annualRunRateInrLakh} lakh a year at today's rate.`,
      impact: { matchingPctGain: 0, waterLitresSaved: 0, tco2Avoided: Math.round((annualKwh * gridShare * factor) / 1000), costInrLakh: null },
      paybackYears: null, leadTimeWeeks: null, costNote: 'Operational fix (runbook)',
    });
  }

  // Water reuse levers.
  const water = circularityPosition(facilityId);
  for (const l of water?.reuseOpportunities ?? []) {
    actions.push({
      id: `water-${l.source}`, category: 'water',
      action: `${l.source.charAt(0).toUpperCase()}${l.source.slice(1)} reuse`,
      detail: l.description,
      impact: { matchingPctGain: 0, waterLitresSaved: l.volumeLitresPerYear, tco2Avoided: 0, costInrLakh: l.costInrLakh },
      paybackYears: l.paybackYears, leadTimeWeeks: null, costNote: l.paybackYears == null ? 'Does not pay back on water cost alone' : null,
    });
  }

  // Stranded capacity: embodied carbon already spent (one-off avoided build).
  const embodied = embodiedCarbonOfStranded(facilityId);
  if (embodied.strandedKw > 0) {
    actions.push({
      id: 'stranded', category: 'efficiency',
      action: `Recover ${embodied.strandedKw} kW of structurally stranded capacity`,
      detail: `Its ~${embodied.estimatedEmbodiedTco2.toLocaleString('en-IN')} tCO2e of embodied carbon is already spent; using it avoids building the same capacity again.`,
      impact: { matchingPctGain: 0, waterLitresSaved: 0, tco2Avoided: embodied.estimatedEmbodiedTco2, costInrLakh: null, oneOff: true },
      paybackYears: null, leadTimeWeeks: null, costNote: 'One-off avoided construction carbon',
    });
  }

  const max = (k) => Math.max(1, ...actions.map((a) => a.impact[k]));
  const scored = actions.map((a) => {
    const score = WEIGHTS.matching * (a.impact.matchingPctGain / max('matchingPctGain'))
      + WEIGHTS.carbon * (a.impact.tco2Avoided / max('tco2Avoided'))
      + WEIGHTS.water * (a.impact.waterLitresSaved / max('waterLitresSaved'));
    const costPerPoint = a.impact.costInrLakh && score > 0 ? a.impact.costInrLakh / (score * 100) : null;
    return { ...a, score: round(score * 100), costPerPointInrLakh: costPerPoint != null ? round(costPerPoint) : null };
  });
  scored.sort((a, b) => b.score - a.score || (a.costPerPointInrLakh ?? 0) - (b.costPerPointInrLakh ?? 0));
  return scored.map((a, i) => ({ ...a, rank: i + 1, priority: a.score >= 40 ? 'High' : a.score >= 15 ? 'Medium' : 'Low' }));
}
