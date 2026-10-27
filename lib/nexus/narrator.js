// lib/nexus/narrator.js
//
// Computed result -> one advisory paragraph. The model sees only `facts`:
// figures the engines already computed, pre-formatted, so it never needs to
// convert or calculate. A streaming guard checks every complete number the
// model writes against the numbers present in those facts; anything else
// aborts the stream and the deterministic template narration is shown instead.
import { guardedNarrate, allowedNumbers, safePrefix } from './guarded-narrate.js';
import { getHall } from './data.js';
import { fmtKw, fmtLakh, fmtInr, fmtNumber, fmtDuration } from './format.js';

export const NARRATOR_SYSTEM_PROMPT = `You are a senior datacenter capacity engineer briefing a commercial team. You are given facts computed by the platform.

Use only the numbers present in the provided result object. Never calculate, estimate, infer or invent a figure. If a number is not in the object, do not mention it.
Do not add, subtract, multiply or otherwise combine figures — any total or difference worth stating is already in the object.
Do not state percentages, shares, ratios, time periods or deadlines unless that exact figure is in the object.

Write one paragraph, under 120 words, plain text — no markdown, no bullet points, no headings.
Lead with the direct answer. Name the binding constraint or the single biggest blocker. Close with one concrete recommendation.
Never mention how this text was produced, and never name any software, model or assistant.`;

const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const shortDate = (ts) => {
  const [d, t] = ts.split(' ');
  const [, m, day] = d.split('-');
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(m) - 1];
  return `${t} on ${Number(day)} ${month}`;
};

/** Pre-formatted, display-ready facts per intent — the only thing the model sees. */
export function buildFacts(intent, r) {
  switch (intent) {
    case 'stranded_capacity': {
      const structural = r.byRow.filter((x) => x.classification === 'structural');
      const byLimit = [...new Set(structural.map((x) => x.limitedBy))].map((limit) => {
        const rows = structural.filter((x) => x.limitedBy === limit);
        return `${limit}-limited: ${fmtKw(rows.reduce((s, x) => s + x.strandedKw, 0))} across ${rows.length === 1 ? 'Row' : 'Rows'} ${list(rows.map((x) => x.rowId))}`;
      });
      return {
        question: 'How much installed power is stranded at the facility?',
        structuralStranded: fmtKw(r.structuralKw),
        totalsByLimitingResource: byLimit,
        byRow: structural.map((x) => `Row ${x.rowId}: ${fmtKw(x.strandedKw)}, ${x.limitedBy}-limited`),
        plannedHeadroom: `${fmtKw(r.plannedHeadroomKw)} in Hall 4, classified as planned expansion headroom — not waste`,
        capitalTiedUp: fmtInr(r.capitalTiedUpInr),
        annualCarryingCost: fmtInr(r.annualCarryingCostInr),
        revenueOpportunityPerYear: fmtInr(r.revenueOpportunityInr),
      };
    }
    case 'capacity_check': {
      const hall = r.eligibleHalls.map((h) => getHall(h).name).join(', ') || 'none';
      return {
        question: `Can the facility take ${r.requestedRacks} racks at ${r.densityKw} kW per rack (${fmtKw(r.requestedKw)})?`,
        answer: r.feasible ? 'yes' : r.deployableRackCount > 0 ? 'partially' : 'no',
        eligibleHalls: `${hall} (only halls rated for ${r.densityKw} kW per rack)`,
        spaceAllows: `${r.maxBySpace} racks`,
        powerAllows: `${r.maxByPower} racks (${fmtKw(r.maxByPower * r.densityKw)})`,
        coolingAllows: `${r.maxByCooling} racks (${fmtKw(r.maxByCooling * r.densityKw)})`,
        bindingConstraint: r.bindingConstraint,
        deployableToday: `${fmtKw(r.deployableKw)} (${r.deployableRackCount} racks)`,
        notDeployableToday: `${fmtKw(r.requestedKw - r.deployableKw)} (${r.requestedRacks - r.deployableRackCount} racks)`,
        shortfalls: r.requiredUpgrades.map((u) => u.description),
      };
    }
    case 'density_readiness': {
      const ready = r.filter((x) => x.aiReady);
      const notReady = r.filter((x) => !x.aiReady);
      return {
        question: 'Which rows are AI-ready (50 kW per rack or more)?',
        aiReadyRows: `${ready.length} of ${r.length} rows (${ready.map((x) => x.rowId).join(', ')}), rated up to ${Math.max(...ready.map((x) => x.maxDensityKw))} kW per rack`,
        notReadyRows: `${notReady.length} rows rated ${Math.max(...notReady.map((x) => x.maxDensityKw))} kW per rack, ${Math.max(...notReady.map((x) => x.gapKw))} kW per rack short of 50 kW`,
        retrofitPerRow: `${Math.max(...notReady.map((x) => x.gapKw))} kW per rack more power and cooling on each of those rows`,
      };
    }
    case 'cascade_simulation':
    case 'failure_simulation': {
      const se = r.secondaryEffects;
      const change = r.rowChanges.map((c) => `Row ${c.rowId}: ${c.rackCount} racks from ${c.oldDensityKw} kW to ${c.newDensityKw} kW per rack (${fmtKw(c.oldKw)} to ${fmtKw(c.newKw)}, ${c.deltaKw >= 0 ? '+' : ''}${fmtKw(c.deltaKw)})`);
      const longest = [...r.requiredUpgrades].sort((a, b) => b.leadTimeWeeks - a.leadTimeWeeks)[0];
      return {
        change: change.length ? change : [`${list(r.failedComponents)} fails`],
        verdict: r.verdict.replace(/_/g, ' '),
        counts: `${r.breakingPoints.length} components exceeded across ${new Set(r.breakingPoints.map((i) => i.componentType)).size} equipment types, ${r.redundancyLosses.length} losing N+1 redundancy, ${r.impacts.filter((i) => i.status === 'tight').length} running tight`,
        exceeded: r.breakingPoints.map((i) => `${i.componentId} at ${i.newUtilisationPct}%`),
        redundancyLost: r.redundancyLosses.map((i) => `${i.componentId} carries ${fmtNumber(i.newLoad, 1)} ${i.unit} against ${fmtNumber(i.deratedCapacity, 1)} ${i.unit} per unit — the N+1 pair can no longer cover a failure`),
        tight: r.impacts.filter((i) => i.status === 'tight').map((i) => `${i.componentId} at ${i.newUtilisationPct}%`),
        upgradeCost: r.requiredUpgrades.length ? fmtLakh(r.totalUpgradeCostInrLakh) : 'none',
        criticalPath: `${r.criticalPathWeeks} weeks`,
        longestLeadUpgrade: longest ? `${longest.componentId}: ${longest.description}, ${longest.leadTimeWeeks} weeks` : 'none',
        annualEnergy: `${se.annualEnergyGwh.before} GWh to ${se.annualEnergyGwh.after} GWh (+${se.annualEnergyGwh.delta} GWh a year)`,
        annualWater: `${fmtNumber(se.annualWaterLitres.before)} to ${fmtNumber(se.annualWaterLitres.after)} litres (+${fmtNumber(se.annualWaterLitres.delta)} litres a year)`,
        pue: `${se.pue.before} to ${se.pue.after}`,
        ...(se.chwFlowLpm ? { chilledWaterFlow: `${fmtNumber(se.chwFlowLpm.before)} to ${fmtNumber(se.chwFlowLpm.after)} LPM (+${fmtNumber(se.chwFlowLpm.delta)} LPM)` } : {}),
        ...(se.generatorRuntimeHours ? { generatorRuntime: `${se.generatorRuntimeHours.before} hours to ${se.generatorRuntimeHours.after} hours` } : {}),
        ...(r.breakingPoint?.firstConstraint ? {
          breakingPoint: `Row ${r.breakingPoint.rowId} holds up to ${r.breakingPoint.maxDensityKw} kW per rack; at ${r.breakingPoint.breaksAtDensityKw} kW ${r.breakingPoint.firstConstraint} is the first component over its limit`,
        } : {}),
      };
    }
    case 'replay':
      return {
        incident: `${r.incident.incident_id} on ${r.incident.component_id}: ${r.incident.description}`,
        agentFlaggedAt: shortDate(r.flaggedAt),
        operatorDetectedAt: shortDate(r.detectedAt),
        leadTime: fmtDuration(r.leadMinutes),
        scheduledSwapCost: fmtLakh(r.scheduledCostInrLakh),
        emergencyResponseCost: fmtLakh(r.emergencyCostInrLakh),
        ...(r.scheduledCostInrLakh ? { emergencyVersusScheduled: `${fmtNumber(r.emergencyCostInrLakh / r.scheduledCostInrLakh, 1)} times the scheduled cost` } : {}),
        sameFailurePatternBefore: `${r.patternIncidents.length} earlier incidents: ${list(r.patternIncidents.map((p) => `${p.incidentId} on ${p.componentId}`))}`,
      };
    case 'thermal': {
      const { map, summary } = r;
      const f = map.failure;
      const base = {
        limits: '27 °C recommended and 32 °C allowable rack inlet (ASHRAE A1)',
        tightestRows: summary.tightestRows.slice(0, 3).map((x) => `Row ${x.rowId}: ${x.maxInletC} °C hottest inlet, ${x.marginC} °C below the recommended limit`),
        rowsThatCannotLoseACrah: `${summary.exposedRows.length} rows (${list(summary.exposedRows)}): the surviving CRAH would run past its rating`,
        basis: 'estimated from each row\'s cold-aisle sensors and CRAH loading',
      };
      if (!f) return base;
      const row = map.rows.find((x) => x.rowId === f.rowId);
      return {
        ...base,
        failure: `${f.crahId} fails`,
        survivor: `${list(f.survivors)} must cool Row ${f.rowId}'s ${f.loadKw} kW alone: ${f.utilisationAfterPct}% of its ${f.survivorCapacityKw} kW rating, up from ${f.utilisationBeforePct}%`,
        inletRise: `${f.riseC} °C`,
        hottestInletAfter: `${row.maxInletC} °C`,
        verdict: f.holds ? 'the row stays within the surviving unit\'s rating' : 'the row exceeds the surviving unit\'s rating',
      };
    }
    default:
      return {};
  }
}

/** Deterministic narration from the same facts — demo mode and guard fallback. */
export function templateNarration(intent, f) {
  switch (intent) {
    case 'stranded_capacity':
      return `${f.structuralStranded} of installed power is structurally stranded: ${list(f.byRow)}. That is ${f.capitalTiedUp} of capital tied up, ${f.annualCarryingCost} a year in carrying cost and ${f.revenueOpportunityPerYear} a year of revenue it cannot earn. A further ${f.plannedHeadroom}. Start with ${f.byRow[0]} — the largest single block.`;
    case 'capacity_check':
      return `Answer: ${f.answer}. ${f.deployableToday} is deployable today in ${f.eligibleHalls}. Space allows ${f.spaceAllows}, power ${f.powerAllows} and cooling ${f.coolingAllows}, so ${f.bindingConstraint} is the binding constraint. Quote the deployable figure now and phase the remainder behind the ${f.bindingConstraint} upgrade.`;
    case 'density_readiness':
      return `${f.aiReadyRows} are AI-ready today. The other ${f.notReadyRows}. Direct AI demand to the ready rows and plan retrofits for the rest.`;
    case 'cascade_simulation':
    case 'failure_simulation':
      if (f.breakingPoint) return `${f.breakingPoint}. ${list(f.change)} is ${f.verdict}: upgrades total ${f.upgradeCost} with a ${f.criticalPath} critical path. Hold the row below its limit until those land.`;
      return `${list(f.change)} is ${f.verdict}.${f.exceeded.length ? ` It breaks ${list(f.exceeded)}.` : ''}${f.redundancyLost.length ? ` Redundancy is lost: ${f.redundancyLost[0]}.` : ''} Upgrades total ${f.upgradeCost} with a ${f.criticalPath} critical path, gated by ${f.longestLeadUpgrade}. Order the longest-lead item first.`;
    case 'replay':
      return `The agent flagged ${f.incident} at ${f.agentFlaggedAt}; operators detected it at ${f.operatorDetectedAt} — ${f.leadTime} later. Acting on the flag means a ${f.scheduledSwapCost} scheduled swap instead of a ${f.emergencyResponseCost} emergency response. The data was already in the building.`;
    case 'thermal':
      if (f.failure) {
        return `If ${f.failure}, ${f.survivor}, so ${f.verdict}. Inlets rise by an estimated ${f.inletRise}, to ${f.hottestInletAfter} at the hottest rack, against ${f.limits}. ${f.rowsThatCannotLoseACrah}. Pre-stage temporary cooling for the exposed rows before CRAH maintenance.`;
      }
      return `Every row runs within the recommended inlet limit today; the tightest is ${f.tightestRows[0]}. But ${f.rowsThatCannotLoseACrah}. Treat those CRAHs as single points of failure until each row has cooling to spare.`;
    default:
      return '';
  }
}

export { allowedNumbers, safePrefix };

/**
 * Streams the narration through the shared number guard. onText(displayText)
 * is called as verified text arrives. Resolves to { text, source: 'llm' | 'template' }.
 */
export function narrate({ intent, result, onText = () => {}, demoMode = false, signal }) {
  const facts = buildFacts(intent, result);
  return guardedNarrate({
    systemPrompt: NARRATOR_SYSTEM_PROMPT,
    facts,
    template: templateNarration(intent, facts),
    factsLabel: 'Result object',
    onText,
    offline: demoMode,
    signal,
    label: 'narrator',
    knowledgeQuery: 'data centre capacity expansion high density power cooling hyperscale tenant',
  });
}
