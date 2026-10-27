import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCockpit, isCockpitShortcut } from './trigger.js';
import { tataPower } from '../../data/cockpit/tata-power.js';

const FULL = 'Tata Power is evaluating entry into datacentre power infrastructure in India. We want to understand the investment opportunity across captive renewable power, battery storage and grid infrastructure serving hyperscale datacentres.';

test('the full trigger paragraph opens the Tata Power cockpit', () => {
  assert.equal(matchCockpit(FULL), 'tata-power');
});

test('short and fumbled wordings still match', () => {
  for (const p of ['Tata Power datacenter opportunity India', 'tata power — data centre investment in india?', 'TATA POWER: Data Center grid & storage opportunity']) {
    assert.equal(matchCockpit(p), 'tata-power', p);
  }
});

test('unrelated or partial prompts do not match', () => {
  for (const p of ['Where can I put 30 racks at 40kW in Mumbai?', 'Tata Power share price', 'datacentre power investment opportunity in India', 'Tata Power datacentre', 'tata powerhouse data centre india investment']) {
    assert.equal(matchCockpit(p), null, p);
  }
});

test('/cockpit alone is the shortcut', () => {
  assert.ok(isCockpitShortcut('/cockpit'));
  assert.ok(isCockpitShortcut('  /Cockpit '));
  assert.ok(!isCockpitShortcut('/cockpit please'));
});

test('the figures reconcile', () => {
  const g = tataPower.market.growth;
  const cagr = (g.at(-1).sizeBn / g[0].sizeBn) ** (1 / (g.length - 1)) - 1;
  assert.equal(Math.round(cagr * 100), 24);
  assert.equal(Math.round(g.slice(0, 3).reduce((s, x) => s + x.sizeBn, 0)), 22);
  const segs = tataPower.segments.items;
  assert.equal(Math.round(segs.reduce((s, x) => s + x.valueBn, 0) * 10) / 10, g.at(-1).sizeBn);
  assert.equal(segs.reduce((s, x) => s + x.share, 0), 100);
  const rows = tataPower.opportunities.rows.reduce((s, r) => s + Number(r.value.replace(/[$Bn]/g, '')), 0);
  assert.equal(Math.round(rows * 10) / 10, 14);
});

test('the tab data reconciles with the overview', () => {
  const m = tataPower.marketAnalysis;
  const sum = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
  // capacity: 1.5 GW → 6.5 GW, clusters partition it, Mumbai about half
  assert.equal(m.capacity[0].itGw, 1.5);
  assert.equal(m.capacity.at(-1).itGw, 6.5);
  assert.equal(sum(m.clusters.map((c) => c.gw2026)), 1.5);
  assert.equal(sum(m.clusters.map((c) => c.gw2030)), 6.5);
  const mumbai = m.clusters.find((c) => c.city === 'Mumbai');
  assert.ok(mumbai.gw2030 / 6.5 > 0.4 && mumbai.gw2026 / 1.5 >= 0.45);
  // Hyderabad is the fastest-growing cluster, as the overview says
  const growth = (c) => c.gw2030 / c.gw2026;
  assert.equal([...m.clusters].sort((a, b) => growth(b) - growth(a))[0].city, 'Hyderabad');
  // segments: 2026 sums to the first chart year, 2030 to the overview segments
  assert.equal(sum(m.segmentGrowth.map((s) => s.y2026)), tataPower.market.growth[0].sizeBn);
  m.segmentGrowth.forEach((s, i) => assert.equal(s.y2030, tataPower.segments.items[i].valueBn));
  // fit on the overview is the rounded mean of the criteria
  tataPower.opportunityDetails.forEach((d, i) => {
    const v = Object.values(d.scores);
    assert.equal(d.name, tataPower.opportunities.rows[i].name);
    assert.equal(Math.round(v.reduce((a, b) => a + b, 0) / v.length), tataPower.opportunities.rows[i].fit, d.name);
  });
  // roadmap workstreams fit the 48-month window and the overview's phases
  for (const w of tataPower.roadmapDetail.workstreams) assert.ok(w.start >= 0 && w.end <= 48 && w.start < w.end);
  assert.equal(tataPower.roadmapDetail.phases.length, tataPower.roadmap.length);
  const caps = tataPower.competitive.capabilities.length;
  for (const p of tataPower.competitive.players) assert.equal(p.levels.length, caps, p.name);
});

test('every report builds from the data, with no gaps', async () => {
  const { buildReport } = await import('./report-content.js');
  for (const rep of tataPower.reports) {
    const r = buildReport(tataPower, rep.id);
    assert.ok(r.sections.length > 0, rep.id);
    for (const s of r.sections) {
      assert.ok(s.heading && s.lines.length, `${rep.id}: ${s.heading}`);
      for (const l of s.lines) assert.doesNotMatch(l, /undefined|NaN|\[object/, `${rep.id}: ${l}`);
    }
  }
  const market = buildReport(tataPower, 'market');
  assert.ok(market.sections.some((s) => s.heading.startsWith('Segment growth')));
});
