# ADR-01: Reuse the /ferie stack and household model

Status: accepted, 2026-11-15 (Phase 0). Covers design D1.

## Context

Strandparken is a private app for two people (Jonas and Camilla). `/ferie` already runs on this site with Astro, a React
island, Tailwind, shadcn/ui, Supabase and Google sign-in, and both people already belong to its household.

## Options

1. **A separate project** (own repository, host and Supabase project). Clean isolation, but a second deploy, a second
   sign-in and a second household to keep in step, for two users.
2. **Same site, same Supabase project, same household.** One deploy, one login, one invite model. The apps share a
   database and must stay apart through naming and policies.
3. **A different stack** (for example a native or Next.js app). More freedom, but nothing is reused and the site's static
   hosting is lost.

## Decision

Option 2.

- `/strandparken/` is an Astro page with a React island, built like `/ferie/`. React, Tailwind and shadcn/ui stay confined
  to these two routes (see `CLAUDE.md`).
- One shared sign-in and client in `src/lib/supabase/`. `/ferie` keeps its implicit flow; Strandparken uses PKCE
  (`?code=`), because its `#view` hash routing would collide with a token in the URL fragment.
- The same `households` / `household_members` tables. `household_members.person` (`a` = Camilla, `b` = Jonas) tells the
  two people apart; `is_owner` already existed.
- Edge functions run on Supabase (Deno) with their own token check (`_shared/guard.ts`).

## Consequences

- Good: no new hosting, one login, and Strandparken needs no sign-up or invite flow of its own.
- Drawback: both apps share one Supabase project, so a bad migration or a leaked secret affects both. Migrations are
  therefore additive (new `sp_` objects only) and policy-tested before they are applied.
- Drawback: the shared auth module must not change `/ferie` behaviour; its flow type stays a parameter.
- If the household grows beyond these two people, the model (household-scoped policies) already supports it; the UI
  assumes two people (`a` and `b`).

## How this is checked

- `tests/strandparken-access.test.ts` covers the access decision (member, non-member, missing person key).
- `supabase/tests/strandparken_policies.sql` proves a non-member reads and writes nothing.
- The build verifies `dist/ferie/index.html` and `dist/strandparken/index.html`.
