// lib/nexus/water-circularity-engine.js — what happens to water already used,
// and what more could be reused.
//
// From 14_water (treated vs fresh litres), 29_water_reuse_opportunities (the
// three standard levers: condensate, greywater, rainwater) and the policies
// in 16_state_policy that apply to the site. No incentive threshold is
// invented: a site is measured against its own applicable policy and against
// a target the user sets.
import { index } from './data.js';

const round = (v, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const LITRES_PER_KL = 1000;

const months = (facilityId) => index.waterByFacility.get(facilityId) ?? [];
export const hasWaterData = (facilityId) => months(facilityId).length > 0;

/** Payback for one reuse lever: capex ÷ (litres × water cost − opex). Null when it never pays back. */
export function leverEconomics(lever) {
  const savingLakh = ((lever.volume_litres_per_year / LITRES_PER_KL) * lever.water_cost_inr_per_kl) / 1e5;
  const net = savingLakh - lever.opex_inr_lakh_per_year;
  return { annualSavingInrLakh: round(savingLakh), netAnnualInrLakh: round(net), paybackYears: net > 0 ? round(lever.capex_inr_lakh / net) : null };
}

/** Policies in 16_state_policy that bear on this site's water. */
export function waterPolicies(facilityId) {
  return (index.policiesByFacility.get(facilityId) ?? [])
    .filter((p) => /water/i.test(`${p.policy} ${p.reporting_obligation ?? ''} ${p.detail ?? ''} ${p.incentives ?? ''}`))
    .map((p) => ({ jurisdiction: p.jurisdiction, policy: p.policy, detail: p.detail, incentive: /incentive|subsid|rebate/i.test(p.incentives ?? '') && /treated water/i.test(p.detail ?? '') }));
}

export function circularityPosition(facilityId, { targetTreatedPct = null } = {}) {
  const ms = months(facilityId);
  if (!ms.length) return null;
  const total = sum(ms.map((m) => m.total_litres));
  const treated = sum(ms.map((m) => m.treated_litres));
  const fresh = sum(ms.map((m) => m.freshwater_litres));
  const scale = 12 / ms.length;
  const treatedSharePct = round((treated / total) * 100);
  const levers = (index.waterReuseByFacility.get(facilityId) ?? []).map((l) => ({
    source: l.source,
    description: l.description,
    volumeLitresPerYear: l.volume_litres_per_year,
    treatmentNeeded: l.treatment_required,
    costInrLakh: l.capex_inr_lakh,
    opexInrLakhPerYear: l.opex_inr_lakh_per_year,
    ...leverEconomics(l),
  }));
  const policies = waterPolicies(facilityId);
  return {
    facilityId,
    period: `${ms[0].month} to ${ms.at(-1).month}`,
    totalLitresPerYear: Math.round(total * scale),
    treatedLitresPerYear: Math.round(treated * scale),
    freshwaterLitresPerYear: Math.round(fresh * scale),
    treatedSharePct,
    freshwaterSharePct: round(100 - treatedSharePct),
    stress: { label: ms.at(-1).local_water_stress, index: ms.at(-1).stress_index },
    policies,
    incentiveLinked: policies.some((p) => p.incentive),
    targetTreatedPct,
    gapToTargetPts: targetTreatedPct != null ? round(Math.max(0, targetTreatedPct - treatedSharePct)) : null,
    reuseOpportunities: levers,
    reusePotentialLitresPerYear: sum(levers.map((l) => l.volumeLitresPerYear)),
  };
}

/**
 * Raise the non-fresh share to a target. On-site levers are taken in order of
 * payback (those that never pay back last); whatever they cannot supply must
 * come from more treated recycle supply, reported as a shortfall.
 */
export function whatIfIncreasedTreatment(facilityId, targetTreatedPct) {
  const pos = circularityPosition(facilityId, { targetTreatedPct });
  if (!pos) return null;
  const targetNonFresh = (pos.totalLitresPerYear * targetTreatedPct) / 100;
  const needed = Math.max(0, targetNonFresh - pos.treatedLitresPerYear);
  const order = [...pos.reuseOpportunities].sort((a, b) => (a.paybackYears ?? Infinity) - (b.paybackYears ?? Infinity));
  let remaining = needed;
  const used = [];
  for (const l of order) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, l.volumeLitresPerYear);
    used.push({ ...l, litresUsed: Math.round(take) });
    remaining -= take;
  }
  const saved = needed - Math.max(0, remaining);
  const capex = sum(used.map((l) => l.costInrLakh));
  // Annual value of the water actually displaced, net of the levers' running cost.
  const net = sum(used.map((l) => (l.litresUsed / l.volumeLitresPerYear) * l.annualSavingInrLakh - l.opexInrLakhPerYear));
  const achievable = round(((pos.treatedLitresPerYear + saved) / pos.totalLitresPerYear) * 100);
  return {
    facilityId,
    targetTreatedPct,
    achievableTreatedPct: Math.min(targetTreatedPct, achievable),
    newFreshwaterLitres: Math.round(pos.freshwaterLitresPerYear - saved),
    litresSaved: Math.round(saved),
    shortfallLitres: Math.round(Math.max(0, remaining)),
    leversUsed: used,
    costInrLakh: round(capex),
    netAnnualInrLakh: round(net),
    paybackYears: net > 0 && capex ? round(capex / net) : null,
    incentiveLinked: pos.incentiveLinked,
  };
}
