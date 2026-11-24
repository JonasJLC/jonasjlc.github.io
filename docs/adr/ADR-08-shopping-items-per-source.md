# ADR-08: Shopping items stored per source, merged on display

Status: accepted, 2026-11-15 (slice 1.4). Covers design D36.

## Context

The list is built from three sources (a week's madplan, a single recipe, hand-typed items) and edited by two people at
once. `Lav indkøbsliste` must be repeatable: pressing it again must add what is new, drop what no longer applies, and
never disturb what has been bought.

## Options

1. **One row per ingredient name, amounts summed on write.** Simple to read, but a changed plan cannot say which part
   of "3 løg" to take back, and two phones summing at once lose updates.
2. **One row per source ingredient, merged on display.** Rows keep their `plan_entry_id` or `recipe_id`, so a removed
   day removes exactly its rows and a changed persons count updates exactly its amounts.
3. **Regenerate the whole list from the plan each time.** Easy to reason about, but it wipes manual items and ticks.

## Decision

Option 2.

- Merge key: canonical name (lower-case, remarks in brackets dropped) plus unit family. g and kg merge, ml/cl/dl/l
  merge, other units (stk, tsk, none) only merge with themselves, so "g and stk" stay separate lines.
- A line is ticked only when all its rows are; ticking a line ticks all of them.
- Statuses: `active`, `checked`, `cleared` (bought and cleared, kept for undo and so the plan is not re-added) and
  `have` ("har hjemme": unticked in the review, kept so that day is never asked about twice).
- Generation compares plan and rows (`planGeneration`, pure) and returns four lists: review (days never seen), add
  (new ingredients on reviewed days), update (amount changed, unticked only) and remove (unticked rows of removed or
  swapped dishes). Ticked and cleared rows are never touched. A second run returns an empty plan.
- Ingredient rows are inserted before anything is removed, so a failure never leaves the list emptier than it was.
- Concurrent edits: the latest write wins per row (`client_updated_at`); Realtime refetches the list on any change.

## Display conversion (2026-11, Idé 13)

- Rows still hold the recipe's scaled amount; nothing about storage or `planGeneration` changed, so generating twice
  still changes nothing and the item sheet can show the original amounts.
- Lines now merge by ingredient, not by canonical name plus unit family: `ingredientFor` (`lib/shopping/purchase.ts`)
  finds the entry in `lib/shopping/ingredients-dk.ts` across name variants ("store tomater" = "tomater"; "rødløg" stays
  apart from "løg"). Each row is converted to the ingredient's base measure (g, ml or stk), the rows are summed, and the
  total is rounded once to a purchase amount (whole pieces, whole packages, or 100 g steps). Unknown ingredients merge
  as before (name plus unit family) and are rounded up in their own unit.
- Pantry basics are a display group, "Tjek at I har", collapsed and left out of the counts. They are still rows, so they
  can be ticked like any line. This is a reminder, not an inventory (D8 holds).
- A unit chosen in the item sheet is stored per household and ingredient in `sp_unit_preferences` and applied on display
  only. It is read with the list and cached for offline use; changing it needs a connection.

## Consequences

- Good: repeatable generation, exact removal, no lost ticks, honest "from which dish" text.
- Drawback: `cleared` rows accumulate (a household's few hundred a year); a later clean-up job can delete old ones.
- Drawback: a plan row has no link to the recipe ingredient it came from, so it is matched by name and unit family; renaming an ingredient in a recipe shows up as one removal plus one addition.
- Offline queueing (ADR-09, slice 1.8) builds on the same rows.
