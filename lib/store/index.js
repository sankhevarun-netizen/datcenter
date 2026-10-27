// lib/store/index.js — server-side persistence for platform records.
//
// Records (audit log, model usage, user state, wiki pages) go to Supabase when
// it is reachable and the caller's session may write them (see
// supabase/migrations/20261006_platform_hardening.sql). Otherwise they go to a
// local store outside the repository: ~/.k-nexus by default, NEXUS_DATA_DIR to
// override. On Vercel the local fallback is /tmp, which does not persist —
// production needs the Supabase tables.
//
// A failed Supabase call opens a one-minute circuit so a dead connection costs
// one timeout, not one per request.
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@/lib/supabase-server';

const TIMEOUT_MS = 3000;
const CIRCUIT_MS = 60_000;
let circuitOpenUntil = 0;

export function localDir() {
  return process.env.NEXUS_DATA_DIR || (process.env.VERCEL ? '/tmp/k-nexus' : path.join(os.homedir(), '.k-nexus'));
}

const supabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function viaSupabase(fn) {
  if (!supabaseConfigured() || Date.now() < circuitOpenUntil) throw new Error('supabase unavailable');
  try {
    const supabase = await createClient();
    const result = await Promise.race([
      fn(supabase),
      new Promise((_, reject) => setTimeout(() => reject(new Error('supabase timeout')), TIMEOUT_MS)),
    ]);
    if (result?.error) throw new Error(result.error.message);
    return result;
  } catch (err) {
    // RLS refusals (no session) are not outages; only network failures open the circuit.
    if (/fetch failed|timeout|ENOTFOUND|ECONNREFUSED/i.test(err.message)) circuitOpenUntil = Date.now() + CIRCUIT_MS;
    throw err;
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

const jsonl = async (table) => path.join(await ensureDir(localDir()), `${table}.jsonl`);

async function readJsonl(table) {
  try {
    const text = await fs.readFile(await jsonl(table), 'utf8');
    return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/** Append one record. Returns which backend took it. */
export async function appendRecord(table, record) {
  try {
    await viaSupabase((s) => s.from(table).insert(record));
    return 'supabase';
  } catch {
    const row = { at: new Date().toISOString(), ...record };
    await fs.appendFile(await jsonl(table), `${JSON.stringify(row)}\n`);
    return 'local';
  }
}

/** Newest first. `filters` are equality matches on columns. */
export async function listRecords(table, { filters = {}, since = null, limit = 500 } = {}) {
  try {
    const { data } = await viaSupabase((s) => {
      let q = s.from(table).select('*').order('at', { ascending: false }).limit(limit);
      for (const [k, v] of Object.entries(filters)) if (v != null && v !== '') q = q.eq(k, v);
      if (since) q = q.gte('at', since);
      return q;
    });
    return { backend: 'supabase', rows: data ?? [] };
  } catch {
    const rows = (await readJsonl(table))
      .filter((r) => Object.entries(filters).every(([k, v]) => v == null || v === '' || r[k] === v))
      .filter((r) => !since || r.at >= since)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
    return { backend: 'local', rows };
  }
}

// ── per-user state ─────────────────────────────────────────────────────────
const stateFile = async () => path.join(await ensureDir(localDir()), 'user_state.json');

async function readLocalState() {
  try { return JSON.parse(await fs.readFile(await stateFile(), 'utf8')); } catch { return {}; }
}

export async function getState(userId, key) {
  if (userId) {
    try {
      const { data } = await viaSupabase((s) => s.from('user_state').select('value').eq('user_id', userId).eq('key', key).maybeSingle());
      return data?.value ?? null;
    } catch { /* fall through */ }
  }
  const all = await readLocalState();
  return all[`${userId ?? 'open-access'}:${key}`] ?? null;
}

export async function setState(userId, key, value) {
  if (userId) {
    try {
      await viaSupabase((s) => s.from('user_state').upsert({ user_id: userId, key, value, updated_at: new Date().toISOString() }));
      return 'supabase';
    } catch { /* fall through */ }
  }
  const all = await readLocalState();
  all[`${userId ?? 'open-access'}:${key}`] = value;
  await fs.writeFile(await stateFile(), JSON.stringify(all, null, 2));
  return 'local';
}

export { viaSupabase };
