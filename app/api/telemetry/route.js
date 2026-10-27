// Client-side error and performance telemetry. Small, validated payloads only;
// nothing here is ever sent to a model.
import { appendRecord, listRecords } from '@/lib/store';
import { requirePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
const TYPES = new Set(['client_error', 'web_vital']);

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || !TYPES.has(body.type)) return Response.json({ error: 'Bad payload' }, { status: 400 });
  await appendRecord('app_events', {
    type: body.type,
    name: String(body.name ?? '').slice(0, 80),
    value: Number.isFinite(body.value) ? body.value : null,
    path: String(body.path ?? '').slice(0, 200),
    message: String(body.message ?? '').slice(0, 500),
    digest: body.digest ? String(body.digest).slice(0, 80) : null,
  });
  return Response.json({ ok: true });
}

export async function GET() {
  const { error } = await requirePermission('view:audit');
  if (error) return error;
  return Response.json(await listRecords('app_events', { limit: 300 }));
}
