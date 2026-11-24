# Strandparken Idé 9: Undersøg Oura og Garmin (kun research) — Research Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find out, from current official sources, how Strandparken can show Camilla's Oura data and Jonas's Garmin data: sleep score, activity goal progress, steps and, for Camilla, cycle day. Recommend one approach with trade-offs, then stop and wait for Jonas's go-ahead. **No code in this plan.**

**Architecture:** None yet. The research decides which adapters idea 10 builds behind its provider-agnostic `HealthSource` interface. Two routes are compared: direct vendor APIs called from Supabase edge functions (Oura API v2; Garmin if any route is open), and Apple HealthKit reached through a bridge on the phone, either an iOS Shortcuts automation or an app such as Health Auto Export posting to an edge function. The source document frames HealthKit as "if this is an iOS app". Strandparken is a PWA (roadmap Q1, Q2), so HealthKit can only be compared as HealthKit-via-bridge.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 9. No mockup.

**Depends on:** Nothing. **Blocks:** ideas 10, 11, 12 and automatic habits in 15.

**Supersedes:** Nothing yet. Its findings update main spec §7.1 (R3, R4), §7.2 (R3, R4 spikes), D14, D39, D52 and become ADR-06 (main spec §10).

**Status:** Draft, 2026-11-24. Index: [roadmap](2026-11-24-strandparken-ideer-roadmap.md) (see Q2, Q6, Q9).

**Privacy (roadmap Q9):** this plan and the report discuss how Camilla's cycle data would be handled. Do not commit them, or ADR-06, until Jonas decides what may be public.

---

## Current setup (as found on 2026-11-24)

| Area | What exists | Consequence |
|---|---|---|
| Desk research | Main spec §7.1, checked 2026-11-11. R3: Oura API v2 is OAuth2-only, single-use refresh tokens, up to 10 users without approval, Gen3+ needs a membership, and public endpoint lists show no cycle endpoint. A third-party analysis says the API agreement effective 8 June 2026 restricts AI processing. R4: Garmin's Connect Developer Programme closed to new applicants in spring 2026, and community libraries broke in March 2026. | Re-check each finding against primary sources; the spec asks for this "on the day its feature plan is written". |
| Decisions | D13 (Oura readiness + cycle day), D14 amended (no Garmin in v1), D38 (no Oura data to AI), D39 (cycle day fallback: in-app period log), D40 (sharing is a revocable choice), D52 (training path: `garmin-dashboard/` export → Strava → manual). | The new idea asks for **sleep score** (not readiness), **activity goal progress** and **steps** for both people. D52's options are re-evaluated against these metrics. |
| ADRs | `docs/adr/` has ADR-01, 02, 07, 08, 09. ADR-06 (health integrations) is planned but not written. | This plan drafts ADR-06. |
| App | PWA at `/strandparken/`, no service worker, no native shell. Sundhed is a placeholder. | No HealthKit or Health Connect access from the page itself. |
| Server | Supabase edge functions with `_shared/guard.ts` (JWT + membership + person key), `private` schema in use (`private.sp_touch`). Scheduling with `pg_cron` is planned (§4.3) but not set up. | Whether `pg_cron`/`pg_net` are enabled on the project is a question for this research (a lookup via the Supabase MCP `list_extensions` is enough). |
| Phones | Assumed iPhones (the source mentions iOS haptics and HealthKit). Not confirmed for both people. | Ask Jonas in the report if it matters for the recommendation. |

---

## Files

**Create**

| File | Purpose |
|---|---|
| `docs/adr/ADR-06-health-integrations.md` | Draft ADR: options, choice (pending go-ahead), one honest drawback, how it is checked. Same structure as ADR-07. |
| Scratchpad report (not in the repo) | The report sent back to Jonas. It can be pasted into chat; no file in the repo is needed. |

**Modify (only after the go-ahead, as part of idea 10's first task, or here if Jonas says so)**

| File | Change |
|---|---|
| `docs/superpowers/specs/2026-11-11-strandparken-design.md` | §7.1 R3 and R4 rows updated with dated findings and primary sources in §12; §7.2 R3/R4 spikes marked done; D14, D39, D52 amended to match the chosen approach. |

---

## Data changes

None.

---

## Tasks

Time-box: one working day in total. Primary sources first (vendor docs, terms, release notes); third-party sources only to locate a primary one, and labelled when used. Record the URL and the date checked for every finding.

### Task 1: Oura API v2

- [ ] Read the official Oura API v2 documentation and record: authentication (OAuth2 authorisation code flow, scopes needed for sleep, activity and any cycle data; whether personal access tokens are really gone), token lifetimes and refresh-token behaviour.
- [ ] For each metric, record the endpoint and field, and whether it is the value Oura shows in its app:
  - sleep score: `daily_sleep` → `score`;
  - activity goal progress: `daily_activity` → which fields express the goal (target calories, target meters, `score`?) and how to compute a 0–1 progress that matches what Camilla sees;
  - steps: `daily_activity` → `steps`;
  - cycle day or phase: any endpoint for cycle insights, period prediction or tags. Check the changelog for additions after November 2025.
- [ ] Record rate limits, the user limit for unapproved apps (10?), and the membership requirement for Gen3/Ring 4.
- [ ] Read the current Oura API agreement / developer terms: may data be shown to a second person (Jonas) with the owner's consent; restrictions on AI processing (D38 already keeps Oura data away from models); storage and deletion duties.
- [ ] Note whether webhooks exist (push on new data), which would replace polling.

### Task 2: Garmin

- [ ] Check the Garmin Connect Developer Program and Health API pages: is the programme accepting applications on the day of the research; is it limited to businesses; what data (sleep score, steps, goals) it offers.
- [ ] Check whether any official personal or non-commercial route exists (data export, Garmin Connect IQ, third-party aggregators such as Terra and their terms and price). Record without recommending a scraping library (R4: they broke and violate the terms).
- [ ] Check the existing `garmin-dashboard/` export (D52 step 1): ask Jonas whether it still produces JSON and what it contains. Do not run anything that signs in to Garmin.

### Task 3: Apple HealthKit through a bridge

- [ ] Confirm that HealthKit has no web API and a PWA cannot read it (Apple developer docs).
- [ ] For each metric, find out whether it reaches HealthKit, and from which app:
  - Oura app → HealthKit: what it writes (sleep analysis, heart rate, steps?, active energy, mindful minutes). Is the **sleep score** written? (Likely not; verify.)
  - Garmin Connect → HealthKit: steps, active energy, sleep analysis, workouts? Sleep score? Is the activity/step **goal** available anywhere?
  - Cycle: Apple Cycle Tracking stores menstrual flow samples. Does the Oura app write period data to HealthKit, or does Camilla log it in Apple Health? Can cycle day be derived from the last flow sample?
- [ ] iOS Shortcuts route: can a personal automation run daily without confirmation ("Kør straks"), read the needed samples ("Find sundhedsprøver"), and `POST` JSON to a URL? Which sample types does the action support (menstrual flow, steps, sleep)? What happens when the phone is locked (Health data is unavailable while locked)?
- [ ] Health Auto Export (or similar): what it exports, its REST automation, price, and its privacy policy (does data pass through its servers?).
- [ ] Android: Health Connect is also native-only. Note it as a fallback only if either phone is Android.

### Task 4: Compare and recommend

- [ ] Build a comparison table: rows = sleep score, activity goal progress, steps, cycle day, for Camilla and for Jonas; columns = Oura API, Garmin (any route), HealthKit via Shortcuts, HealthKit via Health Auto Export, manual entry. Each cell: available / derived / not available, plus a source.
- [ ] Compare on: data freshness and background sync (server cron vs phone automation), setup effort per person, what breaks when (token expiry, iOS updates, app changes), cost, terms risk, and where tokens or secrets live.
- [ ] Write one recommendation with trade-offs. Likely shape to test: Oura API for Camilla (server-side, cron-capable), a HealthKit bridge for Jonas's Garmin data, cycle day from the D39 period log unless an API or HealthKit source proves reliable. Change it if the findings say otherwise.
- [ ] List what idea 10 must build for the recommendation: which adapters (`oura`, `ingest`, `manual`), which secrets (Oura client id and secret, a token-encryption key), and whether `pg_cron`/`pg_net` must be enabled.

### Task 5: Write up and stop

- [ ] Draft `docs/adr/ADR-06-health-integrations.md`: context, options, recommended choice marked "pending go-ahead", one honest drawback, how the decision is checked (for example "both cards show today's data on 5 of 7 mornings in the first two weeks").
- [ ] Send Jonas the report (comparison table, recommendation, open points for him and Camilla). It must be readable in a few minutes.
- [ ] **Stop. Wait for Jonas's go-ahead.** No migrations, functions or UI in this plan. When the answer comes, update the main spec rows listed under Files and mark roadmap Q2 answered.

---

## Verification

- Every finding in the report has a primary-source URL and the date checked.
- The comparison table has no empty cells: "unknown" is written as such, with what would answer it.
- No secrets, tokens, email addresses or real health values appear in the report, the ADR or the scratchpad.
- `git status` shows no committed changes from this plan (roadmap Q9).

## Acceptance criteria

- [ ] The report covers the current official docs for the Oura API (v2) and the Garmin Connect / Garmin Health API: authentication, which of sleep score, activity goal progress, steps and cycle day are available, rate limits, and whether a private, non-commercial app can get access.
- [ ] It compares reading the same data from Apple HealthKit, which the Oura and Garmin Connect apps can sync to, including cycle tracking, and explains why HealthKit needs a bridge for this app.
- [ ] It recommends one approach with trade-offs.
- [ ] No code is written, and the work stops for Jonas's go-ahead.

## Open questions

1. **Do both people use iPhones?** Default: yes. If not, the bridge route needs a Health Connect alternative for that person.
2. **Is a small yearly cost acceptable** (for example a Health Auto Export licence)? Default: prefer a free route (Shortcuts) if it covers the metrics.
3. **Which "activity goal" counts for Jonas**: Garmin's step goal, an active-calorie goal, or a goal set in Strandparken? Default: the goal from the source; if none is reachable, a step goal set in Strandparken.
