// /api/wiki/graph — the firm's knowledge graph, client names removed.
// Clients poll it; they re-render only when the node or edge count changes.
import { knowledgeGraph } from '@/lib/wiki/store';
import { requirePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await requirePermission('view:operations');
  if (error) return error;
  try {
    const graph = await knowledgeGraph();
    return Response.json({ ...graph, empty: graph.nodes.length === 0 });
  } catch (err) {
    console.error('[wiki/graph]', err);
    return Response.json({ error: 'Knowledge graph unavailable' }, { status: 500 });
  }
}
