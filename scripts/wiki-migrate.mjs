#!/usr/bin/env node
// One-time move of the wiki out of the repository, with duplicate ideas merged.
//
//   node scripts/wiki-migrate.mjs                 dry run: prints the plan
//   node scripts/wiki-migrate.mjs --apply         writes to WIKI_PATH (default ~/.k-nexus/wiki)
//   node scripts/wiki-migrate.mjs --source=<dir>  migrate or dedupe another folder (in place if it is the target)
//   node scripts/wiki-migrate.mjs --apply --supabase
//                                                 also upserts into wiki_pages (needs SUPABASE_SERVICE_ROLE_KEY)
//
// Pages for the same idea (per lib/wiki/ontology.js) are merged
// deterministically: the longest page is kept whole and sections the others add
// are appended. Nothing is rewritten by a model.
import path from 'path';
import { fsBackend, wikiRoot } from '../lib/wiki/fs-backend.js';
import { canonicalPath, conceptFor } from '../lib/wiki/ontology.js';
import { parsePage, renderPage, mergePages } from '../lib/wiki/markdown.js';
import { writePage } from '../lib/wiki/knowledge.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const source = fsBackend(path.resolve(args.source ?? 'wiki'));
const target = fsBackend(wikiRoot());
const inPlace = path.resolve(source.root) === path.resolve(target.root);

const pages = (await source.list())
  .filter((p) => !p.path.startsWith('_') && p.path.includes('/'))
  .map((p) => ({ ...p, ...parsePage(p.content) }))
  .filter((p) => p.body.trim().length > 0);

const groups = new Map();
for (const p of pages) {
  const c = canonicalPath(p.path);
  if (!groups.has(c)) groups.set(c, []);
  groups.get(c).push(p);
}

const plan = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([canonical, members]) => {
  const concept = conceptFor(canonical);
  if (members.length === 1) {
    const [m] = members;
    return { canonical, from: [m.path], content: m.content };
  }
  const title = concept?.title ?? members[0].meta.title;
  const merged = mergePages(members, { path: canonical, title, concept: concept?.path.split('/').pop() });
  return { canonical, from: members.map((m) => m.path), content: renderPage(merged.meta, merged.body) };
});

const merges = plan.filter((p) => p.from.length > 1);
const renames = plan.filter((p) => p.from.length === 1 && p.from[0] !== p.canonical);
console.log(`Source: ${source.root}\nTarget: ${target.root}${inPlace ? ' (in place)' : ''}\n`);
console.log(`${pages.length} pages → ${plan.length} after merging ${merges.length} groups of duplicates.\n`);
for (const m of merges) console.log(`  merge  ${m.from.join(' + ')}\n      →  ${m.canonical}`);
for (const r of renames) console.log(`  rename ${r.from[0]} → ${r.canonical}`);

if (!args.apply) {
  console.log('\nDry run. Re-run with --apply to write.');
  process.exit(0);
}

let supabase = null;
if (args.supabase) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('--supabase needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(url, key, { auth: { persistSession: false } });
}

// Write every page first so links resolve against the full set, then embed.
for (const p of plan) await target.put({ path: p.canonical, content: p.content });
let n = 0;
for (const p of plan) {
  await writePage(target, { path: p.canonical, content: p.content });
  if (supabase) {
    const stored = await target.get(p.canonical);
    const emb = (await target.embeddings())[p.canonical];
    const { meta } = parsePage(stored.content);
    const { error } = await supabase.from('wiki_pages').upsert({
      path: p.canonical, type: stored.type, title: meta.title ?? p.canonical, concept: conceptFor(p.canonical)?.path ?? null,
      content: stored.content, links: [], embedding: emb?.vector ?? null, updated_at: new Date().toISOString(),
    });
    if (error) { console.error(`  supabase: ${p.canonical}: ${error.message}`); process.exit(1); }
  }
  n++;
}
if (inPlace) {
  const keep = new Set(plan.map((p) => p.canonical));
  for (const p of pages) if (!keep.has(p.path)) await target.remove(p.path);
}
console.log(`\nWrote ${n} pages to ${target.root}${supabase ? ' and wiki_pages' : ''}.`);
