# Strandparken Idé 8: "Mangler at handle" på Hjem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Mangler at handle" section to Hjem that shows only what is still unbought for today's and tomorrow's planned meals, never the full list. Also show a small day tag ("Tor") on Indkøb rows that belong to a planned meal.

**Architecture:** No schema change: shopping rows generated from the plan already carry `plan_entry_id` (`source = 'plan'`). Moving a meal keeps the entry id (`moveEntry`), and swapping keeps both ids (`swapEntries`), so the link follows the meal. A pure selector, `missingForHome(rows, entries, recipes, today)`, merges each day's plan rows with the existing `mergeRows` and returns two lines. Hjem reads rows through the existing `useShopping` hook (offline cache, queue, realtime), so a tick on the other phone updates Hjem live. Tapping opens `#lister/indkob?for=<entryId>,<entryId>`. `routes.ts` gets a query parser, and Indkøb shows a filter banner with "Vis alle". Indkøb also loads the next 14 days of plan entries to label rows with their day.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 8. Mockups: `image3.png` (Mangler at handle at the bottom of the dashboard) and `image4.png` right (Indkøb rows with day tags).

**Depends on:** Idé 4 (`#lister/indkob` route and the Lister view) and Idé 6 (Hjem slots). Idé 13 changes how lines merge and how amounts read; this plan calls `mergeRows`, so it picks that up without change.

**Supersedes:** adds item 5 of the new Hjem order (roadmap Q7); UI spec §5.8 gets the day tag.

**Status:** ✅ Implemented 2026-11-24 (commits ff63e16). Manual checks: `docs/strandparken-manual-checks.md`. Part of the [roadmap](2026-11-24-strandparken-ideer-roadmap.md).

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Link to the meal | `sp_shopping_items.plan_entry_id` (FK to `sp_meal_plan_entries`, `on delete set null`); `rowFor` sets `source: 'plan'` and `plan_entry_id` when generating from the plan. | "Add that link if it doesn't exist": it exists. No migration. |
| Recipe-only rows | `Læg på indkøbslisten` from a recipe stores `source: 'recipe'` with `recipe_id` and no plan entry. Manual rows have neither. | Neither appears in this section, as the source document asks for manual items. Recipe-only rows are treated the same. |
| Moving meals | `moveEntry` updates `date` on the same row; `swapEntries` keeps both ids. | Links stay correct after moves, including Idé 3's drag and drop. |
| Shopping state | `useShopping(householdId)` returns rows with queued offline changes applied, and subscribes to `sp_shopping_items` through `subscribeHousehold` (channel `strandparken:sp_shopping_items:<household>`). | Hjem and Indkøb are never mounted together (one view at a time), so reusing the hook on Hjem does not open a second channel. |
| Merging | `mergeRows(rows, dishTitle)` → `Line[]`, skipping `have` and `cleared`; `Line.checked` is true when every row is checked. | Merge per day, so a line's count belongs to one meal. |
| Routes | `splitHash` drops everything after `?`; `subPath` returns segments only. | Add `queryOf(hash)`. |

---

## Files

**Create**

| File | Purpose | Task |
|---|---|---|
| `src/components/strandparken/lib/home/missing.ts` | Pure: `missingForHome`, and `dayTagFor(line, entries, today)`. | 1, 4 |
| `src/components/strandparken/home/MissingCard.tsx` | The Hjem section. | 3 |

**Modify**

| File | Change | Task |
|---|---|---|
| `tests/strandparken-home.test.ts` | Selector and day-tag tests (file created by Idé 6). | 1, 4 |
| `src/components/strandparken/lib/routes.ts`, `tests/strandparken-routes.test.ts` | `queryOf(hash): URLSearchParams`; `hrefFor` unchanged. | 2 |
| `src/components/strandparken/shopping/IndkobView.tsx` | `for` filter with banner; day tags; plan entries for 14 days. | 4, 5 |
| `src/components/strandparken/shell/views.tsx` | Place `MissingCard` in the last Hjem slot. | 3 |
| Specs, backlog | Task 6. | 6 |

---

## Data changes

None. Confirm the assumption in Task 1: write a test where an entry moves from Thursday to Friday (same id, new date) and the selector follows it.

---

## Tasks

### Task 1: The selector

- [ ] Tests first in `tests/strandparken-home.test.ts`, using small fixtures of `ShoppingRow`, `PlanEntry` and `Recipe`:
  - tonight has a recipe and three active plan rows plus one checked → `tonight.count` 3, names are the first three line names in store-walk order, `more` 0;
  - five active lines → `names` has three, `more` 2;
  - all rows of tonight's entry checked → `tonight.ready: true` ("Klar til i aften");
  - tonight's rows all `have` (the person has them at home) → treated as bought: `ready: true`;
  - nothing planned today → `tonight: null` (the line is left out); same for tomorrow;
  - free text or idea tonight (no recipe) → `tonight: null`;
  - a manual row and a `source: 'recipe'` row with the same name → not counted;
  - the same ingredient for tonight and tomorrow counts once in each line;
  - tomorrow → `{ title: 'Carbonara', count: 4, ready: false }`;
  - a planned recipe whose list has not been generated (no plan rows) → `{ notOnList: true }`;
  - entry moved to another day (same id) → follows the new date.

```ts
export type MissingLine = { entryId: string; title: string; count: number; names: string[]; more: number; ready: boolean; notOnList: boolean };
export function missingForHome(
  rows: readonly ShoppingRow[], entries: readonly PlanEntry[], recipes: readonly Recipe[],
  categories: readonly GroceryCategory[], today: IsoDate,
): { tonight: MissingLine | null; tomorrow: MissingLine | null };
```

- [ ] Implement it: for each day, take the recipe entry, filter rows by `plan_entry_id`, `mergeRows`, order with `groupLines`, and count lines that are not `checked`.

### Task 2: Query in the hash

- [ ] Tests: `queryOf('#lister/indkob?for=a,b').get('for')` is `'a,b'`; no `?` gives an empty `URLSearchParams`; `parseHash` and `subPath` ignore the query as before.
- [ ] Implement `queryOf` in `routes.ts`.

### Task 3: Hjem section

- [ ] `MissingCard` per `image3.png`: heading "Mangler at handle" (`sp-title-section`), one white card. Rows:
  - "Til i aften" (`sp-body-strong`) with the count on the right ("2 varer", in an amber tone from the existing tokens or the Idé 14 palette, never person colours), and below it the names joined with ", ", then "+ N mere" (`sp-small`, muted);
  - all bought: "Til i aften" with "Klar til i aften" and a check icon in primary instead of the count;
  - "Til i morgen · Carbonara" with the count on the right (`sp-small`, muted);
  - a recipe planned but not on the list: "Til i aften" with "Ikke på listen endnu" (muted).
- [ ] The whole card is one link: `#lister/indkob?for=<tonightId>,<tomorrowId>` (only the ids shown). Accessible name: "Mangler at handle: til i aften 2 varer, lime og avocado. Til i morgen, carbonara, 4 varer."
- [ ] Both lines `null` → the section is not rendered (Hjem stays calm on empty days).
- [ ] Data: `useShopping(householdId)` for rows, `usePlan(householdId, today, tomorrow)` for entries, `useRecipes()` for titles. Loading: skeleton of one row. Error: hide the section (Hjem must not show a list error; Indkøb does).

### Task 4: Day tag in Indkøb

- [ ] Tests first: `dayTagFor(line, entriesById, today)` returns `'Tor'` for the earliest entry date ≥ today among the line's rows. Within 6 days it is `weekdayShort`; further out it is `'27/11'`. It returns `'I dag'` for today, and `null` when no row links to an upcoming entry (manual items, past days).
- [ ] `IndkobView` loads `usePlan(householdId, today, addDays(today, 13))` and passes the tag to each row as a small neutral pill (`--sp-track` ground, `sp-caption`, muted ink) at the right of the row, per `image4.png` right. Idé 14 restyles it; keep it a separate tiny component (`DayTag`) so that plan can move it.

### Task 5: `for` filter in Indkøb

- [ ] When `queryOf(location.hash).get('for')` names entry ids, show only lines with at least one row linked to those entries, and a banner above the list: "Viser varer til i aften og i morgen" (or just "til i aften") with a quiet button "Vis alle", which replaces the hash with `#lister/indkob`.
- [ ] The add field stays visible. An item added while filtered is manual and so disappears from the filtered view; show the toast "Tilføjet – vises under Vis alle".
- [ ] The filter listens to `hashchange` through the existing `useRoute`.

### Task 6: Specs, backlog, verify, commit

- [ ] Main spec §5.6: describe "Mangler at handle" (today and tomorrow only, plan items only, "Klar til i aften"). §5.3.4: mention the day tag and the filtered view.
- [ ] UI spec §5.8: the day tag pill; §6 Hjem: the section.
- [ ] Backlog: "Items added with `Læg på indkøbslisten` from a recipe are not linked to a day, so they never show in Mangler at handle".
- [ ] Commit: `feat(strandparken): Mangler at handle on Hjem and day tags on the list`.

---

## Verification

- `node --test tests/`, `pnpm exec astro check`, `pnpm exec astro build`, `pnpm exec astro preview`.
- Plan tonight and tomorrow with recipes, run `Lav indkøbsliste`, open Hjem: the counts match Indkøb. Tick an item on the other phone: Hjem updates within a few seconds without reloading.
- Tick everything for tonight: "Klar til i aften". Remove tomorrow's meal: the tomorrow line disappears.
- Tap the card: Indkøb opens filtered with the banner; "Vis alle" restores the full list; Back returns to Hjem.
- Offline (airplane mode) with the app open: Hjem shows the cached list, and ticks in Indkøb are reflected on Hjem.
- Day tags: a row for Saturday's dinner reads "Lør"; a manual row has no tag; after moving the meal to Friday (Idé 3 or the day sheet), the tag reads "Fre".

---

## Acceptance criteria

- [ ] Hjem has a "Mangler at handle" section below "I aften" (and, once Idé 12 ships, below "Jeres dag", so it ends up last).
- [ ] It never shows the full shopping list, only what is still unbought for today's and tomorrow's planned meals.
- [ ] Shopping items know which planned meal (day and recipe) they were added for; manually added items have no link and are not shown here.
- [ ] "Til i aften" shows up to about 3 item names, then "+ N mere", and a count.
- [ ] "Til i morgen · [recipe name]" shows a count.
- [ ] When everything for tonight is bought, it reads "Klar til i aften".
- [ ] A day with no planned meal has no line.
- [ ] Tapping opens Lister › Indkøb filtered to those meals.
- [ ] In Lister › Indkøb, items linked to a planned meal show a small day tag (e.g. "Tor").

---

## Open questions

1. **A planned recipe that is not on the list yet.** The source document does not cover it. Default: show "Ikke på listen endnu" rather than "Klar", so a forgotten `Lav indkøbsliste` is visible.
2. **Count unit.** Default: count merged lines ("2 varer"), not packages, so "2 varer" matches what the person sees in the list.
