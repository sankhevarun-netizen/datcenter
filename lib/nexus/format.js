// lib/nexus/format.js
// Display formatting only — these change how a computed number looks, never its value.

const IN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const fmtNumber = (n, dp = 0) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);

/** Up to `dp` decimals, no padding: 48 -> "48", 31.6 -> "31.6", 1.58 -> "1.58". */
export const fmtUpTo = (n, dp = 2) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: dp }).format(n);

export const fmtKw = (kw) => `${IN.format(kw)} kW`;

/** Lakh figure as written in the dataset; crore shown alongside from 100 lakh up. */
export function fmtLakh(lakh) {
  if (lakh >= 100) return `₹${IN.format(lakh)} lakh (₹${fmtNumber(lakh / 100, 2)} crore)`;
  return `₹${IN.format(lakh)} lakh`;
}

/** Whole rupees → the unit an Indian finance audience reads (lakh below a crore, crore above). */
export function fmtInr(inr) {
  if (inr >= 1e7) return `₹${IN.format(Math.round((inr / 1e7) * 100) / 100)} crore`;
  return `₹${IN.format(Math.round(inr / 1e5))} lakh`;
}

/** Compact form for tables and tiles: 383 → "6 h 23 min". */
export function fmtDurationShort(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function fmtDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const part = (v, unit) => `${v} ${unit}${v === 1 ? '' : 's'}`;
  if (h === 0) return part(m, 'minute');
  if (m === 0) return part(h, 'hour');
  return `${part(h, 'hour')} ${part(m, 'minute')}`;
}
