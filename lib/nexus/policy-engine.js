// lib/nexus/policy-engine.js
//
// State policy radar: which policies bind a facility (16_state_policy), what
// each obliges it to report, whether its metered data can evidence that today
// (13_energy, 14_water), the incentives on offer, deadlines coming up, and the
// gaps. A pure join — nothing here is estimated.
import { nexus, index, getFacility } from './data.js';
import { FRAMEWORKS } from './esg-engine.js';
import { AS_OF_DATE, daysBetween } from './time.js';

/** Deadlines inside this window are flagged as approaching. */
export const DEADLINE_WINDOW_DAYS = 180;

const months = (rows) => [...new Set(rows.map((r) => r.month))].sort();

/** What an obligation needs from the ledgers, read from its wording. */
function evidenceFor(policy, facilityId) {
  const text = `${policy.reporting_obligation} ${policy.detail}`;
  const energy = months(index.energyByFacility.get(facilityId) ?? []);
  const water = months(index.waterByFacility.get(facilityId) ?? []);
  const needs = [];
  if (/PUE|energy/i.test(text)) needs.push({ what: 'Energy and PUE', months: energy, source: '13_energy' });
  if (/WUE|water/i.test(text)) needs.push({ what: 'Water and WUE', months: water, source: '14_water' });
  if (/on request/i.test(policy.reporting_obligation)) return { needs, onRequest: true };
  return { needs, onRequest: false };
}

export function policyExposure(facilityId) {
  const f = getFacility(facilityId);
  const operating = f.status === 'Operational';
  const policies = index.policiesByFacility.get(facilityId) ?? [];
  const brsrGaps = FRAMEWORKS.BRSR.lines.filter((l) => l.gap).map((l) => ({ item: l.item, why: l.gap }));

  const obligations = policies.map((p) => {
    const startsIn = daysBetween(AS_OF_DATE, p.effective_from);
    const inForce = startsIn <= 0;
    const { needs, onRequest } = evidenceFor(p, facilityId);
    const missing = needs.filter((n) => !n.months.length);
    const gaps = [
      ...missing.map((n) => `${n.what}: no metered data on file`),
      ...(p.jurisdiction === 'National' ? brsrGaps.map((g) => `${g.item}: ${g.why}`) : []),
    ];
    let status;
    if (!operating) status = 'from-commissioning';
    else if (!inForce) status = 'upcoming';
    else if (missing.length) status = 'gap';
    else if (gaps.length) status = 'partial';
    else status = onRequest ? 'ready-on-request' : 'ready';
    return {
      jurisdiction: p.jurisdiction,
      policy: p.policy,
      obligation: p.reporting_obligation,
      detail: p.detail,
      effectiveFrom: p.effective_from,
      inForce,
      startsInDays: inForce ? null : startsIn,
      status,
      evidence: needs.filter((n) => n.months.length).map((n) => `${n.what}: ${n.months.length} months metered, ${n.months[0]} to ${n.months.at(-1)} (${n.source})`),
      gaps,
    };
  });

  const incentives = policies
    .filter((p) => !/^None/i.test(p.incentives))
    .map((p) => ({
      jurisdiction: p.jurisdiction,
      policy: p.policy,
      incentives: p.incentives.split(/,\s*/),
      // Qualifying criteria are not in the dataset; say so rather than guess.
      eligibility: /treated water|efficiency/i.test(p.detail)
        ? `${operating ? '' : 'From commissioning · '}linked to performance: ${p.detail.charAt(0).toLowerCase()}${p.detail.slice(1)}`
        : operating ? 'Criteria not on file' : 'Assessed from commissioning',
    }));

  const deadlines = obligations
    .filter((o) => o.startsInDays !== null && o.startsInDays <= DEADLINE_WINDOW_DAYS)
    .map((o) => ({ policy: o.policy, jurisdiction: o.jurisdiction, effectiveFrom: o.effectiveFrom, inDays: o.startsInDays }));

  return {
    facilityId,
    name: f.name,
    jurisdiction: f.state,
    status: f.status,
    applicablePolicies: policies.map((p) => `${p.jurisdiction} · ${p.policy}`),
    obligations,
    incentivesAvailable: incentives,
    deadlinesApproaching: deadlines,
    complianceGaps: obligations.flatMap((o) => o.gaps.map((g) => ({ policy: o.policy, gap: g }))),
  };
}

/** Every policy and the sites it binds, ordered by effective date — for the timeline. */
export function policyTimeline() {
  return [...nexus.statePolicy]
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
    .map((p) => ({
      jurisdiction: p.jurisdiction, policy: p.policy, effectiveFrom: p.effective_from, appliesTo: p.applies_to,
      inForce: daysBetween(AS_OF_DATE, p.effective_from) <= 0,
      inDays: Math.max(0, daysBetween(AS_OF_DATE, p.effective_from)),
    }));
}
