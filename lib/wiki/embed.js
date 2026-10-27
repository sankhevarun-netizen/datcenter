// lib/wiki/embed.js — 512-dimension embeddings for the knowledge store.
//
// With VOYAGE_API_KEY set, pages are embedded with voyage-3-lite (512 dims,
// semantic). Without it, a deterministic hashed bag of words and word pairs
// is used: lexical rather than semantic, but stable, free and offline. Pages
// and queries must use the same method; `embeddingMethod()` names the one in
// force and is stored with each page so a switch can be detected and
// re-embedded.

export const DIMS = 512;

const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the this to was were will with which into than then these those can may not no also our your their there'.split(' '));

const tokens = (text) => String(text).toLowerCase()
  .replace(/\[\[|\]\]/g, ' ')
  .split(/[^a-z0-9]+/)
  .filter((t) => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t));

// FNV-1a, 32-bit.
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function lexicalEmbedding(text) {
  const v = new Float64Array(DIMS);
  const t = tokens(text);
  const feats = [...t, ...t.slice(1).map((w, i) => `${t[i]}_${w}`)];
  const tf = new Map();
  for (const f of feats) tf.set(f, (tf.get(f) ?? 0) + 1);
  for (const [f, n] of tf) {
    const h = hash(f);
    v[h % DIMS] += ((h >>> 31) ? -1 : 1) * (1 + Math.log(n));
  }
  const norm = Math.hypot(...v) || 1;
  return Array.from(v, (x) => Math.round((x / norm) * 1e6) / 1e6);
}

export const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

export const embeddingMethod = () => (process.env.VOYAGE_API_KEY ? 'voyage-3-lite' : 'lexical-512');

/** Embeds text with the configured method; falls back to lexical on any failure. */
export async function embed(text, { inputType = 'document', fetchImpl = fetch } = {}) {
  const key = process.env.VOYAGE_API_KEY;
  if (key) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetchImpl('https://api.voyageai.com/v1/embeddings', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'voyage-3-lite', input: [String(text).slice(0, 16000)], input_type: inputType }),
      }).finally(() => clearTimeout(timer));
      if (res.ok) {
        const d = await res.json();
        const v = d.data?.[0]?.embedding;
        if (v?.length === DIMS) return { vector: v, method: 'voyage-3-lite' };
      }
    } catch { /* fall through */ }
  }
  return { vector: lexicalEmbedding(text), method: 'lexical-512' };
}
