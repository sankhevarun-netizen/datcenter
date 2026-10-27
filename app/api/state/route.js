// Engagement persistence: a user's working state (acknowledgements, SLA
// clocks, selections) survives closing the browser.
import { getState, setState } from '@/lib/store';
import { getSessionContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
const KEY = /^[\w:.-]{1,80}$/;

export async function GET(request) {
  const ctx = await getSessionContext();
  if (!ctx.role) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const key = new URL(request.url).searchParams.get('key');
  if (!KEY.test(key ?? '')) return Response.json({ error: 'Bad key' }, { status: 400 });
  return Response.json({ value: await getState(ctx.user?.id ?? null, key) });
}

export async function PUT(request) {
  const ctx = await getSessionContext();
  if (!ctx.role) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const { key, value } = await request.json().catch(() => ({}));
  if (!KEY.test(key ?? '')) return Response.json({ error: 'Bad key' }, { status: 400 });
  if (JSON.stringify(value ?? null).length > 50_000) return Response.json({ error: 'Too large' }, { status: 413 });
  return Response.json({ ok: true, backend: await setState(ctx.user?.id ?? null, key, value) });
}
