// External conditions: primary → backup → stale → unavailable, with no network.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCategory, externalRisk, clearExternalRiskCache, CATEGORIES, TTL_MS } from '../external-risk/index.js';

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
const fail = (status = 503) => Promise.resolve({ ok: false, status, json: async () => ({}) });

const openMeteo = {
  daily: {
    time: ['2026-10-06', '2026-10-07'],
    temperature_2m_max: [33.4, 41.2],
    precipitation_sum: [12, 140],
    wind_gusts_10m_max: [30, 40],
  },
};
const metNorway = {
  properties: { timeseries: [{ time: '2026-10-06T06:00:00Z', data: { instant: { details: { air_temperature: 31, wind_speed: 4 } }, next_1_hours: { details: { precipitation_amount: 2 } } } }] },
};
const wgi = (value) => [{}, [{ date: '2025', value }]];

// Routes each URL to a stubbed response; records what was called.
function stub(routes) {
  const calls = [];
  const impl = (url) => {
    calls.push(url);
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    return hit ? hit[1]() : fail(404);
  };
  return { impl, calls };
}

beforeEach(() => clearExternalRiskCache());

test('primary source answers: live, with signals over threshold', async () => {
  const { impl, calls } = stub({ 'open-meteo': () => ok(openMeteo) });
  const r = await fetchCategory('weather', 'MUM-1', { fetchImpl: impl, now: () => 1_000 });
  assert.equal(r.status, 'live');
  assert.equal(r.source, 'Open-Meteo');
  assert.equal(calls.length, 1);
  assert.ok(r.signals.some((s) => s.title.startsWith('Heat: 41')));
  assert.ok(r.signals.some((s) => s.title.startsWith('Heavy rain: 140')));
});

test('primary fails: the backup answers and the failure is recorded', async () => {
  const { impl } = stub({ 'open-meteo': () => fail(500), 'met.no': () => ok(metNorway) });
  const r = await fetchCategory('weather', 'MUM-1', { fetchImpl: impl, now: () => 1_000 });
  assert.equal(r.status, 'live');
  assert.equal(r.source, 'MET Norway');
  assert.deepEqual(r.tried, ['Open-Meteo: 500']);
});

test('a second call inside the TTL is served from cache without a request', async () => {
  const { impl, calls } = stub({ 'open-meteo': () => ok(openMeteo) });
  await fetchCategory('weather', 'MUM-1', { fetchImpl: impl, now: () => 1_000 });
  const r = await fetchCategory('weather', 'MUM-1', { fetchImpl: impl, now: () => 1_000 + TTL_MS.weather - 1 });
  assert.equal(r.status, 'cached');
  assert.equal(calls.length, 1);
});

test('both fail after the TTL: the last good answer is served as stale', async () => {
  let up = true;
  const impl = (url) => (up && url.includes('open-meteo') ? ok(openMeteo) : fail(503));
  await fetchCategory('weather', 'CHN-1', { fetchImpl: impl, now: () => 1_000 });
  up = false;
  const r = await fetchCategory('weather', 'CHN-1', { fetchImpl: impl, now: () => 1_000 + TTL_MS.weather + 1 });
  assert.equal(r.status, 'stale');
  assert.equal(r.source, 'Open-Meteo');
  assert.equal(r.tried.length, 2);
});

test('both fail with nothing cached: unavailable, never a throw', async () => {
  const r = await fetchCategory('weather', 'HYD-1', { fetchImpl: () => fail(503), now: () => 1_000 });
  assert.equal(r.status, 'unavailable');
  assert.deepEqual(r.signals, []);
});

test('a network error behaves like a failed source', async () => {
  const impl = () => Promise.reject(new TypeError('fetch failed'));
  const r = await fetchCategory('seismic', 'NCR-1', { fetchImpl: impl, now: () => 1_000 });
  assert.equal(r.status, 'unavailable');
  assert.equal(r.tried.length, 2);
});

test('governance falls back to the rule-of-law series and is cached portfolio-wide', async () => {
  const { impl, calls } = stub({ GOV_WGI_PV: () => ok([{}, []]), GOV_WGI_RL: () => ok(wgi(-0.08)) });
  const a = await fetchCategory('governance', 'MUM-1', { fetchImpl: impl, now: () => 1_000 });
  assert.equal(a.source, 'World Bank WGI (rule of law)');
  assert.match(a.summary, /Rule of law -0\.08 \(2025/);
  const b = await fetchCategory('governance', 'CHN-1', { fetchImpl: impl, now: () => 2_000 });
  assert.equal(b.status, 'cached');
  assert.equal(calls.length, 2);
});

test('externalRisk returns every category plus water stress from the dataset', async () => {
  const r = await externalRisk('CHN-1', { fetchImpl: () => fail(503), now: () => 1_000 });
  assert.deepEqual(Object.keys(r.categories).sort(), [...CATEGORIES].sort());
  assert.ok(r.waterStress);
  assert.equal(r.waterStress.source, '14_water');
});
