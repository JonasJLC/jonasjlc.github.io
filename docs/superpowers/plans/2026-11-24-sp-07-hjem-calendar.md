# Strandparken Idé 7: Kalender på Hjem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only calendar widget to Hjem, under the header and above "I aften". It shows today's next event and up to two of tomorrow's events. Each person chooses which of their calendars are shown, and a calendar marked "Fælles" shows on both dashboards.

**Architecture (option A, private iCal feeds):** Each person adds the secret iCal (ICS) address of a calendar in Indstillinger › Kalendere. The address is sent once to an edge function, `calendar`, which test-fetches it, encrypts it with AES-GCM and stores the ciphertext in `private.sp_calendar_feeds`. The browser never sees the address again. Calendar metadata (label, colour, Fælles, enabled) lives in `public.sp_calendar_sources`. Row-level security there lets the owner see all of their own calendars and the other person see only the shared ones. The widget calls `calendar` with `action: 'events'`. The function decrypts the feeds the caller may see, fetches each one through the hardened fetch from `recipe-import`, parses it with `ical.js`, expands only today and tomorrow (Europe/Copenhagen, D53), caches the result per feed for 15 minutes, and returns plain events. The app never creates or edits events.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 7. Mockup: `image3.png`, the calendar card at the top of the dashboard.

**Depends on:** Idé 6 (header and Hjem slots).

**Supersedes:** main spec §1.3 ("No two-way Google Calendar sync") is unchanged; this adds a read path the spec did not have. Adds a `calendar` row to §4.4. Interacts with D37 / slice 2.3 (Madplan written to a Google calendar; not built). If 2.3 is built later, its "Madplan" calendar can be added here as a shared feed like any other.

**Status:** ✅ Implemented 2026-11-24 with Q1 = A (private iCal feeds) (commits 1b59811, bc2aadc). Manual checks: `docs/strandparken-manual-checks.md`. Part of the [roadmap](2026-11-24-strandparken-ideer-roadmap.md) (Q1).

---

## Decision gate (roadmap Q1) — ask Jonas before Task 1

Strandparken is a PWA, not an iOS-native app. A web page has no access to EventKit, so "read events from the device's calendars" cannot be built. The source document says: *"If the app is not iOS-native, tell me before choosing another approach (e.g. Google Calendar API)."* Present the three options from roadmap Q1 (A: private iCal feeds, recommended; B: Google Calendar API read-only; C: native wrapper) and wait for the answer. This plan is written for **A**. The appendix lists what changes under **B**.

What A means for the people using it, said plainly in the settings screen: each calendar is added once by pasting its secret address. Google updates these feeds with a delay, sometimes hours, so a just-created event can show late. Anyone holding the address can read that calendar, so it is stored encrypted and never shown again.

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Calendar code | None. D37/slice 2.3 (write Madplan to Google) is not built; no Google OAuth beyond sign-in. | Nothing to reuse or break. |
| Hardened fetch | `supabase/functions/recipe-import/fetch.ts`: `checkUrl`, `isPrivateAddress`, `assertPublic`, `MAX_BYTES` 2 MB, `MAX_REDIRECTS` 3, `TIMEOUT_MS` 8 s; `fetchPage` refuses anything that is not HTML/XML (`not_html`). | Generalise it into `_shared/fetch.ts` with the accepted types and size limit as options; `fetchPage` stays as a wrapper. If Idé 1 has already done this, reuse it. |
| Function guard | `_shared/guard.ts`: `handler({ fn, schema, run })` gives `caller.{ userId, householdId, person, isOwner }`; errors are logged by class only. | `calendar` uses it. It also needs a service-role client for the `private` schema, built the way `create-issue` builds `admin`. |
| Person-level RLS | `sp_profiles` policies match `household_members.person` to the row's `person`. | `sp_calendar_sources` uses the same shape, plus a shared-read policy. |
| Settings | One `Indstillinger` sheet with `ProfileSection`. | Add a `Kalendere` section that opens its own sheet. |
| Tokens | `--sp-danger` `#7A2A16` passes 4.5:1 on surface. | Use it for the red weekday caps. Calendar colours are a small token palette. |

---

## Files

**Create**

| File | Purpose | Task |
|---|---|---|
| `supabase/migrations/20261124170000_strandparken_calendar.sql` | Tables, RLS, cache. | 1 |
| `supabase/functions/_shared/fetch.ts` | Hardened fetch, generalised from `recipe-import/fetch.ts`. | 2 |
| `supabase/functions/_shared/crypto.ts` (+ `.test.ts`) | `seal(text)` / `open(cipher)` with AES-GCM, key from `SP_FEED_KEY`. | 3 |
| `supabase/functions/calendar/index.ts`, `logic.ts`, `logic.test.ts`, `fixtures/*.ics` | The function: `add`, `events`. | 4, 5 |
| `src/components/strandparken/lib/calendar/model.ts` | Pure: window, next event, "+ N mere", time labels, iOS detection, deep links. | 6 |
| `src/components/strandparken/lib/calendar/repo.ts`, `use-calendar.ts` | Load sources, add/remove/update, fetch events. | 7 |
| `src/components/strandparken/settings/CalendarSettings.tsx` | Indstillinger › Kalendere. | 8 |
| `src/components/strandparken/home/CalendarCard.tsx` | The widget. | 9 |
| `tests/strandparken-calendar.test.ts` | Tests for `lib/calendar/model.ts`. | 6 |

**Modify**

| File | Change | Task |
|---|---|---|
| `supabase/functions/recipe-import/fetch.ts` | Re-export from `_shared/fetch.ts`; behaviour unchanged (its tests must still pass). | 2 |
| `supabase/config.toml` | `[functions.calendar] verify_jwt = false`, with a comment naming `SP_FEED_KEY`. | 4 |
| `supabase/tests/strandparken_policies.sql` | Cases below. | 1 |
| `src/lib/supabase/database.types.ts` | Regenerated. | 1 |
| `src/styles/strandparken.css`, `tests/strandparken-contrast.test.mjs` | Calendar colour tokens (`--sp-cal-1…6` with `-tint`/`-ink`). | 8 |
| `shell/views.tsx`, `settings/…` | Slot the card on Hjem; link Kalendere from Indstillinger. | 8, 9 |
| Specs, backlog | See Task 10. | 10 |

---

## Data changes

`supabase/migrations/20261124170000_strandparken_calendar.sql` (use the real timestamp at build time):

```sql
create table public.sp_calendar_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  person text not null check (person in ('a', 'b')),
  label text not null check (length(btrim(label)) between 1 and 60),
  color text not null check (color in ('cal-1','cal-2','cal-3','cal-4','cal-5','cal-6')), -- a token key, never a hex value
  shared boolean not null default false,          -- "Fælles": shown on both dashboards
  enabled boolean not null default true,
  position integer not null default 0,
  last_fetched_at timestamptz,
  last_error text check (last_error is null or last_error in ('fetch_failed','blocked','too_large','not_calendar','parse_failed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (id, household_id)
);
-- RLS: owner reads and writes own rows (person = own household_members.person, same shape as sp_profiles);
--      a member reads the other person's rows only where shared = true. No insert grant: rows are created by the
--      function together with the feed, so a source can never exist without its secret. update (label, color,
--      shared, enabled, position) and delete for the owner only.
create trigger sp_calendar_sources_touch before insert or update on public.sp_calendar_sources
  for each row execute function private.sp_touch();

create table private.sp_calendar_feeds (
  source_id uuid primary key references public.sp_calendar_sources (id) on delete cascade,
  url_cipher text not null,                       -- base64(iv || AES-GCM ciphertext); key in SP_FEED_KEY
  cached_events jsonb,                            -- events in the cached window only
  cached_for date,                                -- the Copenhagen date the cache was built for
  cached_at timestamptz
);
revoke all on private.sp_calendar_feeds from public, anon, authenticated;
```

Deleting a source (owner, through RLS) cascades to its feed and cache. No realtime: the widget fetches on open.

Policy-test cases (add a second member to household T1 so "the other person" exists):
- owner reads own private and shared rows; the other member reads the shared row only and not the private one;
- the other member cannot update or delete the owner's shared row;
- a non-member reads nothing;
- `authenticated` cannot select from `private.sp_calendar_feeds`;
- insert into `sp_calendar_sources` from the browser is refused.

---

## Tasks

### Task 1: Migration and policy tests
- [ ] Write the policy cases first in `supabase/tests/strandparken_policies.sql`, then the migration. Apply it through the dashboard or MCP `apply_migration` (roadmap: no `db push`), run the policy file, regenerate `database.types.ts`.

### Task 2: Shared hardened fetch
- [ ] Move `checkUrl`, `assertPublic`, `isPrivateAddress`, redirect handling and the capped body reader into `_shared/fetch.ts` as `fetchPublic(url, { accept, types: RegExp, maxBytes, deps })`.
- [ ] `fetchPage` becomes `fetchPublic(url, { accept: 'text/html,…', types: /html|xml/i, maxBytes: 2_000_000 })`. All `recipe-import` tests pass unchanged.
- [ ] Calendar profile: `webcal://` rewritten to `https://`, `Accept: text/calendar`, types `/calendar|text\/plain|octet-stream/i` (some providers serve ICS as `text/plain`), `maxBytes` 5 MB. Then check that the body starts with `BEGIN:VCALENDAR`, else `not_calendar`.

### Task 3: Feed encryption
- [ ] Deno tests: `open(await seal(x)) === x`; tampered ciphertext throws; a missing `SP_FEED_KEY` gives a 503 `not_configured`.
- [ ] Implement with Web Crypto AES-GCM, a 12-byte random IV and a 32-byte base64 key from `SP_FEED_KEY` (`supabase secrets set SP_FEED_KEY=$(openssl rand -base64 32)`; never committed). Supabase Vault is the alternative; it adds SQL `security definer` functions, so it is not the default.

### Task 4: `calendar` function: `add`
- [ ] Input (zod, discriminated on `action`): `{ action: 'add', url, label, color, shared }`.
- [ ] Steps: fetch with the calendar profile, parse once (proves it is a calendar), insert the `sp_calendar_sources` row for `caller.person` and the sealed feed with the service-role client in one go (delete the source if the feed insert fails). Return the source row without the URL. Errors map to Danish copy in the client: `fetch_failed` → "Kalenderen kunne ikke hentes. Tjek adressen.", `not_calendar` → "Adressen er ikke en kalender (iCal).".
- [ ] Logs: function name, outcome and duration only. Never the URL, event titles or hosts.

### Task 5: `calendar` function: `events`
- [ ] Input `{ action: 'events' }`. Sources = the caller's enabled rows plus the other person's rows with `shared and enabled`.
- [ ] Per source: if `cached_for` = today (Copenhagen) and `cached_at` is under 15 minutes old, use `cached_events`. Otherwise decrypt, fetch, parse, expand, store the cache and `last_fetched_at` / `last_error`. Fetch sources in parallel with a 10-second overall budget. A failed source returns its last cache, marked `stale: true`, and never fails the whole response.
- [ ] Parsing with `npm:ical.js` (Mozilla's parser; pin the current 2.x at build time). It handles RRULE, EXDATE, RECURRENCE-ID overrides and VTIMEZONE, and these feeds use all four. Expand only `[today 00:00, day after tomorrow 00:00)` in Europe/Copenhagen. Edge functions have a small CPU budget per request, and a Google feed can hold years of history. Before parsing, skip VEVENT blocks with no RRULE whose DTEND is before the window (a cheap text pre-filter), and measure parse time on the two real feeds during Task 5. If it is too slow, move the refresh to a `pg_cron` job and let `events` read only the cache.
- [ ] Output, sorted by start: `{ sourceId, title, start, end, allDay, color, shared, mine, stale }`. Titles are clipped to 120 characters. Locations and descriptions are not returned.
- [ ] Deno tests with fixtures: a single event, a weekly RRULE with one EXDATE, a moved occurrence (RECURRENCE-ID), an all-day event, an event crossing midnight, a feed in UTC and one with a VTIMEZONE, the DST change at the end of October, and a feed that is not a calendar. Tests for the cache rule and for "other person's private calendar is never fetched".

### Task 6: Pure widget logic
- [ ] Tests first in `tests/strandparken-calendar.test.ts`:
  - `nextToday(events, now)`: the first timed event of today that has not ended; if none but there are all-day events today, the first all-day one ("Hele dagen"); else `null` → "Ingen flere i dag";
  - `tomorrow(events, today)`: all-day events first, then by start; `{ shown: first 2, more: N }` → "+ N mere";
  - `timeRange(e)`: "09.30 – 10.00" (Danish dots), "Hele dagen";
  - `label(e)`: appends " · fælles" for shared events;
  - `isIos(ua)`: iPhone, iPad (including iPadOS reporting as Mac with touch), and false for Android and desktop;
  - `calshowSeconds(iso)`: seconds from 2001-01-01T00:00:00Z to that date's local midnight in Europe/Copenhagen;
  - `dayLink(iso, ua)`: `calshow:<seconds>` on iOS, else `https://calendar.google.com/calendar/r/day/YYYY/MM/DD`.
- [ ] Implement `lib/calendar/model.ts`.

### Task 7: Client data
- [ ] `repo.ts`: `loadSources()` (RLS gives own plus shared), `addSource(input)` (function `add`), `updateSource(id, patch)`, `removeSource(id)`, `loadEvents()` (function `events`).
- [ ] `use-calendar.ts`: load on Hjem open and on `visibilitychange` back to visible, at most once a minute. Keep the last result in `localStorage` per household so the card has something to show at once (mark it as old if it is from a previous day; main spec §4.6 freshness).

### Task 8: Indstillinger › Kalendere
- [ ] A `Kalendere` row in the settings sheet opens a sheet with the person's own calendars (label, colour dot, Fælles switch, Vis switch, last updated, error line) and the other person's shared calendars, read-only and labelled "Fra Camilla".
- [ ] `Tilføj kalender`: fields `Navn`, `Hemmelig iCal-adresse` (paste, `inputmode="url"`), colour chips (six tokens), `Fælles` switch with the hint "Vises også på {andens navn}s forside". A short explanation, in a fold-out: "Strandparken er en webapp og kan ikke læse kalenderne på telefonen. I stedet indsætter du kalenderens hemmelige adresse. Google: Indstillinger › kalenderen › 'Hemmelig adresse i iCal-format'. Outlook: Kalender › Del › Publicer. iCloud: Del kalender › Offentlig kalender. Adressen gemmes krypteret og vises ikke igen. Nye aftaler kan være et par timer om at dukke op."
- [ ] First time on Hjem without any calendar: the card shows "Vis jeres kalendere her" with `Tilføj kalender`, and explains why in one sentence. This replaces the "ask for permission" step, which has no web equivalent.
- [ ] Colour tokens `--sp-cal-1…6` (bar colour) with `-tint` and `-ink` pairs in `strandparken.css`. Add each `ink`-on-`tint` pair to the contrast test.

### Task 9: The widget
- [ ] `home/CalendarCard.tsx` per `image3.png`: one white card in two columns. Left: weekday in caps (`--sp-danger`, `sp-caption` 600, letter-spaced), the date as `sp-stat-lg`, then the next event today (title and time) or "Ingen flere i dag". Right: "I morgen" (`sp-body-strong`), up to two small cards with a 3 px left bar in the calendar colour on its tint, the title (`sp-small` 600, one line, ellipsis) and the time (`sp-caption`), then "+ N mere".
- [ ] The whole card is one link to `dayLink(today)`. The accessible name summarises it: "Kalender: torsdag 19. Ingen flere i dag. I morgen: Tandlæge 09.30 til 10.00, Bio fælles 18.00 til 22.00."
- [ ] States: loading (skeleton of the same height), error (keep the last cached events with "Kunne ikke opdatere" in muted caption), stale per source (a small "opdateret 14.05").
- [ ] Place it in Idé 6's slot above `Tonight`.

### Task 10: Specs, backlog, verify, commit
- [ ] Main spec: add `calendar` to §4.4, the two tables to §6, and a §5.6 sub-item "Kalender (read-only, private iCal feeds)". Note the Q1 decision in §3.2 as a new decision row. Mention `SP_FEED_KEY` in the security section (§4.5, tokens).
- [ ] UI spec: add the calendar card under §5 and to the Hjem screen in §6.
- [ ] Backlog: "Google secret iCal feeds lag by hours; option B (Google API) if that bothers anyone"; "Outlook and iCloud deep links open Google's web calendar on non-iOS phones".
- [ ] Deploy: `supabase secrets set SP_FEED_KEY=…`, `supabase functions deploy calendar`.
- [ ] Commits: `feat(strandparken): calendar feeds and calendar function`, then `feat(strandparken): calendar card on Hjem`.

---

## Verification

- `deno test --node-modules-dir=none --no-lock --allow-env supabase/functions` (calendar, crypto and the unchanged recipe-import tests), `node --test tests/`, `pnpm exec astro check`, `pnpm exec astro build`.
- Policy file: `failures` = 0.
- Both phones, real feeds: Jonas adds a private Google calendar and a shared one, and Camilla adds an iCloud or Outlook one. Jonas's private events never show on Camilla's phone, even with dev tools on the network tab. Shared events show on both, labelled "fælles".
- An event created now shows within the feed provider's delay. An evening with no more events reads "Ingen flere i dag". Three events tomorrow read "+ 1 mere".
- Tap on iPhone opens the Calendar app at today; on any other device it opens Google Calendar's day view.
- Paste a non-calendar URL, a private IP (`https://192.168.1.1/x.ics`) and an `http://` URL: each is refused with a Danish message.
- Supabase function logs contain no URL and no event title.

---

## Acceptance criteria

- [ ] The calendar widget sits directly under the header and above "I aften".
- [ ] Events come from the calendars each person has chosen (Google, Outlook or iCloud through their iCal addresses). The app never creates or edits events.
- [ ] The first time, the app explains in Danish why and how to add a calendar.
- [ ] Each member chooses which of their calendars are shown.
- [ ] A calendar marked "Fælles" shows on both members' dashboards, its events labelled "fælles".
- [ ] Private calendars are only shown to their owner.
- [ ] Left: weekday in red caps, the date in large numbers, and either the next event today or "Ingen flere i dag".
- [ ] Right: "I morgen" with up to 2 events as small cards with the calendar's colour as a left bar, title and time; more than 2 shows "+ N mere".
- [ ] Tapping opens the phone's calendar at that day (iOS), or the web calendar elsewhere.

---

## Open questions

1. **Q1 itself.** Default A. Do not start until Jonas has answered.
2. **Calendar colour.** ICS feeds rarely carry the colour the phone shows. Default: the person picks one of six token colours when adding the feed.
3. **Shared calendar owned by both.** If both add the same Google calendar as Fælles, events show twice. Default: deduplicate by `UID` + start in `events` and keep the first source's colour.

---

## Appendix: what changes under option B (Google Calendar API, read-only)

- Replace Tasks 3–4 with an OAuth code flow, `calendar-oauth`, for the `calendar.readonly` scope, with an encrypted refresh token in `private.sp_integration_tokens` (main spec §6). The consent screen must be "In production" (R6).
- `sp_calendar_sources` is filled from `calendarList.list` (Google's colours and names). The person ticks which calendars to show; the `shared` switch is unchanged.
- `events` calls `events.list` with `singleEvents=true` for the 2-day window, so no ICS parsing and no `ical.js`.
- Outlook and iCloud are not covered. Microsoft Graph would be a second, separate integration.
- Everything from Task 6 on is unchanged.
