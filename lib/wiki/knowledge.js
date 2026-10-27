// lib/wiki/knowledge.js — what the firm has learned, independent of storage.
//
// writePage normalises through the ontology and embeds on write; graph builds
// the view with client names removed; search retrieves context for agents
// with figures stripped, so retrieved text can never feed a number into a brief.
import { canonicalPath, conceptFor, resolveLink } from './ontology.js';
import { parsePage, renderPage, wikilinks, redactor, stripFigures } from './markdown.js';
import { embed, cosine, lexicalEmbedding } from './embed.js';
import { typeOf } from './fs-backend.js';

export { KNOWLEDGE_CATEGORIES } from './categories.js';

const humanise = (s) => s.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const titleOf = (p, meta) => meta.title || humanise(p.split('/').pop());

/** Every name that identifies a client, taken from the client pages. */
export function clientNames(pages) {
  const names = new Set();
  const GENERIC = new Set(['asset', 'capital', 'credit', 'group', 'energy', 'india', 'management', 'ventures', 'holdings', 'partners']);
  for (const p of pages) {
    if (typeOf(p.path) !== 'client') continue;
    const folder = p.path.split('/')[1];
    const full = humanise(folder).replace(/\b\w/g, (c) => c.toUpperCase());
    names.add(full);
    const first = folder.split('-')[0];
    if (!GENERIC.has(first)) names.add(first);
    const { meta } = parsePage(p.content);
    if (typeof meta.client === 'string') names.add(meta.client);
  }
  return [...names];
}

/** Stores a page at its canonical path, with links resolved and an embedding. */
export async function writePage(backend, { path, content }, { embedImpl = embed } = {}) {
  const canonical = canonicalPath(path);
  const { meta, body } = parsePage(content);
  const concept = conceptFor(canonical);
  const existing = await backend.get(canonical);
  const title = concept?.title ?? titleOf(canonical, meta);
  const next = renderPage({ ...meta, title, concept: concept?.path.split('/').pop() ?? meta.concept }, body);
  const all = await backend.list();
  const byPath = new Map(all.map((p) => [p.path, { title: parsePage(p.content).meta.title }]));
  byPath.set(canonical, { title });
  const links = [...new Set(wikilinks(body).map((l) => resolveLink(l, byPath)).filter((l) => l && l !== canonical))];
  const { vector, method } = await embedImpl(`${title}\n${body}`);
  await backend.put({ path: canonical, type: typeOf(canonical), title, concept: concept?.path ?? null, content: next, links, embedding: vector, method });
  return { relPath: `${canonical}.md`, path: canonical, action: existing ? 'merged' : 'created', renamed: canonical !== path.replace(/\.md$/, '') };
}

/**
 * The graph for display. Clients become "Client A", "Client B" by folder
 * order, and every label and preview is redacted. Index and log pages are
 * left out.
 */
export function buildKnowledgeGraph(pages) {
  const redact = redactor(clientNames(pages));
  const shown = pages.filter((p) => !['meta', 'index'].includes(typeOf(p.path)));
  const folders = [...new Set(shown.filter((p) => typeOf(p.path) === 'client').map((p) => p.path.split('/')[1]))].sort();
  const code = (folder) => String.fromCharCode(65 + folders.indexOf(folder));
  const letter = (folder) => `Client ${code(folder)}`;
  // Client folders carry the client's name, so their ids are replaced too.
  const idOf = (p) => (typeOf(p) === 'client' ? p.replace(/^clients\/([^/]+)/,(_, f) => `engagement/${code(f)}`) : p);
  const byPath = new Map(shown.map((p) => [p.path, { ...p, parsed: parsePage(p.content) }]));
  const titles = new Map([...byPath].map(([k, v]) => [k, { title: v.parsed.meta.title }]));
  // A link naming a client resolves to that engagement's (anonymised) node.
  const hubs = new Set(folders.map((f) => `clients/${f}`));
  for (const h of hubs) titles.set(h, { title: h.split('/')[1] });

  const nodes = [];
  const edges = [];
  const seen = new Set();
  const edge = (pa, pb) => { const [a, b] = [idOf(pa), idOf(pb)]; const k = [a, b].sort().join('|'); if (a !== b && !seen.has(k)) { seen.add(k); edges.push({ source: a, target: b }); } };

  for (const folder of folders) {
    nodes.push({ id: `engagement/${code(folder)}`, label: letter(folder), category: 'engagement', size: 12, description: 'Engagement record. Client identity is held in the engagement file, not shown here.' });
  }
  for (const [p, page] of byPath) {
    const type = typeOf(p);
    const { meta, body } = page.parsed;
    const words = body.split(/\s+/).length;
    const isClient = type === 'client';
    const label = isClient ? `${letter(p.split('/')[1])} · ${humanise(p.split('/').pop())}` : redact(titleOf(p, meta));
    nodes.push({
      id: idOf(p),
      label,
      category: isClient ? 'engagement' : type,
      size: Math.max(6, Math.min(16, Math.sqrt(words) * 0.8)),
      description: redact(stripFigures(body).slice(0, 220)),
      updated: meta.updated ?? page.updated_at?.slice(0, 10) ?? null,
    });
    if (isClient) edge(p, `clients/${p.split('/')[1]}`);
    const links = page.links?.length ? page.links : wikilinks(body).map((l) => resolveLink(l, titles)).filter(Boolean);
    for (const l of links) if (byPath.has(l) || hubs.has(l)) edge(p, l);
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => `${a.source}|${a.target}`.localeCompare(`${b.source}|${b.target}`));
  const count = (c) => nodes.filter((n) => n.category === c).length;
  return { nodes, edges, stats: { total: nodes.length, edges: edges.length, concepts: count('concept'), patterns: count('pattern'), market: count('market'), engagements: folders.length } };
}

/**
 * Context for an agent: the closest concept, pattern and market pages to the
 * query. Engagement pages are never retrieved (client confidentiality), and
 * snippets carry no figures and no client names.
 */
export async function searchKnowledge(backend, query, { k = 4, embedImpl = embed, minScore = 0.05 } = {}) {
  const pages = await backend.list();
  const redact = redactor(clientNames(pages));
  const candidates = pages.filter((p) => ['concept', 'pattern', 'market'].includes(typeOf(p.path)));
  const q = await embedImpl(query, { inputType: 'query' });
  const stored = (await backend.embeddings?.()) ?? {};
  const scored = candidates.map((p) => {
    const e = p.embedding ? { vector: p.embedding, method: p.method } : stored[p.path];
    const { meta, body } = parsePage(p.content);
    // A page embedded by a different method is compared lexically on the fly.
    const vector = e?.method === q.method ? e.vector : null;
    const score = vector ? cosine(q.vector, vector) : cosine(lexicalEmbedding(query), lexicalEmbedding(`${meta.title}\n${body}`));
    return { path: p.path, type: typeOf(p.path), title: redact(stripFigures(titleOf(p.path, meta))), body, score };
  }).filter((r) => r.score >= minScore).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, k);
  return scored.map(({ body, ...r }) => ({ ...r, score: Math.round(r.score * 1000) / 1000, snippet: redact(stripFigures(body)).slice(0, 360) }));
}
