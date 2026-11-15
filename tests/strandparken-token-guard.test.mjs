import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;
const dirs = ['src/components/strandparken', 'src/dev/strandparken'];
const exts = /\.(tsx?|astro|css|mjs)$/;

// Raw design values belong in src/styles/strandparken.css only. No allowlist, on purpose.
export const rules = [
  ['hex colour', /#[0-9a-fA-F]{3,8}\b/],
  ['rgb()/rgba()', /rgba?\(/],
  ['hsl()', /hsla?\(/],
  ['arbitrary value with a unit or colour', /-\[[^\]]*(px|rem|#|rgb)/],
  ['font-family', /font-family/],
  ['fontFamily', /fontFamily/],
  ['font name', /Fraunces|Figtree|Georgia/],
];

export const scan = (text) => rules.filter(([, re]) => re.test(text)).map(([name]) => name);

function* files(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (exts.test(name)) yield p;
  }
}

// Samples are joined from fragments: Tailwind scans the whole repo (tests included) and would
// otherwise emit utilities for them into the /ferie stylesheet.
const j = (...parts) => parts.join('');

test('the guard rules catch what they should', () => {
  assert.deepEqual(scan(j('className="bg-', '[#fff]"')), ['hex colour', 'arbitrary value with a unit or colour']);
  assert.ok(scan('style={{ color: "rgb(0 0 0)" }}').includes('rgb()/rgba()'));
  assert.ok(scan(j('w-', '[13px]')).includes('arbitrary value with a unit or colour'));
  assert.ok(scan(j('p-', '[1.5rem]')).includes('arbitrary value with a unit or colour'));
  assert.ok(scan('style={{ fontFamily: "x" }}').includes('fontFamily'));
  assert.ok(scan('// uses Fraunces').includes('font name'));
  assert.deepEqual(scan(j('max-h-', '[85dvh] bg-sp-surface rounded-sp-row href="#hjem"')), []);
});

test('no raw colour, radius, shadow or font value in Strandparken components', () => {
  const found = [];
  for (const dir of dirs)
    for (const file of files(join(root, dir))) {
      const text = readFileSync(file, 'utf8');
      text.split('\n').forEach((line, i) => {
        for (const rule of scan(line)) found.push(`${relative(root, file)}:${i + 1} ${rule}: ${line.trim()}`);
      });
    }
  assert.deepEqual(found, []);
});
