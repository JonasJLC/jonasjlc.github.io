# Strandparken Idé 12: "Jeres dag" på Hjem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a compact "Jeres dag" section to Hjem, directly below the "I aften" card and above "Mangler at handle": one card per member, side by side, showing that person's sleep score, cycle day and activity progress (with a thin bar), the source and sync line, and "Ingen data i nat" when data is missing. Metrics the viewer may not see are left out. Tapping a card opens Sundhed for that person.

**Architecture:** A `JeresDag` component on Hjem uses `useHealth` (idea 10) for both people. For the other person, `sp_health_for` already removes unshared metrics and lists them in `hidden`. The pure function `dayCard(...)` in `lib/health/view.ts` (extended from idea 11) turns a person's today into card rows. Hidden metrics produce no row, and missing ones produce an "Ingen data i nat" row. Each card is a link to `sundhedHref(person)` (idea 11). The cards reuse `Card`, `Avatar` and a small `ProgressBar` built from tokens.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 12. Mockup: image3.png (dashboard, "Jeres dag").

**Depends on:** Idé 6 (new Hjem header and I aften card), Idé 11 (`view.ts`, `sundhedHref`), Idé 10 (data, visibility). Idé 8 adds "Mangler at handle" below; if 8 is not built yet, "Jeres dag" is simply last.

**Supersedes:** main spec D13 ("Oura and training data are not on Hjem") and the line in §5.6 "Oura and training data are not on Hjem" (roadmap Q7).

**Status:** Done, 2026-11-24. Index: [roadmap](2026-11-24-strandparken-ideer-roadmap.md).

**Privacy (roadmap Q9):** shows cycle day on Hjem when shared. Do not commit until Jonas decides.

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Hjem | `shell/views.tsx` `HomeView`: header + `<Tonight />`. After idea 6: header with both avatars, compact I aften card; the "Resten af ugen" strip removed. | `JeresDag` is inserted after the I aften card. |
| Health | Idea 10 `useHealth(person)`; idea 11 `view.ts` (`freshness`, `sourceLine`), `sundhedHref`. | Reused. |
| Primitives | `ui/card.tsx` (`Card`), `ui/avatar.tsx` (`Avatar`, sizes), `ui/icon.tsx`. No progress bar in Strandparken. | Add `ui/progress-bar.tsx` (2-4 px, `bg-sp-track` / `bg-sp-primary`), also usable by ideas 14 and 15. |

---

## Files

**Create**

| File | Purpose |
|---|---|
| `src/components/strandparken/home/JeresDag.tsx` | Section heading and two cards. |
| `src/components/strandparken/home/PersonDayCard.tsx` | One card: avatar + name, metric rows, sync line, link. |
| `src/components/strandparken/ui/progress-bar.tsx` | Thin progress bar with `role="progressbar"`, `aria-valuenow`, and an optional label. |

**Modify**

| File | Change |
|---|---|
| `src/components/strandparken/lib/health/view.ts` | `dayCard(person, today, hidden, sources)`. |
| `tests/strandparken-sundhed.test.ts` | Cases for `dayCard`. |
| `src/components/strandparken/shell/views.tsx` (or the idea-6 Hjem component) | Insert `<JeresDag />` after I aften. |
| Main spec §5.6, D13 | Task 4. |

---

## Data changes

None.

---

## Tasks

### Task 1: Card model (TDD)

- [x] Tests first in `tests/strandparken-sundhed.test.ts`:
  - Camilla with everything shared → rows `[Søvn 82, Cyklus Dag 14, Aktivitet 65 % + bar 0.65]`, sync line "Oura · synk. 19.45".
  - Jonas (no cycle source) → rows `[Søvn 76, Aktivitet 40 % + bar]`, with no Cyklus row.
  - The same Camilla card viewed by Jonas with cycle hidden → no Cyklus row (not a blank row).
  - Sleep `null` → row `Søvn` with text "Ingen data i nat"; activity `null` → "Ingen data i dag" with no bar.
  - The newest day is yesterday → today's values are `null` (freshness from idea 11) and the sync line keeps the real time.
  - No source connected → `{ empty: 'not-connected' }`; every metric hidden → `{ empty: 'not-shared' }`.
  - The bar value is clamped to 0–1 for display; the percentage text is not clamped ("112 %").
- [x] Implement `dayCard` as a pure function returning `{ rows: { metric, label, value: string | null, bar?: number }[], sync: string | null, empty?: ... }`. Order is fixed: Søvn, Cyklus, Aktivitet, Skridt. Skridt is off by default on Hjem (the mockup shows three rows; it stays compact).

### Task 2: Progress bar primitive

- [x] `ui/progress-bar.tsx`: a track `h-1 rounded-sp-pill bg-sp-track` with a fill in `bg-sp-primary`, width by inline `style` percentage, and `role="progressbar"` with `aria-valuemin=0 aria-valuemax=100 aria-valuenow`. The label comes from the row text, so `aria-labelledby` points at it. Token classes only.

### Task 3: Section and cards

- [x] `JeresDag`: `<section aria-labelledby="jeres-dag-title">` with `<h2 className="sp-title-section">Jeres dag</h2>` and a two-column grid (`grid-cols-2 gap-sp-gap-grid`). Camilla is on the left and Jonas on the right, as in the mockup, whoever is signed in.
- [x] `PersonDayCard`: the whole card is an `<a href={sundhedHref(person)}>` with `aria-label` "<Navn>: søvn 82, cyklus dag 14, aktivitet 65 procent. Åbn Sundhed.", built from the same rows. Inside: `Avatar` (small) + name (`sp-body-strong`), rows with a small icon (`Moon`, `CalendarHeart`, `Activity`), label (`sp-small`) and value on the right (`sp-body-strong`), the progress bar under Aktivitet, and the sync line at the bottom (`sp-caption text-sp-muted`).
- [x] Empty cards stay small: "Ikke forbundet" (own card: also "Forbind" text linking to the connect sheet) or "Deler ikke sine tal" for the other person. The section is never hidden entirely, so the dashboard layout does not jump. If **both** cards would be "Ikke forbundet", the section is hidden until someone connects.
- [x] Loading: two skeleton cards of the final height; error: one line "Tallene kunne ikke hentes." with no retry button (Sundhed has one).
- [x] Keep it compact: card padding `--sp-pad-card` reduced variant if needed (UI spec §3.3 tokens only). Check that header + Kalender + I aften + Jeres dag + Mangler at handle fit about one 390×844 screen (roadmap Q7).

### Task 4: Spec, backlog, verify, commit

- [x] Main spec §5.6 list: add "Jeres dag" in its position; reverse D13 for this summary; reference per-metric visibility. UI spec §6 Hjem anatomy.
- [x] Verify (below). Suggested commit: `feat(strandparken): Jeres dag on Hjem`. Do not commit until roadmap Q9 is decided.

---

## Verification

- `node --test tests/`, `pnpm exec astro check`, `pnpm exec astro build`, preview at 360 px and 390 px: the two cards side by side without truncating values; text at 130 % still readable (values may wrap below labels).
- As Jonas with Camilla's cycle sharing off: Camilla's card has no Cyklus row and no gap where it would be.
- Missing night: "Ingen data i nat".
- Tap each card → Sundhed opens on that person (`#sundhed/data/camilla`), and the focus lands on the Sundhed title.
- Screen reader reads one sentence per card; the progress bar has a value.

## Acceptance criteria

- [x] "Jeres dag" sits directly below the "I aften" card and above "Mangler at handle".
- [x] One card per member, side by side, with avatar and name.
- [x] Camilla: sleep score, cycle day, and activity goal as a percentage with a thin progress bar under it.
- [x] Jonas: sleep score, and activity goal as a percentage with a thin progress bar under it.
- [x] A small source and sync line at the bottom of each card, e.g. "Oura · synk. 19.45".
- [x] Visibility settings from Sundhed are respected: hidden metrics are left out for the other member, not shown as blank.
- [x] Missing data shows "Ingen data i nat" instead of a number.
- [x] Tapping a card opens Sundhed for that person.

## Open questions

1. **Steps on Hjem:** left out to keep cards compact (default), or added as a fourth row?
2. **Both members unconnected:** hide the section (default) or show an invitation to connect?
