-- Strandparken health data (idea 10, ADR-06). Additive only.
-- Each person connects their own source (Oura for Camilla, Garmin Personal API for Jonas); cycle day comes from an in-app
-- period log. Metrics are nullable: null means no data, never zero. Tokens and keys are AES-GCM ciphertext written and read
-- only by the edge functions (service role). The other member reads health data only through `sp_health_for`, which drops
-- every metric the owner has not shared and lists it in `hidden` (distinct from null = no data). Sharing is per metric
-- (roadmap Q6): no row means not shared, and rows are only created by the owner's confirmation in the connect flow.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- One row per person, day and source. Written by health-sync only.
create table public.sp_health_daily (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  person text not null check (person in ('a', 'b')),
  date date not null,
  source text not null check (source in ('oura', 'garmin', 'manual')),
  sleep_score smallint check (sleep_score between 0 and 100),
  activity_progress numeric(4, 3) check (activity_progress >= 0), -- done / goal, may exceed 1
  activity_goal integer check (activity_goal > 0),
  activity_goal_unit text check (activity_goal_unit in ('steps', 'kcal', 'score')),
  steps integer check (steps >= 0),
  cycle_day smallint check (cycle_day between 1 and 60),
  synced_at timestamptz not null default now(),
  unique (household_id, person, date, source)
);
create index sp_health_daily_person_date_idx on public.sp_health_daily (household_id, person, date desc);

alter table public.sp_health_daily enable row level security;
revoke all on public.sp_health_daily from anon, authenticated;
grant select on public.sp_health_daily to authenticated;

create policy "owner reads own health" on public.sp_health_daily for select to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_health_daily.household_id and m.person = sp_health_daily.person));

-- What each person lets the other see, per metric. Both members read the rows; each writes only their own.
create table public.sp_health_sharing (
  household_id uuid not null references public.households (id) on delete cascade,
  person text not null check (person in ('a', 'b')),
  metric text not null check (metric in ('sleep_score', 'activity', 'steps', 'cycle_day')),
  shared boolean not null,
  changed_at timestamptz not null default now(),
  primary key (household_id, person, metric)
);

alter table public.sp_health_sharing enable row level security;
revoke all on public.sp_health_sharing from anon, authenticated;
grant select, insert, update on public.sp_health_sharing to authenticated;

create policy "members read sharing" on public.sp_health_sharing for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create policy "own sharing insert" on public.sp_health_sharing for insert to authenticated
  with check (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_health_sharing.household_id and m.person = sp_health_sharing.person));
create policy "own sharing update" on public.sp_health_sharing for update to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_health_sharing.household_id and m.person = sp_health_sharing.person))
  with check (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_health_sharing.household_id and m.person = sp_health_sharing.person));

create function private.sp_health_sharing_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.changed_at := now();
  return new;
end;
$$;
create trigger sp_health_sharing_touch before insert or update on public.sp_health_sharing
  for each row execute function private.sp_health_sharing_touch();

-- Period starts (D39): one tap logs "første dag". Owner only, for reading and writing.
create table public.sp_cycle_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  person text not null check (person in ('a', 'b')),
  period_start date not null check (period_start >= date '2020-01-01'),
  created_at timestamptz not null default now(),
  unique (household_id, person, period_start)
);

alter table public.sp_cycle_log enable row level security;
revoke all on public.sp_cycle_log from anon, authenticated;
grant select, insert, delete on public.sp_cycle_log to authenticated;

create policy "owner reads own cycle" on public.sp_cycle_log for select to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_cycle_log.household_id and m.person = sp_cycle_log.person));
create policy "owner logs own cycle" on public.sp_cycle_log for insert to authenticated
  with check (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_cycle_log.household_id and m.person = sp_cycle_log.person));
create policy "owner deletes own cycle" on public.sp_cycle_log for delete to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_cycle_log.household_id and m.person = sp_cycle_log.person));

-- Which sources a person has connected, without secrets. The owner reads their own rows; `sp_health_sources` gives the
-- other member the source name and last sync only. Written by the edge functions only.
create table public.sp_health_connections (
  household_id uuid not null references public.households (id) on delete cascade,
  person text not null check (person in ('a', 'b')),
  source text not null check (source in ('oura', 'garmin')),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  -- A short code such as 'reconnect' or 'upstream', never a provider message.
  last_error text check (last_error is null or length(last_error) <= 80),
  -- Strandparken's own step goal, used when the source gives none (ADR-06 Decision 2 fallback).
  step_goal integer check (step_goal between 100 and 100000),
  primary key (household_id, person, source)
);

alter table public.sp_health_connections enable row level security;
revoke all on public.sp_health_connections from anon, authenticated;
grant select on public.sp_health_connections to authenticated;

create policy "owner reads own connections" on public.sp_health_connections for select to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_health_connections.household_id and m.person = sp_health_connections.person));

-- Provider secrets, encrypted by the edge functions with SP_TOKEN_KEY ("iv.ciphertext", base64). Nobody but the service
-- role reaches this table, and only through the functions below.
create table private.sp_integration_tokens (
  household_id uuid not null references public.households (id) on delete cascade,
  person text not null check (person in ('a', 'b')),
  provider text not null check (provider in ('oura', 'garmin')),
  access_ciphertext text check (length(access_ciphertext) <= 8192),
  refresh_ciphertext text check (length(refresh_ciphertext) <= 8192),
  api_key_ciphertext text check (length(api_key_ciphertext) <= 8192),
  scopes text[] not null default '{}',
  expires_at timestamptz,
  -- Goes up on every write. A refresh stores its new pair only if the version it claimed is still current.
  version integer not null default 1,
  -- Oura refresh tokens are single-use: one run at a time may spend one, until this time.
  refresh_lease_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (household_id, person, provider)
);
alter table private.sp_integration_tokens enable row level security;
revoke all on private.sp_integration_tokens from public, anon, authenticated;

create function public.sp_health_token_get(p_household uuid, p_person text, p_provider text)
returns table (access_ciphertext text, refresh_ciphertext text, api_key_ciphertext text, expires_at timestamptz, version integer)
language sql stable security definer set search_path = '' as $$
  select t.access_ciphertext, t.refresh_ciphertext, t.api_key_ciphertext, t.expires_at, t.version
  from private.sp_integration_tokens t
  where t.household_id = p_household and t.person = p_person and t.provider = p_provider;
$$;

create function public.sp_health_token_put(
  p_household uuid, p_person text, p_provider text, p_access text, p_refresh text, p_api_key text, p_expires_at timestamptz, p_scopes text[]
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_household::text || p_person || p_provider));
  insert into private.sp_integration_tokens as t
    (household_id, person, provider, access_ciphertext, refresh_ciphertext, api_key_ciphertext, expires_at, scopes)
  values (p_household, p_person, p_provider, p_access, p_refresh, p_api_key, p_expires_at, coalesce(p_scopes, '{}'))
  on conflict (household_id, person, provider) do update set
    access_ciphertext = excluded.access_ciphertext,
    refresh_ciphertext = excluded.refresh_ciphertext,
    api_key_ciphertext = excluded.api_key_ciphertext,
    expires_at = excluded.expires_at,
    scopes = excluded.scopes,
    version = t.version + 1,
    refresh_lease_until = null,
    updated_at = now();
end;
$$;

-- Takes the refresh lease under the advisory lock. `claimed` is false while another run holds an unexpired lease.
create function public.sp_health_token_claim_refresh(p_household uuid, p_person text, p_provider text, p_lease_seconds integer)
returns table (claimed boolean, version integer, refresh_ciphertext text)
language plpgsql security definer set search_path = '' as $$
declare r private.sp_integration_tokens;
begin
  perform pg_advisory_xact_lock(hashtext(p_household::text || p_person || p_provider));
  select * into r from private.sp_integration_tokens t
    where t.household_id = p_household and t.person = p_person and t.provider = p_provider for update;
  if not found then
    return query select false, 0, null::text;
    return;
  end if;
  if r.refresh_lease_until is not null and r.refresh_lease_until > now() then
    return query select false, r.version, null::text;
    return;
  end if;
  update private.sp_integration_tokens t
    set refresh_lease_until = now() + make_interval(secs => least(greatest(p_lease_seconds, 1), 120))
    where t.household_id = p_household and t.person = p_person and t.provider = p_provider;
  return query select true, r.version, r.refresh_ciphertext;
end;
$$;

-- Stores the refreshed pair only if nobody overtook the claim; clears the lease.
create function public.sp_health_token_store_refresh(
  p_household uuid, p_person text, p_provider text, p_version integer, p_access text, p_refresh text, p_expires_at timestamptz
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_household::text || p_person || p_provider));
  update private.sp_integration_tokens t set
    access_ciphertext = p_access, refresh_ciphertext = p_refresh, expires_at = p_expires_at,
    version = t.version + 1, refresh_lease_until = null, updated_at = now()
  where t.household_id = p_household and t.person = p_person and t.provider = p_provider and t.version = p_version;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

create function public.sp_health_token_delete(p_household uuid, p_person text, p_provider text)
returns void
language sql security definer set search_path = '' as $$
  delete from private.sp_integration_tokens t
  where t.household_id = p_household and t.person = p_person and t.provider = p_provider;
$$;

revoke all on function public.sp_health_token_get(uuid, text, text) from public, anon, authenticated;
revoke all on function public.sp_health_token_put(uuid, text, text, text, text, text, timestamptz, text[]) from public, anon, authenticated;
revoke all on function public.sp_health_token_claim_refresh(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.sp_health_token_store_refresh(uuid, text, text, integer, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.sp_health_token_delete(uuid, text, text) from public, anon, authenticated;
grant execute on function public.sp_health_token_get(uuid, text, text) to service_role;
grant execute on function public.sp_health_token_put(uuid, text, text, text, text, text, timestamptz, text[]) to service_role;
grant execute on function public.sp_health_token_claim_refresh(uuid, text, text, integer) to service_role;
grant execute on function public.sp_health_token_store_refresh(uuid, text, text, integer, text, text, timestamptz) to service_role;
grant execute on function public.sp_health_token_delete(uuid, text, text) to service_role;

-- The one read path for health data, for both people. The caller's household comes from household_members, never from a
-- parameter. The owner gets everything; the other member gets only shared metrics, and `hidden` names the withheld ones.
-- Cycle day: a source's own value if it has one, plus a `manual` row per day computed from the latest period start on or
-- before that day (day 1 = the start day; nothing past day 60). At most 400 days per call.
create function public.sp_health_for(p_person text, p_from date, p_to date)
returns table (date date, source text, sleep_score smallint, activity_progress numeric, activity_goal integer,
               activity_goal_unit text, steps integer, cycle_day smallint, synced_at timestamptz, hidden text[])
language sql stable security definer set search_path = '' as $$
  with me as (
    select m.household_id, m.person
    from public.household_members m
    where m.user_id = (select auth.uid()) and m.person in ('a', 'b')
    limit 1
  ),
  v as (
    select me.household_id,
      array(
        select x.metric from unnest(array['sleep_score', 'activity', 'steps', 'cycle_day']) as x(metric)
        where me.person <> p_person
          and not exists (
            select 1 from public.sp_health_sharing s
            where s.household_id = me.household_id and s.person = p_person and s.metric = x.metric and s.shared)
      ) as hidden
    from me
    where p_person in ('a', 'b') and p_from <= p_to and p_to - p_from <= 400
  ),
  r as (
    select d.date, d.source, d.sleep_score, d.activity_progress, d.activity_goal, d.activity_goal_unit, d.steps, d.cycle_day, d.synced_at
    from public.sp_health_daily d join v on d.household_id = v.household_id
    where d.person = p_person and d.date between p_from and p_to
    union all
    select g.day, 'manual', null, null, null, null, null, (g.day - st.period_start + 1)::smallint, st.created_at
    from v
    cross join lateral (select gs::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') gs) g
    cross join lateral (
      select c.period_start, c.created_at from public.sp_cycle_log c
      where c.household_id = v.household_id and c.person = p_person and c.period_start <= g.day
      order by c.period_start desc limit 1
    ) st
    where g.day - st.period_start + 1 <= 60
  )
  select r.date, r.source,
    case when 'sleep_score' = any(v.hidden) then null else r.sleep_score end,
    case when 'activity' = any(v.hidden) then null else r.activity_progress end,
    case when 'activity' = any(v.hidden) then null else r.activity_goal end,
    case when 'activity' = any(v.hidden) then null else r.activity_goal_unit end,
    case when 'steps' = any(v.hidden) then null else r.steps end,
    case when 'cycle_day' = any(v.hidden) then null else r.cycle_day end,
    r.synced_at,
    v.hidden
  from r cross join v
  where not (r.source = 'manual' and 'cycle_day' = any(v.hidden))
  order by r.date, r.source;
$$;
revoke all on function public.sp_health_for(text, date, date) from public, anon;
grant execute on function public.sp_health_for(text, date, date) to authenticated;

-- Connected sources for both people: the owner sees their own error and step goal; the other member sees name and last sync.
create function public.sp_health_sources()
returns table (person text, source text, connected_at timestamptz, last_synced_at timestamptz, last_error text, step_goal integer)
language sql stable security definer set search_path = '' as $$
  select c.person, c.source, c.connected_at, c.last_synced_at,
    case when c.person = me.person then c.last_error end,
    case when c.person = me.person then c.step_goal end
  from public.sp_health_connections c
  join (
    select m.household_id, m.person from public.household_members m
    where m.user_id = (select auth.uid()) and m.person in ('a', 'b') limit 1
  ) me on me.household_id = c.household_id
  order by c.person, c.source;
$$;
revoke all on function public.sp_health_sources() from public, anon;
grant execute on function public.sp_health_sources() to authenticated;

-- Retention (Oura API agreement §3(m), §4(c)): daily rows older than 400 days go. Needs no secret.
select cron.schedule('sp-health-prune', '15 3 * * *', $$delete from public.sp_health_daily where date < current_date - 400$$);
