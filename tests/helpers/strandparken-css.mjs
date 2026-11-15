import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export const css = readFileSync(new URL('../../src/styles/strandparken.css', import.meta.url), 'utf8');

/** Custom properties declared inside the `:root[data-app='strandparken']` block, whitespace normalised. */
export function rootTokens() {
  const start = css.indexOf(":root[data-app='strandparken'] {");
  assert.notEqual(start, -1, "missing :root[data-app='strandparken'] block");
  const end = css.indexOf('\n}', start);
  const body = css.slice(css.indexOf('{', start) + 1, end).replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  return out;
}
