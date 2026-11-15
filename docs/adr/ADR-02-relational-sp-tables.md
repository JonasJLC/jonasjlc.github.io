# ADR-02: Relational `sp_` tables instead of one JSON document

Status: accepted, 2026-11-15 (slice 0.5). Covers design D27.

## Context

`/ferie` stores its whole state in one `jsonb` row (`ferie_state`, about 1 MB cap, last write wins with a version
number). Strandparken holds recipes, ingredients, a meal plan, a shopping list that two people edit at once, images,
documents, usage logs and later health data. It must answer queries ("what is planned this week", "which items are
unchecked") and sync single rows live.

## Options

1. **One JSON document per household**, as in `/ferie`. Simple and already understood, but the size cap, whole-document
   conflicts and no per-row security or realtime make shopping and images unworkable.
2. **One table per entity in `public`, prefixed `sp_`.** Needs migrations and policies per table, but gives queries,
   per-row realtime and per-row constraints.
3. **A separate Postgres schema (`strandparken`).** Cleaner namespace, but it must be exposed in the API settings, a
   shared-project change that affects `/ferie`.

## Decision

Option 2.

- Every table is `sp_<entity>` with a `household_id`, row-level security for members of that household only, and an
  audit trigger (`private.sp_touch()`) that sets `created_by` and `updated_at` from the session.
- Composite foreign keys `(id, household_id)` stop a row from pointing at another household's data. Optional
  references use `on delete set null (col)`.
- Images and documents live in private storage buckets (`sp-recipes`, `sp-documents`) under `<household_id>/...`.
- Realtime only where two people edit at once (`sp_shopping_items`, `sp_meal_plan_entries`), with `replica identity full`.
- Types come from the live schema (`src/lib/supabase/database.types.ts`) and are regenerated after each migration.

## Consequences

- Good: single-row conflicts instead of whole-document ones; queries and constraints in the database; room for images.
- Drawback: more migrations and policies to keep correct. The policy test (`supabase/tests/strandparken_policies.sql`,
  46 checks) must run after every schema change, and tables must be added to its loop.
- Drawback: the `public` namespace is shared with `/ferie`; the `sp_` prefix is the only separation.
- No data is migrated from `/ferie`; the two apps do not share tables beyond households and members.

## How this is checked

- Rolled-back SQL tests for isolation, forged `created_by`, cross-household references, one dish per plan entry and
  storage folder rules.
- Supabase advisors are run after each migration.
