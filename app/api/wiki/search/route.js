// /api/wiki/search?q=&k= — context for agents: the closest concept, pattern
// and market pages. No engagement pages, no client names, no figures.
import { searchWiki } from '@/lib/wiki/store';
import { requirePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { error } = await requirePermission('use:copilot');
  if (error) return error;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').slice(0, 500).trim();
  const k = Math.min(8, Math.max(1, Number(url.searchParams.get('k')) || 4));
  if (!q) return Response.json({ results: [] });
  try {
    return Response.json({ results: await searchWiki(q, { k }) });
  } catch (err) {
    console.error('[wiki/search]', err);
    return Response.json({ results: [] });
  }
}
