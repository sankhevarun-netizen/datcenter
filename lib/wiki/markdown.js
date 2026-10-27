// lib/wiki/markdown.js — page parsing, merging and redaction. Pure functions.

export function parsePage(text) {
  const src = String(text).replace(/\r\n/g, '\n');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i < 1) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((t) => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      meta[k] = v;
    }
  }
  return { meta, body: m ? src.slice(m[0].length) : src };
}

const yamlValue = (v) => (Array.isArray(v) ? `[${v.join(', ')}]` : `"${String(v).replace(/"/g, '\\"')}"`);

export function renderPage(meta, body) {
  const lines = Object.entries(meta).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => `${k}: ${yamlValue(v)}`);
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`;
}

export const wikilinks = (text) => [...String(text).matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].split('|')[0].trim());

const sections = (body) => {
  const out = [];
  let cur = { heading: '', lines: [] };
  for (const line of body.split('\n')) {
    const h = line.match(/^#{2,3}\s+(.*)$/);
    if (h) { out.push(cur); cur = { heading: h[1].trim(), lines: [line] }; } else cur.lines.push(line);
  }
  out.push(cur);
  return out.filter((s) => s.heading || s.lines.join('').trim());
};
const headingKey = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Deterministic merge of duplicate pages into one: the longest page is kept
 * whole; sections from the others whose heading it does not already have are
 * appended; tags are unioned; the merged paths are recorded as aliases.
 * No text is rewritten, so nothing is lost or invented.
 */
export function mergePages(pages, { path, title, concept }) {
  const sorted = [...pages].sort((a, b) => b.body.length - a.body.length || a.path.localeCompare(b.path));
  const [primary, ...rest] = sorted;
  const have = new Set(sections(primary.body).map((s) => headingKey(s.heading)));
  let body = primary.body.trim();
  for (const p of rest) {
    const extra = sections(p.body).filter((s) => s.heading && !have.has(headingKey(s.heading)) && !/changelog/i.test(s.heading));
    if (!extra.length) continue;
    body += `\n\n${extra.map((s) => s.lines.join('\n').trim()).join('\n\n')}`;
    extra.forEach((s) => have.add(headingKey(s.heading)));
  }
  const tags = [...new Set(pages.flatMap((p) => (Array.isArray(p.meta.tags) ? p.meta.tags : [])))];
  const updated = pages.map((p) => p.meta.updated).filter(Boolean).sort().at(-1);
  const aliases = [...new Set(pages.map((p) => p.path).filter((p) => p !== path))].sort();
  return { path, title, concept, meta: { title, tags, updated, concept, aliases }, body };
}

/**
 * Client names never reach the screen or a prompt: each is replaced with a
 * neutral reference. `names` comes from the client pages themselves.
 */
export function redactor(names) {
  const list = [...new Set(names.filter((n) => n && n.length > 2))].sort((a, b) => b.length - a.length);
  if (!list.length) return (t) => t;
  const re = new RegExp(`\\b(${list.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  return (text) => String(text ?? '').replace(re, 'the client');
}

/** Context for a model: no figures, so retrieved text can never feed a number. */
export const stripFigures = (text) => String(text)
  .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
  .replace(/[#*_>`]/g, '')
  .replace(/\btier[\s-]?(4|iv)\b/gi, 'Tier IV').replace(/\btier[\s-]?(3|iii)\b/gi, 'Tier III').replace(/\btier[\s-]?(2|ii)\b/gi, 'Tier II')
  .replace(/[$₹€£]?\d[\d,.]*\s*(%|x|mw|kw|gw|bn|mn|cr|crore|lakh|million|billion|years?|months?)?/gi, '')
  .replace(/\s+/g, ' ')
  .trim();
