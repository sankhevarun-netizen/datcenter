// lib/external-risk/index.js — live external conditions per facility.
//
// Each category has a primary and a backup source. A category resolves to
// the first source that answers; if both fail it serves the last good answer
// (marked stale), and if there is none, 'unavailable'. Every call has a hard
// timeout and results are cached for as long as the data stays meaningful,
// so a page never waits on, or depends on, a third party.
//
// These signals are shown beside the site-risk scores, never inside them:
// scores come only from the dataset.
import { getFacility, index } from '../nexus/data.js';

const TIMEOUT_MS = 4000;
export const TTL_MS = {
  weather: 60 * 60_000,
  seismic: 60 * 60_000,
  unrest: 6 * 60 * 60_000,
  regulatory: 12 * 60 * 60_000,
  supply: 12 * 60 * 60_000,
  governance: 7 * 24 * 60 * 60_000,
};
export const CATEGORIES = Object.keys(TTL_MS);

const cache = new Map(); // key → { at, value }

async function getJson(url, fetchImpl, init = {}, timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const km = (a, b) => {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};

// ── weather ────────────────────────────────────────────────────────────────
const HEAT_C = 40, RAIN_MM = 100, GUST_KMH = 70;

function weatherSignals(days, source) {
  const out = [];
  for (const d of days) {
    if (d.maxC >= HEAT_C) out.push({ severity: d.maxC >= 44 ? 'high' : 'medium', title: `Heat: ${d.maxC} °C forecast on ${d.date}`, detail: 'Above the 40 °C planning threshold for chiller and generator derating', source });
    if (d.rainMm >= RAIN_MM) out.push({ severity: d.rainMm >= 200 ? 'high' : 'medium', title: `Heavy rain: ${d.rainMm} mm forecast on ${d.date}`, detail: 'Flood and access risk; check drainage and fuel logistics', source });
    if (d.gustKmh >= GUST_KMH) out.push({ severity: d.gustKmh >= 100 ? 'high' : 'medium', title: `Wind: gusts to ${d.gustKmh} km/h on ${d.date}`, detail: 'Cooling-tower and overhead-feed exposure', source });
  }
  return out;
}

const weather = [
  {
    name: 'Open-Meteo',
    run: async (f, fetchImpl) => {
      const d = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${f.lat}&longitude=${f.lon}&daily=temperature_2m_max,precipitation_sum,wind_gusts_10m_max&forecast_days=7&timezone=auto`, fetchImpl);
      const days = d.daily.time.map((date, i) => ({ date, maxC: Math.round(d.daily.temperature_2m_max[i]), rainMm: Math.round(d.daily.precipitation_sum[i]), gustKmh: Math.round(d.daily.wind_gusts_10m_max[i]) }));
      return { summary: `7-day outlook: max ${Math.max(...days.map((x) => x.maxC))} °C, wettest day ${Math.max(...days.map((x) => x.rainMm))} mm`, signals: weatherSignals(days, 'Open-Meteo') };
    },
  },
  {
    name: 'MET Norway',
    run: async (f, fetchImpl) => {
      const d = await getJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${f.lat.toFixed(3)}&lon=${f.lon.toFixed(3)}`, fetchImpl, { headers: { 'User-Agent': 'K-Nexus/1.0 operations-risk' } });
      const byDay = new Map();
      for (const t of d.properties.timeseries) {
        const date = t.time.slice(0, 10);
        const cur = byDay.get(date) ?? { date, maxC: -99, rainMm: 0, gustKmh: 0 };
        cur.maxC = Math.max(cur.maxC, Math.round(t.data.instant.details.air_temperature));
        cur.rainMm += Math.round(t.data.next_1_hours?.details?.precipitation_amount ?? 0);
        cur.gustKmh = Math.max(cur.gustKmh, Math.round((t.data.instant.details.wind_speed ?? 0) * 3.6 * 1.5));
        byDay.set(date, cur);
      }
      const days = [...byDay.values()].slice(0, 7);
      return { summary: `7-day outlook: max ${Math.max(...days.map((x) => x.maxC))} °C`, signals: weatherSignals(days, 'MET Norway') };
    },
  },
];

// ── seismic ────────────────────────────────────────────────────────────────
const QUAKE_KM = 500;
function quakeSignals(events, f, source) {
  return events
    .map((e) => ({ ...e, distanceKm: km(f, e) }))
    .filter((e) => e.distanceKm <= QUAKE_KM)
    .sort((a, b) => b.mag - a.mag)
    .slice(0, 5)
    .map((e) => ({ severity: e.mag >= 6 ? 'high' : 'medium', title: `M${e.mag.toFixed(1)} earthquake ${e.distanceKm} km away`, detail: `${e.place} · ${e.at.slice(0, 10)}`, source }));
}
const seismic = [
  {
    name: 'USGS',
    run: async (f, fetchImpl) => {
      const d = await getJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4.5&latitude=${f.lat}&longitude=${f.lon}&maxradiuskm=${QUAKE_KM}&orderby=time&limit=50`, fetchImpl);
      const events = d.features.map((q) => ({ mag: q.properties.mag, place: q.properties.place, at: new Date(q.properties.time).toISOString(), lat: q.geometry.coordinates[1], lon: q.geometry.coordinates[0] }));
      return { summary: `${events.length || 'No'} M4.5+ events within ${QUAKE_KM} km in the record`, signals: quakeSignals(events, f, 'USGS') };
    },
  },
  {
    name: 'EMSC',
    run: async (f, fetchImpl) => {
      const d = await getJson(`https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=4.5&lat=${f.lat}&lon=${f.lon}&maxradius=${(QUAKE_KM / 111).toFixed(1)}&limit=50`, fetchImpl);
      const events = d.features.map((q) => ({ mag: q.properties.mag, place: q.properties.flynn_region, at: q.properties.time, lat: q.properties.lat, lon: q.properties.lon }));
      return { summary: `${events.length || 'No'} M4.5+ events within ${QUAKE_KM} km`, signals: quakeSignals(events, f, 'EMSC') };
    },
  },
];

// ── news-based categories ──────────────────────────────────────────────────
// GDELT allows one request every five seconds and is slow to answer, so its
// calls are queued with spacing and a longer timeout. Results are cached for
// hours, so the queue only matters on a cold start.
const GDELT_SPACING_MS = 5500;
const GDELT_TIMEOUT_MS = 15000;
let gdeltQueue = Promise.resolve();
let gdeltLast = 0;
function gdeltSlot() {
  const slot = gdeltQueue.then(async () => {
    const wait = gdeltLast + GDELT_SPACING_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    gdeltLast = Date.now();
  });
  gdeltQueue = slot.catch(() => {});
  return slot;
}

async function gdelt(query, fetchImpl, source = 'GDELT') {
  await gdeltSlot();
  const d = await getJson(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=8&timespan=7d&sort=hybridrel&format=json`, fetchImpl, {}, GDELT_TIMEOUT_MS);
  const items = (d.articles ?? []).slice(0, 5).map((a) => ({ severity: 'info', title: a.title, detail: `${a.domain} · ${String(a.seendate).slice(0, 8)}`, url: a.url, source }));
  return { summary: `${items.length} recent reports`, signals: items };
}

// Search with summarisation takes several seconds; it is cached for hours.
const TAVILY_TIMEOUT_MS = 10000;

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const dayOf = (d) => { const t = Date.parse(d ?? ''); return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10); };

async function tavily(query, fetchImpl) {
  if (!process.env.TAVILY_API_KEY) throw new Error('no key');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TAVILY_TIMEOUT_MS);
  try {
    const res = await fetchImpl('https://api.tavily.com/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: 5, include_answer: false, search_depth: 'basic', topic: 'news', days: 14 }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const d = await res.json();
    // Page snippets carry navigation and ad text; the outlet and date are enough.
    const items = (d.results ?? []).map((r) => ({ severity: 'info', title: r.title, detail: [hostOf(r.url), dayOf(r.published_date)].filter(Boolean).join(' · '), url: r.url, source: 'Tavily' }));
    return { summary: `${items.length} recent reports`, signals: items };
  } finally {
    clearTimeout(timer);
  }
}

const unrestQuery = (f) => `"${f.city}" (strike OR curfew OR protest OR "power cut" OR blackout OR "load shedding" OR flooding) sourcecountry:IN`;
const regulatoryQuery = (f) => `"${f.state}" data centre (policy OR regulation OR tariff OR electricity) India`;
const supplyQuery = () => {
  const origins = [...new Set([...index.supplyByComponentType.values()].filter((s) => s.single_source === 'yes' && s.origin_country !== 'India').map((s) => s.origin_country))];
  return `(${origins.map((o) => `"${o}"`).join(' OR ')}) (export controls OR shipping disruption OR "Red Sea" OR sanctions) ("data centre" OR "data center") (switchgear OR chiller OR transformer OR busway OR "uninterruptible power")`;
};

const unrest = [
  { name: 'GDELT', run: (f, fx) => gdelt(unrestQuery(f), fx) },
  { name: 'Tavily', run: (f, fx) => tavily(`${f.city} ${f.state} strike curfew power cut this week`, fx) },
];
const regulatory = [
  { name: 'Tavily', run: (f, fx) => tavily(`${f.state} India data centre policy electricity regulation 2026`, fx) },
  { name: 'GDELT', run: (f, fx) => gdelt(regulatoryQuery(f), fx) },
];
const supply = [
  { name: 'GDELT', run: (f, fx) => gdelt(supplyQuery(), fx) },
  { name: 'Tavily', run: (f, fx) => tavily('data centre electrical equipment shortage transformer switchgear chiller lead times', fx) },
];

// ── governance ─────────────────────────────────────────────────────────────
async function wgi(code, label, fetchImpl) {
  const d = await getJson(`https://api.worldbank.org/v2/country/IND/indicator/${code}?source=3&format=json&per_page=10`, fetchImpl);
  const latest = (d[1] ?? []).find((r) => r.value !== null);
  if (!latest) throw new Error('no value');
  const v = Math.round(latest.value * 100) / 100;
  return {
    summary: `${label} ${v} (${latest.date}, scale −2.5 to +2.5)`,
    signals: [{ severity: v < -0.5 ? 'medium' : 'info', title: `India ${label.toLowerCase()} estimate ${v} (${latest.date})`, detail: `World Bank Worldwide Governance Indicators, ${code}`, source: 'World Bank' }],
  };
}

const governance = [
  { name: 'World Bank WGI', run: (f, fx) => wgi('GOV_WGI_PV.EST', 'Political stability', fx) },
  { name: 'World Bank WGI (rule of law)', run: (f, fx) => wgi('GOV_WGI_RL.EST', 'Rule of law', fx) },
];

const PROVIDERS = { weather, seismic, unrest, regulatory, supply, governance };

/** One category for one facility: primary, then backup, then stale cache. */
export async function fetchCategory(category, facilityId, { fetchImpl = fetch, now = Date.now } = {}) {
  const f = getFacility(facilityId);
  const site = { lat: f.lat, lon: f.lon, city: f.city, state: f.state };
  const key = category === 'supply' || category === 'governance' ? `${category}:portfolio` : `${category}:${facilityId}`;
  const hit = cache.get(key);
  if (hit && now() - hit.at < TTL_MS[category]) return { ...hit.value, status: 'cached' };
  const tried = [];
  for (const p of PROVIDERS[category]) {
    try {
      const value = { category, source: p.name, fetchedAt: new Date(now()).toISOString(), ...(await p.run(site, fetchImpl)) };
      cache.set(key, { at: now(), value });
      return { ...value, status: 'live', tried };
    } catch (err) {
      tried.push(`${p.name}: ${err.name === 'AbortError' ? 'timeout' : err.message}`);
    }
  }
  if (hit) return { ...hit.value, status: 'stale', tried };
  return { category, status: 'unavailable', source: null, summary: 'No source answered', signals: [], tried };
}

/** All categories for a facility, in parallel; never throws. */
export async function externalRisk(facilityId, opts = {}) {
  const results = await Promise.all(CATEGORIES.map((c) => fetchCategory(c, facilityId, opts)));
  const water = (index.waterByFacility.get(facilityId) ?? []).at(-1);
  return {
    facilityId,
    categories: Object.fromEntries(results.map((r) => [r.category, r])),
    waterStress: water ? { label: water.local_water_stress, index: water.stress_index, source: '14_water' } : null,
  };
}

export function clearExternalRiskCache() {
  cache.clear();
}
