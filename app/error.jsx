'use client';
// Route-level error boundary: report the failure, offer a retry.
import { useEffect } from 'react';

export default function RouteError({ error, reset }) {
  useEffect(() => {
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'client_error', name: error?.name, message: error?.message, digest: error?.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1F36' }}>This view could not load</h2>
        <p style={{ fontSize: 13, color: '#64748B', margin: '8px 0 16px' }}>The problem has been recorded. Try again, or return to the command centre.</p>
        <button onClick={reset} style={{ background: '#00338D', color: '#fff', border: 0, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Try again</button>
      </div>
    </div>
  );
}
