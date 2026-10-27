// Decision-engine registry — FIXED structure.
// The LLM is only allowed to select/rank/explain from this registry.
// It can never invent a module name or a decision_type.

export const DECISION_QUICK_STARTS = [
  {
    id: 'land-site-audit',
    decision_type: 'land_site_audit',
    title: 'Land & Site Audit',
    subtitle: 'Find and rank candidate locations',
    icon: 'MapPin',
  },
  {
    id: 'power-readiness',
    decision_type: 'power_readiness',
    title: 'Power Readiness Assessment',
    subtitle: 'Evaluate grid access and energy strategy',
    icon: 'Zap',
  },
  {
    id: 'cooling-sustainability',
    decision_type: 'cooling_sustainability',
    title: 'Cooling & Sustainability Review',
    subtitle: 'Analyze PUE, WUE and ESG impact',
    icon: 'Droplets',
  },
  {
    id: 'expansion-investment',
    decision_type: 'expansion_investment',
    title: 'Expansion & Investment Strategy',
    subtitle: 'Assess build vs acquire and capital deployment',
    icon: 'TrendingUp',
  },
  {
    id: 'ai-gpu-campus',
    decision_type: 'ai_gpu_campus',
    title: 'AI & GPU Campus Planner',
    subtitle: 'Model chip generation, power density, cooling, and capital deployment',
    icon: 'Cpu',
  },
];

// The 8 globally-fixed modules. No other module name may ever appear
// in selected_modules / priority_order, by the LLM or by the engine.
export const ALL_MODULES = [
  'final_recommendation',
  'candidate_locations',
  'feasibility',
  'power_analysis',
  'risk_analysis',
  'cost_estimation',
  'connectivity',
  'gpu_cluster_planning',
];

// Fixed per-decision_type subset — defines what's even eligible for that decision.
export const MODULE_REGISTRY = {
  land_site_audit: [
    'final_recommendation',
    'candidate_locations',
    'feasibility',
    'power_analysis',
    'risk_analysis',
    'cost_estimation',
    'connectivity',
  ],
  power_readiness: [
    'final_recommendation',
    'power_analysis',
    'risk_analysis',
    'cost_estimation',
    'feasibility',
    'connectivity',
  ],
  cooling_sustainability: [
    'final_recommendation',
    'feasibility',
    'risk_analysis',
    'cost_estimation',
    'power_analysis',
  ],
  expansion_investment: [
    'final_recommendation',
    'cost_estimation',
    'risk_analysis',
    'feasibility',
    'candidate_locations',
    'power_analysis',
  ],
  ai_gpu_campus: [
    'final_recommendation',
    'gpu_cluster_planning',
    'power_analysis',
    'cost_estimation',
    'risk_analysis',
    'feasibility',
    'connectivity',
  ],
};

export const MODULE_LABELS = {
  final_recommendation: 'Final Recommendation',
  candidate_locations: 'Top Locations',
  feasibility: 'Feasibility',
  power_analysis: 'Power',
  risk_analysis: 'Risk',
  cost_estimation: 'Cost',
  connectivity: 'Connectivity',
  gpu_cluster_planning: 'GPU Cluster',
};

// module → card TYPE (Part 6). This is intrinsic to each module's data shape
// (a ranked list is always a ranking, a risk score is always a score) — it is
// NOT chosen by the LLM and not baked into the compute engine. final_recommendation
// is excluded: it always renders as the dedicated Hero card, outside this system.
export const CARD_TYPE_MAPPING = {
  candidate_locations: 'ranking',
  power_analysis: 'metric',
  cost_estimation: 'metric',
  connectivity: 'metric',
  risk_analysis: 'score',
  feasibility: 'score',
  gpu_cluster_planning: 'planner',
};

// module → accent color key, purely cosmetic (resolved to a hex value by
// components/decision-cockpit/cards/Card.jsx's ACCENTS map).
export const ACCENT_BY_MODULE = {
  candidate_locations: 'navy',
  power_analysis: 'amber',
  cost_estimation: 'success',
  connectivity: 'accent',
  risk_analysis: 'danger',
  feasibility: 'navy',
  gpu_cluster_planning: 'accent',
};

// Tiny string hash used only for deterministic, purely-cosmetic placement
// (map pin coordinates) — never for scoring/ranking.
function hash01(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// Derives a 5-point illustrative trend leading up to today's computed value.
// Purely a presentational derivation of an already-deterministic number —
// no new randomness, no LLM involvement.
function buildTrend(currentValue) {
  return [0.55, 0.7, 0.82, 0.92, 1].map((f, i) => ({
    period: `Y${i + 1}`,
    value: Math.round(currentValue * f),
  }));
}

/**
 * Normalizes a module's bespoke computed fields (lib/decisionEngine.js)
 * into the generic props its card type needs. This is the one place that
 * knows both "what a module computed" and "what a generic card renders" —
 * adding a new module later means adding one case here, not a new component.
 */
export function shapeForCardType(moduleKey, data) {
  if (!data) return null;
  const type = CARD_TYPE_MAPPING[moduleKey] || 'insight';

  if (type === 'ranking') {
    return {
      type,
      items: (data.ranked || []).map(loc => {
        const h = hash01(loc.name);
        return {
          name: loc.name,
          score: loc.score,
          tag: loc.risk_tag,
          // Deterministic, illustrative position only — not real geo-coordinates.
          pin: { x: 20 + h * 60, y: 20 + hash01(loc.name + '|y') * 55 },
          meta: [
            { label: 'Land cost/acre', value: `$${Math.round(loc.land_cost_per_acre_usd / 1000)}K` },
            { label: 'Grid distance', value: `${loc.power_grid_distance_km} km` },
          ],
        };
      }),
    };
  }

  if (type === 'metric') {
    if (moduleKey === 'power_analysis') {
      return {
        type, score: data.score, verdict: data.verdict,
        primary: { label: 'Grid capacity', value: data.grid_capacity_mw, unit: 'MW' },
        metrics: [
          { label: 'Substation distance', value: `${data.substation_distance_km} km` },
          { label: 'Renewable mix', value: `${data.renewable_mix_pct}%` },
        ],
        trend: buildTrend(data.grid_capacity_mw),
        trendLabel: 'Grid capacity outlook (MW)',
      };
    }
    if (moduleKey === 'cost_estimation') {
      return {
        type, score: data.score, verdict: data.verdict,
        primary: { label: 'CapEx', value: data.capex_usd_m, unit: '$M' },
        metrics: [
          { label: 'OpEx / year', value: `$${data.opex_usd_m_per_year}M` },
          { label: 'Payback', value: `${data.payback_years} yrs` },
        ],
        trend: buildTrend(data.opex_usd_m_per_year),
        trendLabel: 'OpEx outlook ($M/yr)',
      };
    }
    if (moduleKey === 'connectivity') {
      return {
        type, score: data.score, verdict: data.verdict,
        primary: { label: 'Fiber routes', value: data.fiber_routes, unit: 'routes' },
        metrics: [
          { label: 'Latency to hub', value: `${data.latency_ms_to_hub} ms` },
          { label: 'Carrier density', value: data.carrier_density },
        ],
        trend: buildTrend(data.fiber_routes),
        trendLabel: 'Fiber route growth',
      };
    }
  }

  if (type === 'score') {
    return { type, score: data.score, verdict: data.verdict, factors: data.factors, flags: data.flags };
  }

  if (type === 'planner') {
    // Richer than ranking/metric/score — PlannerCard reads the computed
    // gpu_cluster_planning fields directly, this just tags the type.
    return { type, ...data };
  }

  return { type: 'insight', summary: data.headline || data.verdict || '' };
}

/**
 * Radar-ready summary across EVERY computed module (not just the ones the
 * LLM selected) — this is the "Evaluation Summary" portfolio view, so it
 * intentionally shows the full picture regardless of what's foregrounded
 * in the main cards.
 */
export function buildEvaluationSummary(computedData) {
  return Object.entries(computedData)
    .filter(([key, val]) => key !== 'final_recommendation' && typeof val?.score === 'number')
    .map(([key, val]) => ({ subject: MODULE_LABELS[key] || key, score: val.score }));
}

/**
 * Derives 3 trade-off insight tiles from already-computed data — no new
 * LLM call. The strongest selected module becomes the "strength" tile, the
 * weakest becomes the "caution" tile, and final_recommendation anchors the
 * "balanced" tile.
 */
export function buildTradeoffInsights(selectedModules, reasoning, computedData) {
  const candidates = selectedModules
    .filter(k => k !== 'final_recommendation')
    .map(k => ({ key: k, score: computedData[k]?.score }))
    .filter(c => typeof c.score === 'number');

  if (!candidates.length) return [];

  const strongest = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  const weakest = candidates.reduce((a, b) => (b.score < a.score ? b : a));
  const hero = computedData.final_recommendation;

  const tiles = [
    {
      tone: 'strength',
      title: `Strong ${MODULE_LABELS[strongest.key]} advantage`,
      body: reasoning?.[strongest.key]?.why_this_value || reasoning?.[strongest.key]?.summary || '',
    },
  ];
  if (weakest.key !== strongest.key) {
    tiles.push({
      tone: 'caution',
      title: `${MODULE_LABELS[weakest.key]} needs mitigation`,
      body: reasoning?.[weakest.key]?.why_this_value || reasoning?.[weakest.key]?.summary || '',
    });
  }
  tiles.push({
    tone: 'balanced',
    title: 'Balanced trade-off',
    body: hero?.headline ? `${hero.headline}. Confidence ${hero.confidence ?? '—'}%.` : '',
  });

  return tiles.slice(0, 3);
}

// Deterministic lookup — used by the coastal/flood hard constraint.
// Plain string match, no LLM, no geocoding API.
export const COASTAL_REGIONS = [
  'chennai', 'mumbai', 'kochi', 'cochin', 'visakhapatnam', 'vizag',
  'mangalore', 'goa', 'kolkata', 'surat', 'kandla', 'chittagong',
  'singapore', 'jakarta', 'manila', 'ho chi minh', 'bangkok',
];

export function isCoastalRegion(location = '') {
  const l = location.toLowerCase();
  return COASTAL_REGIONS.some(region => l.includes(region));
}

const MIN_MODULES = 3;
const MAX_MODULES = 5;
const POWER_THRESHOLD_MW = 50;

/**
 * Deterministic, code-enforced hard constraints. Runs AFTER the LLM
 * proposes a selection, and also defines the fallback path used when
 * the LLM call fails or returns something invalid.
 *
 * The LLM is never trusted to enforce these on its own — every rule
 * here is re-checked in code regardless of what the LLM said.
 */
export function applyHardConstraints(decisionType, params, llmSelection = {}) {
  const registry = MODULE_REGISTRY[decisionType] || [];
  const capacity = Number(params?.capacity) || 0;
  const coastal = isCoastalRegion(params?.location);

  // 1. Start from the LLM's pick, but drop anything not in this decision_type's registry
  //    (this is the "LLM cannot invent modules" enforcement).
  let selected = (llmSelection.selected_modules || [])
    .filter(m => registry.includes(m));

  // 2. Required inclusions by rule.
  const required = new Set();
  required.add('final_recommendation'); // always
  if (capacity >= POWER_THRESHOLD_MW && registry.includes('power_analysis')) required.add('power_analysis');
  if (coastal && registry.includes('risk_analysis')) required.add('risk_analysis');
  if (decisionType === 'land_site_audit' && registry.includes('candidate_locations')) required.add('candidate_locations');

  required.forEach(m => { if (!selected.includes(m)) selected.push(m); });

  // 3. Clamp to 3–5, filling from registry order if under the minimum.
  if (selected.length < MIN_MODULES) {
    for (const m of registry) {
      if (selected.length >= MIN_MODULES) break;
      if (!selected.includes(m)) selected.push(m);
    }
  }
  if (selected.length > MAX_MODULES) {
    // Keep required modules first, then trim the rest.
    const requiredFirst = [...selected.filter(m => required.has(m)), ...selected.filter(m => !required.has(m))];
    selected = requiredFirst.slice(0, MAX_MODULES);
  }

  // 4. Priority order — respect the LLM's proposed order where possible,
  //    otherwise fall back to registry order. final_recommendation always leads.
  let priorityOrder = (llmSelection.priority_order || []).filter(m => selected.includes(m));
  selected.forEach(m => { if (!priorityOrder.includes(m)) priorityOrder.push(m); });
  priorityOrder = ['final_recommendation', ...priorityOrder.filter(m => m !== 'final_recommendation')];

  return { selected_modules: selected, priority_order: priorityOrder, required: [...required] };
}

/**
 * Fully deterministic fallback selection — used when the LLM call
 * fails, times out, or returns malformed output. No randomness.
 */
export function defaultSelection(decisionType, params) {
  const registry = MODULE_REGISTRY[decisionType] || [];
  const { selected_modules, priority_order } = applyHardConstraints(decisionType, params, {
    selected_modules: registry.slice(0, MAX_MODULES),
    priority_order: registry,
  });
  return { selected_modules, priority_order };
}
