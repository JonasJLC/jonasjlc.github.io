# Strandparken: manual checks (idéer, Nov 2026)

Checks the implementing agents could not do themselves: real phones, sign-in, PWA, visuals, deploys and secrets. They are grouped by plan. Tick them off as you go.

**Where to start next:** plan 11 (Sundhed-fanen), then 12 and 15. Status per plan is in `docs/superpowers/plans/2026-11-24-strandparken-ideer-roadmap.md`.

**Do these first.** Health and calendar features collect nothing until they're done: the Oura app and secrets, the `SP_*` secrets, the health sync cron job (plan 10) and `SP_FEED_KEY` (plan 7). The Deno tests have not been run with real Deno on any plan.

Decisions taken on 2026-11-24: Q1 = A (private iCal feeds); Q2 = build with plan 9's recommendation; Q9 = commit everything (repo stays public).

## Plan 4: Lister tab (commit b983f57)

- [ ] Run the Deno tests: `npx -y deno test --node-modules-dir=none --no-lock --allow-env supabase/functions/create-issue supabase/functions/feature-chat` (both suites pass).
- [ ] Open `/strandparken/` at phone width. The bottom bar reads Hjem, Madplan, Lister, Sundhed, Opskrifter, and Lister shows the list-check icon.
- [ ] Tap Lister. The page title is "Lister", the "Indkøb" segment is selected, and the shopping list shows below it with no second "Indkøb" heading.
- [ ] Switch to "To-do". The address bar shows `#lister/todo`. Refresh: To-do is still selected.
- [ ] Switch segments, then press Back. Back leaves Lister for the previous tab; it does not step back through the segments.
- [ ] Open `#indkob` and `#indkøb` directly. Each opens Lister with Indkøb selected, and the address bar shows `#lister/indkob`.
- [ ] The shopping list works as before: tick, add an item, clear ticked items with undo, remove an item with undo, and the offline line.
- [ ] The browser tab title reads "Lister · Strandparken". After you tap the Lister tab, keyboard focus is on the "Lister" heading. Arrow keys move between the segments, and focus stays on the segment you pick.
- [ ] In Indstillinger › Forslag, the area list shows "Lister". Submit a test wish in the Lister area: the chat describes Lister correctly, and the GitHub issue says "## Område" followed by "Lister". Close or delete the test issue afterwards.

## Plan 9: Health research (commit 2080558, docs/adr/ADR-06-health-integrations.md)

Recommendation: Camilla = Oura API v2 (OAuth, `daily` scope); Jonas = Garmin Personal API (personal key); cycle day = manual in-app period log; no HealthKit bridge.

- [x] Pushed to main as `65ba107` (2026-11-24, on Jonas's go-ahead).
- [ ] Signed in to Garmin Connect, open https://developer.garmin.com/gc-developer-program/personal/swagger-docs/ and confirm there is a daily summary with `steps` and `stepsGoal`, and a sleep summary with an overall sleep score. If not, plan 10 uses the fallback in ADR-06 Decision 2: steps and goal only.
- [ ] Create a Garmin personal API key at https://connect.garmin.com/app/settings/personalApiToken with one-year expiry. Read the terms, and confirm that showing your data to Camilla is OK. Renew the key when Garmin's reminder arrives.
- [ ] Create the Oura API application at https://cloud.ouraring.com/oauth/applications with redirect URI `https://kmytekaexgfqhwxapwbw.supabase.co/functions/v1/health-oauth`. Set `OURA_CLIENT_ID` and `OURA_CLIENT_SECRET` as Supabase function secrets.
- [ ] Generate and set the function secrets `SP_TOKEN_KEY` (32 random bytes, base64), `SP_OAUTH_STATE_KEY` and `SP_CRON_SECRET`. Store `SP_CRON_SECRET` in Vault too, for the cron job.
- [ ] Confirm Camilla's Oura membership is active, and that she agrees to share sleep, activity and steps (cycle stays off by default).
- [ ] Turn on MFA for the Supabase dashboard account (Oura agreement §9(a)).
- [ ] After plan 10 ships: on Camilla's phone, check that Strandparken's activity goal progress matches the Oura app's goal ring within a few percent.
- [ ] Over the first two weeks: both cards show today's sleep score and steps by 09:00 on at least 5 of 7 mornings.

## Plan 3: Drag and drop in Madplan (commit ba33f1d)

- [ ] On both phones (installed PWA): a tap on a planned day opens its sheet, a quick swipe scrolls the page, and a long press (about ⅓ s) lifts the row, slightly larger and with a shadow. No iOS text-selection or image callout appears.
- [ ] Haptic on Android: you feel a short vibration when the row lifts.
- [ ] Haptic on iPhone (iOS 18+), on both iPhones: you feel a light tap when the row lifts, and the keyboard, focus and scroll don't react. If it does not fire reliably, remove the iOS branch in `src/components/strandparken/lib/haptics.ts` and record the gap in `docs/strandparken-backlog.md`.
- [ ] While dragging, the day row under the finger gets a green ring on a light green background.
- [ ] Dropping on an empty day moves the meal, dropping on a planned day swaps the two, and dropping on its own day or outside rows changes nothing.
- [ ] Dragging near the top or bottom edge of the screen scrolls the page.
- [ ] Holding the lifted row over › for about 0.6 s switches to the next week, and holding longer switches again. Dropping there moves the meal into that week, and the URL shows `#madplan/<monday>`. Check ‹ the same way. Test this specifically on iOS: the drag must survive the week switching.
- [ ] After a cross-week move, the ‹ › arrows and "Tilbage til denne uge" still navigate correctly.
- [ ] The other phone shows the move within a few seconds.
- [ ] The toast reads "Flyttet til fredag · Fortryd" (or "Byttet med <titel>"), and Fortryd restores the meal, including after a cross-week move and after a swap.
- [ ] The number of persons and any linked shopping rows stay with the moved meal.
- [ ] In the sheet, "Flyt til…" shows "Uge NN" with ‹ ›. Each day reads "Tom", "Byt med <titel>" or "Her nu" (disabled). Picking a day in another week moves the meal there.
- [ ] Desktop: dragging with the mouse works, and a plain click opens the sheet.
- [ ] Keyboard: Tab to a row; Enter opens the sheet; Space lifts it; arrow up and down move one day; Space drops; Escape cancels. The sheet must not open after a drop.
- [ ] VoiceOver: hear the Danish announcements ("Løftede Lasagne fra tirsdag", "Over fredag", "Flyttet til fredag", "Annulleret").
- [ ] With reduced motion on, the lifted row has its shadow but is not scaled.
- [ ] Today's ring and the "I dag" badge still look correct when you are not dragging.

## Plan 1: Dish photo on link import (commits bbb2e6c, d1e3153)

- [ ] Confirm `recipe-import` and `recipe-image` are deployed (Supabase dashboard → Edge Functions), and that `recipe-image` has verify_jwt off, as in `config.toml`. Any redeploy of either must include `_shared/fetch.ts`: `supabase functions deploy recipe-import recipe-image`.
- [ ] Run the Deno tests for the moved fetch helper: `deno test --node-modules-dir=none --no-lock --allow-env supabase/functions`.
- [ ] On a phone, import a recipe from a page with JSON-LD (a Danish food site). The recipe opens at once showing "Henter billede…", and the photo appears within seconds.
- [ ] Import a page that has only `og:image`. The photo arrives the same way.
- [ ] Import a page with no image. The recipe saves without one, and no error shows.
- [ ] The Opskrifter grid, the Madplan rows, the DaySheet pickers and "I aften" load the thumbnail, about 40 kB or less in the network tab.
- [ ] On the recipe page, replace the photo from the camera, then from the library. Remove it, and check that Fortryd restores it.
- [ ] Open Opskrifter once: an existing recipe with a web link and no photo gets one. Visit a second time: a page with no image is not retried.
- [ ] Check "Henter billede…" and the photo buttons with VoiceOver, keyboard focus and reduced motion.
- [ ] Optional cleanup: delete the local branch `sp01-duplicate-backup`.

## Plan 2: Dish placeholder (commit 9d79650)

- [ ] Opskrifter grid at 390 px width with about six recipes without a photo: each card shows a soft coloured tile with a food icon, not a letter, and neighbouring cards usually differ.
- [ ] A recipe tagged `fisk` shows a light-blue tile with a fish, even in category Aftensmad. An untagged Aftensmad recipe shows a peach tile with cutlery.
- [ ] A recipe without a photo shows the same tile in its hero, with a larger icon.
- [ ] In Madplan, rows for recipes, ideas and free text ("Rester", "Takeaway", own text) all show tiles, and a dish shows the same tile as on Opskrifter and Hjem.
- [ ] In Madplan, a dragged dish without a photo shows the same tile in the lifted row.
- [ ] DaySheet: the recipe and idea pickers and the planned-day header show the tiles.
- [ ] Hjem: I aften and "Resten af ugen" show the tiles.
- [ ] In the recipe editor and idea sheet, changing the category or adding a tag (e.g. `pasta`) updates the preview tile right away.
- [ ] A broken photo URL falls back to the tile, and a photo still being fetched shows a readable "Henter billede…" on the tile.
- [ ] Check the eight tones by eye on both phones (soft and fitting the palette). Tune them only in `strandparken.css`, and keep the contrast test green.
- [ ] Check the dev gallery's "Pladsholdere" section: all eight tones in sizes 52, 56 and 64, plus cover.

## Plan 5: To-do under Lister (commits 8f4355f, 5a4f75c; migration 20261124101356 applied; feature-chat v5)

- [ ] At `#lister/todo` on a phone: type a title and press Enter. It appears under "Når der er tid" with the CJ (honey) avatar, and the field clears and keeps focus.
- [ ] Select only the "Jonas" chip: "Nye to-dos: Jonas" appears, and new to-dos get J. With no chips or two chips selected, new to-dos are Fælles.
- [ ] Filter chips narrow the list, and several combine. A filter that hides every open to-do shows "Ingen åbne to-dos her."
- [ ] Tap a row (not the checkbox) to open the sheet. Edit title, owner, date ("Fjern dato") and note, then "Gem". A blank title shows "Skriv hvad der skal gøres."
- [ ] A dated to-do moves to "Snart", sorted by date. Labels read "i dag", "i morgen", a weekday within six days, otherwise "30. nov". A past date shows in brown, not red.
- [ ] Ticking moves a to-do to "Klaret" (collapsed, "Vis klarede (n)"), and unticking brings it back. The other phone updates within seconds, and `completed_by` is the person who ticked it.
- [ ] Swiping left past about 80 px deletes with a "To-do slettet." toast, and "Fortryd" restores it on both phones. A short swipe snaps back, and vertical scrolling is unaffected.
- [ ] "Slet" in the sheet deletes with the same undo toast.
- [ ] With reduced motion on, a deleted row disappears without sliding out.
- [ ] Keyboard: Space toggles the checkbox, Enter on the row opens the sheet. VoiceOver reads an overdue date as "Forfalden: …" and the CJ avatar as "Fælles".
- [ ] Loading shows "Henter to-dos …". Offline shows "To-do-listen kunne ikke hentes." with "Prøv igen". A failed change rolls back with "Det lykkedes ikke. Prøv igen."
- [ ] Hjem shows no to-dos, and Lister › Indkøb still works with the segment kept in the URL.
- [ ] In Forslag, ask about Lister. The chat mentions both the shopping list and the to-do list.
- [ ] Run the Deno tests: `deno test supabase/functions/feature-chat/`.

## Plan 13: Realistic shopping amounts (commits dae4163, a68ed21; migration 20261124110001 applied)

- [ ] In Madplan, plan a week with real recipes (lime, tun, tortillas, creme fraiche, kartofler, salt/peber/olie), press `Lav indkøbsliste`, and open Lister › Indkøb. There are no fractions or spoon amounts: "2 stk" lime, "1 dåse" tun, "1 pakke" tortillas, "700 g" kartofler.
- [ ] Salt, peber and olie sit in the collapsed "Tjek at I har · N" group at the bottom. It opens and closes by keyboard and screen reader (`aria-expanded`). Its lines show the name only, can be ticked, and don't change "x af y varer er købt".
- [ ] Plurals read correctly: "2 dåser", "2 bægre".
- [ ] "store tomater" and "tomater" merge into one "Tomater" line, while "Rødløg" and "Løg" stay separate.
- [ ] The recipe page still shows exact amounts ("1½ lime").
- [ ] Pressing `Lav indkøbsliste` again changes nothing.
- [ ] Tap a line. The sheet shows the purchase amount, a "Til" section ("Quesadillas · Tor · 1½ lime"; manual items say "Tilføjet i hånden"), the Enhed chips, category chips and "Fjern fra listen".
- [ ] Change tomatoes to "Stk" on phone A: it updates at once. After a reload, phone B shows the same, and next week's tomatoes use stk too. "Standard" clears it.
- [ ] Offline with the app open: ticking works, and changing a unit shows "Enheden kan kun ændres, når der er forbindelse."
- [ ] At narrow width the Enhed chips wrap, with no horizontal scroll.
- [ ] No console errors on Lister › Indkøb.

## Plan 6: Hjem header and I aften (commit afd9718)

- [ ] Run `pnpm exec astro preview` and open `/strandparken/` at 390 × 844 and at 360 × 740. The header and I aften take well under half the screen, with no horizontal scroll.
- [ ] The header shows the date (e.g. "Tirsdag 24. november"), the greeting with your first name, and both avatars at the right, the other person's behind and yours in front.
- [ ] Tapping your own avatar opens Indstillinger, on both phones. Tapping the other person's avatar does nothing.
- [ ] With a recipe planned today, the card shows its thumbnail or placeholder, the name, "NN min · N pers." and a chevron, and tapping it opens the recipe.
- [ ] With an idea or free text ("Takeaway") planned today, tapping the card opens today's Madplan day sheet.
- [ ] With nothing planned, the dashed card says "Der er ikke planlagt noget til <ugedag> endnu.". `Planlæg i aften` opens today's day sheet, and closing it leaves `#madplan` in the address bar. Back returns to Hjem without reopening the sheet. `Vælg fra opskrifter` opens Opskrifter.
- [ ] Open `#madplan/<a date in another week>/dag` directly. That week shows with the day sheet open, and closing it leaves `#madplan/<monday>`.
- [ ] Hjem shows no "Resten af ugen" or week overview.
- [ ] At 6:00, 12:00 and 20:00 the greeting reads Godmorgen, Goddag and Godaften.
- [ ] Keyboard: Tab reaches the settings avatar, then the I aften card as one stop, with the focus ring following the rounded corners. Opening the day sheet keeps focus inside the sheet.
- [ ] VoiceOver reads the avatar as "Indstillinger" and the card as one link, "I aften: <navn>, NN min, N personer". If the pair of avatars is confusing, add a visually hidden "Camilla og Jonas".
- [ ] At 130 % text size, a long dish name wraps to two lines, the chevron stays visible and nothing scrolls sideways.
- [ ] Loading ("Henter aftensmad …") is the same height as the card. With the network off, the error card and `Prøv igen` work.

## Plan 8: Mangler at handle on Hjem (commit ff63e16)

- [ ] Plan recipes for tonight and tomorrow, run `Lav indkøbsliste`, then open Hjem. "Mangler at handle" sits below "I aften". "Til i aften" shows a count and up to 3 names, then "+ N mere", and "Til i morgen · <recipe>" shows a count. Counts match Indkøb, without pantry basics.
- [ ] Ticking an item for tonight on the other phone updates Hjem within seconds.
- [ ] With everything for tonight ticked, the line reads "Klar til i aften" with a green check.
- [ ] Removing tomorrow's meal hides the tomorrow line. With nothing planned today or tomorrow (or only free text or ideas), the section is gone.
- [ ] A recipe planned tonight without `Lav indkøbsliste` reads "Ikke på listen endnu".
- [ ] Manual items and items added with `Læg på indkøbslisten` never appear in the card.
- [ ] Tapping the card opens `#lister/indkob?for=…` with only those meals' items and the banner "Viser varer til i aften og i morgen". `Vis alle` shows everything, and Back returns to Hjem.
- [ ] While filtered, adding an item shows "Tilføjet – vises under Vis alle".
- [ ] Day tags in Indkøb: "Lør", "I dag", "27/11" for more than 6 days out, and no tag on manual items. Moving the meal updates the tag live.
- [ ] Offline with the app open: Hjem shows the cached list, and ticks made in Indkøb show on Hjem.
- [ ] Visual at 390 × 844: the card matches mockup image3, the day-tag pill matches image4, the dashboard fits about one screen, and long titles truncate cleanly.
- [ ] Screen reader: the card reads as one link ("Mangler at handle: til i aften 2 varer, lime og avocado. …").
- [ ] Realtime regression (shared channel): go Hjem → Madplan → Indkøb → Hjem, and check that live updates from the other phone still arrive on each screen (meal plan, shopping, to-do).

## Plan 14: Compact shopping list layout (commits ade17c7, 9dec56b)

- [ ] Run `pnpm exec astro preview` and open `#lister/indkob` at 390 × 844. A typical week (about 9 items in 3 categories) fits above the bottom bar without scrolling. Repeat at 360 × 740.
- [ ] The "Lister" title (24 px) and "x af y købt" share a line. Decide whether 24 px looks too small. If so, add a 26 px `sp-title-list` utility in `strandparken.css`.
- [ ] A thin progress bar sits under the segmented control, then the add field. It is hidden when the list is empty. With To-do selected there is no count and no bar.
- [ ] Category headings have a tinted icon tile, and the colours look calm. Amount pills use the category colour; pantry and bare manual items have no pill. Day tags still show.
- [ ] Tick a row: it stays struck through for about 3 s, then moves into "Købt · n" (collapsed). Unticking within 3 s keeps it in place. Unticking inside Købt returns it to its category. "Ryd afkrydsede" inside Købt clears it, and Fortryd restores it.
- [ ] Two phones: a tick on phone A moves straight into Købt on phone B.
- [ ] With reduced motion on, nothing animates, and the 3 s delay still applies.
- [ ] At 130 % text size, long names truncate with an ellipsis, the pill never covers the name, and rows grow instead of clipping.
- [ ] VoiceOver announces each check with the item name, the row as "Lime, 2 stk, til torsdag", the bar as "Købt, 3 af 7", and count updates. The Købt and "Tjek at I har" headings announce expanded or collapsed.
- [ ] Tapping a row opens the item sheet (Til, unit picker, category chips). The hint line disappears after the first tap and stays gone after a reload. In a private window it shows again with no error.
- [ ] A renamed or new grocery category gets the neutral basket, and nothing breaks.
- [ ] Offline: the pill shows, ticks queue and are sent when back online, and the `?for=` filter and banner still work.
- [ ] Decide on row height: 48 px is the default; switch to 44 px if a week's list doesn't fit one screen.

## Plan 10: Health data (commits 8df2245, 626f440, 0f69f22, 4796d77; migration 20261124110156 applied; health-sync and health-oauth deployed)

Nothing collects data until the secrets and the cron job exist. This overlaps with the plan 9 setup items above.

- [ ] Set the function secrets. Generate them with `openssl rand -base64 32` (keys) and `openssl rand -hex 32` (cron): `supabase secrets set SP_TOKEN_KEY=… SP_OAUTH_STATE_KEY=… SP_CRON_SECRET=… OURA_CLIENT_ID=… OURA_CLIENT_SECRET=…`
- [ ] Create the Oura app "Strandparken" at https://cloud.ouraring.com/oauth/applications with redirect URI `https://kmytekaexgfqhwxapwbw.supabase.co/functions/v1/health-oauth`.
- [ ] After the secrets exist, create the sync cron job in the SQL editor (the SQL is also in `docs/strandparken-backlog.md`):
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
- [ ] Garmin: confirm the Personal API daily summary path and fields (`steps`, `stepsGoal`) and the sleep score field. If they differ, set the `GARMIN_API_BASE` / `GARMIN_DAILIES_PATH` / `GARMIN_SLEEPS_PATH` secrets or adjust `mapGarmin` in `supabase/functions/_shared/health/garmin.ts`.
- [ ] Run the Deno tests: `deno test --node-modules-dir=none --no-lock --allow-env supabase/functions`.
- [ ] On Camilla's phone: Hjem › avatar › Sundhed › Forbind enheder › Oura › Forbind. The consent switches show Søvn, Aktivitet and Skridt on and Min cyklus off. Tap "Gem og fortsæt til Oura" and approve. You land on Hjem with "Oura er forbundet.", and the card shows "Oura · synk. hh.mm".
- [ ] On Jonas's phone: Garmin › Forbind, paste the key (step goal optional), then "Gem og del". The card shows Forbundet and a sync time. Check `sp_health_connections.last_error` for `garmin_endpoint` or `garmin_shape`.
- [ ] Camilla taps "Første dag i menstruation", and "Fjern" works. Cycle day stays hidden from Jonas while her Min cyklus switch is off.
- [ ] As the other person, inspect the network responses: no tokens, unshared metrics are null and listed in `hidden`, and `sp_health_sources` has no `last_error`.
- [ ] Turn a metric off with "Skift hvad <navn> kan se". It disappears at once for the other person after a reload.
- [ ] Afbryd with "Slet også de hentede data" deletes the connection and that source's rows, and revokes Oura's token.
- [ ] Compare Camilla's activity progress with the Oura goal ring. If it's off, switch to `1 - meters_to_target / target_meters` (ADR-06).
- [ ] Forbind enheder sheet at phone width: focus moves into the nested sheet, switches toggle with Space, the loading, "Prøv igen" and "Forbindelsen er udløbet — forbind igen" states show, and reduced motion stops the switch animation.
- [ ] The `health-sync` and `health-oauth` logs hold only function name, outcome, duration and counts, never values or tokens.
- [ ] In the first two weeks, both cards show today's sleep score and steps by 09:00 on at least 5 of 7 mornings.

## Plan 7: Calendar on Hjem (commits 1b59811, bc2aadc; migration 20261124113343 applied; `calendar` function deployed)

The calendar stays off until `SP_FEED_KEY` is set.

- [ ] Set the feed key: `supabase secrets set SP_FEED_KEY=$(openssl rand -base64 32)`. Never commit it and never change it afterwards: a new key makes every stored address unreadable.
- [ ] Run the Deno tests: `deno test --node-modules-dir=none --no-lock --allow-env supabase/functions`. Calendar, crypto, recipe-import and recipe-image all pass.
- [ ] Jonas adds a private Google calendar and a shared (Fælles) one in Indstillinger › Kalendere › Tilføj kalender. Camilla adds an iCloud (`webcal://`) or Outlook calendar.
- [ ] Jonas's private events never show on Camilla's phone, not even in the `calendar` network response. Shared events show on both phones with "· fælles".
- [ ] The card sits under the header and above "I aften". Left: the weekday in red caps, the date, and the next event or "Ingen flere i dag". Right: "I morgen" with up to two event cards and "+ 1 mere" when there are three.
- [ ] A new event appears within the provider's delay, which can be hours for Google.
- [ ] Tapping the card on iPhone opens the Calendar app at today. On Android or desktop it opens Google Calendar's day view in a new tab.
- [ ] Adding these is refused with a Danish message: a non-calendar URL ("Adressen er ikke en kalender (iCal)."), `https://192.168.1.1/x.ics` ("Appen må ikke hente fra den adresse.") and an `http://` URL ("Adressen skal starte med https:// eller webcal://.").
- [ ] With no calendar, Hjem shows the dashed "Vis jeres kalendere her" card, and `Tilføj kalender` opens the sheet. The "Hvorfor en adresse?" fold-out reads correctly.
- [ ] Toggling Vis or Fælles, or removing a calendar, updates Hjem without a reload, and the other phone follows for shared calendars.
- [ ] At 390 px: the skeleton shows while loading, "Kunne ikke opdatere" shows offline after a load, keyboard focus reaches the card and switches, and VoiceOver reads the card summary ("Kalender: torsdag 19. …").
- [ ] The `calendar` function logs only show lines like `calendar events ok sources=2 stale=0 123ms`, with no URL, host or event title.
- [ ] Optional: watch the function's CPU time on the two real feeds. If one is slow, move the refresh to a `pg_cron` job (see the backlog).

