// lib/audit-client.js — browser side of the audit trail. Fire-and-forget:
// logging must never slow or break the action being logged. A no-op outside
// the browser (engine tests, server rendering).

export function logEvent(kind, action, { facilityId = null, subject = null, detail = {} } = {}) {
  if (typeof window === 'undefined') return;
  try {
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, action, facilityId, subject, detail }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* never throw from logging */ }
}
