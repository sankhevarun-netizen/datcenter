// lib/nexus/time.js
//
// "Now" for every Nexus view is a moment in the dataset, not the wall clock,
// so every computed answer is reproducible. AS_OF is the most recent event the
// workbook records: the latest active alert.
import { nexus } from './data.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm' → minutes since the epoch (UTC arithmetic, local wall time). */
export function toMinutes(ts) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(ts);
  if (!m) throw new Error(`Unrecognised timestamp: ${ts}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)) / 60000;
}

/** Minutes since the epoch → 'YYYY-MM-DD HH:mm'. */
export function fromMinutes(minutes) {
  const d = new Date(minutes * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export const addMinutes = (ts, minutes) => fromMinutes(toMinutes(ts) + minutes);

export const AS_OF = nexus.activeAlerts.map((a) => a.raised_at).sort().at(-1);
export const AS_OF_DATE = AS_OF.slice(0, 10);
export const AS_OF_MONTH = AS_OF.slice(0, 7);

/** Whole days from a to b (negative when b is earlier). */
export const daysBetween = (a, b) => Math.floor((toMinutes(b) - toMinutes(a)) / 1440);

/** 'YYYY-MM' + n months. */
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** Months from a to b, both 'YYYY-MM'. */
export function monthsBetween(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** '2026-05' → 'May 2026'; short → 'May 26'. */
export function monthLabel(month, short = false) {
  const [y, m] = month.split('-');
  return short ? `${MONTHS[+m - 1].slice(0, 3)} ${y.slice(2)}` : `${MONTHS[+m - 1]} ${y}`;
}

/** '2026-09-29 03:14' → '03:14 on 29 September'. */
export function timeLabel(ts) {
  const [d, t] = ts.split(' ');
  const [, m, day] = d.split('-');
  return t ? `${t} on ${Number(day)} ${MONTHS[+m - 1]}` : `${Number(day)} ${MONTHS[+m - 1]} ${d.slice(0, 4)}`;
}
