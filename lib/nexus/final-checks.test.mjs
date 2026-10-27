// lib/nexus/final-checks.test.mjs — PLAN.md §7: the engines reproduce every
// planted number in 18_checks, and no calculation path is non-deterministic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import checks from '../../data/nexus/fixtures/checks.json';
import { nexus, racksOf, getFacility } from './data.js';
import { findStrandedCapacity, canAccommodate } from './capacity-engine.js';
import { propagateChange } from './impact-engine.js';

const fit = () => canAccommodate({ facilityId: 'MUM-1', rackCount: 34, densityKw: 60 });
const hall4 = (f) => f.rowBreakdown.filter((r) => r.hallId === 'MUM-1-H4');
const cascade = () => propagateChange({ facilityId: 'MUM-1', changes: [{ rowId: 'G', newDensityKw: 60 }] });
const round1 = (n) => Math.round(n * 10) / 10;

// Each 18_checks row, recomputed by the engines or the data layer — never read from the sheet.
const COMPUTED = {
  'Scene 1 structural stranded (kW)': () => findStrandedCapacity('MUM-1').structuralKw,
  'Scene 1 planned headroom, Hall 4 (kW)': () => findStrandedCapacity('MUM-1').plannedHeadroomKw,
  'Scene 1 MUM-1 used IT load (kW)': () => round1(racksOf('MUM-1').reduce((s, r) => s + r.used_kw, 0)),
  'Scene 2 Hall 4 free rack positions': () => fit().maxBySpace,
  'Scene 2 Hall 4 power headroom (kW)': () => hall4(fit()).reduce((s, r) => s + r.powerHeadroomKw, 0),
  'Scene 2 Hall 4 cooling headroom (kW)': () => hall4(fit()).reduce((s, r) => s + r.coolingHeadroomKw, 0),
  'Scene 3 components exceeded': () => cascade().breakingPoints.length,
  'Scene 3 components losing redundancy': () => cascade().redundancyLosses.length,
  'Scene 3 upgrade cost (Rs lakh)': () => cascade().totalUpgradeCostInrLakh,
  'Scene 3 critical path (weeks)': () => cascade().criticalPathWeeks,
  'Portfolio design IT load (kW)': () => nexus.facilities.reduce((s, f) => s + f.design_it_kw, 0),
  'Rack records written': () => nexus.racks.length,
  'Rack load total matches row total (kW)': () => round1(nexus.rows.reduce((s, r) => s + r.used_kw, 0)),
  'Occupied racks match row occupancy': () => nexus.racks.filter((r) => r.status === 'occupied').length,
  'Free rack positions in Hall 4': () => racksOf('MUM-1').filter((r) => r.hall_id === 'MUM-1-H4' && r.status === 'free').length,
  'Blocked positions (Row C fragmentation)': () => nexus.racks.filter((r) => r.status === 'blocked').length,
  'Component positions written': () => nexus.componentPositions.length,
};

test('every 18_checks value is reproduced by the engines', () => {
  assert.equal(checks.length, Object.keys(COMPUTED).length, 'a check has no engine mapping');
  for (const c of checks) {
    const compute = COMPUTED[c.check];
    assert.ok(compute, `no engine mapping for "${c.check}"`);
    assert.equal(compute(), c.expected, c.check);
  }
  assert.equal(getFacility('MUM-1').used_it_kw, 6800);
});

test('no Math.random() or Date.now() in any calculation path', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const sources = readdirSync(here).filter((f) => f.endsWith('.js'));
  assert.ok(sources.length >= 8);
  for (const f of sources) {
    const code = readFileSync(join(here, f), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/Math\.random\s*\(/.test(code), `${f} uses Math.random()`);
    assert.ok(!/Date\.now\s*\(/.test(code), `${f} uses Date.now()`);
    assert.ok(!/new Date\(\s*\)/.test(code), `${f} reads the current time`);
  }
});
