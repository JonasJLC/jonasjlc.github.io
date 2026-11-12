import assert from 'node:assert/strict';
import test from 'node:test';
import { rootTokens } from './helpers/strandparken-css.mjs';

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const t = rootTokens();
const c = (name) => t[`--sp-${name}`];

// UI spec §9: text at least 4.5:1. §3.1 pairs.
const text = [
  ['ink', 'bg'], ['ink', 'surface'], ['ink', 'track'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'track'],
  ['on-primary', 'primary'], ['primary', 'primary-tint'], ['primary', 'surface'], ['primary', 'bg'],
  ['danger', 'danger-tint'], ['danger', 'surface'],
  ['on-primary', 'jonas'], ['on-primary', 'camilla'],
  ['jonas-ink', 'jonas-tint'], ['camilla-ink', 'camilla-tint'],
];
for (const [fg, bg] of text)
  test(`text ${fg} on ${bg} is at least 4.5:1`, () => {
    const r = ratio(c(fg), c(bg));
    assert.ok(r >= 4.5, `${r.toFixed(2)}:1`);
  });

// WCAG 1.4.11: the unchecked-checkbox border must reach 3:1 on both grounds it can sit on.
for (const bg of ['surface', 'bg'])
  test(`--sp-dash on ${bg} is at least 3:1 (non-text boundary)`, () => {
    const r = ratio(c('dash'), c(bg));
    assert.ok(r >= 3, `${r.toFixed(2)}:1`);
  });
