// lib/usage-server.js — record one model call against an engagement.
import { appendRecord } from '@/lib/store';
import { getSessionContext } from '@/lib/auth/session';
import { costUsd } from '@/lib/model-pricing';

const clean = (v, fallback) => (typeof v === 'string' && /^[\w.:-]{1,40}$/.test(v) ? v : fallback);

export async function recordUsage(request, { model, inputTokens = 0, outputTokens = 0 }) {
  try {
    const ctx = await getSessionContext();
    await appendRecord('model_usage', {
      user_id: ctx.user?.id ?? null,
      engagement: clean(request.headers.get('x-nexus-engagement'), 'unassigned'),
      feature: clean(request.headers.get('x-nexus-feature'), 'general'),
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd(model, inputTokens, outputTokens),
    });
  } catch (err) {
    console.warn('[usage] not recorded:', err.message);
  }
}
