// Audit trail: append (any signed-in or open-access user, for their own
// actions) and query/export (partner and admin).
import { appendRecord, listRecords } from '@/lib/store';
import { getSessionContext, requirePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const KINDS = new Set(['action', 'agent_output', 'export', 'access']);

export async function POST(request) {
  const ctx = await getSessionContext();
  if (!ctx.role) return Response.json({ error: 'Sign in required' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!KINDS.has(body.kind) || typeof body.action !== 'string') return Response.json({ error: 'kind and action are required' }, { status: 400 });
  // Identity comes from the session, never from the request body.
  const backend = await appendRecord('audit_log', {
    user_id: ctx.user?.id ?? null,
    user_email: ctx.user?.email ?? null,
    role: ctx.role,
    kind: body.kind,
    action: body.action.slice(0, 120),
    facility_id: body.facilityId ?? null,
    subject: body.subject ? String(body.subject).slice(0, 200) : null,
    detail: body.detail ?? {},
  });
  return Response.json({ ok: true, backend });
}

function toCsv(rows) {
  const cols = ['at', 'user_email', 'role', 'kind', 'action', 'facility_id', 'subject', 'detail'];
  const cell = (v) => {
    const s = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}

export async function GET(request) {
  const { error } = await requirePermission('view:audit');
  if (error) return error;
  const url = new URL(request.url);
  const filters = { kind: url.searchParams.get('kind'), facility_id: url.searchParams.get('facility') };
  const { backend, rows } = await listRecords('audit_log', { filters, since: url.searchParams.get('since'), limit: Number(url.searchParams.get('limit') ?? 500) });
  if (url.searchParams.get('format') === 'csv') {
    return new Response(toCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="nexus-audit-trail.csv"' } });
  }
  return Response.json({ backend, rows });
}
