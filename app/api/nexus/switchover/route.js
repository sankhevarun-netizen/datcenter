// Switchover Planner API: thin wrapper around planSwitchover() for
// server-side or scripted callers. The UI computes client-side instead
// (SwitchoverPlanner.jsx), exactly as the capacity-simulation page does —
// this route exists for parity with the other engines and for anything
// outside the browser. Stateless beyond the audit trail.
import { planSwitchover, SwitchoverInputError } from '@/lib/nexus/switchover-engine';
import { AS_OF } from '@/lib/nexus/time';
import { appendRecord } from '@/lib/store';
import { requirePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { error, ctx } = await requirePermission('run:simulation');
  if (error) return error;

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { facilityId, componentId, action, windowStart, durationHours, transferToId = null } = body ?? {};
  if (!facilityId || !componentId || !action || !windowStart || durationHours === undefined) {
    return Response.json({ error: 'facilityId, componentId, action, windowStart and durationHours are required' }, { status: 400 });
  }

  let result;
  try {
    result = planSwitchover({ facilityId, componentId, action, transferToId, windowStart, durationHours: Number(durationHours), asOf: AS_OF });
  } catch (err) {
    if (err instanceof SwitchoverInputError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }

  await appendRecord('audit_log', {
    user_id: ctx.user?.id ?? null,
    user_email: ctx.user?.email ?? null,
    role: ctx.role,
    kind: 'action',
    action: 'switchover_plan',
    facility_id: facilityId,
    subject: componentId,
    detail: { verdict: result.verdict?.level ?? null, windowStart, durationHours, action },
  });

  return Response.json(result);
}
