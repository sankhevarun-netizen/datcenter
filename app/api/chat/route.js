/**
 * /app/api/chat/route.js
 *
 * Unified RAG endpoint. Uses plain fetch (no SDK) for maximum compatibility.
 *
 * Flow:
 *   1. Receive { prompt, systemOverride, maxTokens, ragQuery, stream }
 *   2. If ragQuery provided → Tavily search → inject top results into system prompt
 *   3. Call Claude API directly via fetch
 *   4. Return response
 *
 * Keys stay 100% server-side. Browser never sees ANTHROPIC_API_KEY or TAVILY_API_KEY.
 */

import { recordUsage } from '@/lib/usage-server';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const BASE_SYSTEM_PROMPT = `You are the KPMG Datacenter Intelligence Engine — a senior AI advisor embedded in the K-Nexus platform.

FORMATTING RULES (strictly follow):
- Use plain section headers like "Executive Summary", "Market Analysis", "Key Risks" — no ## or ### symbols in output
- Use clean bullet points with "-" character
- Never use markdown symbols like **, ##, ###, *, __ in your response
- Numbers and data must be specific and quantitative
- Keep each section concise — 3-5 bullet points max per section
- Structure every response with these sections: Executive Summary | Key Findings | Gaps & Risks | Recommendations | Next Steps
- Professional KPMG advisory tone throughout
- Base analysis on current 2024-2025 market data`;

/**
 * Fetch real-time context from Tavily Search API.
 * Returns a formatted string of top search results, or '' on failure.
 */
async function fetchTavilyContext(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !query) return '';

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 5,
        include_domains: [
          'datacenterknowledge.com',
          'datacenterdynamics.com',
          'uptime.com',
          'iea.org',
          'gartner.com',
          'bloomberg.com',
          'reuters.com',
          'ft.com',
        ],
      }),
    });

    if (!res.ok) return '';
    const data = await res.json();

    // Build a concise context block from Tavily results
    const lines = [];

    if (data.answer) {
      lines.push(`## Live Market Intelligence (via Tavily)`);
      lines.push(data.answer);
      lines.push('');
    }

    if (data.results?.length > 0) {
      lines.push(`## Supporting Sources`);
      data.results.slice(0, 4).forEach((r, i) => {
        lines.push(`### Source ${i + 1}: ${r.title}`);
        lines.push(r.content?.slice(0, 400) ?? '');
        lines.push(`URL: ${r.url}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  } catch {
    // Tavily failure is non-fatal — continue without RAG context
    return '';
  }
}

/**
 * Build the final system prompt by injecting RAG context.
 */
function buildSystemPrompt(baseSystem, ragContext) {
  if (!ragContext) return baseSystem;
  return `${baseSystem}

---
${ragContext}
---

When referencing the above live market data, cite it naturally in your analysis to ground recommendations in current reality.`;
}

export async function POST(request) {
  // ── Validate API key ────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY not configured on server.' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const {
    prompt,
    systemOverride = null,
    maxTokens = 8192,
    ragQuery = null,       // If provided, Tavily will search this query
    stream = false,
  } = body;

  if (!prompt) {
    return Response.json({ error: 'prompt is required.' }, { status: 400 });
  }

  // ── RAG: fetch Tavily context ───────────────────────────────────────────────
  const ragContext = await fetchTavilyContext(ragQuery);
  const systemPrompt = buildSystemPrompt(
    systemOverride || BASE_SYSTEM_PROMPT,
    ragContext
  );

  const anthropicHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  };

  const requestBody = {
    model: 'claude-sonnet-4-5',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  };

  // ── Non-streaming response ──────────────────────────────────────────────────
  if (!stream) {
    try {
      const claudeRes = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: anthropicHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!claudeRes.ok) {
        const errData = await claudeRes.json().catch(() => ({}));
        return Response.json(
          { error: errData.error?.message || `Claude API error: ${claudeRes.status}` },
          { status: claudeRes.status }
        );
      }

      const data = await claudeRes.json();
      await recordUsage(request, { model: requestBody.model, inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens });
      return Response.json({ text: data.content[0].text });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // ── Streaming response ──────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const claudeRes = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: anthropicHeaders,
          body: JSON.stringify({ ...requestBody, stream: true }),
        });

        if (!claudeRes.ok) {
          const errData = await claudeRes.json().catch(() => ({}));
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errData.error?.message || `Claude API error: ${claudeRes.status}` })}\n\n`)
          );
          controller.close();
          return;
        }

        const reader = claudeRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const usage = { input: 0, output: 0 };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6);
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.type === 'message_start') usage.input = parsed.message?.usage?.input_tokens ?? 0;
              if (parsed.type === 'message_delta') usage.output = parsed.usage?.output_tokens ?? usage.output;
              if (parsed.type === 'message_start') usage.input = parsed.message?.usage?.input_tokens ?? 0;
              if (parsed.type === 'message_delta') usage.output = parsed.usage?.output_tokens ?? usage.output;
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        await recordUsage(request, { model: requestBody.model, inputTokens: usage.input, outputTokens: usage.output });
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
