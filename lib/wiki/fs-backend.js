// lib/wiki/fs-backend.js — the knowledge store on disk, outside the repository.
//
// Used when Supabase is unreachable, and by the migration script. Pages are
// markdown files under the root; embeddings live beside them in one JSON file.
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export function wikiRoot() {
  if (process.env.WIKI_PATH) return path.resolve(process.env.WIKI_PATH);
  const base = process.env.NEXUS_DATA_DIR || (process.env.VERCEL ? '/tmp/k-nexus' : path.join(os.homedir(), '.k-nexus'));
  return path.join(base, 'wiki');
}

export const typeOf = (p) => {
  const head = p.split('/')[0];
  return { clients: 'client', concepts: 'concept', market: 'market', patterns: 'pattern', _meta: 'meta' }[head] ?? 'index';
};

async function walk(dir, base, out) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch (err) { if (err.code === 'ENOENT') return out; throw err; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, base, out);
    else if (e.name.endsWith('.md')) out.push(path.relative(base, full).replace(/\\/g, '/').replace(/\.md$/, ''));
  }
  return out;
}

const EMB = '_embeddings.json';

export function fsBackend(root = wikiRoot()) {
  const file = (p) => path.join(root, `${p}.md`);
  const readEmb = async () => { try { return JSON.parse(await fs.readFile(path.join(root, EMB), 'utf8')); } catch { return {}; } };
  const writeEmb = async (all) => { await fs.mkdir(root, { recursive: true }); await fs.writeFile(path.join(root, EMB), JSON.stringify(all)); };

  return {
    name: 'local',
    root,
    async list() {
      const paths = (await walk(root, root, [])).sort();
      return Promise.all(paths.map(async (p) => {
        const [content, stat] = await Promise.all([fs.readFile(file(p), 'utf8'), fs.stat(file(p))]);
        return { path: p, type: typeOf(p), content, updated_at: stat.mtime.toISOString() };
      }));
    },
    async get(p) {
      try { return { path: p, type: typeOf(p), content: await fs.readFile(file(p), 'utf8') }; } catch (err) { if (err.code === 'ENOENT') return null; throw err; }
    },
    async put({ path: p, content, embedding, method }) {
      await fs.mkdir(path.dirname(file(p)), { recursive: true });
      await fs.writeFile(file(p), content, 'utf8');
      if (embedding) { const all = await readEmb(); all[p] = { method, vector: embedding }; await writeEmb(all); }
    },
    async remove(p) {
      await fs.rm(file(p), { force: true });
      const all = await readEmb();
      if (all[p]) { delete all[p]; await writeEmb(all); }
    },
    embeddings: readEmb,
  };
}
