// Server-side error monitoring: every unhandled error in a route, page or
// server action is recorded (message, path, digest) so a failure is seen
// before a client reports it. Node runtime only — the store uses the
// filesystem fallback, which the edge runtime does not have.
export async function register() {}

export async function onRequestError(err, request, context) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { appendRecord } = await import('./lib/store/index.js');
      await appendRecord('app_events', {
        type: 'server_error',
        name: context?.routeType ?? 'request',
        path: String(request?.path ?? '').slice(0, 200),
        message: String(err?.message ?? err).slice(0, 500),
        digest: err?.digest ?? null,
      });
    } catch (e) {
      console.error('[monitoring] could not record server error:', e?.message);
    }
  }
}
