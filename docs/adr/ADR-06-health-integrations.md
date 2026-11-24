# ADR-06: Health integrations: Oura API, Garmin Personal API, cycle day logged in the app

Status: accepted, 2026-11-24 (idea 9, roadmap Q2). Jonas chose to build with this recommendation without a separate go-ahead.
Covers design D13, D14, D38–D40, D52 and idea 10's adapters. All findings checked 2026-11-24 against the sources in
"Findings" below.

## Context

Strandparken should show, per person per day, **sleep score**, **activity goal progress**, **steps** and, for Camilla,
**cycle day**. Camilla wears an Oura ring; Jonas wears a Garmin watch. Strandparken is a PWA with no native shell,
so it cannot read Apple HealthKit (iOS) or Health Connect (Android) itself. Edge functions do all provider work behind
the `HealthSource` interface from idea 10. Both phones are assumed to be iPhones.

Two things changed since the desk research of 2026-11-11 (main spec §7.1 R3, R4):

- **Garmin opened a free Personal API on 21 October 2026.** A Garmin Connect user creates a personal API key in
  Garmin Connect web, with no application or approval. That removes the main reason for D14 ("no Garmin in v1").
- **Oura confirmed there is still no cycle data in API v2** (OpenAPI 1.43). Oura also does not write cycle data or
  any score to Apple Health. Cycle day must come from the app's own period log (D39).

## Options

| Metric | Oura API v2 | Garmin Personal API | HealthKit via iOS Shortcuts | HealthKit via Health Auto Export | Manual in app |
|---|---|---|---|---|---|
| Camilla, sleep score | **Available**: `daily_sleep.score` | n/a | **Not available**: Oura writes sleep stages, not the score | **Not available** (same reason) | Possible, but nobody will type it daily |
| Camilla, activity goal progress | **Derived**: `active_calories / target_calories` (also `meters_to_target`, `target_meters`) | n/a | **Not available**: no goal in HealthKit | **Not available** | Possible |
| Camilla, steps | **Available**: `daily_activity.steps` | n/a | Available (`stepCount`, Oura writes steps) | Available | Possible |
| Camilla, cycle day | **Not available**: no cycle, period or menstrual endpoint | n/a | **Derived** only if Camilla logs periods in Apple Health (`menstrualFlow`); Oura does not write it | Derived, same condition | **Available**: one-tap "første dag" log (D39) |
| Jonas, sleep score | n/a | **Likely**: Health JSON summaries; field to confirm in the Personal Swagger docs | **Not available**: Garmin writes sleep analysis, not the score | **Not available** | Possible |
| Jonas, activity goal progress | n/a | **Likely, derived**: `steps / stepsGoal` from the daily summary; to confirm in Swagger | **Not available**: no goal in HealthKit | **Not available** | Step goal set in Strandparken |
| Jonas, steps | n/a | **Likely**: daily summary `steps`; to confirm in Swagger | Available (Garmin writes steps, only while Garmin Connect is open in the foreground) | Available, same caveat | Possible |
| Jonas, cycle day | n/a | n/a | n/a | n/a | n/a |

| | Oura API v2 | Garmin Personal API | Shortcuts bridge | Health Auto Export | Manual |
|---|---|---|---|---|---|
| Freshness / background | Server pull; cron and on app open. Sleep appears only after Camilla opens the Oura app. Webhooks exist (~30 s after a sync). | Server pull (pull-only, no push); cron and on app open. | Phone automation; Health data is unreadable while the phone is locked, so a timed automation at night fails. | Background sync (Premium), same lock limit. | When someone remembers. |
| Setup per person | Camilla taps `Forbind` once (OAuth). | Jonas creates a key in Garmin Connect web and pastes it once; renews it at most yearly. | Build a Shortcut, allow Health access, allow running when locked, test. | Install, buy Premium, configure REST target and token. | None. |
| What breaks | Refresh token is single-use (race = reconnect). Membership lapse → 403. | Key expires (30 d to 1 y; Garmin emails a week before). Programme is new; endpoints may change. | iOS updates, locked phone, Health permission changes. | App updates, subscription. | Habit. |
| Cost | Free (Oura reserves the right to charge later, with notice). Needs Camilla's active Oura membership. | Free. | Free. | 199 kr. lifetime or 59 kr./yr for Premium. | Free. |
| Terms risk | Low if we follow the agreement (see below). | Low–medium: "for personal use, not … commercial applications serving multiple end users"; showing Jonas's own data to his partner is not addressed. | None (own data, own phone). | Low; "Data Not Collected" is self-declared. | None. |
| Where secrets live | Client id/secret as function secrets; tokens AES-GCM encrypted in `private.sp_integration_tokens`. | Key AES-GCM encrypted in `private.sp_integration_tokens`; 24 h access token not stored. | Per-person ingest token (hash in DB, plain in the Shortcut). | Same ingest token in the app. | n/a |

## Decision

Build three adapters behind `HealthSource`, nothing else:

1. **`oura` for Camilla: Oura API v2, OAuth2 authorisation code flow with PKCE (S256), server side.**
   - Scope `daily` only. Authorise at `https://cloud.ouraring.com/oauth/authorize`, token at
     `https://api.ouraring.com/oauth/token`, revoke at `https://api.ouraring.com/oauth/revoke`. Every request sends
     `User-Agent: Strandparken/1.0`.
   - Redirect URI (registered exactly): `https://kmytekaexgfqhwxapwbw.supabase.co/functions/v1/health-oauth`
     (the `callback` action is chosen by the signed `state`, not by the path).
   - Mapping: `GET /v2/usercollection/daily_sleep` → `score` → `sleep_score`.
     `GET /v2/usercollection/daily_activity` → `steps` → `steps`; `target_calories` → `activity_goal` with unit `kcal`;
     `active_calories / target_calories` → `activity_progress` (not clamped; null when the target is 0 or missing).
     Check on Camilla's phone that this matches the goal ring in the Oura app; if it does not, switch to
     `1 - meters_to_target / target_meters` (both fields are in the same response).
   - Refresh: single-use refresh tokens, stored together with the new pair under an advisory lock (plan 10 Task 5).
   - No webhooks in v1. Two people and a few calls a day are far from any rate limit; cron plus on-open sync is enough,
     and it avoids a public verification endpoint and subscription renewals. Revisit if mornings are often stale.
2. **`garmin` for Jonas: Garmin Connect Personal API, pull from an edge function.**
   - Jonas creates a personal API key at `https://connect.garmin.com/app/settings/personalApiToken` (expiry: one year)
     and pastes it once into the connect sheet. `health-oauth` (action `garmin-key`) encrypts and stores it; it is never
     returned to the browser.
   - Each sync exchanges the key for a 24-hour access token:
     `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token` with
     `Authorization: ApiKey <key>`. There is no refresh token; a new access token is requested when needed.
   - Mapping (to confirm in the Personal Swagger docs before coding, see "How this is checked"): daily summary `steps` →
     `steps`; `stepsGoal` → `activity_goal` with unit `steps`; `steps / stepsGoal` → `activity_progress`; the sleep
     summary's overall sleep score → `sleep_score`.
   - If the Swagger docs show no daily summary or no sleep score: keep whatever the Personal API does have, and fill the
     gap from the manual source (a step goal set in Strandparken). Do **not** build the Shortcuts bridge for this: it
     cannot provide either score.
3. **`manual` for cycle day: the in-app period log (D39).** Camilla taps "Første dag i menstruation"; the app counts
   from there. Cycle day is private by default (Q6).

**Not built:** the `ingest` adapter (Shortcuts or Health Auto Export). HealthKit carries neither sleep score nor goals
from Oura or Garmin, cannot be read while the phone is locked, and the only metric it adds (steps) already comes from the
APIs. Plan 10's `health-ingest` function and the ingest token are dropped. They stay a documented fallback if Garmin
withdraws the Personal API.

### Rules that follow from the Oura API and MCP Agreement (effective 8 June 2026)

- **Showing Camilla's data to Jonas** is allowed only with her informed, specific consent that she can revoke (§5(a),
  §5(j)). The `SharingConfirm` step (Q6) is that consent; the sheet must say how to withdraw it (`Afbryd` or the
  switches).
- **No AI on Oura data**: no prompting, training or evaluating models with API data (§4(a), §4(d)). D38 already holds;
  it now covers Garmin data too, for simplicity.
- **Retention and deletion**: keep data only as long as needed (§3(m), §4(c)). Daily rows older than 400 days are
  deleted by the cron job. On `Afbryd`, revoke the Oura token and delete Camilla's Oura rows within 72 hours (§5(f));
  the disconnect flow does it at once.
- **Security**: encryption in transit and at rest (§9(a)); report incidents to Oura within 24 hours (§9(b)). Tokens
  are encrypted with `SP_TOKEN_KEY`; the Supabase dashboard account should have MFA on.

### What idea 10 must build and set up

- Adapters `oura`, `garmin`, `manual`; edge functions `health-oauth` (Oura start/callback/disconnect, Garmin key
  save/disconnect) and `health-sync`. No `health-ingest`.
- Extensions: `pg_cron` and `pg_net` are available on the project but **not installed** (checked with `list_extensions`
  on 2026-11-24). Enable both in the migration. `supabase_vault` is installed; keep the cron secret there.
- Schedule `health-sync` mode `all` at 07:30 and 19:30 Copenhagen time for both `oura` and `garmin`.
- Function secrets: `SP_TOKEN_KEY` (32 random bytes, base64), `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`,
  `SP_OAUTH_STATE_KEY` (HMAC key for `state`), `SP_CRON_SECRET` (also stored in Vault for the cron job).
  No Garmin secret: the key is per person and stored encrypted.

### What Jonas and Camilla must do by hand

1. **Oura developer app** (whoever has an Oura account, most simply Camilla's, with Jonas at the keyboard): create an
   API application at `https://cloud.ouraring.com/oauth/applications`; name it Strandparken; add the redirect URI above;
   copy the client id and secret into the Supabase function secrets. Leave it unapproved; the 10-user limit is enough.
2. **Camilla's membership**: an active Oura membership is required for API access on Gen3 and newer rings.
3. **Garmin key**: Jonas creates a personal API key (expiry one year), reads and accepts Garmin's terms, opens the
   Personal Swagger docs (`https://developer.garmin.com/gc-developer-program/personal/swagger-docs/`) while signed in,
   and confirms the daily summary and sleep score endpoints. He pastes the key into Strandparken once idea 10 ships, and
   renews it when Garmin's reminder email arrives.
4. **Secrets**: generate and set `SP_TOKEN_KEY`, `SP_OAUTH_STATE_KEY`, `SP_CRON_SECRET`; set `OURA_CLIENT_ID` and
   `OURA_CLIENT_SECRET`.

## Consequences

- Good: everything runs on the server on a schedule. No phone automation to keep alive, no paid app, and both scores
  come from the vendors themselves, so they match what each person sees in their own app.
- Honest drawback: Jonas's half rests on a programme that is five weeks old and whose data endpoints could not be read
  without signing in. If the Personal API lacks the sleep score, Jonas's card has steps and goal only. Garmin's terms
  say "personal use" and do not mention showing data to a partner; we read a two-person household app as personal use,
  but that is our reading, not Garmin's statement. The key also expires at least yearly and must be pasted again.
- Cycle day depends on Camilla tapping once per cycle. Oura's own cycle insights stay in the Oura app.
- Sleep score appears only after Camilla opens the Oura app in the morning (Oura syncs sleep through the app).

## How this is checked

- Before coding the `garmin` adapter: the Personal Swagger docs list a daily summary with steps and step goal and a
  sleep summary with a sleep score. If not, the fallback in Decision 2 applies and this ADR is amended.
- Deno tests with recorded, anonymised fixtures: field mapping, progress maths, single-use refresh under concurrency,
  Garmin token exchange and expiry (`reconnect`).
- In use: both people's cards show today's sleep score and steps on at least 5 of 7 mornings by 09:00 in the first two
  weeks, and Camilla's goal progress matches the Oura app within a few percent.

## Findings (checked 2026-11-24)

Primary sources unless marked *(third party)*.

**Oura API v2**

- OpenAPI 1.43, the version loaded by the docs page: V2 is the only API; personal access tokens "were deprecated in
  December 2025 and are no longer available"; apps are limited to 10 users before approval; users consent per data type;
  rate limits per token and per application, numbers not published, with `Retry-After` on 429; webhooks for
  `daily_sleep`, `daily_activity` and others, about 30 seconds after an app sync; "sleep data requires users to open the
  Oura app". Data types: activity, sleep, readiness, stress, resilience, SpO2, cardiovascular age, VO2 max, tags,
  sessions, workouts, ring data. No cycle, period or menstrual type. —
  https://api.ouraring.com/v2/static/json/openapi-1.43.json , https://cloud.ouraring.com/v2/docs
- `PublicDailySleep.score`; `PublicDailyActivity`: `steps`, `score`, `active_calories`, `target_calories`,
  `target_meters`, `meters_to_target`. — same OpenAPI file
- Authentication: authorisation code flow with PKCE (S256) recommended; client-side flow has no refresh and lasts 30
  days; "The refresh token is single-use"; redirect URIs must match exactly; scopes `email`, `personal`, `daily`,
  `heartrate`, `workout`, `tag`, `session`, `spo2` (the OpenAPI file also lists `heart_health`); a `User-Agent` header is
  required. — https://cloud.ouraring.com/docs/authentication
- "Gen3 and later users without active Oura Membership can't access their data through the Oura API." —
  https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API
- Oura API and MCP Agreement, effective 8 June 2026: §4(a)(iii–iv), §4(c), §4(d) on AI; §5(a), §5(j) on consent and
  showing data to others; §3(m), §4(c), §5(f) on retention and 72-hour deletion; §9(a), §9(b) on security and incident
  reporting; §3(h) on possible future fees. — https://cloud.ouraring.com/legal/api-agreement
- Oura → Apple Health writes active energy, heart rate, height, mindful minutes, respiratory rate, sleep (duration,
  times, stages), steps, weight, workouts. No scores, no cycle data. — https://support.ouraring.com/hc/en-us/articles/360025438734
- Cycle Insights (cycle day, phases, period prediction) needs Gen3+ and a membership; the article does not mention the
  API. — https://support.ouraring.com/hc/en-us/articles/4410663885331

**Garmin**

- Programme overview: three tiers. Personal ("Secure access to your own Garmin Connect data"): Activity (JSON, .FIT),
  Health (JSON), Women's Health (JSON), pull only, key from Garmin Connect. Starter and Enterprise for businesses,
  push-based. — https://developer.garmin.com/gc-developer-program/overview/
- Personal FAQ: "available for personal use … not intended for commercial applications serving multiple end users";
  keys expire after 30, 90, 180 days or one year, with a reminder a week before; access tokens last 24 hours; no refresh
  tokens. Token exchange endpoint and `Authorization: ApiKey` header. —
  https://developer.garmin.com/gc-developer-program/personal/personal-faq/ ,
  https://developer.garmin.com/gc-developer-program/personal/personal-api/
- Data endpoints for the Personal API are in Swagger docs that did not render without a browser session: **unknown**,
  answered by Jonas opening https://developer.garmin.com/gc-developer-program/personal/swagger-docs/ . Field names
  `steps` and `stepsGoal` come from the business Health API's daily summary *(third party data dictionaries)*.
- Programme reopened and Personal tier launched 21 October 2026; Personal and Starter free *(third party:
  https://www.dcrainmaker.com/2026/10/garmin-connect-api-revamps-connect-developer.html ,
  https://the5krunner.com/2026/10/22/garmin-personal-api/ )*.
- The existing `garmin-dashboard/` export signs in with the community `garminconnect`/`garth` libraries (username and
  password); its newest snapshot is from 20 October 2025. It is not used (R4: those libraries broke and the route is
  against Garmin's terms). Not run.
- Garmin Connect → Apple Health: steps, active and resting energy, heart rate, sleep analysis, workouts; sent only while
  Garmin Connect is open in the foreground *(third party; Garmin's own article was not found)*. No sleep score, no goals.

**Apple HealthKit**

- "The user's device stores all HealthKit data locally … the device encrypts the HealthKit store when the user locks the
  device … your app may not be able to read data from the store when it runs in the background." HealthKit is a native
  framework; a web page has no access. — https://developer.apple.com/documentation/healthkit/protecting-user-privacy ,
  https://developer.apple.com/documentation/healthkit/hkerror/code/errordatabaseinaccessible
- `HKCategoryTypeIdentifier.menstrualFlow` stores periods (start sample marked with cycle-start metadata). —
  https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier/menstrualflow
- Shortcuts: personal automations with a Time of Day trigger can run without confirmation when "Allow Running When
  Locked" is on, and do not notify. — https://support.apple.com/guide/shortcuts/apdfbdbd7123/ios . Whether "Find Health
  Samples" offers menstrual flow is **unknown**; answered by opening the action's type list on the phone. Not needed for
  this decision.
- Health Auto Export 10.0.6: Premium 59 kr./yr or 199 kr. lifetime adds background sync to REST endpoints; exports
  menstrual data; privacy label "Data Not Collected" (self-declared). — https://apps.apple.com/dk/app/id1115567069
- Android Health Connect is also native-only; irrelevant while both phones are iPhones.
