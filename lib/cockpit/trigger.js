// lib/cockpit/trigger.js — decides whether a Guide prompt opens a presentation cockpit.
//
// Forgiving on purpose: someone fumbling the wording on stage still gets the
// cockpit. A prompt matches a client when it contains one required term, at
// least one strong term and two or more supporting terms. Terms are matched as
// whole words on lowercased, punctuation-free text.
import { COCKPITS } from '../../data/cockpit/index.js';

export const MIN_SUPPORTING = 2;

export const normalise = (text) => ` ${String(text ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;

const has = (norm, term) => norm.includes(` ${normalise(term).trim()} `);

/** The matching cockpit's slug, or null. */
export function matchCockpit(text, cockpits = COCKPITS) {
  const norm = normalise(text);
  for (const [slug, c] of Object.entries(cockpits)) {
    const t = c.trigger;
    if (!t.required.some((term) => has(norm, term))) continue;
    if (!t.strong.some((term) => has(norm, term))) continue;
    const supporting = new Set(t.supporting.filter((term) => has(norm, term)));
    if (supporting.size >= MIN_SUPPORTING) return slug;
  }
  return null;
}

/** "/cockpit" on its own: go straight to the default cockpit, no animation. */
export const isCockpitShortcut = (text) => String(text ?? '').trim().toLowerCase() === '/cockpit';
