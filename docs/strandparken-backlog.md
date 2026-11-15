# Strandparken backlog

Things found or deferred while building, outside the delivery plan in the design spec §8. Newest first. Remove an item when it ships.

## Before first real use

- **Apply and test the profiles migration (2.1).** `supabase/migrations/20261115190000_strandparken_profiles.sql` is written but not applied, and the new cases in `supabase/tests/strandparken_policies.sql` have not been run (no local database here). Apply with `supabase db push`, run the test file, then run the advisors. Until it is applied, Indstillinger shows `Profilen kunne ikke hentes`.

- **Deploy `recipe-import`.** Set `ANTHROPIC_API_KEY` as a function secret, then `supabase functions deploy recipe-import`. Try one pasted caption and one screenshot; the structured-output schema has only run against test doubles (slice 1.6).
- **Set a spend limit in the Anthropic console** as the backstop that ADR-07 recommends.
- **Try the app on both phones** (sign-in, tick sync, review sheets). Slices 1.4 to 1.8 have been tested by unit tests and the build only, never in a browser against Supabase.

## Known gaps in shipped slices

- **Cold start offline (ADR-09, R9).** Without a service worker the app page cannot open with no signal; the list works offline only once the page is open. Add a service worker for the shell if it shows up in use.
- **Recipe page action bar (1.4).** `Læg på indkøbslisten` sits at the bottom of the page, not in the sticky 84 px action bar from the UI spec §5.11. `Tilføj til madplan` (spec §5.3.1) is missing there too.
- **Idea photos (1.7).** The spec allows an optional photo on an idea. Photo upload is tied to recipe ids today.
- **Link import (1.2).** Fetching a web page, schema.org first, AI as fallback, needs spike R7 (cost and quality on 20 real imports). Until then a pasted link is stored as the source and the sheet asks for text.
- **Stale canonical name.** Renaming an ingredient in the recipe editor keeps its old `canonical_name`; the shopping list computes its own from the name, so nothing breaks today, but nutrition (3.1) will rely on it.
- **Cleared shopping rows accumulate (ADR-08).** Add a clean-up that deletes `cleared` rows older than a few months.
- **Shopping category change is online-only** and affects only the rows of that line; it does not teach the guess anything.
- **Phone clocks (ADR-09).** The offline conflict rule assumes the two phones' clocks are within a few seconds.
- **Hjem v1 (1.5)** has no tasks, habits or Husholdning and Økonomi links; they come with 4.3.
