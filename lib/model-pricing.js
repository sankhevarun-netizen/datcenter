// lib/model-pricing.js — list prices per million tokens, for cost telemetry.
// Update when the model or its pricing changes.
export const MODEL_PRICES_USD_PER_MTOK = {
  'claude-sonnet-4-5': { input: 3, output: 15 },
};

export function costUsd(model, inputTokens, outputTokens) {
  const p = MODEL_PRICES_USD_PER_MTOK[model];
  if (!p) return 0;
  return Math.round(((inputTokens * p.input + outputTokens * p.output) / 1e6) * 1e6) / 1e6;
}
