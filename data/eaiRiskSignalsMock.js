// ── EAI Risk Signals mock data ─────────────────────────────────────────────
// Owns EXTERNAL / environmental / geospatial / regulatory risk tied to site
// locations — deliberately does NOT duplicate Intelligence Center, which owns
// internal asset-failure / anomaly risk.
//
// Every score here is DERIVED deterministically from eaiFacilities (id →
// seeded PRNG, city/country → published-style hazard classifications) so the
// numbers are reproducible and plausible rather than random on every load.
// Swap-in point for Phase 2 (see bottom): a real Google Earth Engine service
// replaces the deterministic sub-score generator below without changing the
// SITE_RISK shape or any UI that consumes it.

import { eaiFacilities } from '@/data/eaiMockData';

// ── deterministic PRNG (mulberry32, seeded from a string) ────────────────────
function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h || 1;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp100(v) { return Math.max(0, Math.min(100, Math.round(v))); }

// ── geography-aware hazard priors (published-style classifications, not
//    randomly assigned) — e.g. Pacific Ring-of-Fire countries for seismic,
//    WRI Aqueduct-style water-stress tiers, low-lying/delta cities for flood.
const SEISMIC_HIGH_COUNTRIES   = ['Japan', 'Indonesia', 'Chile', 'Mexico'];
const FLOOD_PRONE_CITIES       = ['Jakarta', 'Bangkok', 'Mumbai', 'Amsterdam', 'São Paulo', 'Singapore', 'Hong Kong'];
const WILDFIRE_PRONE_CITIES    = ['Sydney', 'Santiago', 'Denver', 'Johannesburg'];
const GRID_RISK_HIGH_COUNTRIES = ['India', 'Indonesia', 'Thailand', 'South Africa', 'Brazil', 'Mexico', 'UAE'];
const GRID_RISK_LOW_COUNTRIES  = ['USA', 'Canada', 'Netherlands', 'Germany', 'UK', 'Finland', 'Sweden', 'Japan', 'South Korea', 'Singapore', 'Australia'];
const WATER_STRESS_HIGH        = ['UAE', 'India', 'South Africa'];
const WATER_STRESS_MED         = ['China', 'Thailand', 'Mexico', 'Australia'];
const REGULATORY_REGION_BASE   = { EMEA: 45, APAC: 35, 'North America': 25, 'Latin America': 30, Americas: 28, 'Middle East': 40 };

export const HAZARD_LABELS = {
  weather: 'Weather', seismic: 'Seismic', flood: 'Flood', wildfire: 'Wildfire',
  gridReliability: 'Grid Reliability', waterStress: 'Water Stress',
  regulatory: 'Regulatory', geopolitical: 'Geopolitical',
};
const HAZARD_TO_SUB = {
  weather: 'weather', seismic: 'seismic', flood: 'flood', wildfire: 'wildfire',
  grid: 'gridReliability', regulatory: 'regulatory', geopolitical: 'geopolitical',
};

function subScoresFor(f, rng) {
  const seismicBase  = SEISMIC_HIGH_COUNTRIES.includes(f.country) ? 58 : 8;
  const floodBase    = FLOOD_PRONE_CITIES.includes(f.city) ? 55 : 8;
  const wildfireBase = WILDFIRE_PRONE_CITIES.includes(f.city) ? 48 : 5;
  const gridBase     = GRID_RISK_HIGH_COUNTRIES.includes(f.country) ? 48
                      : GRID_RISK_LOW_COUNTRIES.includes(f.country) ? 8 : 28;
  const waterBase    = WATER_STRESS_HIGH.includes(f.country) ? 55
                      : WATER_STRESS_MED.includes(f.country) ? 30 : 10;
  const regBase      = REGULATORY_REGION_BASE[f.region] ?? 28;
  const weatherBase  = Math.abs(f.lat) < 23.5 ? 34 : 14; // tropical belt → higher storm/heat exposure

  return {
    weather:         clamp100(weatherBase + rng() * 32),
    seismic:         clamp100(seismicBase + rng() * 26),
    flood:           clamp100(floodBase + rng() * 26),
    wildfire:        clamp100(wildfireBase + rng() * 24),
    gridReliability: clamp100(gridBase + rng() * 26),
    waterStress:     clamp100(waterBase + rng() * 24),
    regulatory:      clamp100(regBase + rng() * 20),
    geopolitical:    clamp100(15 + rng() * 38),
  };
}

const COMPOSITE_WEIGHTS = {
  weather: 0.15, seismic: 0.12, flood: 0.15, wildfire: 0.10,
  gridReliability: 0.18, waterStress: 0.10, regulatory: 0.10, geopolitical: 0.10,
};
const PEAK_WEIGHT = 0.40;
function compositeScore(sub) {
  let sum = 0, wsum = 0, peak = 0;
  for (const k in COMPOSITE_WEIGHTS) {
    const v = sub[k] ?? 0;
    sum += v * COMPOSITE_WEIGHTS[k];
    wsum += COMPOSITE_WEIGHTS[k];
    if (v > peak) peak = v;
  }
  const mean = sum / wsum;
  return clamp100(mean * (1 - PEAK_WEIGHT) + peak * PEAK_WEIGHT);
}
function bandFor(score) {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'elevated';
  return 'low';
}
// Risk climbs toward the current score across the window rather than hovering
// flat around it, so the portfolio trend line and the forecast extrapolated from
// it both have a direction to show. Previously this produced 28,29,29,28,29,28
// — a dead line with an unexplained jump on the final point.
function trendFor(seedStr, current, weeks = 8) {
  const rng = mulberry32(seedFromString(`${seedStr}-trend`));
  const pts = Array.from({ length: weeks }, (_, i) => {
    const t = i / (weeks - 1);
    const ramp = current - 13 * (1 - t);   // starts ~13 below, climbs to current
    const wobble = (rng() - 0.5) * 5;      // small week-to-week noise
    return { week: `W${i + 1}`, value: clamp100(ramp + wobble) };
  });
  pts[pts.length - 1] = { week: pts[pts.length - 1].week, value: current };
  return pts;
}

// ── SITE_RISK ──────────────────────────────────────────────────────────────
export const SITE_RISK = eaiFacilities.map(f => {
  const rng = mulberry32(seedFromString(f.id));
  const sub = subScoresFor(f, rng);
  const riskScore = compositeScore(sub);
  return {
    facilityId: f.id, name: f.name, city: f.city, country: f.country,
    lat: f.lat, lon: f.lon, region: f.region, status: f.status,
    riskScore, band: bandFor(riskScore), sub,
    trend: trendFor(f.id, riskScore),
  };
});

// ── SIGNAL_FEED ────────────────────────────────────────────────────────────
const SIGNAL_TEMPLATES = {
  weather:      [{ title: n => `Severe storm warning issued near ${n}`, source: 'Open-Meteo Severe Weather' },
                 { title: n => `Heatwave advisory affecting ${n} region`, source: 'Open-Meteo Forecast' },
                 { title: n => `High wind advisory near ${n}`, source: 'Open-Meteo Forecast' }],
  seismic:      [{ title: n => `M4.2 earthquake detected within 150km of ${n}`, source: 'USGS Earthquake Feed' },
                 { title: n => `Minor seismic activity cluster near ${n}`, source: 'USGS Earthquake Feed' }],
  flood:        [{ title: n => `River/coastal flood watch issued for ${n} area`, source: 'Open-Meteo Precipitation' },
                 { title: n => `Heavy rainfall accumulation risk near ${n}`, source: 'Open-Meteo Precipitation' }],
  wildfire:     [{ title: n => `Elevated wildfire danger rating near ${n}`, source: 'Fire Weather Outlook' },
                 { title: n => `Smoke / air-quality advisory affecting ${n}`, source: 'Open-Meteo Air Quality' }],
  grid:         [{ title: n => `Grid reliability advisory for ${n} service territory`, source: 'Regional Grid Operator' },
                 { title: n => `Planned load-shedding risk flagged near ${n}`, source: 'Regional Grid Operator' }],
  regulatory:   [{ title: n => `New data-sovereignty rule proposed affecting ${n}`, source: 'Regulatory Monitor' },
                 { title: n => `Environmental permitting update for ${n} jurisdiction`, source: 'Regulatory Monitor' }],
  geopolitical: [{ title: n => `Cross-border policy shift may affect ${n} operations`, source: 'Geopolitical Risk Wire' },
                 { title: n => `Trade / tariff change flagged for ${n} region`, source: 'Geopolitical Risk Wire' }],
};
const SEVERITY_RANK = { critical: 3, warning: 2, watch: 1, info: 0 };
const AGO_LADDER = [
  '2 min ago', '6 min ago', '11 min ago', '18 min ago', '27 min ago', '38 min ago', '52 min ago',
  '1 hr ago', '1 hr ago', '2 hr ago', '2 hr ago', '3 hr ago', '4 hr ago', '5 hr ago', '6 hr ago',
  '8 hr ago', '10 hr ago', '14 hr ago', '18 hr ago', '22 hr ago',
  '1 day ago', '1 day ago', '2 days ago', '2 days ago', '3 days ago',
];

function pickWeightedType(sub, rng) {
  const entries = Object.entries(HAZARD_TO_SUB);
  const weights = entries.map(([, subKey]) => Math.max(1, sub[subKey]));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < entries.length; i++) { r -= weights[i]; if (r <= 0) return entries[i][0]; }
  return entries[entries.length - 1][0];
}

function buildSignalFeed() {
  const items = [];
  SITE_RISK.forEach(site => {
    const rng = mulberry32(seedFromString(`${site.facilityId}-signals`));
    const nSignals = site.band === 'critical' ? 3 : site.band === 'high' ? 2 : site.band === 'elevated' ? 1 : (rng() < 0.35 ? 1 : 0);
    for (let i = 0; i < nSignals; i++) {
      const type = pickWeightedType(site.sub, rng);
      const templates = SIGNAL_TEMPLATES[type];
      const tmpl = templates[Math.floor(rng() * templates.length)];
      const hazardScore = site.sub[HAZARD_TO_SUB[type]] ?? site.riskScore;
      const severity = hazardScore >= 75 ? 'critical' : hazardScore >= 55 ? 'warning' : hazardScore >= 35 ? 'watch' : 'info';
      items.push({
        id: `sig-${site.facilityId}-${i}`,
        type, severity,
        facilityId: site.facilityId,
        title: tmpl.title(site.name),
        source: tmpl.source,
        sourceUrl: '#',
        lat: site.lat, lon: site.lon,
        _tiebreak: seedFromString(`${site.facilityId}-${i}-order`),
      });
    }
  });
  items.sort((a, b) => (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) || (b._tiebreak - a._tiebreak));
  return items.map((it, i) => {
    const { _tiebreak, ...rest } = it;
    return { ...rest, ago: AGO_LADDER[i % AGO_LADDER.length] };
  });
}
export const SIGNAL_FEED = buildSignalFeed();

// ── HAZARD_LAYERS ──────────────────────────────────────────────────────────
export const HAZARD_LAYERS = [
  { key: 'weather',      label: 'Weather',         color: '#0077C8', defaultOn: true  },
  { key: 'seismic',      label: 'Seismic',         color: '#F59E0B', defaultOn: false },
  { key: 'flood',        label: 'Flood',           color: '#06B6D4', defaultOn: false },
  { key: 'wildfire',     label: 'Wildfire',        color: '#EF4444', defaultOn: false },
  { key: 'grid',         label: 'Grid Reliability',color: '#7C3AED', defaultOn: false },
  { key: 'regulatory',   label: 'Regulatory',      color: '#10B981', defaultOn: false },
  { key: 'geopolitical', label: 'Geopolitical',    color: '#6B7280', defaultOn: false },
];

// ── RISK_BY_CATEGORY (donut) ───────────────────────────────────────────────
const CATEGORY_COLORS = {
  weather: '#0077C8', seismic: '#F59E0B', flood: '#06B6D4', wildfire: '#EF4444',
  gridReliability: '#7C3AED', waterStress: '#00A36C', regulatory: '#10B981', geopolitical: '#6B7280',
};
export const RISK_BY_CATEGORY = (() => {
  const keys = Object.keys(HAZARD_LABELS);
  const avgs = keys.map(k => ({ key: k, avg: SITE_RISK.reduce((s, x) => s + x.sub[k], 0) / SITE_RISK.length }));
  const total = avgs.reduce((s, a) => s + a.avg, 0) || 1;
  return avgs.map(a => ({
    name: HAZARD_LABELS[a.key], color: CATEGORY_COLORS[a.key],
    value: Math.round(a.avg), pct: Math.round((a.avg / total) * 100),
  }));
})();

// ── RISK_TREND (portfolio-wide, 8 weeks) ───────────────────────────────────
export const RISK_TREND = Array.from({ length: 8 }, (_, i) => ({
  week: `W${i + 1}`,
  value: Math.round(SITE_RISK.reduce((s, x) => s + x.trend[i].value, 0) / SITE_RISK.length),
}));

// ── RISK_FORECAST (next 4 weeks projected, for ForecastChart) ─────────────
export const RISK_FORECAST = (() => {
  const actualWeeks = RISK_TREND.slice(-4);
  const last = actualWeeks[actualWeeks.length - 1].value;
  const prev = actualWeeks[actualWeeks.length - 2]?.value ?? last;
  const slope = (last - prev) * 0.6; // damped extrapolation
  const rows = actualWeeks.map(w => ({ month: w.week, actual: w.value, forecast: null }));
  rows[rows.length - 1] = { ...rows[rows.length - 1], forecast: last };
  for (let i = 1; i <= 4; i++) {
    rows.push({ month: `W${8 + i}`, actual: null, forecast: clamp100(last + slope * i) });
  }
  return rows;
})();
// The High-band floor (55), not the Critical floor (75). A portfolio average
// cannot reach 75 without every site simultaneously in crisis, which left the
// projection annotation permanently reading "not projected".
export const RISK_FORECAST_THRESHOLD = 55;
// First projected week that crosses the threshold. This also tested
// `month.startsWith('W9')`, which pinned the annotation to week 9 alone — a
// crossing in W10-W12 was silently reported as "not projected within 4 weeks".
export const RISK_FORECAST_EXCEED_WEEK = (() => {
  const hit = RISK_FORECAST.find(r => r.actual === null && (r.forecast ?? 0) >= RISK_FORECAST_THRESHOLD);
  return hit ? hit.month : null;
})();

// ── TOP_AT_RISK_SITES ──────────────────────────────────────────────────────
export const TOP_AT_RISK_SITES = [...SITE_RISK]
  .sort((a, b) => b.riskScore - a.riskScore)
  .slice(0, 10)
  .map(s => {
    const topHazardKey = Object.entries(s.sub).sort((a, b) => b[1] - a[1])[0][0];
    return { ...s, topHazard: HAZARD_LABELS[topHazardKey] ?? topHazardKey, topHazardKey };
  });

// ── REGULATORY_WATCH ────────────────────────────────────────────────────────
function sitesIn(region) { return SITE_RISK.filter(s => s.region === region).map(s => s.facilityId); }
export const REGULATORY_WATCH = [
  { id: 'reg-1', jurisdiction: 'European Union', title: 'EU Energy Efficiency Directive — mandatory PUE & WUE reporting', effectiveDate: 'Jul 2025', status: 'Pending',   impact: 'High',   affectedSites: sitesIn('EMEA') },
  { id: 'reg-2', jurisdiction: 'European Union', title: 'EU Data Act — cross-border data transfer & sovereignty rules',   effectiveDate: 'Sep 2025', status: 'Proposed',  impact: 'High',   affectedSites: sitesIn('EMEA') },
  { id: 'reg-3', jurisdiction: 'Singapore',      title: 'IMDA Green Data Centre standard — renewable sourcing targets',    effectiveDate: 'Jan 2026', status: 'Finalized', impact: 'Medium', affectedSites: SITE_RISK.filter(s => s.city === 'Singapore').map(s => s.facilityId) },
  { id: 'reg-4', jurisdiction: 'India',          title: 'CERT-In critical infrastructure incident-reporting mandate',      effectiveDate: 'Jun 2025', status: 'In Force', impact: 'High',   affectedSites: SITE_RISK.filter(s => s.country === 'India').map(s => s.facilityId) },
  { id: 'reg-5', jurisdiction: 'United States',  title: 'FERC grid-interconnection queue reform for large loads',          effectiveDate: 'Q4 2025', status: 'Proposed',  impact: 'Medium', affectedSites: SITE_RISK.filter(s => s.country === 'USA').map(s => s.facilityId) },
  { id: 'reg-6', jurisdiction: 'China',          title: 'PIPL cross-border data export security assessment update',        effectiveDate: 'Aug 2025', status: 'Pending',   impact: 'High',   affectedSites: SITE_RISK.filter(s => s.country === 'China').map(s => s.facilityId) },
  { id: 'reg-7', jurisdiction: 'UAE',            title: 'UAE water-usage disclosure requirement for large industrial users', effectiveDate: 'Mar 2026', status: 'Proposed', impact: 'Medium', affectedSites: SITE_RISK.filter(s => s.country === 'UAE').map(s => s.facilityId) },
  { id: 'reg-8', jurisdiction: 'Australia',      title: 'AEMO grid-reliability standard for critical-load connections',    effectiveDate: 'Nov 2025', status: 'Finalized', impact: 'Low',    affectedSites: SITE_RISK.filter(s => s.country === 'Australia').map(s => s.facilityId) },
];

// ── MITIGATIONS ──────────────────────────────────────────────────────────────
export const MITIGATION_TEMPLATES = {
  weather:         'Review severe-weather runbooks and confirm backup generator fuel reserves.',
  seismic:         'Verify seismic bracing on raised floors and critical rack containment.',
  flood:           'Inspect perimeter flood barriers and sump-pump redundancy.',
  wildfire:        'Confirm defensible-space clearance and air-filtration intake protection.',
  gridReliability: 'Validate N+1 generator failover and extend fuel supply contracts.',
  waterStress:     'Evaluate closed-loop or air-cooled chiller retrofit to cut water draw.',
  regulatory:      'Engage local counsel to confirm compliance timeline for pending rules.',
  geopolitical:    'Review business-continuity plan for regional disruption scenarios.',
};
export const MITIGATIONS = TOP_AT_RISK_SITES.flatMap(s => {
  const top2 = Object.entries(s.sub).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return top2.map(([hazardKey, score]) => ({
    id: `mit-${s.facilityId}-${hazardKey}`,
    facilityId: s.facilityId, facilityName: s.name,
    hazard: HAZARD_LABELS[hazardKey] ?? hazardKey, hazardKey, score,
    recommendation: MITIGATION_TEMPLATES[hazardKey],
    priority: score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low',
  }));
});

// ── RISK_KPIS ────────────────────────────────────────────────────────────────
export const RISK_KPIS = [
  { key: 'sitesAtRisk',       label: 'Sites at Risk',              value: SITE_RISK.filter(s => s.band === 'high' || s.band === 'critical').length, unit: '',    sublabel: `of ${SITE_RISK.length} facilities`,        delta: '▲2 vs last week',    up: false, iconKey: 'building',    color: '#EF4444', bg: 'rgba(239,68,68,0.14)',  seed: 11 },
  { key: 'activeSignals24h',  label: 'Active Signals (24h)',       value: SIGNAL_FEED.length,                              unit: '',    sublabel: 'Across all hazard types',                   delta: '▲6 vs yesterday',    up: false, iconKey: 'activity',    color: '#0077C8', bg: 'rgba(0,119,200,0.14)',  seed: 22 },
  { key: 'highSeveritySignals', label: 'High-Severity Signals',    value: SIGNAL_FEED.filter(s => s.severity === 'critical' || s.severity === 'warning').length, unit: '', sublabel: 'Critical + Warning', delta: '▲3 vs yesterday', up: false, iconKey: 'shieldAlert', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)', seed: 33 },
  { key: 'avgSiteRisk',       label: 'Avg Site Risk Score',        value: Math.round(SITE_RISK.reduce((s, x) => s + x.riskScore, 0) / SITE_RISK.length), unit: '/100', sublabel: 'Composite, all sites', delta: '▼1.4 vs last week', up: true, iconKey: 'zap', color: '#7C3AED', bg: 'rgba(124,58,237,0.14)', seed: 44 },
  { key: 'regulatoryPending', label: 'Regulatory Changes Pending', value: REGULATORY_WATCH.filter(r => r.status === 'Pending' || r.status === 'Proposed').length, unit: '', sublabel: 'Tracked jurisdictions', delta: '▲1 this month', up: false, iconKey: 'layers', color: '#10B981', bg: 'rgba(16,185,129,0.14)', seed: 55 },
  { key: 'signalsIngested24h',label: 'Signals Ingested (24h)',     value: SIGNAL_FEED.length + Math.round(SIGNAL_FEED.length * 0.6), unit: '', sublabel: 'Weather · seismic · regulatory feeds', delta: '▲12% vs yesterday', up: true, iconKey: 'droplets', color: '#00A36C', bg: 'rgba(0,163,108,0.14)', seed: 66 },
];

// ── PHASE 2 (not built now) ───────────────────────────────────────────────
// Real Google Earth Engine integration (NDVI / land-surface-temperature /
// flood-extent rasters via a GEE service account + tile export) replaces
// subScoresFor()'s deterministic priors above as the geospatial source. The
// SITE_RISK shape (facilityId, riskScore, band, sub{...}, trend[]) and the
// map overlay contract (HAZARD_LAYERS keys) are already structured so that
// swap is a data-source change only — no UI changes required.
