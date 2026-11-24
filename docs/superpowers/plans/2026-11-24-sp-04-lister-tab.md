# Strandparken Idé 4: Ny fane "Lister" med Indkøb — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the Indkøb tab to "Lister" and give it a segmented control at the top: "Indkøb" | "To-do". Indkøb holds the existing shopping list, unchanged. To-do shows "Kommer snart" until Idé 5. The bottom bar becomes Hjem, Madplan, Lister, Sundhed, Opskrifter, with a list-check icon for Lister. Anything that opens the shopping list opens Lister with Indkøb selected.

**Architecture:** The view id changes from `indkob` to `lister` in `lib/routes.ts`. The segment lives in the hash path (`#lister/indkob`, `#lister/todo`), so a refresh or a shared link keeps it, the same way Madplan keeps its week (`#madplan/<date>`). Old addresses (`#indkob`, `#indkøb`) are rewritten to `#lister/indkob` by a pure alias function that both `parseHash` and `useRoute`'s canonicalisation use. A new `lister/ListerView.tsx` owns the page title and the `SegmentedControl` and renders `IndkobView` (with its own title removed) or the To-do placeholder in a `SegmentedPanel`.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 4. Mockups showing the Lister header: the To-do mockup and "Idé 5 · Lister med Indkøb" (older numbering in the mockup labels).
**Depends on:** nothing. Idé 5 fills the To-do segment; Idé 8 links to `#lister/indkob` with a filter; Idé 14 restyles the header.
**Supersedes:** main spec D24 and §5.1 (tab names and order), §5.3.4 heading ("Indkøb (tab)" → a segment of Lister); UI spec §5.1 (bottom bar items) and §6 (screens).
**Status:** Draft 2026-11-24. See the [roadmap](2026-11-24-strandparken-ideer-roadmap.md) (Q8).

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Routes | `lib/routes.ts`: `views = ['hjem','madplan','indkob','sundhed','opskrifter']`, `labels`, `parseHash` (folds `ø` → `o`, so `#indkøb` works), `subPath`, `hrefFor(view)`. | Change `indkob` to `lister`, and add an alias table for old slugs that also supplies a default sub-path. |
| Canonical hash | `lib/use-route.ts`: if the first hash segment is not exactly the parsed view, the hash is replaced with `hrefFor(view)`, which drops the sub-path. | Without care, `#indkob` would become `#lister` and `#lister/todo` would survive; the alias must produce `#lister/indkob`. |
| Bottom bar | `shell/BottomBar.tsx`: an `icons: Record<View, LucideIcon>` map, `indkob: ShoppingBasket`. | `lister: ListChecks` (exported by `lucide-react` 1.76). |
| Views | `shell/views.tsx` `ViewFor` renders `<IndkobView householdId>` for `indkob`; the `placeholders` type excludes it by name. | Route `lister` to `ListerView` and update the `Exclude<…>`. |
| Title and focus | `AppShell.tsx` sets `document.title` from `labels[view]` and focuses `#view-title` on every view or path change. `IndkobView` renders its own `<h1 id="view-title">Indkøb</h1>` in three states. | `ListerView` owns the one `h1` ("Lister"); `IndkobView` gets a `title={false}` prop (or the `Title` is moved out). Focus then lands on "Lister" after a segment change too, which is acceptable; the tab's own focus stays when the user switches with the keyboard because the panel change is not a route remount. |
| Links to the list | A search for `#indkob` finds only `routes.ts`; no screen links to the list today. "Lav indkøbsliste" and "Læg på indkøbslisten" (`shopping/ListButtons.tsx`) write rows but do not navigate. | Only the alias is needed now. New links (Idé 8, toasts) use `listerHref('indkob')`. |
| Tests | `tests/strandparken-routes.test.ts` asserts the five views and labels. | Update those assertions and add alias cases. |

## Files

**Create**

| File | Purpose | Task |
|---|---|---|
| `src/components/strandparken/lister/ListerView.tsx` | Title "Lister", `SegmentedControl` Indkøb \| To-do, panels | 2 |

**Modify**

| File | Change | Task |
|---|---|---|
| `src/components/strandparken/lib/routes.ts` | `lister` view, `labels.lister = 'Lister'`, `legacyAlias(hash)`, `listerHref(segment)`, `listerSegment(path)` | 1 |
| `src/components/strandparken/lib/use-route.ts` | Canonicalise through `legacyAlias` before the view check | 1 |
| `tests/strandparken-routes.test.ts` | New order, labels, aliases, segment parsing | 1 |
| `src/components/strandparken/shell/BottomBar.tsx` | `lister: ListChecks` | 2 |
| `src/components/strandparken/shell/views.tsx` | `lister` → `ListerView`; placeholder type | 2 |
| `src/components/strandparken/shopping/IndkobView.tsx` | Optional title (`showTitle` prop, default `true` for the gallery) | 2 |
| `src/components/strandparken/shell/AppShell.tsx` | `document.title` stays `Lister · Strandparken` (from `labels`); no change expected beyond checking | 2 |
| `public/strandparken/manifest.webmanifest` | Only if it lists shortcuts to `#indkob` (it does not today; check) | 3 |

## Data changes

None.

## Tasks

### Task 1: Routes and aliases
- [ ] Failing tests in `tests/strandparken-routes.test.ts`:
  - `views` is `['hjem','madplan','lister','sundhed','opskrifter']` and the labels are `['Hjem','Madplan','Lister','Sundhed','Opskrifter']`.
  - `legacyAlias('#indkob')` → `'#lister/indkob'`; `legacyAlias('#indk%C3%B8b')` and `legacyAlias('#indkøb')` → the same; `legacyAlias('#indkob?x=1')` keeps the query (`'#lister/indkob?x=1'`); `legacyAlias('#madplan')` → `null`.
  - `parseHash('#indkob')` → `'lister'`.
  - `listerSegment([])` → `'indkob'`, `listerSegment(['todo'])` → `'todo'`, `listerSegment(['ukendt'])` → `'indkob'`.
  - `listerHref('todo')` → `'#lister/todo'`.
- [ ] Implement in `routes.ts`:

```ts
export const listerSegments = ['indkob', 'todo'] as const;
export type ListerSegment = (typeof listerSegments)[number];
/** Old addresses that must keep working: `#indkob` (and `#indkøb`) open Lister › Indkøb. Null when the hash is not an alias. */
export function legacyAlias(hash: string): string | null
export const listerSegment = (path: readonly string[]): ListerSegment => …
export const listerHref = (segment: ListerSegment) => `#lister/${segment}`;
```

- [ ] `use-route.ts`: in `canonicalise`, first `const alias = legacyAlias(location.hash); if (alias) history.replaceState(null, '', alias);`, then the existing check. `#lister` alone stays as `#lister`; `ListerView` treats an empty segment as `indkob`, so there is no extra history entry.

### Task 2: Lister view and bottom bar
- [ ] `ListerView({ path, householdId })`: `<h1 id="view-title" tabIndex={-1} className="sp-title-page">Lister</h1>`, then `SegmentedControl aria-label="Liste" options={[{ value: 'indkob', label: 'Indkøb' }, { value: 'todo', label: 'To-do' }]} value={listerSegment(path)} onValueChange={(v) => history.replaceState(null, '', listerHref(v)) …}`. Use `location.hash = listerHref(v)` if a history entry per segment is wanted; default: `replaceState` plus a local state update, so Back leaves Lister rather than toggling segments.
- [ ] `SegmentedPanel value="indkob"`: `<IndkobView householdId showTitle={false} />`. `SegmentedPanel value="todo"`: a `Card` with `sp-title-section` "To-do" and `sp-body text-sp-muted` "Kommer snart." (replaced in Idé 5).
- [ ] `BottomBar`: `import { ListChecks } from 'lucide-react'`; `lister: ListChecks`. `views.tsx`: route `lister`, fix the `placeholders` type.
- [ ] `IndkobView`: `showTitle = true` prop; when false, the three `<Title />` uses render nothing. The gallery (`src/dev/strandparken/Gallery.tsx`) is unaffected.

### Task 3: Links, specs, verify, commit
- [ ] Search again (`grep -rn "indkob" src public/strandparken`) and point any link to the shopping list at `listerHref('indkob')`. Expected today: none outside `routes.ts`.
- [ ] Main spec D24, §5.1 and §5.3.4, and UI spec §5.1 and §6: the new tab name, order, icon and segments.
- [ ] Verify (below). Commit: `feat(strandparken): Lister tab with Indkøb and a To-do placeholder`.

## Verification

- `node --test tests/strandparken-routes.test.ts`, `pnpm exec astro check`, `pnpm exec astro build`.
- `pnpm exec astro preview`:
  - The bottom bar reads Hjem, Madplan, Lister, Sundhed, Opskrifter, and Lister has the list-check icon.
  - `#lister` shows Indkøb; switching to To-do shows "Kommer snart"; refreshing on `#lister/todo` keeps To-do.
  - `#indkob` and `#indkøb` open Lister with Indkøb selected, and the address bar shows `#lister/indkob`.
  - The shopping list behaves exactly as before: tick, add, clear, undo, offline.
  - The tab title reads "Lister · Strandparken"; keyboard focus lands on the "Lister" heading; arrow keys move between the segments.

## Acceptance criteria

- [ ] The Indkøb tab is renamed "Lister" and has a segmented control at the top: "Indkøb" | "To-do".
- [ ] "Indkøb" contains the existing shopping list, unchanged.
- [ ] "To-do" is an empty placeholder ("Kommer snart").
- [ ] The bottom bar order is Hjem, Madplan, Lister, Sundhed, Opskrifter, with a list-check icon for Lister.
- [ ] Any link that opens the shopping list opens Lister with "Indkøb" selected.

## Open questions

None. Segment switching uses `replaceState`, so Back leaves the tab; change it if a history entry per segment turns out to be wanted.
