# Strandparken backlog

Things found or deferred while building, outside the delivery plan in the design spec §8. Newest first. Remove an item when it ships.

## Before first real use

- **Apply and test the profiles migration (2.1).** `supabase/migrations/20261115190000_strandparken_profiles.sql` is written but not applied, and the new cases in `supabase/tests/strandparken_policies.sql` have not been run (no local database here). Apply with `supabase db push`, run the test file, then run the advisors. Until it is applied, Indstillinger shows `Profilen kunne ikke hentes`.

- **Deploy `recipe-import`.** Set `ANTHROPIC_API_KEY` as a function secret, then `supabase functions deploy recipe-import`. Try one pasted caption, one screenshot and one link (a page with schema.org data and one without); the structured-output schema and the page fetch have only run against test doubles (slices 1.6 and 1.2). Spike R7 (cost and quality on 20 real imports) is still open.
- **Deploy `meal-suggest` (2.2).** Same secret as `recipe-import`; then `supabase functions deploy meal-suggest`. Try `Foreslå ret` on an empty day with a few recipes saved. The structured-output schema (an enum of candidate ids) has only run against test doubles.
- **Set a spend limit in the Anthropic console** as the backstop that ADR-07 recommends.
- **Try the app on both phones** (sign-in, tick sync, review sheets). Slices 1.4 to 1.8 have been tested by unit tests and the build only, never in a browser against Supabase.

## Known gaps in shipped slices

- **Link import (1.2).** Pages that build their recipe in the browser (no schema.org data, no text in the HTML) come back as `not_a_recipe` and the sheet falls back to pasted text. The fetch resolves the host name and then lets `fetch` resolve it again, so a name that changes its answer between the two lookups is not caught (see `supabase/functions/recipe-import/fetch.ts`).
- **`Til madplan` (recipe page)** only fills free days in the next 14 days; it does not replace a planned dinner.
- **Idea photos.** A photo removed from a promoted idea's recipe also removes the file the idea still points at; the idea is hidden after promotion, so nothing shows a broken image.
- **Cold start offline (ADR-09, R9).** Without a service worker the app page cannot open with no signal; the list works offline only once the page is open. Add a service worker for the shell if it shows up in use.
- **Stale canonical name.** Renaming an ingredient in the recipe editor keeps its old `canonical_name`; the shopping list computes its own from the name, so nothing breaks today, but nutrition (3.1) will rely on it.
- **Cleared shopping rows accumulate (ADR-08).** Add a clean-up that deletes `cleared` rows older than a few months.
- **Shopping category change is online-only** and affects only the rows of that line; it does not teach the guess anything.
- **Phone clocks (ADR-09).** The offline conflict rule assumes the two phones' clocks are within a few seconds.
- **Suggestions (2.2).** The candidate list is built in the app and sent to the function, which checks the answer against it; the function does not read the database itself. Cooked history is the plan entries of the past 90 days (D35). Suggestions are not remembered between visits to the sheet, and the model sees at most 60 candidates (newest first).
- **Hjem v1 (1.5)** has no tasks, habits or Husholdning and Økonomi links; they come with 4.3.
