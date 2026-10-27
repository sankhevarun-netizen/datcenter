// lib/nexus/query-parser.js
//
// Natural language -> structured parameters. The model only extracts what
// the user stated; any arithmetic (e.g. 2 MW at 60 kW -> 34 racks) happens in
// resolveQuery() below, in JavaScript. A deterministic local parser covers the
// demo queries and is used when the API is unavailable, slow, or in demo mode.
import { callClaude } from '../claude-api.js';
import { nexus, componentsOf, index } from './data.js';

export const HERO_FACILITY = 'MUM-1';
const INTENTS = ['capacity_check', 'stranded_capacity', 'density_readiness', 'cascade_simulation', 'failure_simulation', 'unknown'];
const FAILABLE_TYPES = ['utility_feed', 'transformer', 'switchgear', 'ups', 'generator', 'rpp', 'busway', 'chiller', 'cooling_tower', 'chw_loop'];
const TYPE_WORDS = {
  utility_feed: ['utility feed', 'feed', 'util feed', 'utility'],
  transformer: ['transformer', 'tx'],
  switchgear: ['switchgear', 'swgr'],
  ups: ['ups'],
  generator: ['generator', 'gen', 'genset'],
  rpp: ['rpp', 'remote power panel'],
  busway: ['busway', 'bus'],
  chiller: ['chiller'],
  cooling_tower: ['cooling tower', 'tower', 'ct'],
  chw_loop: ['chilled water loop', 'chw loop', 'chilled water'],
};

const failableComponents = (facilityId) => componentsOf(facilityId).filter((c) => FAILABLE_TYPES.includes(c.component_type));

const norm = (s) => ` ${String(s).toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim()} `;

/** Map free text ("utility feed A", "UPS 1", "UTIL-FEED-A") to a real component id. */
export function matchComponent(text, facilityId = HERO_FACILITY) {
  if (!text) return null;
  const direct = index.componentById.get(String(text).trim().toUpperCase());
  if (direct && FAILABLE_TYPES.includes(direct.component_type)) return direct.component_id;
  const t = norm(text);
  let best = null;
  for (const c of failableComponents(facilityId)) {
    const suffix = c.component_id.split('-').pop().toLowerCase();
    const aliases = [c.component_id, c.label, ...TYPE_WORDS[c.component_type].map((w) => `${w} ${suffix}`)].map(norm);
    for (const a of aliases) {
      if (t.includes(a) && (!best || a.length > best.len)) best = { id: c.component_id, len: a.length };
    }
  }
  return best?.id ?? null;
}

const num = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')));

/** Deterministic parser for the demo queries. */
export function parseLocally(text) {
  const t = String(text).toLowerCase();
  const base = { facilityId: null, rackCount: null, requestedPowerValue: null, requestedPowerUnit: null, densityKw: null, rowId: null, failedComponent: null, clarificationNeeded: false, clarificationQuestion: null };

  const failure = /\b(lose|lost|losing|loss of|fail|fails|failed|failure|goes down|outage|trip|trips)\b/.test(t);
  const failedComponent = failure ? matchComponent(text) : null;
  if (failure && failedComponent) return { ...base, intent: 'failure_simulation', failedComponent };

  const row = /\brow\s+([a-x])\b/i.exec(text);
  const density = /(\d+(?:\.\d+)?)\s*kw(?:\s*(?:\/|per)\s*rack|\s+density)?/i.exec(text);
  if (row && density) return { ...base, intent: 'cascade_simulation', rowId: row[1].toUpperCase(), densityKw: num(density[1]) };

  const power = /(\d+(?:[.,]\d+)?)\s*(mw|kw)\b(?!\s*(?:\/|per)\s*rack)(?!\s+density)/i.exec(text);
  const racks = /(\d+)\s*racks?\b/i.exec(text);
  const densityMatch = /(?:at|@)\s*(\d+(?:\.\d+)?)\s*kw/i.exec(text) || /(\d+(?:\.\d+)?)\s*kw\s*(?:density|\/\s*rack|per\s*rack)/i.exec(text);
  if ((racks || power) && densityMatch && (racks || power.index !== densityMatch.index)) {
    return {
      ...base,
      intent: 'capacity_check',
      rackCount: racks ? num(racks[1]) : null,
      requestedPowerValue: !racks && power ? num(power[1]) : null,
      requestedPowerUnit: !racks && power ? (power[2].toLowerCase() === 'mw' ? 'MW' : 'kW') : null,
      densityKw: num(densityMatch[1]),
    };
  }

  if (/stranded|trapped|wasted|unusable/.test(t)) return { ...base, intent: 'stranded_capacity' };
  if (/ai.?ready|density readiness|high.?density|which rows/.test(t)) return { ...base, intent: 'density_readiness' };
  if (failure) return { ...base, intent: 'failure_simulation', clarificationNeeded: true, clarificationQuestion: 'Which component — for example utility feed A, UPS-1 or chiller 1?' };
  return { ...base, intent: 'unknown', clarificationNeeded: true, clarificationQuestion: 'Try one of the example questions, e.g. "Can we take 2MW at 60kW density?"' };
}

function systemPrompt() {
  const facilities = nexus.facilities.map((f) => `${f.facility_id} (${f.name}, ${f.city})`).join('; ');
  const components = failableComponents(HERO_FACILITY).map((c) => `${c.component_id} = ${c.label}`).join('; ');
  return `You convert a datacenter capacity question into JSON parameters. You do not answer, explain or calculate anything.

Return ONLY one JSON object, no prose, no code fences:
{"intent": "capacity_check"|"stranded_capacity"|"density_readiness"|"cascade_simulation"|"failure_simulation"|"unknown",
 "facilityId": string|null, "rackCount": number|null, "requestedPowerValue": number|null, "requestedPowerUnit": "kW"|"MW"|null,
 "densityKw": number|null, "rowId": string|null, "failedComponent": string|null,
 "clarificationNeeded": boolean, "clarificationQuestion": string|null}

Rules:
- Copy numbers exactly as the user stated them. NEVER convert, multiply, divide or round. "2MW" -> requestedPowerValue 2, requestedPowerUnit "MW". "30 racks" -> rackCount 30.
- capacity_check: can a quantity of racks or power fit at a per-rack density. densityKw is the per-rack density.
- cascade_simulation: changing an existing row's density ("what if Row G goes to 60kW") -> rowId (single letter A-X) and densityKw.
- failure_simulation: losing a component. failedComponent must be one of these ids: ${components}.
- stranded_capacity: stranded, trapped or wasted capacity. density_readiness: which rows are AI-ready / high-density capable.
- facilityId: one of ${facilities}, only if named; otherwise null.
- If a required value is missing (e.g. no density for a capacity check), set clarificationNeeded true with one short question.`;
}

function extractJson(text) {
  const s = String(text);
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON in parser response');
  return JSON.parse(s.slice(start, end + 1));
}

function sanitise(raw) {
  const out = parseLocally('');
  out.intent = INTENTS.includes(raw.intent) ? raw.intent : 'unknown';
  for (const k of ['facilityId', 'rowId', 'failedComponent', 'clarificationQuestion']) out[k] = typeof raw[k] === 'string' && raw[k].trim() ? raw[k].trim() : null;
  for (const k of ['rackCount', 'requestedPowerValue', 'densityKw']) out[k] = Number.isFinite(Number(raw[k])) && raw[k] !== null ? Number(raw[k]) : null;
  out.requestedPowerUnit = raw.requestedPowerUnit === 'MW' || raw.requestedPowerUnit === 'kW' ? raw.requestedPowerUnit : null;
  out.clarificationNeeded = Boolean(raw.clarificationNeeded);
  if (out.rowId) out.rowId = out.rowId.replace(/^row\s*/i, '').toUpperCase();
  return out;
}

/**
 * Parse with Claude (fast, max_tokens 300), falling back to the local parser
 * on error, timeout, or in demo mode. Returns the raw parameters plus `source`.
 */
export async function parseQuery(text, { demoMode = false, timeoutMs = 2500 } = {}) {
  const local = parseLocally(text);
  if (demoMode) return { ...local, source: 'local' };
  try {
    const raw = await Promise.race([
      callClaude({ prompt: `Question: ${text}`, systemOverride: systemPrompt(), maxTokens: 300 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('parser timeout')), timeoutMs)),
    ]);
    const parsed = sanitise(extractJson(raw));
    if (parsed.intent === 'unknown' && local.intent !== 'unknown') return { ...local, source: 'local' };
    return { ...parsed, source: 'llm' };
  } catch {
    return { ...local, source: 'local' };
  }
}

/**
 * Validate parsed parameters against the dataset and do any arithmetic in JS.
 * Returns { intent, params } or { clarification }.
 */
export function resolveQuery(parsed) {
  const facilityId = parsed.facilityId && index.facilityById.has(parsed.facilityId.toUpperCase()) ? parsed.facilityId.toUpperCase() : HERO_FACILITY;
  if (facilityId !== HERO_FACILITY) {
    return { clarification: `Rack-level data in this dataset covers ${index.facilityById.get(HERO_FACILITY).name} (${HERO_FACILITY}) only.` };
  }
  if (parsed.clarificationNeeded) return { clarification: parsed.clarificationQuestion || 'Could you add a little more detail?' };

  switch (parsed.intent) {
    case 'stranded_capacity':
    case 'density_readiness':
      return { intent: parsed.intent, params: { facilityId } };
    case 'capacity_check': {
      if (!(parsed.densityKw > 0)) return { clarification: 'At what density per rack (kW)?' };
      let rackCount = parsed.rackCount;
      let requestedKw = null;
      if (!(rackCount > 0) && parsed.requestedPowerValue > 0) {
        requestedKw = parsed.requestedPowerValue * (parsed.requestedPowerUnit === 'MW' ? 1000 : 1);
        rackCount = Math.ceil(requestedKw / parsed.densityKw);
      }
      if (!(rackCount > 0)) return { clarification: 'How many racks, or how much power in total?' };
      return { intent: 'capacity_check', params: { facilityId, rackCount, densityKw: parsed.densityKw, requestedKw } };
    }
    case 'cascade_simulation': {
      const rowId = parsed.rowId && /^[A-X]$/.test(parsed.rowId) ? parsed.rowId : null;
      if (!rowId) return { clarification: 'Which row (A–X)?' };
      if (!(parsed.densityKw > 0)) return { clarification: `What density per rack should Row ${rowId} go to?` };
      return { intent: 'cascade_simulation', params: { facilityId, rowId, densityKw: parsed.densityKw } };
    }
    case 'failure_simulation': {
      const componentId = matchComponent(parsed.failedComponent, facilityId);
      if (!componentId) return { clarification: 'Which component — for example utility feed A, UPS-1 or chiller 1?' };
      return { intent: 'failure_simulation', params: { facilityId, componentId } };
    }
    default:
      return { clarification: 'Try one of the example questions, e.g. "Can we take 2MW at 60kW density?"' };
  }
}
