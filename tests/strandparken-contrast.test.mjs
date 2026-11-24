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
  // Idea 5: overdue dates (warning, never red). The Fælles (CJ) avatar uses the honey tone pair, checked below.
  ['warn', 'surface'], ['warn', 'bg'],
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

// Idé 2 tone pairs (also reused by ideas 14 and 15): the icon is a graphical object (WCAG 1.4.11, 3:1),
// and the tile stays soft, so it never reads louder than a photo.
const tones = ['clay', 'sage', 'honey', 'rose', 'mint', 'plum', 'sky', 'oat'];
for (const k of tones) {
  test(`tone ${k}: ink on tile is at least 3:1`, () => {
    const r = ratio(c(`tone-${k}-ink`), c(`tone-${k}`));
    assert.ok(r >= 3, `${r.toFixed(2)}:1`);
  });
  test(`tone ${k}: tile against surface stays below 1.6:1`, () => {
    const r = ratio(c(`tone-${k}`), c('surface'));
    assert.ok(r < 1.6, `${r.toFixed(2)}:1`);
  });
  // Idea 14: the shopping list's amount pill is 12.5 px text in the tone ink on the tone, so it needs the text ratio.
  test(`tone ${k}: ink text on tone is at least 4.5:1 (shopping amount pill)`, () => {
    const r = ratio(c(`tone-${k}-ink`), c(`tone-${k}`));
    assert.ok(r >= 4.5, `${r.toFixed(2)}:1`);
  });
  // The cover tile's "Henter billede…" caption (Idé 1) sits on the tone.
  test(`text muted on tone ${k} is at least 4.5:1`, () => {
    const r = ratio(c('muted'), c(`tone-${k}`));
    assert.ok(r >= 4.5, `${r.toFixed(2)}:1`);
  });
}

// Idé 7: calendar colours. Event title and time sit on the tint (text, 4.5:1); the bar is a graphical marker on the tint
// and the colour dot sits on the surface (WCAG 1.4.11, 3:1).
for (const k of [1, 2, 3, 4, 5, 6]) {
  test(`calendar ${k}: ink on tint is at least 4.5:1`, () => {
    const r = ratio(c(`cal-${k}-ink`), c(`cal-${k}-tint`));
    assert.ok(r >= 4.5, `${r.toFixed(2)}:1`);
  });
  for (const bg of [`cal-${k}-tint`, 'surface'])
    test(`calendar ${k}: bar on ${bg} is at least 3:1`, () => {
      const r = ratio(c(`cal-${k}`), c(bg));
      assert.ok(r >= 3, `${r.toFixed(2)}:1`);
    });
}
