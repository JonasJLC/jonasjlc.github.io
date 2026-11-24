# Strandparken Idé 14: Nyt layout på indkøbslisten — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Lister › Indkøb so a typical week's list fits on about one phone screen. The page title gets smaller with "x af y købt" on the same line, and a thin progress bar sits under the segmented control. Category headings get tinted icons, and rows are compact with an amount pill in the category colour. Checked items slide into a collapsed "Købt" group.

**Architecture:** Presentation only, plus one pure helper. The data, merging and purchase amounts come from Idé 13 (`Line.purchase`) and the day tag from Idé 8. New pieces: a category style map (`lib/shopping/category-style.ts`) from grocery category name to `{ icon, tone }` with a neutral fallback, since categories are editable (D31); colour tokens for six or seven category tones in `strandparken.css`; a `ShoppingRow` component; and a small "settling" state in the view that keeps a just-ticked row in place for about 3 seconds before it moves to "Købt". The header changes live in the Lister view from Idé 4.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 14. Mockup: `image6.png` (Lister with Indkøb selected).

**Depends on:** Idé 4 (Lister view and segmented control), Idé 8 (day tag), Idé 13 (purchase amounts, pantry group).

**Supersedes:** UI spec §5.8 (shopping row and add field) and the Indkøb screen in UI spec §6.

**Status:** Draft, 2026-11-24. Part of the [roadmap](2026-11-24-strandparken-ideer-roadmap.md).

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Rows | `IndkobView` renders each line as `min-h-13.5` (54 px): `Checkbox` (26 px circle in a 44 px target), name in `sp-body` 500, dish titles in `sp-caption` below, amount at the right in `sp-small` muted. | The dish line is removed and the amount becomes a pill. Row height goes from 54 px to 48 px. |
| Done items | `groupLines` puts ticked lines at the bottom of their own category (`done`); a "Ryd afkrydsede" button clears them. | Ticked lines leave their category for a global "Købt" group, after a delay. |
| Header | `Title` "Indkøb" (`sp-title-page`) plus a separate "x af y varer er købt" line; offline pill. After Idé 4 the page title is "Lister". | The title becomes smaller and shares a line with the count. |
| Category headings | `sp-title-group` text. | Gains an icon tile. |
| Progress primitive | Only `/ferie` has `ui/progress.tsx`. | Use a token-styled `div role="progressbar"` (React and Radix stay confined to their routes; no ferie import). |
| Tokens | Person colours, primary, danger, track; no category colours. Contrast test checks text pairs from `rootTokens()`. | Add tone pairs and test each one. |
| Touch targets | UI spec §9 and main spec §4.6: at least 44 px. | The mockup's rows (about 37 px at phone scale) are below that. Resolved below. |

**Density versus touch targets:** rows are 48 px tall. The check keeps a 44 px target, and the rest of the row is the tap area for the item sheet. Nine 48 px rows, three headings and the header fill a 390 × 844 screen above the bottom bar. That is a typical week's list, and it meets "about one screen" without going below 44 px.

---

## Files

**Create**

| File | Purpose | Task |
|---|---|---|
| `src/components/strandparken/lib/shopping/category-style.ts` | `styleFor(categoryName)` → `{ icon, tone }`; `capitalise(name)`; `settle` helpers. | 1 |
| `tests/strandparken-shopping-layout.test.ts` | Tests for the helpers. | 1, 4 |
| `src/components/strandparken/shopping/ShoppingRow.tsx` | The compact row. | 3 |
| `src/components/strandparken/shopping/CategoryHeading.tsx` | Icon tile and name. | 3 |

**Modify**

| File | Change | Task |
|---|---|---|
| `src/styles/strandparken.css` | Tone tokens and Tailwind theme entries; `sp-title-list` utility if needed. | 2 |
| `tests/strandparken-contrast.test.mjs` | Pairs for every tone (ink on tint, icon on tint). | 2 |
| `src/components/strandparken/shopping/IndkobView.tsx` | New layout, "Købt" group, settling delay. | 4, 5 |
| `src/components/strandparken/lister/ListerView.tsx` (from Idé 4; use its actual path) | Header with "x af y købt"; progress bar under the segmented control when Indkøb is selected. | 5 |
| `src/components/strandparken/lib/shopping/model.ts` | `groupLines` option `{ doneSeparately: true }` returning `{ groups, bought }`. | 4 |
| Specs, backlog | Task 6. | 6 |

---

## Data changes

None.

---

## Tasks

### Task 1: Category style and small helpers

- [ ] Tests first in `tests/strandparken-shopping-layout.test.ts`:
  - `styleFor('Frugt & grønt')` → tone `green`; `'Frugt og grønt'` matches too (normalise `&`/`og`, case, spaces);
  - `'Kolonial'` → `amber`; `'Mejeri & æg'` → `blue`; an unknown or renamed category → tone `neutral`, icon `ShoppingBasket`;
  - every one of the 13 D31 names has a style;
  - `capitalise('avocado, modne')` → `'Avocado, modne'`; `capitalise('æg')` → `'Æg'`; an empty string stays empty.
- [ ] Map (icons must exist in `lucide-react` 1.76; check each import at build):

| Category (D31) | Tone | Icon |
|---|---|---|
| Frugt & grønt | green | `Apple` |
| Brød & bagværk | amber | `Croissant` |
| Kød & fisk | rose | `Beef` |
| Pålæg & køl | peach | `Sandwich` |
| Mejeri & æg | blue | `Milk` |
| Frost | blue | `Snowflake` |
| Kolonial | amber | `Wheat` |
| Konserves & glas | rose | `Package` |
| Krydderier, olie & bagning | olive | `Leaf` |
| Drikkevarer | teal | `CupSoda` |
| Snacks & slik | pink | `Candy` |
| Husholdning & pleje | lavender | `SprayCan` |
| Andet / unknown | neutral | `ShoppingBasket` |
| Tjek at I har (Idé 13 pantry group) | neutral | `ListChecks` |

### Task 2: Tone tokens

- [ ] If Idé 2 (placeholder) has already added soft tone pairs, reuse them and add only the missing tones. Otherwise add, in `:root[data-app='strandparken']`: `--sp-tone-<name>` (tint, the pill and icon-tile ground) and `--sp-tone-<name>-ink` (text and icon) for green, amber, rose, peach, blue, teal, olive, pink, lavender and neutral (neutral = `--sp-track` / `--sp-muted`). Soft and muted, fitting the beige and green palette, with the mockup's green, amber and blue as the anchors. Map them in `@theme inline` as `--color-sp-tone-<name>` and `--color-sp-tone-<name>-ink`.
- [ ] Contrast test: each `-ink` on its tint is at least 4.5:1 (the pill text is 13–14 px). The token-guard test must still pass: no raw colours outside `strandparken.css`.
- [ ] Tailwind needs literal class names: export a `toneClasses` record with full strings (`'bg-sp-tone-green text-sp-tone-green-ink'`), as `people.ts` does for person colours.

### Task 3: Row and heading components

- [ ] `CategoryHeading`: a 28 px `rounded-sp-inset` tile in the tone tint with an 18 px icon in the tone ink (decorative), then the name in `sp-body-strong` (smaller than today's `sp-title-group`, per the mockup).
- [ ] `ShoppingRow` (48 px min height, one white group per category with `--sp-line-soft` separators as today):
  - the existing `Checkbox` (round, 26 px in a 44 px target); checked = filled primary with a white tick;
  - the name, capitalised (`sp-body`), single line with ellipsis; checked = struck through and muted;
  - Idé 8's day tag, when present, as a small neutral pill;
  - at the right, the amount pill: `formatQuantity` of Idé 13's purchase amount ("2 stk", "1 bakke") in `sp-caption` 600 on the tone tint with tone ink, `rounded-sp-pill`, 4 px × 10 px padding; no pill when there is no amount (pantry lines);
  - no recipe names in the row; the row (except the check) is a button that opens `ItemSheet`, which shows the meals (Idé 13 Task 8);
  - accessible name of the check: the item name; of the row button: "Lime, 2 stk, til torsdag".

### Task 4: "Købt" group and the settling delay

- [ ] Tests first: a pure `settle(checkedKeys, settlingKeys)` that, given the line list, returns `{ open, settling, bought }`. A just-ticked line stays in `open` (shown checked) while its key is in `settling`. Unticking a settling line cancels the move. Pantry lines never enter `bought` (Idé 13: they stay in their own group).
- [ ] `groupLines(lines, categories, { doneSeparately: true })` → `{ groups: Group[] (open lines only), bought: Line[] }`. Keep the old shape as the default so other callers (Idé 8) do not change.
- [ ] In `IndkobView`, a `settling` set: on tick, add the key and start a 3 s timer that removes it. With `prefers-reduced-motion: reduce` the delay is still 3 s (the person needs time to see the tick), but the move is instant instead of animated. Clear the timers on unmount.
- [ ] The move animates with `motion`'s `layout` prop on rows (already a dependency), or a simple height and opacity transition; none with reduced motion.
- [ ] "Købt · 5" at the bottom: a collapsed disclosure (`aria-expanded`). Expanded, it shows the bought rows (still untickable) and "Ryd afkrydsede" (the existing `clearDone` with undo).
- [ ] The tick made on the other phone also settles (the change arrives through realtime). It skips the delay, since nobody on this phone is looking at it.

### Task 5: Header and progress

- [ ] In the Lister view, while Indkøb is selected: the title "Lister" uses a smaller role than `sp-title-page` (`sp-title-card`, 24 px, or a new `sp-title-list` 26 px utility in `strandparken.css` if 24 px looks too small next to the bar), and at the right on the same baseline "0 af 7 købt" (`sp-small`, muted, `aria-live="polite"`). Counts exclude pantry lines (Idé 13 `counts`). The offline pill moves under the header row.
- [ ] Under the segmented control, a 4 px track (`--sp-track`, pill radius) with a primary fill: `role="progressbar"`, `aria-valuemin=0`, `aria-valuemax={total}`, `aria-valuenow={done}`, `aria-label="Købt"`. Hidden when the list is empty. With To-do selected, there is no count or bar.
- [ ] Add field as today (Field with the plus action) directly under the bar.
- [ ] Hint at the bottom of the list, as in the mockup, shown only until the first time a row is tapped (`localStorage`, wrapped in try/catch): "Tryk på en vare for at se, hvilke retter den er til".

### Task 6: Specs, backlog, verify, commit

- [ ] UI spec §5.8: the new row (48 px, pill, day tag, no dish line), the category heading, the "Købt" group, the settling delay, and the density rule (a week's list on about one 390 × 844 screen, never below 44 px targets). UI spec §3.1: list the tone tokens. §6 Indkøb screen: header with count and progress bar.
- [ ] Main spec §5.3.4 "While shopping": "ticked items collapse to the bottom" becomes "ticked items move to a collapsed Købt group after a few seconds".
- [ ] Backlog: anything deferred (for example, choosing a colour per custom category).
- [ ] Commit: `feat(strandparken): compact shopping list layout`.

---

## Verification

- `node --test tests/` (layout helpers, contrast, token guard, shopping), `pnpm exec astro check`, `pnpm exec astro build`, `pnpm exec astro preview` at 390 × 844 and 360 × 740.
- A typical week (about 9 items in 3 categories) fits above the bottom bar at 390 × 844 without scrolling.
- Tick a row: it stays checked and struck through for about 3 seconds, then moves into "Købt". Untick within the 3 seconds: it stays. Tick on the other phone: it moves straight away on this phone.
- Reduced motion on: no animation, same behaviour.
- Text size 130 %: the pill never covers the name (the name truncates), and rows grow instead of clipping.
- VoiceOver: each check is announced with the item name, the row button with name, amount and day, and the progress bar as "Købt, 3 af 7".
- Rename a grocery category to something new: its heading uses the neutral style, and nothing breaks.

---

## Acceptance criteria

- [ ] Smaller page title, with "x af y købt" on the same line, and a thin progress bar under the segmented control.
- [ ] Each category heading has a small rounded icon tinted in the category's colour.
- [ ] Each item is a compact row: round check, item name with a capital first letter, and the amount as a pill on the right in the category's colour ("2 stk", "1 bakke").
- [ ] The recipe name is gone from each row; tapping an item shows which meals it is for.
- [ ] The small day tag from Idé 8 is kept.
- [ ] Checked items get a filled check and strikethrough, and move to a collapsed "Købt" group at the bottom after a few seconds.
- [ ] Rows are dense enough that a typical week's list fits on about one screen, with touch targets still at least 44 px.

---

## Open questions

1. **Row height.** The mockup is denser than the 44 px rule allows. Default: 48 px rows with a 44 px check target. Jonas can approve 44 px rows if one screen is not enough in practice.
2. **Category colours for custom categories.** Default: neutral. A colour picker per category can come later.
