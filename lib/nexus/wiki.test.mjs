// Knowledge graph: ontology, dedupe, embeddings, redaction and retrieval.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { canonicalPath, conceptFor, resolveLink } from '../wiki/ontology.js';
import { parsePage, mergePages, redactor, stripFigures } from '../wiki/markdown.js';
import { lexicalEmbedding, cosine, DIMS } from '../wiki/embed.js';
import { fsBackend } from '../wiki/fs-backend.js';
import { writePage, buildKnowledgeGraph, searchKnowledge } from '../wiki/knowledge.js';

const lexical = async (t) => ({ vector: lexicalEmbedding(t), method: 'lexical-512' });
const page = (title, body, extra = '') => `---\ntitle: "${title}"\ntags: [a, b]\nupdated: "2025-01-10"${extra}\n---\n\n${body}`;

test('ontology folds the variants of one idea into one path', () => {
  for (const p of ['concepts/joint-venture-jv', 'concepts/joint-venture-structures.md', 'concepts/Joint Venture', 'patterns/jv']) {
    assert.equal(canonicalPath(p), 'concepts/joint-venture');
  }
  assert.equal(canonicalPath('concepts/tier-3-data-center'), 'concepts/tier-3-data-centre');
  assert.equal(canonicalPath('market/india-data-center'), 'market/india-dc-market');
  // A new idea keeps its folder with a clean slug; a global outlook is not the India one.
  assert.equal(canonicalPath('concepts/Power Purchase Agreement'), 'concepts/power-purchase-agreement');
  assert.equal(canonicalPath('market/2030-market-outlook'), 'market/2030-market-outlook');
  assert.equal(conceptFor('Tier III')?.path, 'concepts/tier-3-data-centre');
});

test('wikilinks resolve through aliases to stored pages', () => {
  const pages = new Map([['concepts/tier-3-data-centre', { title: 'Tier III Data Centre Standard' }], ['patterns/power-as-moat', { title: 'Power as Competitive Moat' }]]);
  assert.equal(resolveLink('Tier-3', pages), 'concepts/tier-3-data-centre');
  assert.equal(resolveLink('Power as Competitive Moat|moat', pages), 'patterns/power-as-moat');
  assert.equal(resolveLink('Unknown idea', pages), null);
});

test('merging duplicates keeps the longest page whole and adds only new sections', () => {
  const a = { path: 'concepts/joint-venture', ...parsePage(page('JV', '# JV\n\n## Definition\nA long definition of a joint venture structure.\n\n## Risks\nShared risk.')) };
  const b = { path: 'concepts/joint-venture-jv', ...parsePage(page('JV2', '## Definition\nShort.\n\n## Governance\nBoard seats split.\n\n## Changelog\n- x')) };
  const m = mergePages([b, a], { path: 'concepts/joint-venture', title: 'Joint Venture Structures', concept: 'joint-venture' });
  assert.match(m.body, /A long definition/);
  assert.match(m.body, /## Governance\nBoard seats split\./);
  assert.doesNotMatch(m.body, /Short\./);
  assert.doesNotMatch(m.body, /Changelog/);
  assert.deepEqual(m.meta.aliases, ['concepts/joint-venture-jv']);
  assert.deepEqual(m.meta.tags, ['a', 'b']);
});

test('lexical embeddings are deterministic, normalised and 512-d', () => {
  const v = lexicalEmbedding('Joint venture structures for greenfield data centres');
  assert.equal(v.length, DIMS);
  assert.deepEqual(v, lexicalEmbedding('Joint venture structures for greenfield data centres'));
  assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-3);
  const q = lexicalEmbedding('joint venture partner');
  assert.ok(cosine(q, v) > cosine(q, lexicalEmbedding('cooling tower water usage effectiveness')));
});

test('redaction removes client names; figures are stripped from retrieved text', () => {
  const r = redactor(['Blackstone Credit', 'Blackstone']);
  assert.equal(r('Blackstone Credit targets India; blackstone also bid.'), 'the client targets India; the client also bid.');
  assert.equal(stripFigures('Targets $22 billion and 500 MW by 2030 at 60% IRR in [[Tier-3]]'), 'Targets and by at IRR in Tier III');
});

test('store: write normalises, embeds, links; graph hides client names; search excludes engagements', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'wiki-'));
  try {
    const be = fsBackend(dir);
    await writePage(be, { path: 'clients/acme-power/overview.md', content: page('Acme Power overview', '## Mandate\nAcme Power wants a [[Joint Venture]] for 300 MW.') }, { embedImpl: lexical });
    const w = await writePage(be, { path: 'concepts/joint-venture-jv.md', content: page('JV', '## Definition\nA joint venture shares capital and operating risk. Acme Power is one example.') }, { embedImpl: lexical });
    assert.equal(w.path, 'concepts/joint-venture');
    assert.equal(w.renamed, true);
    await writePage(be, { path: 'patterns/power-as-moat.md', content: page('Power as Competitive Moat', 'Grid power secured early, often through a [[JV]].') }, { embedImpl: lexical });

    const stored = parsePage((await be.get('concepts/joint-venture')).content);
    assert.equal(stored.meta.title, 'Joint Venture Structures');
    assert.ok((await be.embeddings())['concepts/joint-venture'].vector.length === DIMS);

    const g = buildKnowledgeGraph(await be.list());
    const text = JSON.stringify(g.nodes);
    assert.doesNotMatch(text, /acme/i);
    assert.ok(g.nodes.some((n) => n.label === 'Client A'));
    assert.ok(g.edges.some((e) => [e.source, e.target].includes('concepts/joint-venture') && [e.source, e.target].includes('patterns/power-as-moat')));
    assert.deepEqual(g, buildKnowledgeGraph(await be.list()), 'graph is deterministic');

    const hits = await searchKnowledge(be, 'joint venture capital risk', { embedImpl: lexical });
    assert.equal(hits[0].path, 'concepts/joint-venture');
    assert.ok(hits.every((h) => h.type !== 'client'));
    assert.ok(hits.every((h) => !/\d/.test(h.snippet) && !/acme/i.test(h.snippet)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
