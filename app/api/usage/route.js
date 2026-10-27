// Model spend per engagement (partner and admin).
import { listRecords } from '@/lib/store';
import { requirePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { error } = await requirePermission('view:costs');
  if (error) return error;
  const url = new URL(request.url);
  const { backend, rows } = await listRecords('model_usage', { since: url.searchParams.get('since'), limit: 5000 });
  const byEngagement = new Map();
  for (const r of rows) {
    const e = byEngagement.get(r.engagement) ?? { engagement: r.engagement, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, byFeature: {} };
    e.calls += 1;
    e.inputTokens += r.input_tokens;
    e.outputTokens += r.output_tokens;
    e.costUsd += Number(r.cost_usd);
    e.byFeature[r.feature] = (e.byFeature[r.feature] ?? 0) + Number(r.cost_usd);
    byEngagement.set(r.engagement, e);
  }
  const engagements = [...byEngagement.values()]
    .map((e) => ({ ...e, costUsd: Math.round(e.costUsd * 1e4) / 1e4 }))
    .sort((a, b) => b.costUsd - a.costUsd);
  return Response.json({ backend, engagements, recent: rows.slice(0, 50) });
}
