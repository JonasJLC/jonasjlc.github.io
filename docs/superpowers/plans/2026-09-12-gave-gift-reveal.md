# Gave Gift Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the private Danish interactive gift reveal at `/gave/` as a polished, accessible Astro page.

**Architecture:** The route supplies the Danish document shell, neutral metadata, and a semantic application mount. `gift.ts` holds every editable detail and copy value. A small dependency-free browser script renders one scene at a time and persists a validated versioned state, using pure state/input helpers that have Node tests.

**Tech Stack:** Astro 5, TypeScript, browser DOM APIs, CSS, Node's built-in test runner, pnpm 10.33.2.

**Spec:** `docs/superpowers/specs/2026-09-12-gave-gift-reveal-design.md`

## Global Constraints

- Keep the existing Astro pipeline and `pnpm-lock.yaml`; add no dependency, framework, server, router, or client island.
- Create only the `/gave/` route and do not link it from the portfolio homepage.
- Use Danish copy, `lang="da"`, neutral metadata, and canonical/sharing URL `https://jonasjlc.github.io/gave/`.
- Keep all recipient-facing copy and booking details in `src/content/gift.ts`; unknown optional values are empty and omitted.
- Use one versioned local-storage key; invalid storage resets safely and unavailable storage remains usable in memory.
- Keep inactive scenes out of display, tab order, and the accessibility tree; move focus to each new scene heading.
- Support keyboard use, visible focus, 44px controls, a polite live region, and reduced motion.
- Update this plan's checkboxes and verification notes at each checkpoint; commit and push coherent working changes directly to `main`.

---

### Task 1: Add the content contract and tested pure helpers

**Files:**
- Create: `src/content/gift.ts`
- Create: `src/scripts/gave-logic.mjs`
- Create: `tests/gave-logic.test.mjs`

**Interfaces:**
- Produces: `gift` configuration containing recipient, departure, booking details, copy, packing cards, clues, and accepted answer lists.
- Produces: `normalizeAnswer(value)`, `matchesAnswer(value, accepted)`, `isValidSavedState(value, packingCount)`, and `initialState` from `gave-logic.mjs`.

- [x] **Step 1: Write failing behavior tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesAnswer, normalizeAnswer } from '../src/scripts/gave-logic.mjs';

test('accepts Kerteminde despite casing, spaces, and punctuation', () => {
  assert.equal(normalizeAnswer('  KERTE-minde! '), 'kerteminde');
  assert.equal(matchesAnswer('Kerte Minde', ['kerteminde', 'kerte minde']), true);
});
```

- [x] **Step 2: Run the test and confirm it fails because the module does not exist**

Run: `node --test tests/gave-logic.test.mjs`

- [x] **Step 3: Implement the smallest configuration and helper contract**

```js
export function normalizeAnswer(value) {
  return value.toLocaleLowerCase('da-DK').replace(/[^\p{L}\p{N}]+/gu, '');
}

export function matchesAnswer(value, accepted) {
  return accepted.some((answer) => normalizeAnswer(answer) === normalizeAnswer(value));
}
```

Use a fixed `version: 1` and six allowed scene IDs in the saved-state validator. Give `gift` ten packing cards and explicit empty optional booking values.

- [x] **Step 4: Run focused tests and the Astro type check**

Run: `node --test tests/gave-logic.test.mjs; $env:ASTRO_TELEMETRY_DISABLED = '1'; pnpm exec astro check`

- [x] **Step 5: Commit the tested content foundation**

```powershell
git add src/content/gift.ts src/scripts/gave-logic.mjs tests/gave-logic.test.mjs
git commit -m "feat(gave): add gift content and state helpers"
git push origin main
```

### Task 2: Build the standalone accessible gift route and visual system

**Files:**
- Create: `src/pages/gave/index.astro`
- Create: `src/styles/gave.css`

**Interfaces:**
- Consumes: `gift` from `src/content/gift.ts`.
- Produces: `#gave-app`, `#gave-title`, and `#gave-live` DOM anchors for `gave.ts`; a static no-JavaScript explanation.

- [ ] **Step 1: Add a failing route build check**

```powershell
$env:ASTRO_TELEMETRY_DISABLED = '1'
pnpm exec astro build
if (Test-Path 'dist/gave/index.html') { throw 'The gift route exists before its implementation.' }
```

- [ ] **Step 2: Run the check and confirm it fails for the missing route**

Run: the PowerShell commands from Step 1.

- [ ] **Step 3: Implement the route and stylesheet**

```astro
---
import { gift } from '../../content/gift';
import '../../styles/gave.css';
---
<!doctype html>
<html lang="da">
  <head><!-- neutral title, descriptions, canonical and Open Graph URL --></head>
  <body><main id="gave-app" tabindex="-1"></main></body>
</html>
```

Use a cream/charcoal dossier opening and progressively warmer stone, water, mist, and nature gradients. Include reduced-motion media rules, responsive single-card layouts, focus styles, and no horizontal overflow. Do not reference a remote image; a configured local image must have a CSS gradient fallback.

- [ ] **Step 4: Build and inspect the generated route**

Run: `$env:ASTRO_TELEMETRY_DISABLED = '1'; pnpm build; if (-not (Test-Path 'dist/gave/index.html' -PathType Leaf)) { throw 'Gift route was not generated' }`

- [ ] **Step 5: Commit the route shell and styling**

```powershell
git add src/pages/gave/index.astro src/styles/gave.css
git commit -m "feat(gave): add invitation route and visual design"
git push origin main
```

### Task 3: Implement the scene machine and persistence

**Files:**
- Create: `src/scripts/gave.ts`
- Modify: `src/pages/gave/index.astro`
- Modify: `tests/gave-logic.test.mjs`

**Interfaces:**
- Consumes: `gift`, `initialState`, `isValidSavedState`, `matchesAnswer`, and DOM anchors from Task 2.
- Produces: complete `intro → packing → location → namePuzzle → reveal → details` interaction and `gave-reveal-v1` local storage record.

- [ ] **Step 1: Extend failing pure tests for invalid persisted data and answer variants**

```js
test('rejects a state with an unknown scene', () => {
  assert.equal(isValidSavedState({ version: 1, scene: 'unknown' }, 10), false);
});

test('accepts Danish and English name-puzzle answers', () => {
  assert.equal(matchesAnswer('GREAT', ['stor', 'big', 'great']), true);
  assert.equal(matchesAnswer('north', ['nord', 'north']), true);
});
```

- [ ] **Step 2: Run the test and confirm the new behavior fails**

Run: `node --test tests/gave-logic.test.mjs`

- [ ] **Step 3: Implement the pure validation and browser renderer**

Implement a single `render()` that replaces the active scene content, binds native button/form events, persists safely, and focuses its heading. Render packing feedback until `Næste ting`; show location clues one at a time; give each puzzle hint and answer-reveal paths that complete it. Cancel stored timeout IDs before every scene change and ignore controls while transitioning. A refresh while reveal animation is unfinished restarts it, while a complete reveal restores its final frame.

- [ ] **Step 4: Run focused tests, check, and production build**

Run: `node --test tests/gave-logic.test.mjs; $env:ASTRO_TELEMETRY_DISABLED = '1'; pnpm build`

- [ ] **Step 5: Commit the interactive experience**

```powershell
git add src/scripts/gave.ts src/scripts/gave-logic.mjs src/pages/gave/index.astro tests/gave-logic.test.mjs
git commit -m "feat(gave): implement reveal experience"
git push origin main
```

### Task 4: Complete deployment checks and repository documentation

**Files:**
- Modify: `.github/workflows/pages.yml`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-09-12-gave-gift-reveal.md`

**Interfaces:**
- Produces: a CI assertion for nonempty `dist/gave/index.html` after the existing build, and current guidance for Astro, the gift configuration, optional local assets, and preview path.

- [ ] **Step 1: Add the post-build artifact assertion**

```yaml
- name: Verify gift route
  run: test -s dist/gave/index.html
```

- [ ] **Step 2: Document the editable gift content and route**

Add `src/content/gift.ts`, `public/gave/assets/`, and `/gave/` to the README. Replace obsolete root-HTML and `site-check.yml` instructions in AGENTS.md with the Astro files and `.github/workflows/pages.yml` build assertion.

- [ ] **Step 3: Run full local verification**

Run: `pnpm install --frozen-lockfile; node --test tests/gave-logic.test.mjs; $env:ASTRO_TELEMETRY_DISABLED = '1'; pnpm exec astro check; $env:ASTRO_TELEMETRY_DISABLED = '1'; pnpm exec astro build; if (-not (Test-Path 'dist/gave/index.html' -PathType Leaf) -or (Get-Item 'dist/gave/index.html').Length -eq 0) { throw 'Gift output is missing or empty' }`

Also start `pnpm exec astro preview` and manually verify `/gave/` and `/gave`, narrow and desktop layouts, keyboard focus, reduced motion, packing choices, hints, answer reveal paths, refresh recovery, restart, and browser console output.

- [ ] **Step 4: Record evidence and commit the final checkpoint**

Check every completed task in this plan, record the commands and manual checks under a `## Verification` heading, then run:

```powershell
git add .github/workflows/pages.yml README.md AGENTS.md docs/superpowers/plans/2026-09-12-gave-gift-reveal.md
git commit -m "docs(gave): document reveal experience"
git push origin main
```

## Verification

- Task 1: `node --test tests/gave-logic.test.mjs` passed (3 tests) and `pnpm exec astro check` passed with 0 errors on 2026-09-12.
- Remaining: Tasks 2–4.
