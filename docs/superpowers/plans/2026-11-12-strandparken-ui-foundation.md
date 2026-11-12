# Strandparken UI Foundation (U1–U4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Strandparken design foundation and an empty app shell at `/strandparken/`. This covers UI spec steps U1 (fonts and tokens), U2 (primitives), U3 (dev-only UI gallery) and U4 (app shell), which together are main-spec slices 0.3 and 0.4. `/ferie/` must look and behave exactly as before.

**Architecture:** A new Astro page, `src/pages/strandparken/index.astro`, mounts one React island (`client:only="react"`). It is the same pattern as `/ferie/`. All styling lives in `src/styles/strandparken.css`. That file defines the §3 tokens, maps them into Tailwind v4 through `@theme inline`, and points the shadcn/ui theme variables at them. It is imported only by Strandparken pages and scans only Strandparken sources. Primitives in `src/components/strandparken/ui/` are vendored shadcn/ui primitives (Radix), restyled through the tokens. The shell keeps the current view in the URL hash. The UI gallery is injected as a route only when `astro dev` runs, so it never reaches `dist/`.

**Tech Stack:** Astro 7.4.11, React 19.3, TypeScript 6, Tailwind CSS 4.3.5 via `@tailwindcss/vite` 4.3.5 (CSS-first config, no `tailwind.config`), shadcn/ui primitives on `radix-ui` 1.8.1, `sonner` 2.0.8, `class-variance-authority`, `lucide-react`, Fontsource variable fonts, and Node's built-in test runner. Use pnpm 10.33.2 and Node 22.23.4+ (Node strips types natively, so `node --test` runs `.ts` tests that use relative imports).

**Specs:**
- Appearance: `docs/superpowers/specs/2026-11-12-strandparken-ui-design.md` (the "UI spec"). Exact values come from `docs/superpowers/specs/assets/strandparken-ui-reference.dc.html`.
- Behaviour: `docs/superpowers/specs/2026-11-11-strandparken-design.md` (the "main spec"): §4.2, §4.3, §5.1, §5.2, Phase 0.

**Status:** Draft. The open questions at the end must be answered before execution. Every task that depends on a question names it. The marked defaults are what this plan assumes if you approve it unchanged.

---

## Current setup (as found on 2026-11-12)

| Area | What the repo has | Consequence for Strandparken |
|---|---|---|
| Tailwind | `tailwindcss` 4.3.5 and `@tailwindcss/vite` 4.3.5, registered in `astro.config.mjs`. Config is CSS-first: `src/styles/ferie.css` does `@import 'tailwindcss'` and declares its theme with `@theme inline`. There is no `@source`, so Tailwind's automatic detection scans every non-ignored file in the repo. | A second entry stylesheet works the same way. Without source limits, each stylesheet would generate utilities for the other app's class names (Q4). |
| shadcn/ui | Not a package dependency. Components were generated with `pnpm dlx shadcn@latest` into `src/components/ferie/ui/`. `components.json`: style `new-york`, Tailwind v4 mode (`config: ""`, `data-slot` attributes), `cssVariables: true`, baseColor `neutral`, icon library `lucide`. All aliases point at `@/components/ferie/...`. Primitives come from the unified `radix-ui` 1.8.1 package. Drawers use `vaul` 1.1.2 and toasts use `sonner` 2.0.8. | Running the CLI would write into `/ferie`. Strandparken primitives are copied from the shadcn registry source by hand into `src/components/strandparken/ui/` and import a Strandparken-local `cn`. `components.json` stays unchanged. |
| shadcn theme variables | `ferie.css` defines `--background`, `--foreground`, `--primary`, `--muted`, `--ring`, … on `:root`, plus a dark set on `:root[data-theme='dark']`. | Strandparken defines the same names inside its own scope, pointing at `--sp-*`. The stylesheets never load on the same page. |
| Fonts | `/ferie` self-hosts through Fontsource npm packages imported at the top of `ferie.css` (`@fontsource-variable/instrument-sans`, `@fontsource/instrument-serif`). The portfolio uses woff2 files in `src/assets/fonts/`. | Fraunces and Figtree follow the `/ferie` pattern: `@fontsource-variable/fraunces` 5.3.0 and `@fontsource-variable/figtree` 5.3.0 (both exist on npm). These are the only new dependencies. |
| Routing | `FerieApp.tsx` reads `location.hash` and listens to `hashchange`. | Use the same pattern, extracted into a tested pure module. |
| PWA | `public/ferie/manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-32.png`. No service worker. | Mirror this under `public/strandparken/`. |
| Avatars | `public/ferie/avatars/jonas.jpg` and `camilla.jpg`. | Reused as the UI spec §5.15 says. |
| Tests | `tests/gave-logic.test.mjs` runs with `node --test`. No Vitest and no Playwright. CI (`.github/workflows/pages.yml`) runs no tests; it builds and checks `dist/gave/index.html` and `dist/ferie/index.html`. | Pure logic and token guards use `node --test` (Q11). Visual checks are manual in the browser. |
| Sitemap | `astro.config.mjs` filters `/ferie` and `/gave` out of `@astrojs/sitemap`. | `/strandparken` must be added to the filter. |
| Repository | Public (`gh repo view` → `PUBLIC`). Current branch is `feature/strandparken`. | See Q2 and Q3. |

---

## How the §3 tokens are mapped

All of this lives in `src/styles/strandparken.css`. Nothing in it is imported by `/ferie`.

**1. Source scope.** The stylesheet starts:

```css
@import '@fontsource-variable/fraunces/opsz.css'; /* wght + opsz axes, so optical size is automatic */
@import '@fontsource-variable/figtree';
@import 'tailwindcss' source(none);
@source '../components/strandparken';
@source '../pages/strandparken';
@source '../dev/strandparken';
```

`source(none)` stops this stylesheet from generating utilities for `/ferie` class names. The reverse direction needs `@source not '../components/strandparken';` (and the pages and dev folders) in `ferie.css`. That is a one-line change to a `/ferie` file, so it is Q4.

**2. Raw tokens on the root element.** The page renders `<html lang="da" data-app="strandparken">`, and the tokens are declared on `:root[data-app='strandparken']`. They go on `<html>` rather than on the island's wrapper `<div>` because Radix portals (sheet, toast) render into `<body>`, outside any app `<div>`. A wrapper scope would leave every sheet unstyled. `<html>` is also the literal "root element" the UI spec §3 names.

```css
:root[data-app='strandparken'] {
  /* §3.1 colour, exactly as listed */
  --sp-bg: #F5F1E8;  --sp-surface: #FFFFFF;  --sp-ink: #1B2620;  --sp-muted: #5C6259;
  --sp-primary: #1F4D3A;  --sp-on-primary: #FFFFFF;  --sp-primary-tint: #E8EFE6;
  --sp-track: #E9E3D4;  --sp-line: #E6E0D2;  --sp-line-soft: #EFEADD;  --sp-dash: #A8A291; /* Q6 */
  --sp-danger: #7A2A16;  --sp-danger-tint: #F6DFD6;
  --sp-jonas: #2F6690;  --sp-jonas-tint: #EDF2F6;  --sp-jonas-ink: #24506F;      /* Q5 */
  --sp-camilla: #96486A;  --sp-camilla-tint: #F5ECF0;  --sp-camilla-ink: #7A3856;
  --sp-scrim: rgba(27, 38, 32, 0.45);
  /* §3.3 shape and depth */
  --sp-r-card: 24px;  --sp-r-row: 20px;  --sp-r-inset: 16px;  --sp-r-sheet: 30px;  --sp-r-pill: 999px;
  --sp-shadow-hero: 0 12px 30px rgba(52, 60, 40, 0.12);
  --sp-shadow-float: 0 4px 12px rgba(40, 30, 15, 0.18);
  --sp-shadow-seg: 0 1px 3px rgba(0, 0, 0, 0.12);
  /* §3.3 spacing, named so components never hold raw px */
  --sp-page-top: 28px;  --sp-page-x: 20px;  --sp-page-bottom: 40px;
  --sp-gap-home: 22px;  --sp-gap: 16px;  --sp-pad-card: 18px;  --sp-gap-grid: 12px;  --sp-gap-row: 8px;
  --sp-row-min: 52px;  --sp-target: 44px;  --sp-bar-h: 76px;  --sp-column: 520px;
  /* shadcn/ui theme variables → Strandparken tokens (same scope) */
  --background: var(--sp-bg);        --foreground: var(--sp-ink);
  --card: var(--sp-surface);         --card-foreground: var(--sp-ink);
  --popover: var(--sp-surface);      --popover-foreground: var(--sp-ink);
  --primary: var(--sp-primary);      --primary-foreground: var(--sp-on-primary);
  --secondary: var(--sp-track);      --secondary-foreground: var(--sp-ink);
  --muted: var(--sp-track);          --muted-foreground: var(--sp-muted);
  --accent: var(--sp-track);         --accent-foreground: var(--sp-ink);
  --destructive: var(--sp-danger);   --border: var(--sp-line);
  --input: var(--sp-dash);           --ring: var(--sp-primary);
  color-scheme: light;               /* D29: no dark mode */
}
```

**3. Tailwind theme.** `@theme inline` exposes the tokens as utilities. The default palette, radius, shadow and font scales are reset to `initial`, so `bg-red-500` or `rounded-lg` produces no CSS. Raw design values become impossible without an arbitrary `[...]` value, and the token-guard test (Task 7) catches those.

```css
@theme inline {
  --color-*: initial;  --radius-*: initial;  --shadow-*: initial;  --font-*: initial;
  --color-sp-bg: var(--sp-bg);  --color-sp-surface: var(--sp-surface);  /* …one per §3.1 colour… */
  --color-background: var(--background);  --color-foreground: var(--foreground);  /* …shadcn names… */
  --radius-sp-card: var(--sp-r-card);  --radius-sp-row: var(--sp-r-row);  --radius-sp-inset: var(--sp-r-inset);
  --radius-sp-sheet: var(--sp-r-sheet);  --radius-sp-pill: var(--sp-r-pill);
  --shadow-sp-hero: var(--sp-shadow-hero);  --shadow-sp-float: var(--sp-shadow-float);  --shadow-sp-seg: var(--sp-shadow-seg);
  --font-sp-serif: 'Fraunces Variable', Georgia, serif;
  --font-sp-sans: 'Figtree Variable', system-ui, sans-serif;
}
```

The result is utilities such as `bg-sp-surface`, `text-sp-muted`, `rounded-sp-row`, `shadow-sp-hero` and `font-sp-sans`. Vendored shadcn code keeps working with `bg-background`, `text-muted-foreground` and `ring-ring`.

**4. Typography roles (§3.2)** are `@utility` rules, one per role, so a component writes `sp-title-page` instead of four classes. Sizes are in `rem` (px ÷ 16), so the layout follows the user's text size (UI spec §9, 130 %).

| Utility | Face / weight | Size / line height / tracking |
|---|---|---|
| `sp-title-page` | serif 500 | 2rem / 1.1 / −0.01em |
| `sp-title-recipe` | serif 500 | 1.875rem / 1.12 / −0.01em |
| `sp-title-card` | serif 500 | 1.5rem / 1.15 |
| `sp-title-section` | serif 500 | 1.25rem / 1.2 |
| `sp-title-group` | serif 500 | 1.125rem / 1.2 |
| `sp-stat-lg` / `sp-stat-sm` | serif 400 | 2.5rem / 1.1 · 1.625rem / 1.1 |
| `sp-body` / `sp-body-strong` | sans 400 / 600 | 0.9375rem / 1.4 |
| `sp-small` | sans 400 | 0.84375rem / 1.4 |
| `sp-caption` | sans 400 (600 via `font-semibold`) | 0.78125rem / 1.35 |
| `sp-nav` | sans 600 | 0.71875rem / 1 |
| `sp-button` / `sp-button-sm` | sans 600 | 1rem · 0.875rem |
| `sp-input` | sans 400 | 1rem (stops iOS zoom) |

Ranges in the spec are resolved from the reference: `body-strong` 600 (row titles in the reference are 600), primary button 16 px, in-card and chip buttons 14 px.

**5. Base layer** (scoped to `:root[data-app='strandparken']`): body ground `--sp-bg`, ink, `sp-body`, antialiasing, focus ring `2px solid var(--sp-primary)` with 2 px offset, and a reduced-motion block that makes every transition and animation instant (UI spec §8).

**Where the UI spec and the reference disagree** (UI spec §1 says the spec wins; noted here, not asked):
- Tonight card radius 26 px and recipe or link cards 22 px in the reference → `--sp-r-card` 24 / `--sp-r-row` 20.
- Tonight title 23 px → `sp-title-card` 24 px.
- Recipe segmented track `#EFEADD` and explanation box `#EEF2EA` → `--sp-track` and `--sp-primary-tint` (UI spec §3.1 note).
- Scroll area inset 86 px against a 76 px bar → content padding is `--sp-bar-h` + safe area + `--sp-page-bottom`.

---

## Files

**Create**

| File | Purpose | Task |
|---|---|---|
| `src/pages/strandparken/index.astro` | Route, `<html data-app>`, metadata, noindex, manifest links, island mount | 2, 20 |
| `src/styles/strandparken.css` | Fonts, tokens, Tailwind theme, typography utilities, base, keyframes | 3–6 |
| `src/components/strandparken/StrandparkenApp.tsx` | Island root: providers (toaster) and shell | 2, 19 |
| `src/components/strandparken/lib/utils.ts` | `cn()` (local copy, so `/ferie` stays untouched) | 8 |
| `src/components/strandparken/lib/routes.ts` | Pure hash-route parse/serialize | 17 |
| `src/components/strandparken/lib/use-route.ts` | `hashchange` hook | 17 |
| `src/components/strandparken/lib/stepper.ts` | Pure clamp/step logic | 12 |
| `src/components/strandparken/lib/fixtures.ts` | Typed shell fixture (signed-in person only) | 19 |
| `src/components/strandparken/ui/icon.tsx` | Lucide defaults: 22 px, stroke 1.8, `aria-hidden` | 8 |
| `src/components/strandparken/ui/button.tsx` | Primary, outline, quiet, icon | 8 |
| `src/components/strandparken/ui/card.tsx` | Card plus row separator | 9 |
| `src/components/strandparken/ui/badge.tsx` | Neutral, positive, danger, person | 9 |
| `src/components/strandparken/ui/avatar.tsx` | Photo or initial; 44/34/30 | 9 |
| `src/components/strandparken/ui/chip.tsx` | Toggle pill (`aria-pressed`) | 10 |
| `src/components/strandparken/ui/segmented-control.tsx` | Radix Tabs list styled per UI spec §5.9 | 10 |
| `src/components/strandparken/ui/checkbox.tsx` | Radix Checkbox, `shape="round" \| "square"` | 11 |
| `src/components/strandparken/ui/stepper.tsx` | Persons stepper | 12 |
| `src/components/strandparken/ui/field.tsx` | Labelled pill input, optional round action | 12 |
| `src/components/strandparken/ui/sheet.tsx` | Bottom sheet (Q7) | 13 |
| `src/components/strandparken/ui/toast.tsx` | Sonner toaster and `notify()` with `Fortryd` | 14 |
| `src/components/strandparken/ui/dish-image.tsx` | Round/cover, letter fallback, empty slot | 15 |
| `src/components/strandparken/shell/BottomBar.tsx` | UI spec §5.1 | 18 |
| `src/components/strandparken/shell/AppShell.tsx` | Column, header avatar, view switch, safe areas | 19 |
| `src/components/strandparken/shell/views.tsx` | Five placeholder views (title and empty state) | 19 |
| `src/dev/strandparken/gallery.astro` | Dev-only gallery page (outside `src/pages`) | 16 |
| `src/dev/strandparken/Gallery.tsx` | Every primitive in every state | 16 |
| `public/strandparken/manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-32.png` | PWA (Q10) | 20 |
| `tests/strandparken-tokens.test.mjs` | Every §3 token exists with its exact value | 5 |
| `tests/strandparken-contrast.test.mjs` | WCAG ratios of the §3.1 pairs | 5 |
| `tests/strandparken-token-guard.test.mjs` | No raw colour, radius, shadow or font in `src/components/strandparken/` | 7 |
| `tests/strandparken-routes.test.ts` | Hash routing | 17 |
| `tests/strandparken-stepper.test.ts` | Stepper clamp | 12 |

**Change**

| File | Change | Task |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | Add `@fontsource-variable/fraunces`, `@fontsource-variable/figtree` | 3 |
| `astro.config.mjs` | Sitemap filter gains `strandparken`; inline dev-only integration injects the gallery route | 2, 16 |
| `src/styles/ferie.css` | One `@source not` block, only if Q4 = yes | 4 |
| `.github/workflows/pages.yml` | `Verify strandparken route` step; optionally a test step (Q11) | 2 |
| `AGENTS.md` | Describe `/strandparken/`; extend the React/Tailwind/shadcn/Supabase exception to it; fix "Astro 5" if Q13 = yes | 2 |
| `README.md` | Short `/strandparken/` section and the gallery command | 21 |
| This plan | Tick boxes; record evidence under `## Verification` | each |

Not touched: anything in `src/components/ferie/`, `src/pages/ferie/`, `components.json`, `public/ferie/`, and `supabase/`.

---

## Global constraints

- The UI spec wins on appearance and the main spec wins on behaviour. Danish copy is taken verbatim from the UI spec or the reference.
- Components use tokens only. No hex, `rgb()`, px radius, shadow or font name outside `strandparken.css`. Task 7 enforces this.
- Real `<button>`, `<a>`, `<input>` and `<label>` elements. Every icon-only control has a Danish `aria-label`. Touch targets are at least 44 × 44 px.
- No emoji. Icons come from `lucide-react` through `ui/icon.tsx`.
- The page has a viewport tag with `viewport-fit=cover`, a description, `noindex, nofollow`, `lang="da"`, and no link from the homepage.
- React, Tailwind and shadcn stay confined to `/ferie/` and `/strandparken/`. No new dependency beyond the two font packages.
- Preserve unrelated working-tree changes. Stage only the task's files. The untracked spec files are not committed by this plan (Q3).

**Standard checks**, referred to below as "run the standard checks":

```bash
pnpm install --frozen-lockfile        # only when node_modules is missing or the lockfile changed
node --test tests/
ASTRO_TELEMETRY_DISABLED=1 pnpm exec astro check
ASTRO_TELEMETRY_DISABLED=1 pnpm exec astro build
test -s dist/ferie/index.html && test -s dist/gave/index.html && test -s dist/strandparken/index.html
```

**/ferie regression check**, referred to below as "run the /ferie check": compare against the Task 1 baseline.
1. `dist/ferie/index.html` differs from the baseline only in hashed asset names.
2. The CSS file linked from `dist/ferie/index.html` is byte-identical to the baseline CSS (this needs Q4 = yes; with Q4 = no, it may only gain rules for class names under `src/components/strandparken/`, and that is checked by diffing the selector list).
3. With `pnpm exec astro preview`, `/ferie/` at 390 px and 1280 px in light and dark matches the baseline screenshots, with no new console output.

---

### Task 1: Capture the /ferie baseline

**Files:** none in the repo. Output goes to the session scratchpad.

- [x] **Step 1:** On a clean checkout of this branch, run the standard checks without the `strandparken` assertion.
- [x] **Step 2:** Copy `dist/ferie/` and the CSS file it links to into the scratchpad. Record the CSS file name and `sha256sum`.
- [x] **Step 3:** Preview `/ferie/`. Take screenshots of each `/ferie` tab (`#feriedage`, `#kassen`, `#plan`) at 390 × 844 and 1280 × 800, in light and dark. Run without Supabase env so no sign-in gate appears (README).
- [x] **Verify:** the baseline files and screenshots exist, and their paths are recorded under `## Verification`.

### Task 2: Route scaffold (slice 0.1 prerequisite, Q1)

**Files:** create `src/pages/strandparken/index.astro` and `src/components/strandparken/StrandparkenApp.tsx` (renders one `<main>` with "Strandparken"). Change `astro.config.mjs` (sitemap filter `/\/(ferie|gave|strandparken)(\/|$)/`), `.github/workflows/pages.yml`, and `AGENTS.md`.

- [x] **Step 1:** Add the CI step `Verify strandparken route: test -s dist/strandparken/index.html` after the ferie check. Run the standard checks and confirm they fail on that assertion.
- [x] **Step 2:** Create the page. It has `<html lang="da" data-app="strandparken">`, `viewport` with `viewport-fit=cover`, `description` ("Madplan, indkøb og hverdag for to."; the wording needs your OK), `robots noindex, nofollow`, canonical `https://jonasjlc.github.io/strandparken/`, `theme-color #F5F1E8`, `<title>Strandparken</title>`, `<StrandparkenApp client:only="react" />` and a Danish `<noscript>`. The hex in `theme-color` is page metadata, not a component value, and is the only allowed exception.
- [x] **Step 3:** Update `AGENTS.md`: add a `/strandparken/` paragraph (page, components, styles, unlisted), extend the island exception to `/strandparken/`, and add the CI assertion to the pages.yml description.
- [x] **Verify:** the standard checks pass. `grep -c noindex dist/strandparken/index.html` is 1. `dist/sitemap-0.xml` has no `strandparken`. The homepage has no link to it (`grep -L strandparken dist/index.html`). Run the /ferie check.
- [x] **Commit:** `feat(strandparken): add unlisted route scaffold` (Q12).

### Task 3: Self-hosted fonts (U1)

**Files:** `package.json` and `pnpm-lock.yaml`. Create `src/styles/strandparken.css` with the two font imports only, and import it from the page.

- [x] **Step 1:** `pnpm add @fontsource-variable/fraunces@5.3.0 @fontsource-variable/figtree@5.3.0`
- [x] **Step 2:** Import `@fontsource-variable/fraunces/opsz.css` (weight and optical-size axes) and `@fontsource-variable/figtree`. Confirm the family names in each package's CSS (`'Fraunces Variable'`, `'Figtree Variable'`) before using them in Task 5.
- [x] **Verify:** the standard checks pass. `dist/_astro/` contains Fraunces and Figtree latin woff2 files. `grep -r googleapis dist/strandparken` returns nothing. In the browser, DevTools → Network shows the woff2 files served from the site, and "Rendered fonts" for a test heading shows Fraunces. Run the /ferie check (fonts must not appear in the /ferie CSS).
- [x] **Commit:** `feat(strandparken): self-host Fraunces and Figtree`

### Task 4: Tailwind entry and source isolation (U1, Q4)

**Files:** `src/styles/strandparken.css`, plus `src/styles/ferie.css` if Q4 = yes.

- [x] **Step 1:** Add `@import 'tailwindcss' source(none)` and the three `@source` lines (see "How the §3 tokens are mapped").
- [x] **Step 2 (Q4 = yes):** In `ferie.css`, directly after `@import 'tailwindcss';`, add `@source not '../components/strandparken'; @source not '../pages/strandparken'; @source not '../dev/strandparken';`.
- [x] **Verify:** put a sentinel class `sp-sentinel-x` in `StrandparkenApp.tsx` and build. It appears in the Strandparken CSS and not in the /ferie CSS. A `/ferie`-only class such as `bg-cat-mad-tint` does not appear in the Strandparken CSS. Remove the sentinel. Run the /ferie check (CSS byte-identical).
- [x] **Commit:** `feat(strandparken): isolate Tailwind sources per app`

### Task 5: Colour, shape, depth and spacing tokens with Tailwind and shadcn mapping (U1)

**Files:** `src/styles/strandparken.css`, `tests/strandparken-tokens.test.mjs`, `tests/strandparken-contrast.test.mjs`.

- [x] **Step 1: Failing tests.** `strandparken-tokens.test.mjs` reads `strandparken.css` and checks that every token in UI spec §3.1 and §3.3 is declared inside `:root[data-app='strandparken']` with the exact value, and that every shadcn variable listed in the mapping points at a `--sp-*` token. `strandparken-contrast.test.mjs` computes WCAG ratios from those values: text pairs ≥ 4.5 (ink, muted on bg, surface and track; on-primary on primary; primary on primary-tint; danger on danger-tint; white on jonas and camilla; jonas-ink on jonas-tint; camilla-ink on camilla-tint). Non-text boundary `--sp-dash` must be ≥ 3 on surface and on bg (WCAG 1.4.11). The dash case is expected to fail today (Q6).
- [x] **Step 2:** Run `node --test tests/` and confirm the failures.
- [x] **Step 3:** Write the `:root[data-app='strandparken']` block and the `@theme inline` block, including the `initial` resets.
- [x] **Verify:** the tests pass, except the dash case until Q6 is answered (a decision recorded in the test either way). Build and confirm `bg-red-500` produces no rule. In the browser, the page ground is `#F5F1E8` and `getComputedStyle(document.documentElement).getPropertyValue('--primary')` resolves to the green. Run the /ferie check.
- [x] **Commit:** `feat(strandparken): add design tokens and Tailwind mapping`

### Task 6: Typography utilities, base layer and motion (U1)

**Files:** `src/styles/strandparken.css`.

- [x] **Step 1:** Add the `@utility sp-*` typography roles from the table, the scoped base layer (body, focus ring, `input { font-size: 1rem }`), the keyframes used later (sheet-up 220 ms, scrim-fade 220 ms, tick 120 ms) and the reduced-motion block.
- [x] **Step 2:** Temporarily render one sample of each role in `StrandparkenApp.tsx`.
- [x] **Verify:** compare computed styles for each sample with the table. Fraunces headings show `font-variation-settings` / optical size auto. With browser text size at 130 % (Chrome → Settings → Font size), the samples scale. With DevTools "Emulate prefers-reduced-motion: reduce", the keyframes resolve to about 0 ms. Remove the samples. Run the standard checks and the /ferie check.
- [x] **Commit:** `feat(strandparken): add typography roles and motion base`

### Task 7: Token guard (U1)

**Files:** `tests/strandparken-token-guard.test.mjs`.

- [x] **Step 1:** The test walks `src/components/strandparken/` and `src/dev/strandparken/`. It fails on `#[0-9a-f]{3,8}\b`, `rgba?\(`, `hsl\(`, any arbitrary Tailwind value carrying a unit or colour (`-\[[^\]]*(px|rem|#|rgb)`), `font-family`, `fontFamily`, and the literal names `Fraunces`, `Figtree`, `Georgia`. An allowlist comment is not supported, on purpose.
- [x] **Verify:** add a scratch file with `bg-[#fff]` and confirm the test fails. Delete it and confirm the test passes.
- [x] **Commit:** `test(strandparken): guard against raw design values`

### Task 8: `cn`, Icon and Button (U2)

**Files:** `lib/utils.ts`, `ui/icon.tsx`, `ui/button.tsx`.

- [x] **Step 1:** `Icon` wraps a lucide component with `size` 22, `strokeWidth` 1.8, `aria-hidden`, and `currentColor`.
- [x] **Step 2:** `Button` uses cva with variants `primary` (fill, `min-h` 52 px; `inCard` → 46 px), `outline` (1.5 px primary border and text, transparent), `quiet` (primary text, 600, no fill, still a 44 px target), and `icon` (44 px circle, `size="lg"` 48 px; tone `ground` = white surface, tone `add` = primary fill; `aria-label` required by the type). Pressed: primary darkens through `color-mix(in oklab, var(--sp-primary) 96%, black)` defined as a token `--sp-primary-pressed` in CSS; outline, quiet and icon use a `--sp-track` wash. Focus uses the base ring. Disabled: `opacity-45 pointer-events-none`. `asChild` uses Radix `Slot`, so links can share the look.
- [x] **Verify:** standard checks and token guard. In the browser: Tab shows the 2 px ring with 2 px offset on every variant. A held pointer shows the pressed state. Disabled cannot be focused or clicked. Measured sizes are 52/46 and 44/48. Icon-only buttons fail `astro check` when `aria-label` is missing.
- [x] **Commit:** `feat(strandparken): add Button and Icon primitives`

### Task 9: Card, Badge, Avatar (U2)

**Files:** `ui/card.tsx`, `ui/badge.tsx`, `ui/avatar.tsx`.

- [x] **Step 1:** `Card`: surface, `rounded-sp-card`, card padding, no border or shadow. `CardRow` adds a top border in `--sp-line-soft` for every row except the first.
- [x] **Step 2:** `Badge`: pill, `sp-caption` 600, tones `positive` (primary-tint and primary), `danger` (danger-tint and danger), `neutral` (track), `person` (person colour, white; `Fælles` uses primary).
- [x] **Step 3:** `Avatar` (Radix Avatar): `person: 'jonas' | 'camilla'`, `size: 44 | 34 | 30`, image `/ferie/avatars/<person>.jpg`, fallback is the white initial on the person colour. Alt text is the name. When the avatar is a button, the wrapper sets `aria-label`.
- [x] **Verify:** standard checks and token guard. Block `/ferie/avatars/*` in DevTools and confirm the initial fallback appears with no broken-image icon.
- [x] **Commit:** `feat(strandparken): add Card, Badge and Avatar`

### Task 10: Chip and SegmentedControl (U2)

**Files:** `ui/chip.tsx`, `ui/segmented-control.tsx`.

- [x] **Step 1:** `Chip`: `<button aria-pressed>`, pill, `min-h` 44, 16 px side padding, 14 px 600. Unselected is surface and ink; selected is primary and white.
- [x] **Step 2:** `SegmentedControl` on Radix Tabs (`Tabs.List` and `Tabs.Trigger`, giving `role=tablist` and arrow-key navigation). Track pill on `--sp-track` with 4 px padding, segments at least 44 px. Active is surface, `shadow-sp-seg` and ink; inactive is muted. It takes `aria-label` and works with 2 or 3 segments (`Alle | Aftensmadsidéer`, `Ingredienser | Fremgangsmåde | Næring`, `Én butik | Maks. 2 | Pr. vare`).
- [x] **Verify:** standard checks and token guard. Keyboard: arrow keys move between segments and Tab leaves the list. Inactive muted text on the track passes the contrast test (4.91:1, already covered in Task 5).
- [x] **Commit:** `feat(strandparken): add Chip and SegmentedControl`

### Task 11: Checkbox, round and square (U2)

**Files:** `ui/checkbox.tsx`.

- [x] **Step 1:** Radix Checkbox. The root is the 44 px target and the indicator is 26 px. `shape="round"` is a circle; `shape="square"` has a 9 px radius (token `--sp-r-check: 9px` added to CSS). Unchecked: surface with a 1.5 px `--sp-dash` border. Checked: primary fill, white `Check` icon at 16 px and stroke 2.6 (from the reference), filling in over 120 ms. It needs a label through `aria-label` or `aria-labelledby`.
- [x] **Verify:** standard checks and token guard. Space toggles it. Focus shows the ring around the 44 px target. With reduced motion the tick is instant. Tasks and habits are told apart by shape alone.
- [x] **Commit:** `feat(strandparken): add round and square Checkbox`

### Task 12: Stepper and Field (U2)

**Files:** `lib/stepper.ts`, `tests/strandparken-stepper.test.ts`, `ui/stepper.tsx`, `ui/field.tsx`.

- [x] **Step 1: Failing test.** `step(value, delta, {min: 1, max: 8})` clamps the result. `canDecrement` and `canIncrement` report the limits. The limits 1 and 8 come from the reference.
- [x] **Step 2:** `Stepper`: primary pill with 3 px padding, 44 px round `−` and `+` buttons (`aria-label` `Færre personer` / `Flere personer`, disabled at the limits), and the number between them in 17 px 700 white with `aria-live="polite"`. The label (`2 personer`, `1 person`) sits to its left and comes from a pure `personsLabel(n)`.
- [x] **Step 3:** `Field`: `<label>` with a visually hidden label text, a surface pill input (50 px), `sp-input`, and a placeholder. Optional `action` renders a 50 px primary round icon `Button` beside it (`Tilføj vare` / `aria-label="Tilføj varen"`).
- [x] **Verify:** `node --test tests/` passes. Standard checks and token guard. A screen reader announces the new count. The input does not zoom on iOS (16 px).
- [x] **Commit:** `feat(strandparken): add Stepper and Field`

### Task 13: Sheet (U2, Q7)

**Files:** `ui/sheet.tsx`.

- [x] **Step 1 (default for Q7: Radix Dialog):** `Sheet`, `SheetContent` and `SheetHeader`. Content is fixed to the bottom on `--sp-bg` with `rounded-t-sp-sheet`, padding 22/20/26 plus the bottom safe area, and `max-h-[85dvh]` scrolling inside. The `85dvh` arbitrary value is allowed: it is a layout rule, not a design value, and the guard regex permits `dvh`. The scrim is `--sp-scrim` and fades over 220 ms. The sheet slides up over 220 ms. The header shows the title in `sp-title-card`, an optional small eyebrow line (the day in "Hvad skal I have?"), and a 44 px surface close button `aria-label="Luk"`. Focus trap, Escape and focus return come from Radix.
- [x] **Verify:** standard checks and token guard. Open from a button, Tab cycles inside, Escape closes, and focus returns to the opener. A tall sheet stops at 85 % height. Reduced motion makes it instant. The sheet is styled even though it is portalled (this confirms the `<html>` scope).
- [x] **Commit:** `feat(strandparken): add bottom Sheet`

### Task 14: Toast with undo (U2)

**Files:** `ui/toast.tsx`.

- [x] **Step 1:** `<Toaster>` wraps `sonner` with `position="bottom-center"`, `visibleToasts={1}`, `duration={4000}`, an `offset` equal to bar height plus safe area plus 12 px (from tokens via CSS variable), and `toastOptions.unstyled` with token classes (ink pill, white text, `sp-small`). `notify(message, { onUndo? })` adds a `Fortryd` action button (white, 600, 44 px target) when `onUndo` is given. Each new toast dismisses the previous one.
- [x] **Verify:** standard checks and token guard. Two quick notifications show one toast. `Fortryd` calls the callback and dismisses. The toast sits above the bar on a phone-sized viewport. The toast region is announced politely (sonner's `aria-live`).
- [x] **Commit:** `feat(strandparken): add toast with Fortryd`

### Task 15: DishImage (U2)

**Files:** `ui/dish-image.tsx`.

- [x] **Step 1:** Props are `src?`, `name`, `shape: 'round' | 'cover'`, and `size: 52 | 56 | 64` (round only). `cover` fills its box with `object-cover object-center`. When there is no `src` or the image fails (`onError`), it shows a `--sp-track` fill with the first letter of `name` in Fraunces and primary, `aria-hidden`, because the dish name is always shown next to it. `DishSlot` (empty) is a dashed `--sp-dash` circle (1.5 px) with a `Plus` icon. Images get `loading="lazy"`, `decoding="async"`, and `alt=""` when decorative.
- [x] **Verify:** standard checks and token guard. A broken URL shows the letter and never a broken-image icon. Round sizes measure 52, 56 and 64.
- [x] **Commit:** `feat(strandparken): add DishImage`

### Task 16: Dev-only UI gallery (U3)

**Files:** `astro.config.mjs`, `src/dev/strandparken/gallery.astro`, `src/dev/strandparken/Gallery.tsx`.

- [ ] **Step 1:** In `astro.config.mjs`, add an inline integration: on `astro:config:setup`, if `command === 'dev'`, call `injectRoute({ pattern: '/strandparken/galleri', entrypoint: './src/dev/strandparken/gallery.astro' })`. The file lives outside `src/pages`, so a production build never sees it.
- [ ] **Step 2:** The gallery page uses the same `<html data-app="strandparken">` head as the route, plus `noindex`. `Gallery.tsx` shows, on the real ground colour, one section per primitive: every variant and every static state (default, selected or checked, disabled, photo or fallback, empty slot, 1 and 8 persons), plus buttons that open a sheet and fire both toast types. Focus and pressed states are shown by interaction; the section says "Tab / hold for at se fokus og tryk".
- [ ] **Verify:** `pnpm exec astro dev`, then `/strandparken/galleri` renders every section with no console errors. After `astro build`: `test ! -e dist/strandparken/galleri` and `grep -rl "Gallery\|galleri" dist/` return nothing. Token guard covers `src/dev/strandparken/`.
- [ ] **Commit:** `feat(strandparken): add dev-only UI gallery`

### Task 17: Hash routing (U4)

**Files:** `lib/routes.ts`, `lib/use-route.ts`, `tests/strandparken-routes.test.ts`.

- [ ] **Step 1: Failing test.** The views are `['hjem', 'madplan', 'indkob', 'sundhed', 'opskrifter']` (slug `indkob`, Q14). `parseHash('')`, `parseHash('#')` and `parseHash('#ukendt')` return `hjem`. `parseHash('#madplan')` returns `madplan`. `hrefFor(view)` returns `#<view>`. Labels map to `Hjem · Madplan · Indkøb · Sundhed · Opskrifter`. A query string (`?code=` from future PKCE) is ignored.
- [ ] **Step 2:** `useRoute()` reads the hash on mount and on `hashchange`, scrolls to the top on change, and replaces an unknown hash with `#hjem` through `history.replaceState`.
- [ ] **Verify:** `node --test tests/` passes. Standard checks.
- [ ] **Commit:** `feat(strandparken): add hash routing`

### Task 18: Bottom bar (U4)

**Files:** `shell/BottomBar.tsx`.

- [ ] **Step 1:** `<nav aria-label="Hovedmenu">` is fixed to the bottom with the full-width `--sp-bg` ground and a 1 px `--sp-line` top border, no shadow and no radius. Its height is `--sp-bar-h` plus `env(safe-area-inset-bottom)`. Inside, the five equal columns are constrained to the centred column width (Q9). Each item is an `<a href>` filling its cell: an anchor, because each item changes the URL, and the spec allows `<a>` (§9). The icon (22 px; Home, CalendarDays, ShoppingBasket, Heart, BookOpen) sits above the `sp-nav` label with a 4 px gap. Inactive is muted. The active item is primary, has `aria-current="page"` and a 2 px primary indicator along its top edge (an inset box-shadow, as in the reference). Nothing else differs between items.
- [ ] **Verify:** standard checks and token guard. At 360, 390 and 768 px the five cells are equal width (measure in DevTools). Only colour and the indicator change on the active item. Keyboard Tab reaches all five. A screen reader announces "nuværende side".
- [ ] **Commit:** `feat(strandparken): add bottom bar`

### Task 19: App shell (U4, Q8)

**Files:** `shell/AppShell.tsx`, `shell/views.tsx`, `lib/fixtures.ts`, `StrandparkenApp.tsx`.

- [ ] **Step 1:** `fixtures.ts` exports a typed `signedInPerson` (default `jonas`, Q8). No sample recipes or other data yet (U6).
- [ ] **Step 2:** `AppShell`: a single scrolling column. Fluid from 360 px; from 560 px it is centred at `--sp-column`. Padding is top `--sp-page-top` plus `env(safe-area-inset-top)`, sides `--sp-page-x`, and bottom `--sp-page-bottom` plus bar height plus the bottom safe area, so content never sits under the bar. It renders the view for the current route, the `BottomBar`, and the `<Toaster>`.
- [ ] **Step 3:** `views.tsx`: each view has an `<h1 class="sp-title-page">` with its Danish title and a placeholder empty state: one sentence and no fake data. Hjem shows the header row (date line in `sp-small` muted, formatted in `Europe/Copenhagen` and Danish, e.g. "Onsdag 11. november"; greeting "Godaften, Jonas" chosen by the time of day — the exact greeting set needs your OK; the 44 px avatar button `aria-label="Indstillinger"`). The avatar opens a `Sheet` titled `Indstillinger` with an empty-state sentence (Q8). On route change, focus moves to the view's `<h1>` (`tabIndex=-1`).
- [ ] **Verify:** standard checks and token guard. A refresh on `#sundhed` stays on Sundhed. Back and forward step through views. At 360, 390, 768 and 1280 px the column is centred from 560 px and nothing scrolls horizontally. In iOS Safari (or DevTools with safe-area emulation) the bar clears the home indicator. At 130 % text size nothing overlaps. The console is clean.
- [ ] **Commit:** `feat(strandparken): add app shell and five views`

### Task 20: PWA manifest and icons (U4, Q10, Q15)

**Files:** `public/strandparken/manifest.webmanifest`, icons, `src/pages/strandparken/index.astro`.

- [ ] **Step 1:** Manifest: `name` and `short_name` "Strandparken", `start_url` and `scope` `/strandparken/`, `display: standalone`, `background_color` and `theme_color` `#F5F1E8`, `lang: da`, and 192/512 icons (plus a 512 `maskable`).
- [ ] **Step 2:** Icons per Q10. Rasterize the SVG to 192, 512, 180 (`apple-touch-icon`) and 32 with a one-off command that is not committed (for example a scratchpad script using the `sharp` that Astro already installs). Check that each PNG is small (≤ 20 kB).
- [ ] **Step 3:** Head links: `icon` (svg and png 32), `apple-touch-icon`, `manifest`, and `apple-mobile-web-app-title` "Strandparken".
- [ ] **Verify:** standard checks. DevTools → Application → Manifest shows no errors and the icons render. Chrome offers "Install app". On iOS "Føj til hjemmeskærm" shows the name and icon. The installed app opens on `#hjem` and keeps the view on reopen when the URL has a hash. No service worker is registered (Q15).
- [ ] **Commit:** `feat(strandparken): add PWA manifest and icons`

### Task 21: Final verification and documentation

**Files:** `README.md`, this plan.

- [ ] **Step 1:** README: add a `/strandparken/` paragraph (unlisted, where code and styles live, `pnpm exec astro dev` then `/strandparken/galleri` for the gallery, and that tokens live only in `strandparken.css`).
- [ ] **Step 2:** Run the standard checks and the full /ferie check (all baseline screenshots).
- [ ] **Step 3:** Walk the UI spec §11 items that apply to U1–U4: no raw values (guard test), bottom bar equal items, checkboxes, stepper and segmented control identical in the gallery, letter placeholder, 44 px targets with visible focus, reduced motion, /ferie unchanged, Danish copy. Record pass/fail per item.
- [ ] **Step 4:** Record commands, outputs and manual checks under `## Verification`, then stop and show the gallery and the shell (UI spec §12.2).
- [ ] **Commit:** `docs(strandparken): document UI foundation`

---

## Open questions

Each question names its default. The plan above assumes the default.

1. **Slice 0.1 is not in U1–U4, but U1 needs the route.** Should this plan include the minimal 0.1 scaffold (route, noindex, sitemap filter, CI assertion, AGENTS.md exception) as Task 2? *Default: yes.* Auth (0.2) stays out, so the shell renders without sign-in.
2. **Branch and deploy.** AGENTS.md authorises pushing to `main`, which deploys. You are on `feature/strandparken`. Pushing to `main` before 0.2 would publish an unauthenticated (fixture-only) shell. *Default: commit on `feature/strandparken`, push the branch and open no PR to `main` until you say so.*
3. **Public repository (main spec C6).** The repo is **public**. The two specs and the reference are untracked. Should this plan file be committed, and the specs too? *Default: commit the plan (it contains no health details), leave the specs untracked.*
4. **Touching `ferie.css` for Tailwind isolation.** Tailwind scans the whole repo, so without a change `/ferie`'s CSS would gain rules for Strandparken class names. It would look the same but its bytes would differ. Adding three `@source not` lines to `ferie.css` keeps its CSS byte-identical. May I make that one-line change to a `/ferie` file? *Default: yes.*
5. **Person colours are swapped between the two apps.** In `/ferie`, Camilla (person `a`) is blue `#2f66ad` and Jonas (`b`) is pink `#b2457b`. The UI spec makes Jonas blue `#2F6690` and Camilla pink `#96486A`. Both of you will use both apps. Keep the UI spec values, or swap Strandparken to match `/ferie`? *Default: UI spec values (D26 says its own identity).*
6. **`--sp-dash` fails non-text contrast.** `#A8A291` is about 2.55:1 on white and lower on `#F5F1E8`, below WCAG 1.4.11's 3:1 for an unchecked checkbox border (UI spec §9 says the token pairs pass). Options: darken `--sp-dash` to about `#8C8676` (≥ 3:1 on both; the exact value to be computed in Task 5), or keep it and treat the dash only as decoration (the checkbox is then identified by its label). *Default: none; please choose.*
7. **Sheet primitive.** Radix Dialog gives the exact 220 ms slide and instant reduced motion, but no swipe-to-dismiss. `vaul` Drawer, which `/ferie` uses, gives swipe-to-close with its own fixed timing (~500 ms) that is awkward to override. *Default: Radix Dialog.*
8. **Header avatar.** The reference shows it only on Hjem; main spec §5.1 calls it "the header". (a) Only on Hjem or on every tab? (b) Before sign-in exists, whose avatar is shown? (c) What does it open before the settings content exists? *Default: Hjem only; fixture person Jonas; an empty `Indstillinger` sheet.*
9. **Bottom bar on wide screens.** "The bar stays at the bottom at every width." Should the bar ground span the full width with the five items constrained to the 520 px column, or should the whole bar be 520 px wide? *Default: full-width ground, centred items.*
10. **App icon.** Neither spec defines one. *Default: a serif "S" in Fraunces, outlined to a path, white on `--sp-primary`, rounded square with a maskable safe zone.* Or do you have artwork?
11. **Test tooling.** Main spec §9 names Vitest and Playwright with axe. The repo has only `node --test`, and CI runs no tests. For U1–U4: keep `node --test`, add a `node --test tests/` step to `pages.yml`, and defer Playwright and axe to U9? *Default: yes to all three.*
12. **Commit messages.** UI spec §12.2 suggests `U2: primitives`. The repo convention is `<type>(scope): <description>`. *Default: repo convention, one commit per task, scope `strandparken`; the U-step is named in the body.*
13. **AGENTS.md says "Astro 5"**, but the repo runs Astro 7.4.11. Fix it while updating AGENTS.md in Task 2? *Default: yes.*
14. **Hash slug for Indkøb.** `#indkob` (ASCII, as in the reference's internal key) or `#indkøb`? *Default: `#indkob`.*
15. **Service worker.** Main spec slice 0.4 includes "service worker for the shell", but UI spec U4 lists only manifest and icons. *Default: no service worker in this plan; it goes with offline work (1.8), where caching rules are designed.*
16. **Copy not in either spec.** The page meta description, the Hjem greeting by time of day (Godmorgen / Goddag / Godaften?), the placeholder empty-state sentences for the five views, and the `<noscript>` text. *Default: I draft them in Danish and list them for your review in Task 21.*

## Verification

### Execution decisions (2026-11-12)

- Open questions: defaults taken except **Q4 = no** (your execution rule says not to touch `/ferie`, so `ferie.css` is not edited; `/ferie` is proven unchanged by CSS hash, selector diff, HTML diff and screenshots) and **Q6**, which is asked at Task 5.
- `node --test tests/` fails on Node 24 (directory treated as a module); the glob `node --test tests/*.test.*` is used instead.
- Commit subjects name the U-step (e.g. `feat(strandparken): U1 self-host Fraunces and Figtree`), repo convention otherwise.
- Baseline `/ferie` tab slugs are `feriedage`, `rejsekassen`, `rejseplan`, `forslag` (the plan's `kassen`/`plan` do not exist).

### Task 1 baseline
- Scratchpad `baseline/dist/` (copy of `dist/`), `baseline/css-sha.txt`: `/_astro/index.B2mBCXbe.css` sha256 `b08ffff7...098347b`.
- 16 screenshots in `baseline/shots/` (4 tabs x 390x844 and 1280x800 x light and dark), headless Chrome against a build with `PUBLIC_SUPABASE_URL= PUBLIC_SUPABASE_KEY=` so the sign-in gate is absent.

### Task 2
- CI step failed before the page existed, passes after. `astro check` 0 errors, `node --test` 4/4, build 5 pages.
- `grep -c noindex dist/strandparken/index.html` = 1; no `strandparken` in sitemap files; 0 in `dist/index.html`.
- /ferie: CSS byte-identical, `index.html` identical after normalising asset names.


### Task 3
- Added `@fontsource-variable/fraunces` and `@fontsource-variable/figtree` 5.3.0 (exact versions; the only new dependencies). Family names confirmed: `'Fraunces Variable'`, `'Figtree Variable'`.
- `dist/_astro/` holds Fraunces (latin, latin-ext, vietnamese, opsz) and Figtree (latin, latin-ext) woff2; `grep googleapis dist/strandparken` = 0. /ferie CSS byte-identical, HTML identical.
- In-browser "Rendered fonts" check is done in Task 6, when text first uses the faces.

### Task 4 (Q4 = no)
- `strandparken.css` imports `tailwindcss` with `source(none)` plus three `@source` lines. `ferie.css` is not touched.
- A sentinel arbitrary-width utility in `StrandparkenApp.tsx`: present in the Strandparken CSS, and also in the /ferie CSS (the leak Q4 = yes would have closed); `bg-cat-mad-tint` (/ferie-only) is absent from the Strandparken CSS. Sentinel removed; /ferie CSS is byte-identical again.
- Consequence to watch: Strandparken utilities that are also valid in /ferie's theme can add unused rules to the /ferie CSS. Each later task reports the selector diff; the rendered /ferie is unaffected. Tailwind also scans `docs/`, so do not write real utility class names into plan or spec text (one such mention leaked into the /ferie CSS and was reworded).

### Task 5 (Q6 decided: darken `--sp-dash`)
- Q6 answer: `--sp-dash` is `#8C8676` (3.63:1 on white, 3.22:1 on the ground) instead of the spec's `#A8A291`. This is the one deliberate deviation from UI spec §3.1; all dashed outlines and the unchecked-box border use it.
- Tests written first (6 failing), then passing: `tests/strandparken-tokens.test.mjs` (all §3.1/§3.3 values, shadcn mapping, resets, utilities) and `tests/strandparken-contrast.test.mjs` (16 text pairs at least 4.5:1, dash at least 3:1 on surface and ground). Shared parser in `tests/helpers/strandparken-css.mjs`. Full suite 27/27.
- Browser probe (temporary, removed): `bg-sp-surface` is `rgb(255,255,255)`, `rounded-sp-row` 20px, hero shadow and `Fraunces Variable, Georgia, serif` resolve, the shadcn `--primary` resolves to `#1f4d3a`; `bg-red-500` and `rounded-lg` generate no CSS (computed transparent and 0px).
- /ferie CSS byte-identical, HTML identical.

### Task 6
- Added the 15 `sp-*` typography utilities, scoped base layer (ground, ink, antialiasing, 2px focus ring with 2px offset, 16px inputs), keyframes inside `@theme inline` (`animate-sp-sheet-in/out`, `scrim-in/out`, `tick`; closing variants added so Radix can animate out) and the reduced-motion block.
- Temporary probe in headless Chrome (removed): all 15 roles match the table exactly (e.g. `title-page` Fraunces 500, 32px, 35.2px, -0.32px; `input` 16px); page ground `rgb(245,241,232)`; `document.fonts` reports both `Fraunces Variable` and `Figtree Variable` latin woff2 loaded from the site (closes the Task 3 browser check).
- Reduced motion (`--force-prefers-reduced-motion`): sheet animation 0.22s becomes 1e-05s. Text size: with a 20px root (125%) `title-page` is 40px and `body` 18.75px, so sizes follow the user's text size.
- Probe lesson: Tailwind only sees literal class names, so the sample used a literal map.
- /ferie: CSS byte-identical, HTML identical, **all 16 screenshots byte-identical** to the Task 1 baseline.

### Task 7
- `tests/strandparken-token-guard.test.mjs` walks `src/components/strandparken/` and `src/dev/strandparken/` (when present) and fails on hex colours, `rgb()`/`hsl()`, arbitrary values with a unit or colour, `font-family`/`fontFamily` and the font names. No allowlist. A rules self-test proves each rule fires and that `dvh`, token classes and `#hjem` hrefs pass.
- Scratch file with a raw arbitrary-colour class: guard failed naming file, line and both rules; after deleting it, 2/2 pass.
- Leak found and fixed: sample class strings in the guard test leaked into the /ferie CSS (Tailwind scans `tests/`); the samples are now joined from fragments. /ferie CSS byte-identical again. Keep literal utility class names out of tests and docs.

### Task 8
- Files: `lib/utils.ts` (local `cn`), `ui/icon.tsx` (22px, stroke 1.8, `aria-hidden`, `currentColor`), `ui/button.tsx` (cva; variants `primary`, `outline`, `quiet`, `icon`; `inCard`; icon `tone` ground/add and `size` md/lg; `asChild` through Radix `Slot`; default `type="button"`).
- Supporting CSS: named sizes exposed to Tailwind (`--spacing-sp-target` etc., `--container-sp-column`), `--sp-primary-pressed` token (with a test), and a `sp-border-strong` utility for the 1.5px outline. Component sizes use tokens or Tailwind's spacing scale only, so the guard stays strict.
- Measured in headless Chrome (CDP): primary 52px high, in-card primary 46, outline 44, quiet 44, icon 44, large icon 48, link-as-button 44. Primary 16px/600, in-card and outline and quiet 14px/600.
- Keyboard: Tab shows a 2px solid primary outline with 2px offset on every variant; the disabled button is skipped by Tab, shows 0.45 opacity and ignores clicks (0 click events).
- Pressed (`:active` forced): primary and large add icon use `--sp-primary-pressed`; outline, quiet and ground icon use `--sp-track` (`rgb(233,227,212)`).
- Type check: an icon `Button` without `aria-label` fails `astro check` (`Property 'aria-label' is missing`).
- Decisions: no colour transitions (spec §8: motion only answers an action; a transition also made the focus ring fade in). The 1.5px border is 1.5px at 2x DPR (Chrome snaps it to whole device pixels at 1x and 3x); that is browser behaviour, not a bug.
- /ferie: HTML identical and 16/16 screenshots byte-identical, but the CSS is **no longer byte-identical** (the Q4 = no consequence): it gained 5 rules (`size-12`, `min-h-11.5` and three disabled/aria-disabled variants), none of whose class names appear in /ferie sources, so they are dead rules. The check script now lists added selectors and tests them against /ferie sources. Closing the leak needs the three-line `@source not` change in `ferie.css` (Q4 = yes); flagged for your decision.
- §11 for this task: tokens only (guard passes), 44px targets, visible focus, reduced motion (no transitions), Danish labels: pass.

### Task 9
- Files: `lib/people.ts` (person names, initials, photo paths and literal colour classes, shared by Badge and Avatar), `ui/card.tsx` (`Card`, `CardRow`), `ui/badge.tsx` (tones neutral, positive, danger, person incl. `Fælles`), `ui/avatar.tsx` (`Avatar` on Radix Avatar; `AvatarButton` for the 44px header button). New role `sp-caption-strong` (caption at 600) so badges do not depend on class order.
- Measured: card white, radius 24px, padding 18px, no shadow, no border; rows 2 and 3 have a 1px `--sp-line-soft` top rule, row 1 none. Badges 24px high, 12.5px/600, colours match the token pairs. Avatars 44, 34, 30px with the photos from `/ferie/avatars/`; the avatar button is 44x44 with `aria-label="Indstillinger"` and a decorative avatar inside.
- Photos blocked (`Network.setBlockedURLs` for `*/ferie/avatars/*`): all four avatars show the white initial on the person colour; no `<img>` is rendered, so no broken-image icon. Console clean.
- /ferie: HTML identical; CSS differs only by unused rules (listed by the check script). §11 for this task: tokens only, person colour never alone (name or initial always present), letter fallback: pass.

### Task 10
- Files: `ui/chip.tsx` (`<button aria-pressed>`), `ui/segmented-control.tsx` (`SegmentedControl` on Radix Tabs with `options`, required `aria-label`; `SegmentedPanel` per option so `aria-controls` points at a real panel).
- Measured: chips 44px high, 14px/600, selected primary with white text, unselected white with ink; track `--sp-track` with 4px padding and pill radius, segments 44px high (two segments 169px each at 390px; three segments 106/122/106), active white with the segment shadow and ink text, inactive muted. Muted on track is 4.91:1 (contrast test).
- Keyboard (CDP): Tab lands on the active segment; ArrowRight/ArrowLeft move focus and selection and swap the panel; Tab leaves the list (to the panel); Space toggles a chip and flips `aria-pressed`. Focus ring 2px solid primary, 2px offset. `aria-controls` of every tab resolves to a panel. Console clean.
- /ferie: HTML identical; CSS differs only by unused rules. §11: segmented control and chips are single components used everywhere; 44px targets; visible focus: pass.

### Task 11
- Files: `ui/checkbox.tsx` (Radix Checkbox; `shape` round or square; the type requires `aria-label` or `aria-labelledby`). New token `--sp-r-check: 9px` with `--radius-sp-check` (test-first: the two token tests failed, then passed).
- Measured at 2x DPR: root 44x44, visible box 26px; round is a full circle, square has a 9px radius; unchecked is white with a 1.5px `#8C8676` border, checked is primary with a white check icon at 16px, stroke 2.6. Tasks and habits differ by shape alone.
- Keyboard: Tab focuses the 44px target with a 2px primary ring at 2px offset; Space toggles on and off; click toggles; `aria-labelledby` resolves to its label; a disabled checkbox is dimmed to 0.45 and not clickable. Tick animation is 0.12s, and 1e-05s under `prefers-reduced-motion: reduce`. Console clean.
- /ferie: HTML identical; CSS differs only by unused rules. §11: checkboxes consistent, 44px targets, focus, reduced motion: pass.

### Task 12
- Test first: `tests/strandparken-stepper.test.ts` failed (module missing), then passed 4/4 with `lib/stepper.ts` (`step`, `canDecrement`, `canIncrement`, `personsLabel`, limits 1 to 8 from the reference). Node runs the `.ts` test natively.
- Files: `ui/stepper.tsx`, `ui/field.tsx`; Button gained icon size `field` (50px); new role `sp-stepper-value` (17px/700).
- Stepper measured: pill 124x50 on primary with 3px padding, 44x44 minus and plus with Danish labels, number 17px/700 white with a 22px minimum width, label `2 personer` / `1 person` on the left. Minus at 1 and plus at 8 are `aria-disabled` and dimmed to 0.45 but keep focus; values never leave 1 to 8.
- Two deliberate deviations: (1) the live region (`aria-live="polite"`) is the label ("3 personer") rather than the bare number, which is what a screen reader should say; the number is `aria-hidden`. (2) The stepper buttons use a white 2px focus ring (offset 0), because the default primary ring is invisible on the primary pill.
- Field measured: input 50px high, white, 999px radius, 16px text (no iOS zoom), a real `<label>` with visually hidden text (`label.control` is the input), action button 50x50 primary with `aria-label="Tilføj varen"`; typing and clicking the action adds the item. Console clean. I cannot run a screen reader here; the announcement is verified by the live region and text change in the DOM.
- CI: added a `Run tests` step (`node --test tests/*.test.*`) to `pages.yml` (Q11 default). The plan's `node --test tests/` does not work on Node 24.
- /ferie: HTML identical; CSS differs only by unused rules. §11: stepper identical everywhere (one component), 44px targets, focus: pass.

### Task 13 (Q7 default: Radix Dialog)
- Files: `ui/sheet.tsx` (`Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`). Safe-area padding lives in the stylesheet as `pb-sp-sheet` (26px plus `env(safe-area-inset-bottom)`), so there is no arbitrary pixel value in the component; `max-h-[85dvh]` is the one allowed layout value.
- Measured on a 390x844 screen with a 30-row sheet: height 717px = 85%, bottom edge at 844, ground `rgb(245,241,232)`, top corners 30px, padding 22/20/26, scrolls inside, scrim `rgba(27,38,32,0.45)`. Title Fraunces 24px with an optional muted line, 44x44 white close button labelled `Luk`. Rendered through a portal into `<body>` and still fully styled, which confirms the `<html>` token scope.
- Behaviour: Tab and Shift+Tab stayed inside the dialog for 40 presses; the page behind is `aria-hidden`; Escape, the close button and a scrim click all close it; focus returns to the opener each time; the first focus is the close button. Slide is `sp-sheet-in` 0.22s, and 1e-05s for both sheet and scrim under reduced motion. Console clean.
- /ferie: HTML identical; CSS differs only by unused rules. §11: sheets trap focus, close on Escape, return focus (UI spec §9); never above about 85%: pass.

### Task 14
- Files: `ui/toast.tsx` (`Toaster` wrapping Sonner; `notify(message, { onUndo? })`). Two new tokens with a test written first: `--sp-toast-offset` (bar height + safe area + 12px) and `--sp-toast-width`, so the component holds no raw pixel values.
- Sonner is unstyled and restyled with token classes: ink pill, white text, `sp-small`; position bottom-centre, `visibleToasts={1}`, 4000ms, Danish region label `Beskeder`. `notify` dismisses the current toast first.
- Measured at 390px with a 76px mock bar: two notifications 100ms apart leave exactly one visible; the toast is 12px above the bar, `rgb(27,38,32)` with white text, 999px radius, 13.5px; the live region is `aria-live="polite"`. It is gone after about 5s. `Fortryd` is 79x44, 14px/600, calls the callback once and dismisses the toast; a plain `notify` has no action button. Console clean.
- /ferie: HTML identical; CSS differs only by unused rules. §11: undo for destructive actions, one toast at a time, above the bar: pass.

### Task 15
- Files: `ui/dish-image.tsx` (`DishImage` with `shape` round or cover, round sizes 52, 56, 64 enforced by the type; `DishSlot` for an empty day). The fallback is a `--sp-track` tile with the first letter (Danish upper-casing) in Fraunces, primary colour, `aria-hidden` because the name is always shown next to it. Photos are `loading="lazy"`, `decoding="async"`, `alt=""`.
- Measured: round 52/56/64px circles; cover fills its box (192x132 in the probe) with `object-fit: cover` and `50% 50%`; photo-less and failing-URL dishes show the letter (20px round, 40px cover) with no `<img>` rendered, so zero broken images in the document; the slot is a 1.5px dashed `#8C8676` circle with a plus. The only console line is the browser's own 404 for the deliberately broken URL.
- /ferie: HTML identical; CSS differs only by unused rules. §11: a dish without a photo shows the letter placeholder, never a broken image: pass.
