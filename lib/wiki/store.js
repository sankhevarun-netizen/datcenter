// lib/wiki/store.js — the knowledge store for server routes.
//
// Supabase `wiki_pages` (pgvector) when reachable; otherwise the folder
// outside the repository (WIKI_PATH, default ~/.k-nexus/wiki). Every call
// falls back on its own, so a Supabase outage never loses a write.
import { viaSupabase } from '@/lib/store';
import { fsBackend } from './fs-backend.js';
import { writePage, buildKnowledgeGraph, searchKnowledge, clientNames } from './knowledge.js';
import { embed } from './embed.js';
import { redactor, stripFigures, parsePage } from './markdown.js';

const local = fsBackend();

const backend = {
  async list() {
    try {
      const { data } = await viaSupabase((s) => s.from('wiki_pages').select('path,type,title,content,links,updated_at').order('path'));
      return data;
    } catch {
      return local.list();
    }
  },
  async get(path) {
    try {
      const { data } = await viaSupabase((s) => s.from('wiki_pages').select('path,type,title,content').eq('path', path).maybeSingle());
      return data;
    } catch {
      return local.get(path);
    }
  },
  async put(page) {
    try {
      await viaSupabase((s) => s.from('wiki_pages').upsert({
        path: page.path, type: page.type, title: page.title, concept: page.concept, content: page.content,
        links: page.links, embedding: page.embedding, updated_at: new Date().toISOString(),
      }));
      return 'supabase';
    } catch {
      await local.put(page);
      return 'local';
    }
  },
  embeddings: () => local.embeddings(),
};

export const wikiStore = backend;
export const localWikiRoot = local.root;

export const saveWikiPage = (page) => writePage(backend, page);
export const knowledgeGraph = async () => buildKnowledgeGraph(await backend.list());

/** Closest pages to the query; pgvector when available, local scoring otherwise. */
export async function searchWiki(query, { k = 4 } = {}) {
  try {
    const q = await embed(query, { inputType: 'query' });
    const { data } = await viaSupabase((s) => s.rpc('match_wiki_pages', { query_embedding: q.vector, match_count: k, exclude_types: ['client', 'meta', 'index'] }));
    const redact = redactor(clientNames(await backend.list()));
    return data.map((r) => ({ path: r.path, type: r.type, title: redact(stripFigures(r.title)), score: Math.round(r.similarity * 1000) / 1000, snippet: redact(stripFigures(parsePage(r.content).body)).slice(0, 360) }));
  } catch {
    return searchKnowledge(local, query, { k });
  }
}
