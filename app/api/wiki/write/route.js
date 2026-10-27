// /api/wiki/write — turns a knowledge event into wiki pages.
//
// The model extracts pages; every page is then normalised through the
// ontology (lib/wiki/ontology.js), merged with any existing page for the same
// idea, embedded and stored (Supabase, or the folder outside the repository).
import { wikiStore, saveWikiPage } from '@/lib/wiki/store';
import { canonicalPath } from '@/lib/wiki/ontology';
import { requirePermission } from '@/lib/auth/session';
import { recordUsage } from '@/lib/usage-server';

const MODEL_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';

async function modelCall(request, system, prompt, maxTokens = 3000) {
  const res = await fetch(MODEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Extraction service error ${res.status}: ${err?.error?.message || 'unknown'}`);
  }
  const data = await res.json();
  await recordUsage(request, { model: MODEL, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 });
  return data.content[0].text;
}

const EXTRACTION_SYSTEM = `You are a knowledge extraction agent. Given a knowledge event, extract structured knowledge and return ONLY valid JSON — no markdown, no backticks, no explanation. Just raw JSON.

Return this exact schema:
{
  "clientName": "string or null",
  "clientSlug": "kebab-case or null",
  "clientFiles": [
    {
      "relPath": "clients/{clientSlug}/{filename}.md",
      "title": "string",
      "content": "full markdown with frontmatter and [[wikilinks]]"
    }
  ],
  "conceptFiles": [
    { "relPath": "concepts/{slug}.md", "title": "string", "content": "markdown" }
  ],
  "marketFiles": [
    { "relPath": "market/{slug}.md", "title": "string", "content": "markdown" }
  ],
  "patternFiles": [
    { "relPath": "patterns/{slug}.md", "title": "string", "content": "markdown" }
  ]
}

Rules:
- Every file must start with YAML frontmatter: --- title: "..." tags: [...] updated: "YYYY-MM-DD" source: "eventType" ---
- Use [[wikilinks]] generously for cross-linking
- Be specific — extract real names, numbers, locations
- clientFiles: client-specific facts only
- conceptFiles: reusable DC concepts (Tier-3, Greenfield, JV, etc.)
- marketFiles: geography, market data, trends
- patternFiles: only if a clear reusable pattern emerges
- Keep each file 200-400 words
- Always return valid JSON — this is critical`;

const MERGE_SYSTEM = `You are a knowledge merge agent. Merge new content into an existing wiki file.

Rules:
- Preserve accurate existing content
- Update changed facts
- Add new information
- Flag contradictions with: > ⚠️ Conflicting data — needs review
- Update frontmatter updated date to today
- Append to ## Changelog section at bottom
- Preserve all [[wikilinks]], add new ones
- Output ONLY the final merged markdown — no explanation`;

async function extractKnowledge(request, eventType, content, metadata, known) {
  const prompt = `Extract wiki knowledge from this ${eventType} event.

Metadata: ${JSON.stringify(metadata)}

Pages that already exist — when an idea matches one, use its exact relPath so it is merged, not duplicated:
${known.join('\n')}

Content (first 4000 chars):
${content.slice(0, 4000)}`;

  const raw = await modelCall(request, EXTRACTION_SYSTEM, prompt, 6000);
  // Strip any accidental markdown fences
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  // Find JSON object in response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in extraction response');
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    // Response was truncated — attempt to close open arrays/objects and re-parse
    let partial = jsonMatch[0];
    const opens = (partial.match(/\[/g) || []).length - (partial.match(/\]/g) || []).length;
    const braces = (partial.match(/\{/g) || []).length - (partial.match(/\}/g) || []).length;
    // Strip trailing incomplete token (last comma or partial string)
    partial = partial.replace(/,\s*$/, '').replace(/"[^"]*$/, '"...');
    partial += ']'.repeat(Math.max(0, opens)) + '}'.repeat(Math.max(0, braces));
    try {
      return JSON.parse(partial);
    } catch {
      throw new Error('Could not parse extraction response as JSON — response may have been truncated');
    }
  }
}

async function mergeIntoExisting(request, existingContent, newContent, title) {
  const prompt = `Merge this new information into the existing wiki file titled "${title}".

EXISTING:
${existingContent.slice(0, 2000)}

NEW CONTENT:
${newContent.slice(0, 1500)}

Output the final merged markdown file only.`;

  return modelCall(request, MERGE_SYSTEM, prompt, 2000);
}

async function processFile(request, fileSpec) {
  const path = canonicalPath(fileSpec.relPath);
  const existing = await wikiStore.get(path);
  const content = existing ? await mergeIntoExisting(request, existing.content, fileSpec.content, fileSpec.title) : fileSpec.content;
  const saved = await saveWikiPage({ path, content });
  return { relPath: saved.relPath, action: existing ? 'merged' : 'created' };
}

export async function POST(request) {
  const { error } = await requirePermission('use:copilot');
  if (error) return error;
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Knowledge extraction is not configured' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { eventType, content, metadata = {} } = body;
  if (!eventType || !content) {
    return Response.json({ error: 'eventType and content are required' }, { status: 400 });
  }

  try {
    const known = (await wikiStore.list()).map((p) => p.path).filter((p) => !p.startsWith('clients/') && !p.startsWith('_')).map((p) => `${p}.md`);
    const extracted = await extractKnowledge(request, eventType, content, metadata, known);
    const allFiles = [
      ...(extracted.clientFiles || []),
      ...(extracted.conceptFiles || []),
      ...(extracted.marketFiles || []),
      ...(extracted.patternFiles || []),
    ].filter((f) => f?.relPath && f?.content);

    // Two extracted files for one idea are written one after the other, so the second merges into the first.
    const results = [];
    for (const f of allFiles) results.push(await processFile(request, f));
    return Response.json({ success: true, filesWritten: results });
  } catch (err) {
    console.error('[wiki/write]', err.message);
    return Response.json({ error: 'Knowledge write failed' }, { status: 500 });
  }
}
