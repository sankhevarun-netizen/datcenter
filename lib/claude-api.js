/**
 * lib/claude-api.js
 *
 * Client-side wrapper. All calls go to /api/chat (Next.js server route).
 * No API keys ever exist in this file — they live in .env.local on the server.
 *
 * RAG is opt-in per call: pass ragQuery to trigger a Tavily search
 * that gets injected into the system prompt server-side.
 */

/**
 * Single (non-streaming) Claude call with optional RAG.
 */
// feature and engagement tag each call for cost telemetry (see /api/chat).
const tags = (feature, engagement) => ({
  ...(feature ? { 'x-nexus-feature': feature } : {}),
  ...(engagement ? { 'x-nexus-engagement': engagement } : {}),
});

export async function callClaude({ prompt, systemOverride, maxTokens = 16000, ragQuery, feature, engagement }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tags(feature, engagement) },
    body: JSON.stringify({ prompt, systemOverride, maxTokens, ragQuery, stream: false }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `API route not found or server error (${res.status}). ` +
      `Check that ANTHROPIC_API_KEY is set in .env.local and the dev server is running.`
    );
  }

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `API error ${res.status}`);
  }
  return data.text;
}

/**
 * Streaming Claude call with optional RAG.
 * Yields text chunks as they arrive.
 */
export async function* callClaudeStream({ prompt, systemOverride, maxTokens = 16000, ragQuery, feature, engagement }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tags(feature, engagement) },
    body: JSON.stringify({ prompt, systemOverride, maxTokens, ragQuery, stream: true }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) yield parsed.text;
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

/**
 * Build a standard stage analysis prompt (used by Stage 01 only after this refactor,
 * or by stages that have no prior context yet).
 */
export function buildStagePrompt(stageName, stageContext, formData, relevantDCData) {
  return `You are analyzing inputs for the "${stageName}" stage of the datacenter lifecycle.

## Stage Context
${stageContext}

## User Inputs
${Object.entries(formData)
  .map(([k, v]) => `- **${k}**: ${Array.isArray(v) ? v.join(', ') : v}`)
  .join('\n')}

${relevantDCData ? `## Relevant Market Data\n${relevantDCData}` : ''}

Please provide a comprehensive analysis for this stage with specific recommendations, quantitative benchmarks, and actionable next steps. Format your response with clear ## section headers.`;
}

/**
 * Build a CONTEXTUAL stage prompt for stages 2–6.
 *
 * This is the agent-to-agent layer. It injects:
 *   1. The locked session context from Stage 01 (region, budget, etc.)
 *   2. Trimmed summaries of all prior stage outputs
 *   3. The current stage's own form inputs
 *
 * No LangChain needed — it's pure prompt engineering.
 *
 * @param {string} stageName        - e.g. "Stage 02: DC Supply Chain & Sourcing"
 * @param {string} stageContext     - The stage's own STAGE_CONTEXT description
 * @param {object} formData         - Current stage's form fields
 * @param {object|null} sessionContext - Locked fields from Stage 01 (from Zustand)
 * @param {object} stageOutputs     - All prior stage outputs (from Zustand)
 * @param {string} currentStageNum  - e.g. "02"
 * @param {string|null} relevantDCData - Optional live DC data
 */
export function buildContextualPrompt(
  stageName,
  stageContext,
  formData,
  sessionContext,
  stageOutputs,
  currentStageNum,
  relevantDCData = null
) {
  const currentNum = parseInt(currentStageNum);

  // ── 1. Session context block ──────────────────────────────────────────────
  let contextBlock = '';
  if (sessionContext) {
    const location = sessionContext.state
      ? `${sessionContext.state}, ${sessionContext.region}`
      : sessionContext.region;

    const fields = [
      location                   && `Target Location: ${location}`,
      sessionContext.workloads?.length && `Workload Types: ${sessionContext.workloads.join(', ')}`,
      sessionContext.capacity    && `Capacity Target: ${sessionContext.capacity} MW`,
      sessionContext.budget      && `Investment Budget: ${sessionContext.budget}`,
      sessionContext.timeline    && `Target Timeline: ${sessionContext.timeline}`,
      sessionContext.sustainability && `Sustainability Priority: ${['','Low','Moderate','Important','High','Critical'][sessionContext.sustainability] || sessionContext.sustainability}`,
    ].filter(Boolean);

    if (fields.length) {
      contextBlock = `## Established Session Context (locked from Stage 01)\n${fields.map(f => `- ${f}`).join('\n')}\n\nIMPORTANT: Do NOT ask the user to re-specify these parameters. They are fixed for this engagement.\n`;
    }
  }

  // ── 2. Prior stage summaries ──────────────────────────────────────────────
  const STAGE_NAMES = {
    '01': 'Strategy',
    '02': 'Supply Chain Management',
    '03': 'Design & Build',
    '04': 'Compliance',
    '05': 'Operations',
  };

  let priorOutputsBlock = '';
  const summaries = [];

  for (let i = 1; i < currentNum; i++) {
    const padded = String(i).padStart(2, '0');
    const output = stageOutputs[padded] || stageOutputs[i];
    if (output) {
      // Trim to first ~700 chars so we don't blow the context window
      const trimmed = output.length > 700 ? output.slice(0, 700) + '…' : output;
      summaries.push(`### Stage ${padded} (${STAGE_NAMES[padded] || ''}) Key Findings\n${trimmed}`);
    }
  }

  if (summaries.length) {
    priorOutputsBlock = `## Prior Stage Intelligence (from earlier agents in this session)\nThe following analysis was completed in previous stages. Build on these findings — do not repeat them, but reference and extend them where relevant.\n\n${summaries.join('\n\n')}\n`;
  }

  // ── 3. Current stage inputs ───────────────────────────────────────────────
  const inputsBlock = `## Current Stage: ${stageName}
${stageContext}

## This Stage's Parameters
${Object.entries(formData)
  .map(([k, v]) => `- **${k}**: ${Array.isArray(v) ? v.join(', ') : v}`)
  .join('\n')}

${relevantDCData ? `## Live Market Data\n${relevantDCData}` : ''}`;

  // ── 4. Assemble ───────────────────────────────────────────────────────────
  return `${contextBlock}
${priorOutputsBlock}
${inputsBlock}

Provide a comprehensive analysis for ${stageName}. Integrate the session context and prior stage findings into your recommendations. Give specific, quantitative, actionable outputs. Format with clear ## section headers.`;
}

/**
 * Derive a Tavily RAG query from stage name + form inputs.
 */
export function buildRagQuery(stageName, formData) {
  const region = formData.region || formData.jurisdictions?.join(', ') || '';
  const workloads = Array.isArray(formData.workloads) ? formData.workloads.join(' ') : '';
  const base = `datacenter ${stageName.toLowerCase()} ${region} ${workloads} 2024 2025`;
  return base.trim().replace(/\s+/g, ' ');
}

export function buildChatPrompt(messages, originalContext) {
  const formatted = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  return `You are continuing a conversation about datacenter lifecycle management. Here is the context:\n\n${originalContext}\n\n## Conversation So Far\n${formatted}\n\nContinue the conversation as the KPMG Datacenter Intelligence Engine. Provide specific, data-driven responses.`;
}