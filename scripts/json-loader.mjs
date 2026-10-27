// scripts/json-loader.mjs
// Test-only: lets `node --test` load the plain `import x from './x.json'`
// statements that webpack/Next handle natively (Node otherwise requires an
// import attribute). Usage: node --import ./scripts/json-loader.mjs --test ...
import { register } from 'node:module';

register(
  'data:text/javascript,' + encodeURIComponent(`
    import { readFile } from 'node:fs/promises';
    export async function load(url, context, next) {
      if (url.endsWith('.json')) {
        const json = await readFile(new URL(url), 'utf8');
        return { format: 'module', source: 'export default ' + json + ';', shortCircuit: true };
      }
      return next(url, context);
    }
  `),
);
