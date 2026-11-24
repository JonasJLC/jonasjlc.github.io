# Strandparken Idé 13: Realistiske mængder på indkøbslisten — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bug where the shopping list shows recipe amounts such as "1½ limes" or "1,5 spsk tun". The list must show amounts that can be bought in a Danish supermarket: whole pieces, whole packages, or loose weight rounded up to 100 g. Basic pantry items move to a collapsible "Tjek at I har" group. The recipe page keeps its exact amounts.

**Architecture:** Conversion happens **at display time only**. Storage stays as ADR-08 defines it: one row per source holding the recipe's scaled amount. Generating the list from the plan therefore stays repeatable (`planGeneration` compares recipe amounts with stored amounts, as today), the original amounts are always available for the item sheet, and the offline queue and realtime need no change. Two new pure modules do the work. `lib/shopping/ingredients-dk.ts` is a data table of about 100 common Danish ingredients: names and variants, purchase rule, package unit and size, piece weight, spoon weights. `lib/shopping/purchase.ts` finds an ingredient by name, converts each row to a base measure (g, ml or stk), sums across recipes and name variants, and only then rounds to a purchase quantity. `mergeRows` groups by purchase key instead of by name plus unit family, and returns purchase amounts. A small table, `sp_unit_preferences`, remembers when a person changes an item's unit in the list.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 13. Mockup: `image6.png` shows the result ("2 stk", "1 bakke", "1 dåse", "1 pakke", "1 bæger").

**Depends on:** Idé 4 (Lister › Indkøb). Should ship before Idé 14 (which styles the amount pill) and works with Idé 8 (whose counts use `mergeRows`).

**Supersedes:** main spec §5.3.4 "Storage and merging" (lines merge by ingredient, not by name and unit) and D32's unit list is unchanged for recipes. ADR-08 gains a "Display conversion" section. D8 (no pantry) holds: "Tjek at I har" is a reminder, not an inventory.

**Status:** ✅ Implemented 2026-11-24 (commits dae4163, a68ed21). Manual checks: `docs/strandparken-manual-checks.md`. Part of the [roadmap](2026-11-24-strandparken-ideer-roadmap.md).

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Stored rows | `sp_shopping_items`: `name`, `canonical_name`, `amount`, `unit`, `status`, `source`, `plan_entry_id`, `recipe_id`. Plan rows hold the recipe amount scaled to the entry's persons (`wantedFor` → `scaleIngredient`). | Already the "original amount" the item sheet must show. Keep it. |
| Names | `canonicalName(name)`: lower case, parentheses removed, single spaces. "store tomater" and "tomater" are different keys. | Variant matching goes in the new lookup (`ingredientFor`). `canonicalName` stays as is because it is stored and compared by `planGeneration`. |
| Units | `canonicalUnit` maps aliases; `normalised` knows mass (g, kg) and volume (ml, cl, dl, l). Everything else ("stk", "spsk", "tsk", "fed", "bundt", "dåse") only merges with itself. Import units (D32): g, kg, ml, dl, l, tsk, spsk, stk, fed, bundt, dåse. | The converter handles every D32 unit and anything unknown as "other". |
| Merging | `mergeRows` keys lines by `canonical_name` + unit family, sums, and shows `readable` units. Ticking a line ticks all its rows. | Change the key to the purchase key. Ticking still works on `line.rows`. |
| Item sheet | `ItemSheet` shows the amount and dish titles in the header; category chips; remove. | Add the per-meal original amounts and the unit picker. |
| Counts | `counts(lines)` → "x af y købt". | Pantry lines are left out of both numbers. |
| Generation | `planGeneration` matches stored rows by `plan_entry_id` + `canonical_name` + unit family. | Untouched. Conversion never changes stored amounts, so "generate twice changes nothing" still holds. |

---

## Files

**Create**

| File | Purpose | Task |
|---|---|---|
| `src/components/strandparken/lib/shopping/ingredients-dk.ts` | The ingredient table (data only). | 2 |
| `src/components/strandparken/lib/shopping/purchase.ts` | `ingredientFor`, `toBase`, `purchaseFor`, `unitOptions`. | 1, 3, 4 |
| `tests/strandparken-purchase.test.ts` | Table-driven tests, including every example from the source document. | 1–4 |
| `src/components/strandparken/lib/shopping/preferences.ts` | Load and save unit preferences. | 6 |
| `supabase/migrations/20261124180000_strandparken_unit_preferences.sql` | Table and RLS. | 6 |

**Modify**

| File | Change | Task |
|---|---|---|
| `src/components/strandparken/lib/shopping/model.ts` | `Line` gains `ingredientKey`, `purchase`, `pantry`, `sources`; `mergeRows` keys by purchase key; `counts` skips pantry; `groupLines` puts pantry lines in their own group. | 5 |
| `tests/strandparken-shopping.test.ts` | Update merge expectations; add pantry and variant cases. `planGeneration` tests must pass unchanged. | 5 |
| `src/components/strandparken/shopping/IndkobView.tsx` | "Tjek at I har" group, collapsed; amounts from `line.purchase`. | 7 |
| `src/components/strandparken/shopping/ItemSheet.tsx` | Meals and original amounts; unit picker. | 8 |
| `supabase/tests/strandparken_policies.sql`, `src/lib/supabase/database.types.ts` | Policy cases; regenerated types. | 6 |
| `docs/adr/ADR-08-shopping-items-per-source.md`, specs, backlog | Task 9. | 9 |

---

## Data changes

`supabase/migrations/20261124180000_strandparken_unit_preferences.sql` (real timestamp at build time):

```sql
-- Idé 13: a unit chosen in the shopping list is remembered per ingredient for the household.
create table public.sp_unit_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  ingredient_key text not null check (length(ingredient_key) between 1 and 120), -- ingredients-dk key, or "?<canonical name>" for unknown ones
  unit text not null check (unit in ('stk','g','kg','ml','l','dåse','bakke','pakke','bæger','karton','glas','pose','bundt','net','flaske','tube','recipe')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (household_id, ingredient_key)
);
-- Same household policy shape as the Phase 1 tables: members read, insert, update, delete their household's rows;
-- trigger private.sp_touch(). No realtime: preferences are read when the list loads.
```

`unit = 'recipe'` means "show the recipe amount, rounded up" (an escape hatch for odd cases). Policy cases: a member reads and writes their household's preferences; a member of another household and a non-member read nothing. Regenerate types after applying (dashboard or MCP, roadmap note).

---

## The rules (from the source document, made exact)

Rows of one ingredient are first converted to a **base measure** of that ingredient (grams, millilitres or pieces) and **summed across recipes and name variants**. Only then is the total rounded, once:

| Rule | Applies to | Result | Example |
|---|---|---|---|
| 1. `count` | Items bought by the piece (lime, avocado, løg, æg, peberfrugt, citron, agurk …) | Total pieces, rounded **up**, as "stk". Grams are turned into pieces with the piece weight. | 1½ lime → **2 stk**; 300 g løg (piece 100 g) → **3 stk** |
| 2. `package` | Items sold in packages (tun, flåede tomater, tortillas, creme fraiche, passata, pasta, ris, fløde, mælk …) | Total ÷ package size, rounded **up**, in the package unit. Any amount above zero gives at least 1, so a spoonful becomes 1 package. | 1,5 spsk tun → **1 dåse**; 8 tortillas (pakke of 8) → **1 pakke**; 2½ dl creme fraiche (bæger 200 ml) → **2 bæger** |
| 3. `weight` | Items sold loose by weight (kartofler, gulerødder, rødbeder …) | Grams rounded **up** to the nearest 100 g; shown as kg from 1000 g ("1,2 kg"). Pieces are turned into grams with the piece weight. | 650 g kartofler → **700 g**; 4 gulerødder (piece 80 g) → **400 g** |
| 4. `pantry` | Basics used in small amounts (salt, peber, olie, olivenolie, eddike, sukker in spoons, dried spices, bouillon terninger …) | Not on the list. Shown in a collapsible group "Tjek at I har", without amounts. | "1 tsk spidskommen" → under Tjek at I har |
| 5. Merge | Same ingredient across recipes and variants ("store tomater" + "tomater"; "rødløg" stays separate from "løg") | One line; summed before rounding. | 2 tomater + 200 g store tomater → one "Tomater" line |
| Unknown | Not in the table | If every amount is a count (stk or no unit): rule 1. Otherwise the recipe amount rounded up in its own readable unit: spoons, fed, bundt, dåse and stk to whole numbers; g to the next 10 g; dl to whole dl; l to the next half litre. | 1,5 spsk tahin → **2 spsk**; 125 g halloumi → **130 g** |

Spoon and volume to weight use the ingredient's own `spsk`/`tsk` grams or density, falling back to water (1 g/ml) with `approx: true`. When an amount cannot be converted at all (an unknown unit or no amount), a `package` item shows **1 package** and a `count` item shows the count if there is one, else **1 stk**. Both are marked `approx`.

---

## Tasks

### Task 1: Name lookup

- [ ] Tests first in `tests/strandparken-purchase.test.ts`:
  - `ingredientFor('Lime')`, `('limes')`, `('lime, økologisk')` → `lime`;
  - `('store tomater')`, `('Tomater (modne)')`, `('tomat')` → `tomat`; `('hakkede tomater')`, `('flåede tomater')` → `tomater-daase`; `('cherrytomater')` → `cherrytomat`;
  - `('rødløg')` → `rødløg`, not `løg`; `('hvidløg')` → `hvidløg`; `('forårsløg')` → `forårsløg`;
  - `('tun i vand')` → `tun`; `('creme fraiche 18%')` → `creme-fraiche`;
  - `('kyllingebryst')` → `kyllingebryst`; `('kylling')` → `kylling`;
  - `('drage-frugt')` → `null` (unknown).
- [ ] Implement `ingredientFor(name)`: normalise with `canonicalName`, drop leading size or quality words (`store`, `små`, `mellemstore`, `friske`, `modne`, `økologiske`, `finthakket` …), drop a trailing comma clause ("avocado, modne"), drop percentages, then find the **longest** name or alias that matches the whole string or its last word (Danish compounds put the key word last, as `guessCategoryName` already assumes). Exact names win over compounds, so "rødløg" never becomes "løg".

### Task 2: The ingredient table

- [ ] Write `ingredients-dk.ts`, starting with the ~100 most common Danish dinner ingredients. Shape:

```ts
export type Rule = 'count' | 'package' | 'weight' | 'pantry';
export type PackUnit = 'dåse' | 'bakke' | 'pakke' | 'bæger' | 'karton' | 'glas' | 'pose' | 'bundt' | 'net' | 'flaske' | 'tube';
export type Ingredient = {
  key: string;                // stable id, also used in sp_unit_preferences
  name: string;               // display name on the list, e.g. "Tomater"
  aliases: string[];          // singular/plural and variants
  rule: Rule;
  pack?: { unit: PackUnit; size: number; measure: 'g' | 'ml' | 'stk' };
  pieceGrams?: number;        // for count <-> weight
  spoonGrams?: { tsk: number; spsk: number };
  gramsPerMl?: number;        // density for dl/ml given for a weighed item
};
```

  Examples to include, at least:

| key | rule | pack / piece |
|---|---|---|
| `lime`, `citron`, `avocado`, `løg`, `rødløg`, `peberfrugt`, `agurk`, `æg` | count | piece 70 / 100 / 200 / 100 / 100 / 150 / 350 / 60 g |
| `tun` | package | dåse 185 g; spsk 15 g |
| `tomater-daase` | package | dåse 400 g |
| `tomat`, `cherrytomat` | package | bakke 500 g / 250 g; tomat piece 100 g |
| `tortillas` | package | pakke 8 stk |
| `creme-fraiche`, `piskefløde`, `madlavningsfløde` | package | bæger 200 ml / karton 250 ml / karton 250 ml |
| `passata` | package | karton 500 g |
| `pasta`, `spaghetti`, `ris` | package | pakke 500 g / 500 g / 1000 g |
| `mælk` | package | karton 1000 ml |
| `parmesan`, `revet ost`, `feta` | package | pakke 100 g / pose 175 g / pakke 150 g |
| `hakket oksekød`, `kyllingebryst` | package | bakke 500 g / bakke 400 g |
| `hvidløg` | count | 1 stk = 10 fed (a "fed" converts to 0.1 stk), rounded up |
| `kartofler`, `gulerødder`, `rødbeder` | weight | piece 120 / 80 / 150 g |
| `salt`, `peber`, `olivenolie`, `olie`, `eddike`, `spidskommen`, `paprika`, `kanel`, `oregano`, `karry`, `bouillon`, `sojasauce` | pantry | – |

- [ ] Table tests: at least 100 entries; keys unique; no alias belongs to two entries; every `package` entry has `pack`; every `weight` entry and every `count` entry used with grams has `pieceGrams`; every alias resolves to its own entry through `ingredientFor`.
- [ ] Package sizes are typical Danish sizes (Netto, Føtex, Rema 1000, Lidl). Any line can be corrected later through the unit preference, so the table only has to be sensible, not perfect.

### Task 3: Conversion to the base measure

- [ ] Tests: `toBase(ing, 1.5, 'spsk')` for tun → 22.5 g; `toBase(lime, 1.5, null)` → 1.5 stk; `toBase(kartofler, 3, 'stk')` → 360 g; `toBase(creme-fraiche, 2.5, 'dl')` → 250 ml; `toBase(hvidløg, 3, 'fed')` → 0.3 stk; an unknown unit returns `null`.
- [ ] Implement with the existing `canonicalUnit` and the mass and volume factors already in `model.ts` (export them, do not duplicate them).

### Task 4: Purchase quantity

- [ ] Tests, table-driven, one row per example above plus:
  - the source document's examples: **1½ lime → 2 stk**, **1,5 spsk tun → 1 dåse**, **tortillas → 1 pakke**, **creme fraiche → 1 bæger**, **passata → 1 karton**, **kartofler 650 g → 700 g**;
  - summing before rounding: lime 0.5 + 0.5 + 0.5 → 2 stk (not 3);
  - two recipes with 250 g and 300 g hakket oksekød → 550 g → **2 bakker** (500 g each);
  - 1000 g kartofler → "1 kg"; 1050 g → "1,1 kg";
  - pantry → `{ pantry: true }`;
  - unknown with stk only → whole stk; unknown 1,5 spsk → 2 spsk;
  - a preference `{ tomat: 'stk' }` → 4 tomater (400 g ÷ 100 g) instead of 1 bakke; `'recipe'` → the summed recipe amount, rounded up.

```ts
export type Purchase = { amount: number | null; unit: string | null; pantry: boolean; approx: boolean };
export function purchaseFor(ing: Ingredient | null, parts: { amount: number | null; unit: string | null }[], pref?: string): Purchase;
/** What the unit picker offers for this ingredient: its package unit, "stk" if it has a piece weight, g/kg, and "Opskriftens mængde". */
export function unitOptions(ing: Ingredient | null): string[];
```

### Task 5: Merge by ingredient

- [ ] Update tests in `tests/strandparken-shopping.test.ts` first:
  - "store tomater" (200 g) and "tomater" (2 stk) from two recipes → one line, `purchase` "1 bakke", `rows.length` 2;
  - "rødløg" and "løg" stay two lines;
  - a pantry row → a line with `pantry: true`, in the pantry group, not counted by `counts`;
  - ticking: `line.checked` is still "every row checked";
  - every existing `planGeneration` test passes unchanged (generation is not touched).
- [ ] `mergeRows(rows, dishTitle, prefs = {})`: key = `ingredientFor(row.name)?.key ?? '?' + canonicalName + '|' + unit family` (unknown ingredients merge as today). `Line` gains `ingredientKey`, `purchase: Purchase`, `pantry: boolean`, and `sources: { rowId, dish, date, amount, unit }[]` for the sheet. Keep `amount` and `unit` on `Line`, filled from `purchase`, so the other callers (Idé 8, `IndkobView`, `ItemSheet`) keep working. The line's display name is the table's `name` for known ingredients (capitalised; Idé 14 capitalises everywhere), else the first row's name.
- [ ] `groupLines` returns pantry lines as a separate trailing group `{ categoryId: 'pantry', name: 'Tjek at I har', … }` instead of in their grocery category.
- [ ] `counts` ignores pantry lines.

### Task 6: Remembered units

- [ ] Policy cases first, then the migration; apply it, regenerate types.
- [ ] `preferences.ts`: `loadUnitPreferences(): Promise<Record<string, string>>`, `saveUnitPreference(householdId, key, unit)` (upsert on `household_id, ingredient_key`), `clearUnitPreference(…)`.
- [ ] `useShopping` (or `IndkobView`) loads preferences with the rows and keeps them in the offline cache (`queue.ts` `Cache` gains `prefs`, with a default of `{}` for old caches). Changing a unit needs a connection, like changing a category (a toast says so when offline).

### Task 7: List view

- [ ] Amounts come from `line.purchase` through `formatQuantity` (an `approx` purchase gets a leading "ca."). Plural package units stay singular after a number ("2 dåse" reads wrong, so use a small plural map: dåser, bakker, pakker, bægre, kartoner, glas, poser, bundter, net, flasker, tuber).
- [ ] "Tjek at I har": collapsed by default (a disclosure button with the count, "Tjek at I har · 4"), at the bottom above any "Købt" group. Rows show the name only, can be ticked like any line, and are not counted in "x af y købt".
- [ ] Idé 8's day tag and the `for` filter keep working (they read `line.rows`).

### Task 8: Item sheet

- [ ] Header: the purchase amount ("2 stk").
- [ ] Section "Til" lists each source: dish title, weekday (from the plan entry, if any), and the original amount, e.g. "Quesadillas · Tor · 1½ lime" and "Guacamole · Lør · 0,5 lime". Manual items show "Tilføjet i hånden".
- [ ] Section "Enhed": chips from `unitOptions`, the current one selected. Choosing one saves the preference and updates the line at once. A chip "Standard" clears it.
- [ ] Category chips and "Fjern fra listen" as today.

### Task 9: ADR, specs, backlog, verify, commit

- [ ] ADR-08: add "Display conversion (2026-11, Idé 13)": rows keep recipe amounts; lines merge by ingredient and show purchase amounts; pantry is a display group; preferences per household.
- [ ] Main spec §5.3.4: replace "rows with the same canonical name and compatible unit become one line" with the rules table; add "Tjek at I har"; add `sp_unit_preferences` to §6.
- [ ] Backlog: remove "Stale canonical name" if the lookup no longer depends on it; add "Ingredient table covers ~100 items; extend when a line shows a recipe amount" and "The har hjemme review still lists pantry items" (see open question 1).
- [ ] Commits: `feat(strandparken): buyable amounts on the shopping list`, then `feat(strandparken): remember a chosen unit per ingredient`.

---

## Verification

- `node --test tests/` (purchase, shopping and every other Strandparken test), `pnpm exec astro check`, `pnpm exec astro build`.
- Policy file: `failures` = 0.
- With real recipes: plan a week, `Lav indkøbsliste`, and read the list in Lister › Indkøb. No fractions or spoon amounts on purchasable items; salt, pepper and oil sit under "Tjek at I har"; the recipe page still shows "1½ lime".
- Press `Lav indkøbsliste` again: nothing changes (repeatability).
- Change tomatoes to "stk" on one phone; reload the other phone: the same unit shows, and next week's tomatoes use it too.
- Offline: ticking works; changing a unit says it needs a connection.

---

## Acceptance criteria

- [ ] Countable items (lime, avocado, løg, æg, peberfrugt) are rounded up to a whole number in "stk": 1½ lime → 2 stk.
- [ ] Items sold in packages are converted to the package unit and rounded up to whole packages (tun → dåse, tomater → bakke, tortillas → pakke, creme fraiche → bæger, passata → karton/glas); a small spoon amount becomes 1 package.
- [ ] Items often sold loose by weight (kartofler, gulerødder) keep grams or kg, rounded up to the nearest 100 g.
- [ ] Basic pantry items (salt, peber, olie, krydderier) are not added to the list automatically; they show in a collapsible group "Tjek at I har".
- [ ] Lines for the same ingredient across recipes and name variants ("store tomater" + "tomater") are merged, summed before rounding.
- [ ] A mapping table covers the ~100 most common Danish ingredients; an unknown ingredient falls back to rule 1 if the amount is a count, otherwise the recipe amount rounded up.
- [ ] Changing an item's unit in the list is remembered for that ingredient next time.
- [ ] The recipe page keeps exact recipe amounts; only the shopping list is converted.
- [ ] Tapping an item shows which meals it is for and the original amounts.

---

## Open questions

1. **Pantry items in the "har hjemme" review.** The review sheet (`ReviewSheet.tsx`) still asks about salt and pepper. Default: leave the review unchanged in this plan, since the items land under "Tjek at I har" anyway. A follow-up can pre-untick pantry items in the review.
2. **Pantry by amount, not only by name.** Sugar is pantry in "1 tsk sukker" but not in "500 g sukker" for baking. Default: pantry entries may set a threshold (`pantryBelow: { g: 50 }`); above it they use their package rule. Implement for sukker, mel and smør only.
3. **Package sizes.** Defaults come from the table. Jonas or Camilla correct a wrong one with the unit picker, or by editing the table.
