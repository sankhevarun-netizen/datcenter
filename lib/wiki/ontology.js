// lib/wiki/ontology.js — one id per idea.
//
// The writer produced the same idea under several names (joint-venture,
// joint-venture-jv, joint-venture-structures). Every page path and every
// [[wikilink]] is resolved through this table on write, so a new page about
// an existing idea merges into it rather than becoming a sibling node.
//
// To add an idea: give it a canonical path and the aliases seen for it.
// Aliases are compared after slugging, so "Tier-3", "tier 3" and "Tier III"
// need only one entry each.

export const ONTOLOGY = [
  // concepts
  { path: 'concepts/joint-venture', title: 'Joint Venture Structures', aliases: ['joint-venture-jv', 'joint-venture-structures', 'joint-venture-structure', 'joint-venture-strategy', 'jv', 'joint-ventures', 'jv-structure', 'jv-structures'] },
  { path: 'concepts/tier-3-data-centre', title: 'Tier III Data Centre Standard', aliases: ['tier-3-data-center', 'tier-3', 'tier-iii', 'tier-iii-data-centre', 'tier-iii-data-center', 'tier-3-datacenter'] },
  { path: 'concepts/readiness-scoring', title: 'Readiness Scoring Framework', aliases: ['readiness-score', 'readiness-assessment-framework', 'readiness-assessment', 'readiness-scores', 'datacenter-readiness-scoring'] },
  { path: 'concepts/dc-lifecycle', title: 'Data Centre Investment Lifecycle', aliases: ['data-center-lifecycle', 'dc-lifecycle-investment-stages', 'data-centre-lifecycle', 'lifecycle-stages', 'investment-lifecycle'] },
  { path: 'concepts/greenfield-development', title: 'Greenfield Development', aliases: ['greenfield', 'greenfield-data-center-development', 'greenfield-data-centre'] },
  { path: 'concepts/hyperscale-data-centre', title: 'Hyperscale Data Centre Model', aliases: ['hyperscale', 'hyperscale-data-center', 'hyperscale-data-centres', 'hyperscale-model'] },
  { path: 'concepts/build-to-suit-agreement', title: 'Build-to-Suit Agreement', aliases: ['build-to-suit', 'bts', 'bts-agreement'] },
  { path: 'concepts/minority-stakes-strategy', title: 'Minority Stakes Strategy', aliases: ['minority-stakes', 'minority-stake', 'minority-investment'] },
  { path: 'concepts/platform-acquisition', title: 'Platform Acquisition', aliases: ['platform-acquisitions', 'platform-deal'] },
  { path: 'concepts/reit-exit', title: 'REIT Exit Strategy', aliases: ['reit', 'reit-exit-strategy'] },
  { path: 'concepts/market-entry-strategy', title: 'Market Entry Strategy', aliases: ['market-entry', 'market-entry-strategies'] },
  // market
  { path: 'market/india-dc-market', title: 'India Data Centre Market', aliases: ['india-data-center-market', 'india-data-center', 'india-data-centre-market', 'india-dc', 'indian-data-center-market'] },
  { path: 'market/india-dc-market-2030', title: 'India Data Centre Market Outlook to 2030', aliases: ['india-2030-outlook', 'india-dc-outlook-2030', 'india-market-outlook-2030'] },
  // patterns
  { path: 'patterns/new-entrant-jv-pathway', title: 'New Entrant JV Pathway', aliases: ['new-entrant-jv-pattern', 'new-entrant-to-jv', 'new-entrant-jv'] },
];

export const slug = (s) => String(s).toLowerCase()
  .replace(/\.md$/, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim().replace(/\s+/g, '-').replace(/-+/g, '-');

const byAlias = new Map();
for (const c of ONTOLOGY) {
  const base = c.path.split('/').pop();
  for (const a of [base, slug(c.title), ...c.aliases]) byAlias.set(slug(a), c);
}

/** The ontology entry an idea belongs to, or null if it is new. */
export function conceptFor(nameOrPath) {
  const base = String(nameOrPath).split('/').pop();
  return byAlias.get(slug(base)) ?? null;
}

/**
 * The path a page should be stored at. Known ideas resolve to their canonical
 * path whatever folder the writer chose; new ideas keep their folder with a
 * clean slug.
 */
export function canonicalPath(relPath) {
  const clean = String(relPath).replace(/\\/g, '/').replace(/\.md$/, '').replace(/^\/+/, '');
  const parts = clean.split('/');
  if (parts[0] === 'clients') return parts.map(slug).join('/');
  const hit = conceptFor(parts.at(-1));
  if (hit) return hit.path;
  return [...parts.slice(0, -1), slug(parts.at(-1))].join('/');
}

/**
 * Resolves a [[wikilink]] target to a stored page path, or null. Tries the
 * ontology first, then any page whose last segment or title slug matches.
 */
export function resolveLink(target, pages) {
  const text = String(target).split('|')[0].trim();
  const hit = conceptFor(text);
  if (hit && pages.has(hit.path)) return hit.path;
  const s = slug(text);
  for (const [p, page] of pages) {
    if (p.split('/').pop() === s || slug(page.title ?? '') === s) return p;
  }
  return null;
}
