// Multi-turn conversational API for the K-Nexus operations copilot. Answers
// are seeded entirely from the dataset via local-copilot.js — no model call.
import { localCopilotAnswer } from '@/lib/nexus/local-copilot';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { messages = [] } = body;

  if (!messages.length) {
    return Response.json({ error: 'messages array is required.' }, { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const content = localCopilotAnswer(lastUser?.content ?? '');
  return Response.json({ content }, { status: 200 });
}
