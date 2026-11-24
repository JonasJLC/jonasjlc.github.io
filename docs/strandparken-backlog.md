# Strandparken backlog

Things found or deferred while building, outside the delivery plan in the design spec §8. Newest first. Remove an item when it ships.

## Before first real use

- **Try Forslag in Strandparken on both phones:** a real chat, the GitHub issue (labels `forslag` and `strandparken`, first name only), the other phone seeing it live, Jonas changing status and replying, and `/ferie/` Forslag still listing only Ferieplan requests.
- **Try `recipe-import` on more pages.** It has been used in production: 4 recipes saved (3 from links), 4 model calls (2 screenshot or vision calls on `claude-sonnet-5-5`, 2 on `claude-haiku-5-5`), no errors, 0.44 kr. in total as of 24 Nov. Still untested: a page without schema.org data, and a pasted social caption. Spike R7 (cost and quality on 20 real imports) is still open.
- **Try `meal-suggest` (2.2):** `Foreslå ret` on an empty day with a few recipes saved. It had never been called in production as of 24 Nov; the structured-output schema (an enum of candidate ids) has only run against test doubles. Neither person has filled in a profile (dislikes, preferences) yet.
- **Try Madplan drag and drop on both phones (idea 3):** long press vs. tap vs. scroll, swap, edge auto-scroll, switching week over ‹ ›, undo. The iOS haptic on lift (`lib/haptics.ts`, the iOS 18 `<input switch>` technique) is unverified: keep it only if it fires reliably on both iPhones with no focus or scroll side effects; otherwise remove the iOS branch and record "Haptic on iOS is best effort: not possible in a PWA" under known gaps.
- **Set a spend limit in the Anthropic console** as the backstop that ADR-07 recommends.
- **Turn on health data (idea 10).** Functions and tables are live, but nothing runs until the secrets are set (`SP_TOKEN_KEY`, `SP_OAUTH_STATE_KEY`, `SP_CRON_SECRET`, `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`) and the `sp-health-sync` cron job is created with the cron secret in Vault (SQL below). Then: Camilla connects Oura, Jonas pastes his Garmin key, and both confirm sharing. The job runs at :30 past 05, 06, 17 and 18 UTC and the function acts only when it is 07 or 19 in Copenhagen, so it syncs at 07:30 and 19:30 all year:

  ```sql
  select vault.create_secret('<the SP_CRON_SECRET value>', 'sp_cron_secret');
  select cron.schedule('sp-health-sync', '30 5,6,17,18 * * *', $$
    select net.http_post(
      url := 'https://kmytekaexgfqhwxapwbw.supabase.co/functions/v1/health-sync',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'sp_cron_secret')),
      body := '{"mode":"all","hours":[7,19]}'::jsonb,
      timeout_milliseconds := 60000)
  $$);
  ```
- **Try the app on both phones** (sign-in, tick sync, review sheets). As of 24 Nov all 16 shopping rows were written by one person, so live sync between two phones has not been seen yet.

## Done

- **To-do under Lister (idea 5, 24 Nov).** `sp_todos` migration applied (`20261124101356`), `strandparken_policies.sql` 75/75 against production (rolled back), `feature-chat` prompt updated and redeployed.
- **Forslag in Strandparken (24 Nov).** `feature_requests.app` migration applied (`20261124093354`), `feature-chat` and `create-issue` serve both apps, UI at `#hjem/forslag`. `supabase/tests/feature_requests_app.sql` 15/15 against production (rolled back, no rows left).
- **Migration history repaired (24 Nov).** Production had recorded the migrations under the versions the dashboard tool gave them, and `claim_only_verified_emails` was applied but never recorded. Each recorded migration was compared with its file (identical apart from comments). The files were then renamed to the production versions, and the missing history row was added. `supabase db push` now sees nothing to apply. `apply_migration` (dashboard or MCP) gives a migration its own version: rename the file to that version afterwards, or apply new migrations with `supabase db push` instead.
- **Policy tests run against production (24 Nov):** `strandparken_policies.sql` 55/55, `strandparken_ai_usage.sql` 14/14, `claim_only_verified_emails.sql` 4/4. Every test ran inside a transaction that was rolled back, and no test rows remained afterwards. The database advisor reports only two items: `feature_chat_calls` has RLS on and no policies, which is intended because only the service role uses it; and leaked-password protection is off, which matters only if email sign-up is enabled (`supabase/config.toml` disables it).

## Known gaps in shipped slices

- **To-do has no recurrence (idea 5, roadmap Q3).** Recurring chores are not supported; add a "Gentag" option to a to-do if needed.
- **Completed to-dos older than 30 days stay in `sp_todos`.** They are hidden, not deleted; add a clean-up if the table grows.
- **To-do is online only.** Changes are shown at once and rolled back if they fail; there is no offline queue as Indkøb has (ADR-09). An undone delete of a completed to-do is re-stamped with the restorer and the time of the undo.
- **Forslag chat prompt lists the tabs.** `supabase/functions/feature-chat/logic.ts` (`STRANDPARKEN_SYSTEM`) names the five tabs and what they hold. When navigation or a tab's content changes, update it (and `LISTER_LABEL` in `src/lib/forslag/model.ts` with the matching label in `create-issue/logic.ts` if a tab is renamed), then redeploy the functions. Idea 4 did this on 24 Nov (Lister); idea 5 updated Lister to "indkøbsliste og to-do-liste" on 24 Nov.
- **Forslag AI use is not in `sp_ai_usage` (D48).** It keeps its own per-user limit (40 an hour, 150 a day) and a small model. Revisit only if the cost shows up.
- **Recipe photos from links (Idé 1).** Photo jobs run only while the app is open; an interrupted job is retried by the backfill on the next visit to Opskrifter. A page whose photo cannot be fetched is tried once and then left without one (`image_fetch_attempted_at`); to retry, set the column back to null or add the photo by hand. Image servers that need a referrer or cookies are not reachable.
- **Link import (1.2).** Pages that build their recipe in the browser (no schema.org data, no text in the HTML) come back as `not_a_recipe` and the sheet falls back to pasted text. The fetch resolves the host name and then lets `fetch` resolve it again, so a name that changes its answer between the two lookups is not caught (see `supabase/functions/_shared/fetch.ts`).
- **`Til madplan` (recipe page)** only fills free days in the next 14 days; it does not replace a planned dinner.
- **Idea photos.** A photo removed from a promoted idea's recipe also removes the file the idea still points at; the idea is hidden after promotion, so nothing shows a broken image.
- **Cold start offline (ADR-09, R9).** Without a service worker the app page cannot open with no signal; the list works offline only once the page is open. Add a service worker for the shell if it shows up in use.
- **Stale canonical name.** Renaming an ingredient in the recipe editor keeps its old `canonical_name`; the shopping list computes its own from the name, so nothing breaks today, but nutrition (3.1) will rely on it.
- **Ingredient table (Idé 13).** `lib/shopping/ingredients-dk.ts` covers about 170 common ingredients with typical package sizes. When a line shows a recipe amount (an unknown ingredient) or a wrong package, add or fix the entry there; a household can also correct one line with the unit picker.
- **The "har hjemme" review still lists pantry items (Idé 13).** Salt and pepper are asked about in the review even though the list puts them under "Tjek at I har". A follow-up can pre-untick pantry items in `ReviewSheet.tsx`.
- **Unit preferences are not live (Idé 13).** `sp_unit_preferences` has no realtime; the other phone picks up a changed unit on its next refetch (a shopping change, coming back to the app, or a reload).
- **Cleared shopping rows accumulate (ADR-08).** Add a clean-up that deletes `cleared` rows older than a few months.
- **Shopping category change is online-only** and affects only the rows of that line; it does not teach the guess anything.
- **Phone clocks (ADR-09).** The offline conflict rule assumes the two phones' clocks are within a few seconds.
- **Suggestions (2.2).** The candidate list is built in the app and sent to the function, which checks the answer against it; the function does not read the database itself. Cooked history is the plan entries of the past 90 days (D35). Suggestions are not remembered between visits to the sheet, and the model sees at most 60 candidates (newest first).
- **Category colours for custom categories (Idé 14).** A renamed or new grocery category gets the neutral basket style. A colour and icon picker per category can come later; the map is in `lib/shopping/category-style.ts`.
- **Shopping row height (Idé 14).** Rows are 48 px with a 44 px check target, a little less dense than the mockup. Jonas can approve 44 px rows if a week's list does not fit one screen in practice.
- **`Ryd afkrydsede` lives inside the expanded "Købt" group (Idé 14).** Ticked pantry lines ("Tjek at I har") are cleared with it, but when only pantry lines are ticked there is no Købt group and so no clear button.
- **Recipe items never show in Mangler at handle (Idé 8).** Items added with `Læg på indkøbslisten` from a recipe are not linked to a day, so they never show in Mangler at handle and have no day tag. Only `Lav indkøbsliste` links items to a plan entry.
- **Calendar feeds lag (Idé 7, D57).** Google updates secret iCal feeds with a delay, sometimes hours, so a new event can show late. If that bothers anyone, upgrade to the Google Calendar API, read only (option B in the plan's appendix).
- **Calendar deep links (Idé 7).** On a non-iOS phone the card always opens Google Calendar's web day view, also for Outlook and iCloud calendars.
- **Calendar refresh runs on request (Idé 7).** The `calendar` function fetches a feed when the card asks and the 15-minute cache has run out; there is no scheduled refresh. If a real feed turns out too slow to parse inside a request, move the refresh to a `pg_cron` job and let `events` read only the cache.
- **Husholdning and Økonomi links** are not placed on Hjem until those pages exist (roadmap Q7).
- **Garmin data endpoints (idea 10).** The Personal API's Swagger docs could not be read; the adapter assumes the business Health API paths and field names (`steps`, `stepsGoal`, `overallSleepScore.value`). If a sync records `garmin_endpoint` or `garmin_shape`, set `GARMIN_API_BASE`, `GARMIN_DAILIES_PATH` and `GARMIN_SLEEPS_PATH`, or adjust `mapGarmin`. Without a sleep endpoint Jonas's sleep score stays empty.
- **Health deferred (idea 10).** No Oura webhooks (cron plus app open only); no HealthKit/Shortcuts bridge (`health-ingest` dropped, ADR-06); the Oura activity goal uses `active_calories / target_calories` and has not been compared with the Oura app's ring yet. A refresh that fails after taking the lease holds it for 30 s.
