import assert from 'node:assert/strict';
import test from 'node:test';
import { css, rootTokens } from './helpers/strandparken-css.mjs';

// UI spec §3.1 colour, §3.3 shape, depth, space. Values exactly as written there,
// except --sp-dash, darkened on request (plan Q6) so the unchecked-box border reaches 3:1.
const expected = {
  '--sp-bg': '#F5F1E8', '--sp-surface': '#FFFFFF', '--sp-ink': '#1B2620', '--sp-muted': '#5C6259',
  '--sp-primary': '#1F4D3A', '--sp-on-primary': '#FFFFFF', '--sp-primary-tint': '#E8EFE6',
  '--sp-track': '#E9E3D4', '--sp-line': '#E6E0D2', '--sp-line-soft': '#EFEADD', '--sp-dash': '#8C8676',
  '--sp-danger': '#7A2A16', '--sp-danger-tint': '#F6DFD6',
  '--sp-jonas': '#2F6690', '--sp-jonas-tint': '#EDF2F6', '--sp-jonas-ink': '#24506F',
  '--sp-camilla': '#96486A', '--sp-camilla-tint': '#F5ECF0', '--sp-camilla-ink': '#7A3856',
  '--sp-scrim': 'rgba(27, 38, 32, 0.45)',
  '--sp-r-card': '24px', '--sp-r-row': '20px', '--sp-r-inset': '16px', '--sp-r-sheet': '30px', '--sp-r-pill': '999px',
  '--sp-shadow-hero': '0 12px 30px rgba(52, 60, 40, 0.12)',
  '--sp-shadow-float': '0 4px 12px rgba(40, 30, 15, 0.18)',
  '--sp-shadow-seg': '0 1px 3px rgba(0, 0, 0, 0.12)',
  '--sp-page-top': '28px', '--sp-page-x': '20px', '--sp-page-bottom': '40px',
  '--sp-gap-home': '22px', '--sp-gap': '16px', '--sp-pad-card': '18px', '--sp-gap-grid': '12px', '--sp-gap-row': '8px',
  '--sp-row-min': '52px', '--sp-target': '44px', '--sp-bar-h': '76px', '--sp-column': '520px',
};

const shadcn = {
  '--background': 'sp-bg', '--foreground': 'sp-ink', '--card': 'sp-surface', '--card-foreground': 'sp-ink',
  '--popover': 'sp-surface', '--popover-foreground': 'sp-ink', '--primary': 'sp-primary', '--primary-foreground': 'sp-on-primary',
  '--secondary': 'sp-track', '--secondary-foreground': 'sp-ink', '--muted': 'sp-track', '--muted-foreground': 'sp-muted',
  '--accent': 'sp-track', '--accent-foreground': 'sp-ink', '--destructive': 'sp-danger', '--border': 'sp-line',
  '--input': 'sp-dash', '--ring': 'sp-primary',
};

test('every UI spec token exists with its exact value', () => {
  const tokens = rootTokens();
  for (const [name, value] of Object.entries(expected)) assert.equal(tokens[name], value, name);
});

test('every shadcn theme variable points at a Strandparken token', () => {
  const tokens = rootTokens();
  for (const [name, target] of Object.entries(shadcn)) assert.equal(tokens[name], `var(--${target})`, name);
});

test('light only: color-scheme is light', () => {
  assert.match(css, /color-scheme:\s*light\s*;/);
});

test('Tailwind default palette, radius, shadow and font scales are reset', () => {
  for (const reset of ['--color-*: initial', '--radius-*: initial', '--shadow-*: initial', '--font-*: initial'])
    assert.ok(css.includes(reset), reset);
});

test('Tailwind utilities exist for every colour, radius, shadow and font token', () => {
  const theme = css.slice(css.indexOf('@theme inline'));
  for (const c of Object.keys(expected).filter((n) => /^--sp-(bg|surface|ink|muted|primary|on-primary|primary-tint|track|line|line-soft|dash|danger|danger-tint|jonas|jonas-tint|jonas-ink|camilla|camilla-tint|camilla-ink|scrim)$/.test(n)))
    assert.ok(theme.includes(`--color-${c.slice(2)}: var(${c})`), c);
  for (const r of ['card', 'row', 'inset', 'sheet', 'pill']) assert.ok(theme.includes(`--radius-sp-${r}: var(--sp-r-${r})`), r);
  for (const s of ['hero', 'float', 'seg']) assert.ok(theme.includes(`--shadow-sp-${s}: var(--sp-shadow-${s})`), s);
  assert.ok(theme.includes("--font-sp-serif: 'Fraunces Variable'"));
  assert.ok(theme.includes("--font-sp-sans: 'Figtree Variable'"));
});
