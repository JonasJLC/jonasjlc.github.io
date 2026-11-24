# Strandparken backlog

Things found or deferred while building, outside the delivery plan in the design spec §8. Newest first. Remove an item when it ships.

## Before first real use

- **Try `recipe-import` on more pages.** It has been used in production: 4 recipes saved (3 from links), 4 model calls (2 screenshot or vision calls on `claude-sonnet-5-5`, 2 on `claude-haiku-5-5`), no errors, 0.44 kr. in total as of 24 Nov. Still untested: a page without schema.org data, and a pasted social caption. Spike R7 (cost and quality on 20 real imports) is still open.
- **Try `meal-suggest` (2.2):** `Foreslå ret` on an empty day with a few recipes saved. It had never been called in production as of 24 Nov; the structured-output schema (an enum of candidate ids) has only run against test doubles. Neither person has filled in a profile (dislikes, preferences) yet.
- **Set a spend limit in the Anthropic console** as the backstop that ADR-07 recommends.
- **Try the app on both phones** (sign-in, tick sync, review sheets). As of 24 Nov all 16 shopping rows were written by one person, so live sync between two phones has not been seen yet.

## Done

- **Migration history repaired (24 Nov).** Production had recorded the migrations under the versions the dashboard tool gave them, and `claim_only_verified_emails` was applied but never recorded. Each recorded migration was compared with its file (identical apart from comments). The files were then renamed to the production versions, and the missing history row was added. `supabase db push` now sees nothing to apply. `apply_migration` (dashboard or MCP) gives a migration its own version: rename the file to that version afterwards, or apply new migrations with `supabase db push` instead.
- **Policy tests run against production (24 Nov):** `strandparken_policies.sql` 55/55, `strandparken_ai_usage.sql` 14/14, `claim_only_verified_emails.sql` 4/4. Every test ran inside a transaction that was rolled back, and no test rows remained afterwards. The database advisor reports only two items: `feature_chat_calls` has RLS on and no policies, which is intended because only the service role uses it; and leaked-password protection is off, which matters only if email sign-up is enabled (`supabase/config.toml` disables it).

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
