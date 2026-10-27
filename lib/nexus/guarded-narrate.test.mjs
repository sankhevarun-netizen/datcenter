// The shared number guard, driven end to end through a stubbed /api/chat stream.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { guardedNarrate, allowedNumbers } from './guarded-narrate.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function streamReply(chunks) {
  globalThis.fetch = async () => {
    const body = chunks.map((text) => `data: ${JSON.stringify({ text })}\n`).join('') + 'data: [DONE]\n';
    return new Response(body, { status: 200 });
  };
}

const facts = { exposed: '3 tenants', penaltyAtRisk: '₹18.4 lakh', duration: '4 h 15 min' };
const template = 'Template: 3 tenants exposed, ₹18.4 lakh at risk.';

test('a brief using only fact numbers streams through untouched', async () => {
  streamReply(['Three tenants — 3 in all — ', 'carry ₹18.4 lakh ', 'of penalty exposure over 4 h 15 min.']);
  let shown = '';
  const r = await guardedNarrate({ systemPrompt: 's', facts, template, onText: (t) => { shown = t; } });
  assert.equal(r.source, 'llm');
  assert.equal(shown, 'Three tenants — 3 in all — carry ₹18.4 lakh of penalty exposure over 4 h 15 min.');
});

test('a brief that invents a figure is replaced by the template', async () => {
  streamReply(['3 tenants carry ', '₹22.1 lakh of exposure.']);
  let shown = '';
  const r = await guardedNarrate({ systemPrompt: 's', facts, template, onText: (t) => { shown = t; } });
  assert.equal(r.source, 'template');
  assert.equal(r.rejected, '22.1');
  assert.equal(shown, template);
});

test('offline briefs never touch the network', async () => {
  globalThis.fetch = async () => { throw new Error('network used'); };
  const r = await guardedNarrate({ systemPrompt: 's', facts, template, offline: true });
  assert.deepEqual(r, { text: template, source: 'template' });
});

test('a failed request falls back to the template', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 500 });
  const r = await guardedNarrate({ systemPrompt: 's', facts, template });
  assert.equal(r.source, 'template');
});

test('allowed numbers come from nested facts', () => {
  assert.deepEqual([...allowedNumbers({ a: ['1,250 kW', { b: 'Row 7' }] })].sort(), [1250, 7]);
});
