# Strandparken Idé 10: Forbind sundhedsdata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring each person's daily health numbers into Strandparken through one provider-agnostic interface: sleep score, activity progress, activity goal, steps and cycle day, with the source and last sync time. Each member connects their own device or account. Tokens stay server-side and are never visible to the other member. Missing data is `null`, never `0`. The only new screen is the connect flow.

**Architecture:** Edge functions do all provider work. A `HealthSource` interface in `supabase/functions/_shared/health/` maps any provider's data to one `HealthDay` shape. `health-sync` runs the adapters for the caller (on app open, throttled) or for everyone (from `pg_cron`), and upserts `sp_health_daily`. `health-oauth` handles Oura's authorisation code flow. `health-ingest` accepts posts from a phone bridge (iOS Shortcuts or Health Auto Export), authenticated by a per-person ingest token. Tokens are encrypted in `private.sp_integration_tokens`, and only edge functions read them. Visibility is enforced in the database. Owners read their own rows. The other member reads only through `sp_health_for(...)`, a security-definer function that drops unshared metrics and marks them `hidden`, which is distinct from `null` (no data). The client gets one hook, `useHealth`, used by ideas 11, 12 and 15.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 10. Mockup: image5.png, left ("Forbind enheder").

**Depends on:** Idé 9 and Jonas's go-ahead (roadmap Q2). **Only Task 5 (adapters) depends on which source was chosen.** Roadmap Q6 (sharing defaults).

**Supersedes:** main spec D13 (readiness → sleep score; data is no longer Sundhed-only, see idea 12), D40 (sharing per metric instead of per integration), §4.4 rows `oura-oauth` / `oura-sync` / `training-sync` (replaced by `health-oauth`, `health-sync`, `health-ingest`), §6 rows `sp_health_daily` and `sp_health_sharing`.

**Status:** ✅ Implemented 2026-11-24 (commits 8df2245..4796d77). Manual checks: `docs/strandparken-manual-checks.md`. Index: [roadmap](2026-11-24-strandparken-ideer-roadmap.md).

**Privacy (roadmap Q9):** this plan describes how cycle data is stored and shared. Do not commit it until Jonas decides.

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Function guard | `supabase/functions/_shared/guard.ts`: `handler({ fn, schema, run })` verifies JWT, membership and person key (`'a'` Camilla, `'b'` Jonas) and maps errors without logging messages. `http.ts` has `HttpError`, `cors`, `json`. | `health-sync` and `health-oauth` (start) use `handler`. `health-ingest` and the OAuth callback cannot carry a Supabase JWT, so they get their own small auth checks. |
| Private schema | `private` exists (`private.sp_touch`, `private.sp_seed_categories`). | Tokens and ingest-token hashes live there; no grants to `anon`/`authenticated`. |
| Health tables | None. Main spec §6 sketches `sp_health_daily`, `sp_health_sharing`, `sp_cycle_log`, `private.sp_integration_tokens`. | Created here, adjusted to the new metric set. |
| Scheduling | No `pg_cron` jobs yet. | Task 7 checks and enables `pg_cron` + `pg_net` (or uses Supabase Cron in the dashboard). |
| Settings | Settings is a `Sheet` opened from the avatar in `shell/views.tsx` (`HomeView`) and holds `ProfileSection`. | The connect flow is a new row "Forbind enheder" in that sheet, opening its own sheet. |
| Client data | `lib/<area>/{model,repo,use-*}.ts` pattern; generated types in `src/lib/supabase/database.types.ts`. | New `lib/health/`. |
| Tests | Deno tests next to functions (`*.test.ts`), fakes in `_shared/fakes.ts`; SQL policy tests in `supabase/tests/strandparken_policies.sql` with `pg_temp.try` and a result table. | Same patterns. |

---

## Files

**Create**

| File | Purpose |
|---|---|
| `supabase/migrations/20261201100000_strandparken_health.sql` | Tables, policies, `sp_health_for`, sharing defaults (timestamp is a placeholder; use the real time of writing). |
| `supabase/functions/_shared/health/types.ts` | `HealthDay`, `HealthSource`, `Metric`, `ProviderId`. |
| `supabase/functions/_shared/health/normalise.ts` (+ `.test.ts`) | Clamp and validate values, `null` for missing, cycle day from period starts. |
| `supabase/functions/_shared/health/tokens.ts` (+ `.test.ts`) | AES-GCM encrypt/decrypt with `SP_TOKEN_KEY`; SHA-256 hashing of ingest tokens. |
| `supabase/functions/_shared/health/oura.ts` (+ `.test.ts`) | Oura adapter (if chosen in idea 9). |
| `supabase/functions/_shared/health/ingest.ts` (+ `.test.ts`) | Bridge payload schema and mapping (if chosen). |
| `supabase/functions/health-sync/index.ts`, `logic.ts`, `logic.test.ts` | Sync caller (throttled) or all (cron); upsert days. |
| `supabase/functions/health-oauth/index.ts`, `logic.ts`, `logic.test.ts` | `start` (returns authorise URL with signed state), `callback` (code exchange, store tokens, redirect back), `disconnect`. |
| `supabase/functions/health-ingest/index.ts`, `logic.ts`, `logic.test.ts` | Bridge endpoint; also issues/rotates the ingest token for the signed-in caller. |
| `src/components/strandparken/lib/health/model.ts` | Client types, `formatSync("Oura", ts)` → "Oura · synk. 19.45", `isStale`. |
| `src/components/strandparken/lib/health/repo.ts` | `loadHealth(person, from, to)` via `rpc('sp_health_for')`, `loadConnections()`, `setSharing()`, `logPeriodStart()`, function calls. |
| `src/components/strandparken/lib/health/use-health.ts` | Hook used by ideas 11, 12, 15; triggers sync on app open. |
| `src/components/strandparken/settings/ConnectSheet.tsx` | "Forbind enheder" screen. |
| `src/components/strandparken/settings/SharingConfirm.tsx` | The per-metric confirmation step (Q6). |
| `tests/strandparken-health.test.ts` | Client model tests. |

**Modify**

| File | Change |
|---|---|
| `src/components/strandparken/shell/views.tsx` | "Forbind enheder" row in the settings sheet; mount the on-open sync. |
| `src/lib/supabase/database.types.ts` | Regenerate. |
| `supabase/config.toml` | `[functions.health-sync]`, `[functions.health-oauth]`, `[functions.health-ingest]` with `verify_jwt = false` and comments on secrets. |
| `supabase/tests/strandparken_policies.sql` | Health cases (below). |
| Main spec, ADR-06, `docs/strandparken-backlog.md` | Task 9. |

---

## Data changes

Migration `…_strandparken_health.sql` (sketch; follow the shape of `20261115170536_strandparken_food_tables.sql`):

```sql
-- One row per person, day and source. Metrics are nullable: null = no data, never zero.
create table public.sp_health_daily (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  person text not null check (person in ('a', 'b')),
  date date not null,
  source text not null check (source in ('oura', 'garmin', 'healthkit', 'manual')),
  sleep_score smallint check (sleep_score between 0 and 100),
  activity_progress numeric(4,3) check (activity_progress >= 0),          -- 0–1, may exceed 1
  activity_goal integer check (activity_goal > 0),
  activity_goal_unit text check (activity_goal_unit in ('steps', 'kcal', 'score')),
  steps integer check (steps >= 0),
  cycle_day smallint check (cycle_day between 1 and 60),
  synced_at timestamptz not null default now(),
  unique (household_id, person, date, source)
);
alter table public.sp_health_daily enable row level security;
revoke all on public.sp_health_daily from anon, authenticated;
grant select on public.sp_health_daily to authenticated;          -- writes: service role only
create policy "owner reads own health" on public.sp_health_daily for select to authenticated
  using (exists (select 1 from public.household_members m where m.user_id = (select auth.uid())
                 and m.household_id = sp_health_daily.household_id and m.person = sp_health_daily.person));

-- Per metric, per person. No row = not shared. Rows are created only by the confirmation step.
create table public.sp_health_sharing (
  household_id uuid not null references public.households (id) on delete cascade,
  person text not null check (person in ('a', 'b')),
  metric text not null check (metric in ('sleep_score', 'activity', 'steps', 'cycle_day')),
  shared boolean not null,
  changed_at timestamptz not null default now(),
  primary key (household_id, person, metric)
);
-- RLS: household reads (the other person may see what is shared); insert/update only own person (same exists() as sp_profiles).

-- D39 fallback: one tap logs a period start.
create table public.sp_cycle_log (... household_id, person, period_start date, unique (household_id, person, period_start));
-- RLS: owner only (read and write).

-- Which sources a person has connected, without secrets. Owner reads own; the other reads source + last sync only via sp_health_for.
create table public.sp_health_connections (household_id, person, source, connected_at, last_synced_at, last_error text check (length(last_error) <= 80), primary key (household_id, person, source));

create table private.sp_integration_tokens (
  household_id uuid not null, person text not null, provider text not null,
  access_ciphertext bytea, refresh_ciphertext bytea, scopes text[], expires_at timestamptz,
  ingest_token_hash bytea,                              -- SHA-256 of the bridge token; the token itself is shown once
  updated_at timestamptz not null default now(),
  primary key (household_id, person, provider)
);
revoke all on private.sp_integration_tokens from public, anon, authenticated;

-- The one read path for "the other person". Owner gets everything; the other member gets shared metrics,
-- and `hidden` lists what was withheld so the UI can leave it out instead of showing it blank.
create function public.sp_health_for(p_person text, p_from date, p_to date)
returns table (date date, source text, sleep_score smallint, activity_progress numeric, activity_goal integer,
               activity_goal_unit text, steps integer, cycle_day smallint, synced_at timestamptz, hidden text[])
language sql stable security definer set search_path = '' as $$ … $$;
revoke all on function public.sp_health_for(text, date, date) from public, anon;
grant execute on function public.sp_health_for(text, date, date) to authenticated;
```

`sp_health_for` resolves the caller's household from `household_members` (never from a parameter), returns nothing for non-members, and applies the sharing rows for `p_person` when the caller is the other person. Cycle day: the stored value if a source provides it, otherwise it is computed from the latest `sp_cycle_log.period_start` on or before the date (`date - start + 1`, `null` when there is no start or it is more than 60 days old).

**Policy test cases** (add to `supabase/tests/strandparken_policies.sql`):
- The owner reads their own `sp_health_daily` rows; the other member reads none directly; a non-member reads none.
- `authenticated` cannot insert or update `sp_health_daily` (expects `42501`).
- `sp_health_for` as the other member: an unshared metric is `null` and listed in `hidden`, a shared metric comes through, and with no sharing rows every metric is hidden.
- A member cannot write a sharing row for the other person; a non-member calling `sp_health_for` gets zero rows.
- `private.sp_integration_tokens` is not readable by `authenticated` (expects `42501`).
- `sp_cycle_log` is owner-only for read and write.

---

## Tasks

### Task 1: Types and normalisation (pure, TDD)

- [ ] Write `_shared/health/normalise.test.ts` first: out-of-range values become `null`; a provider `0` sleep score with no sleep recorded becomes `null`; `activity_progress = done / goal` with `goal <= 0` → `null`; cycle day from period starts (same day = 1; no start → `null`; > 60 days → `null`); dates in Europe/Copenhagen (D53).
- [ ] Implement `types.ts`:

```ts
export type Metric = 'sleep_score' | 'activity' | 'steps' | 'cycle_day';
export interface HealthDay {
  date: string;                       // ISO date, Copenhagen
  sleep_score: number | null;
  activity_progress: number | null;   // 0–1 (may exceed 1)
  activity_goal: number | null;
  activity_goal_unit: 'steps' | 'kcal' | 'score' | null;
  steps: number | null;
  cycle_day: number | null;
  source: 'oura' | 'garmin' | 'healthkit' | 'manual';
  last_synced_at: string;
}
export interface HealthSource {
  id: HealthDay['source'];
  /** Days in [from, to] for one person. Throws HttpError('reconnect') when the grant is gone. */
  fetchDays(ctx: { householdId: string; person: 'a' | 'b'; from: string; to: string }): Promise<HealthDay[]>;
}
```

- [ ] Implement `normalise.ts` until the tests pass.

### Task 2: Token handling (TDD)

- [ ] `tokens.test.ts`: encrypt → decrypt round trip; a different key fails; ciphertexts differ for equal input (random IV); `hashIngestToken` is stable and does not equal the token.
- [ ] Implement with Web Crypto AES-GCM; the key comes from the secret `SP_TOKEN_KEY` (32 random bytes, base64). Document `supabase secrets set SP_TOKEN_KEY=…` in `config.toml`. Never log tokens or decrypted values.

### Task 3: Migration and policy tests

- [ ] Write the policy test cases first in `strandparken_policies.sql`, then the migration above.
- [ ] Apply through the dashboard or MCP `apply_migration` (see roadmap: migration history is out of step), run the policy file (`failures = 0`), regenerate `database.types.ts`.

### Task 4: `health-sync` core (TDD, provider-independent)

- [ ] `health-sync/logic.test.ts` with fake sources from `_shared/fakes.ts`: syncs the caller only (mode `self`), skips when `last_synced_at` is under 30 minutes old unless `force`, fetches the last 8 days (7-day trend + today), upserts on `(household_id, person, date, source)`, records `last_error` as a short code on failure and keeps old rows, and a failing source never blocks another.
- [ ] Mode `all` (cron): accepts only the service role (check `Authorization` against `SUPABASE_SERVICE_ROLE_KEY` or a separate `SP_CRON_SECRET`) and loops over connected persons.
- [ ] Logs: function name, outcome, duration, counts only. No values.

### Task 5: Adapters — **the only task that depends on idea 9**

Build the adapters idea 9 recommends; skip the others. Each gets Deno tests with recorded, anonymised fixture responses.

- [ ] **Oura (if chosen).** `health-oauth` `start` returns the Oura authorise URL with `state` = HMAC-signed `{householdId, person, nonce, exp}`; `callback` verifies `state`, exchanges the code, encrypts and stores tokens, then redirects to `/strandparken/#hjem?forbundet=oura`. `oura.ts` maps `daily_sleep.score` → `sleep_score` and `daily_activity` → `steps`, `activity_goal`, `activity_progress` (fields as found in idea 9). Refresh: Oura refresh tokens are single-use, so the refresh and the store of the new pair happen in one transaction under `pg_advisory_xact_lock(hashtext(household||person||'oura'))` (an RPC in `private`, service role only), so two runs cannot invalidate each other (main spec §4.5). Tests: refresh under concurrent calls stores exactly one new pair; a 401 after refresh → `reconnect`.
- [ ] **Bridge ingest (if chosen).** `health-ingest` has two actions. `issue` (with `handler`, signed-in caller) creates a random 32-byte token, stores its hash and returns it once, together with setup text for the Shortcut. `post` (no JWT) takes `Authorization: Bearer <ingest token>`, looks up the hash, validates a zod schema (`days: [{date, sleep_score?, steps?, activity_progress?, activity_goal?, menstrual_flow_start?}]`, max 14 days, max 8 KB), maps through `ingest.ts`, upserts with `source = 'healthkit'`, and writes a `menstrual_flow_start` into `sp_cycle_log`. Rate limit: 30 posts/hour per token. Tests: wrong token 401, oversized 413, future dates rejected, values clamped.
- [ ] **Manual (always).** Cycle: "Første dag i menstruation" one-tap log writes `sp_cycle_log` (D39) from the connect sheet.

### Task 6: Connect flow UI (`ConnectSheet`)

- [ ] Row "Forbind enheder" in the settings sheet → sheet titled "Forbind enheder", intro "Hver af jer forbinder jeres egen enhed. Jeres login deles ikke med hinanden."
- [ ] One card per source (per mockup): icon tile, name, "<Navn> · synk. 19.45" or "Ikke forbundet", and a status "Forbundet" or a `Forbind` button. The other person's sources are shown read-only (name and last sync), without a button.
- [ ] Connect → `SharingConfirm` step before anything is shared (Q6): "Hvad må <anden person> se?" with switches Søvn, Aktivitet, Skridt (pre-set on) and "Min cyklus" (pre-set off), and the button `Gem og del`. Saving writes the four sharing rows. Until then there are no rows, so nothing is shared.
- [ ] `Afbryd` (with confirmation): deletes tokens and the connection, and asks "Slet også de hentede data?" (deletes that source's `sp_health_daily` rows through a `health-oauth` `disconnect` action with the service role).
- [ ] "Hvis data mangler" card: "Ingen data i nat — tjek at ringen har synkroniseret i Oura-appen." (the text matches the source).
- [ ] States: loading, error with `Prøv igen`, `reconnect` shown as "Forbindelsen er udløbet — forbind igen".

### Task 7: Sync on app open and in the background

- [ ] `useHealth` calls `health-sync` (`self`) once per app open when signed in; the function's 30-minute throttle keeps it cheap. A failure is silent, and the cards show their last sync time.
- [ ] Background: confirm `pg_cron` and `pg_net` are enabled (Supabase MCP `list_extensions`); schedule `health-sync` mode `all` at 07:30 and 19:30 Copenhagen time for sources that allow server pulls (Oura). The bridge route relies on the phone's own automation schedule; document it in the setup text.

### Task 8: Client model and hook (TDD)

- [ ] `tests/strandparken-health.test.ts`: `formatSync('oura', '2026-11-19T18:45:00Z')` → "Oura · synk. 19.45" (Copenhagen); `isStale(day, today)` is true when the newest day is not today; merging two sources per day prefers the one with a value per metric (Oura over HealthKit for sleep score, configurable); `hidden` metrics are removed from the view model, `null` metrics are kept as "no data".
- [ ] Implement `model.ts`, `repo.ts`, `use-health.ts` (`{ days, today, sources, hidden, status, reload }` per person).

### Task 9: Spec, ADR, backlog, verify, commit

- [ ] Main spec: §2.1 rows, D13, D40, §4.4 table, §6 rows, §5.4.1 (sleep score, per-metric sharing); ADR-06 marked accepted with the chosen adapters.
- [ ] Backlog: anything deferred (Garmin if unavailable, webhooks, token rotation for ingest).
- [ ] Run Verification below. Suggested commits: `feat(strandparken): health tables and visibility function`, `feat(strandparken): health sync functions`, `feat(strandparken): Forbind enheder`. Do not commit until roadmap Q9 is decided; push only after checks pass.

---

## Verification

- `deno test --node-modules-dir=none --no-lock --allow-env supabase/functions`
- `node --test tests/`, `pnpm exec astro check`, `pnpm exec astro build`
- SQL policy file: `failures = 0`.
- Deploy `health-sync`, `health-oauth`, `health-ingest`; set `SP_TOKEN_KEY` (and Oura client id/secret if used). On both phones: connect, confirm sharing, see "Forbundet · synk. hh.mm"; sign in as the other person and confirm tokens and unshared metrics are unreachable (inspect the network responses); disconnect removes the connection.
- Function logs contain no health values, tokens or ingest payloads.

## Acceptance criteria

- [ ] A provider-agnostic `HealthSource` interface returns, per person per day: `sleep_score`, `activity_progress` (0–1), `activity_goal`, `steps`, `cycle_day` (nullable), `source`, `last_synced_at`.
- [ ] Each member connects their own device or account; tokens are stored securely and are never visible to the other member.
- [ ] Data syncs on app open, and in the background where the platform allows it.
- [ ] Missing data is `null`, not zero, so the UI can say "Ingen data i nat".
- [ ] Nothing is shared with the other member before the owner confirms it, and each metric can be switched off at any time with immediate effect.
- [ ] No new screens beyond the connect flow.

## Open questions

1. **Two sources for the same metric** (Oura and HealthKit both give steps): which wins? Default: the vendor API over the bridge, per metric, configurable later.
2. **Back-fill on first connect:** how far back? Default: 8 days (enough for the 7-day trend).
3. **Delete data on disconnect:** ask every time, or always delete? Default: ask, with "Slet" pre-selected.
4. **Cron times:** default 07:30 and 19:30; Jonas may prefer one morning run only.
