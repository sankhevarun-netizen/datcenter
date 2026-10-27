// The platform registry: one vocabulary, honest status, no dead clicks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { LENSES, ENGINES, TOOLS, STOPS, PHASES, STATUS } from '../platform-registry.js';

const routeExists = (href) => {
  const p = href.split('?')[0].replace(/^\//, '');
  return existsSync(path.join('app', p, 'page.jsx')) || existsSync(path.join('app', p, 'page.js'));
};

test('every wired lens, tool and stop routes to a page that exists; roadmap ones route nowhere', () => {
  for (const item of [...LENSES, ...TOOLS.filter((t) => t.href), ...STOPS]) {
    assert.ok(STATUS[item.status], `${item.id} has a known status`);
    if (item.status === 'roadmap') assert.ok(!item.href || item.id === 'exa', `${item.id} is roadmap and must not route`);
    else if (item.href) assert.ok(routeExists(item.href), `${item.id} → ${item.href} must exist`);
  }
  for (const s of STOPS) if (s.status !== 'roadmap') assert.ok(s.href, `${s.id} is wired, so it needs a route`);
});

test('lens names are the sidebar names: the sidebar reads them from the registry', () => {
  const layout = readFileSync('components/command-center/CCLayout.jsx', 'utf8');
  assert.match(layout, /from '@\/lib\/platform-registry'/);
  for (const l of LENSES) assert.ok(layout.includes(`lensOf('${l.id}')`), `${l.label} is in the sidebar via the registry`);
  // Stops for the same capability use the same name.
  for (const s of STOPS) {
    const lens = LENSES.find((l) => l.href === s.href);
    if (lens) assert.equal(s.title, lens.label, `${s.id} is named like its lens`);
  }
});

test('engines named by lenses exist; modules are real files', () => {
  for (const l of LENSES) for (const e of l.engines) assert.ok(ENGINES.some((x) => x.id === e), `${l.id} → ${e}`);
  for (const e of ENGINES) assert.ok(existsSync(path.join('lib', 'nexus', `${e.module}.js`)), `${e.module}.js`);
});

test('every stop belongs to a phase, and live tools are backed by code', () => {
  for (const s of STOPS) assert.ok(PHASES.some((p) => p.id === s.phase), s.id);
  for (const p of PHASES) assert.ok(STOPS.some((s) => s.phase === p.id), `${p.id} has stops`);
  const tavily = readFileSync('lib/external-risk/index.js', 'utf8');
  assert.match(tavily, /api\.tavily\.com/);
  assert.ok(existsSync('app/api/peeringdb-india/route.js'));
  assert.equal(TOOLS.find((t) => t.id === 'exa').status, 'roadmap', 'Exa has no key configured');
});

test('services: phase counts add up to the header counts; audited links', async () => {
  const { countBy } = await import('../platform-registry.js');
  for (const st of Object.keys(STATUS)) {
    const perPhase = PHASES.reduce((n, p) => n + countBy(STOPS.filter((s) => s.phase === p.id), st), 0);
    assert.equal(perPhase, countBy(STOPS, st), st);
  }
  assert.equal(PHASES.reduce((n, p) => n + STOPS.filter((s) => s.phase === p.id).length, 0), STOPS.length);
  // Global Infrastructure is live only on the PeeringDB-backed dashboard.
  assert.equal(STOPS.find((s) => s.id === 'global-infra').href, '/dashboard');
  assert.match(readFileSync('components/pages/GlobalDashboard.jsx', 'utf8'), /\/api\/peeringdb/);
});
