// Product copy never names an AI vendor or model, and never calls itself a
// demo. Comments and code identifiers (demoMode, source: 'llm') are fine;
// anything that could reach the screen, a PDF or an export is checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Surfaces built on the Nexus dataset. Add each new surface as it ships.
const SURFACES = [
  'components/nexus',
  'components/command-center',
  'app/command-center',
  'app/incidents',
  'app/api/copilot',
  'modules/global-infrastructure',
  'app/wiki',
  'components/wiki',
  'lib/nexus',
  'lib/external-risk',
  'lib/wiki',
  'app/ai-insights',
  'components/datacenters',
  'components/cockpit',
  'data/cockpit',
  'lib/cockpit',
  'app/cockpit',
  'components/agentic-stack',
  'components/services',
  'app/services',
  'app/agentic-stack',
];

const FORBIDDEN = [
  // Whole words only: callClaude() is a function name, not copy.
  /\bClaude\b/, /\bAnthropic\b/, /\bOpenAI\b/, /\bChatGPT\b/, /\bGPT\b/, /\bGemini\b/, /\bLLM\b/,
  /\bDemo\b/, /\bDEMO\b/, /\bdemo (mode|scene|data|environment|env)\b/i,
];

function files(dir) {
  const abs = join(root, dir);
  return readdirSync(abs).flatMap((name) => {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) return files(join(dir, name));
    return /\.(jsx?|mjs)$/.test(name) && !/\.test\.mjs$/.test(name) ? [p] : [];
  });
}

// Strip block comments (including JSX {/* */}) and line comments, keeping
// line numbers. "://" in URLs is not a comment.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

test('no AI vendor, model or demo wording in user-facing copy', () => {
  const hits = [];
  for (const file of SURFACES.flatMap(files)) {
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      for (const re of FORBIDDEN) if (re.test(line)) hits.push(`${relative(root, file)}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(hits, []);
});
