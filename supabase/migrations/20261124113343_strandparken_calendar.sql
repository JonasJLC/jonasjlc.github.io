-- Idé 7: calendar on Hjem, option A (private iCal feeds, roadmap Q1). Read only: the app never creates or edits events.
-- public.sp_calendar_sources holds what the browser may see: label, colour, Fælles, Vis. The owner sees all of their own
-- calendars; the other person sees only the shared ones. private.sp_calendar_feeds holds the encrypted address and the
-- event cache; only the `calendar` edge function reaches it, through the service-role functions at the end.

create table public.sp_calendar_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  person text not null check (person in ('a', 'b')),
  label text not null check (length(btrim(label)) between 1 and 60),
  color text not null check (color in ('cal-1', 'cal-2', 'cal-3', 'cal-4', 'cal-5', 'cal-6')), -- a token key, never a hex value
  shared boolean not null default false, -- "Fælles": shown on both dashboards
  enabled boolean not null default true,
  position integer not null default 0,
  last_fetched_at timestamptz,
  last_error text check (last_error is null or last_error in ('fetch_failed', 'blocked', 'too_large', 'not_calendar', 'parse_failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (id, household_id)
);
create index sp_calendar_sources_household_idx on public.sp_calendar_sources (household_id, person, position);
create index sp_calendar_sources_created_by_idx on public.sp_calendar_sources (created_by);

-- No insert grant: a calendar is created by the function together with its address, so a row never exists without one.
-- The owner may change only the label, colour, Fælles, Vis and order, and may delete.
alter table public.sp_calendar_sources enable row level security;
revoke all on public.sp_calendar_sources from anon, authenticated;
grant select, delete on public.sp_calendar_sources to authenticated;
grant update (label, color, shared, enabled, position) on public.sp_calendar_sources to authenticated;

create policy "own or shared calendars read" on public.sp_calendar_sources for select to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_calendar_sources.household_id
      and (m.person = sp_calendar_sources.person or sp_calendar_sources.shared)));

create policy "own calendars update" on public.sp_calendar_sources for update to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_calendar_sources.household_id and m.person = sp_calendar_sources.person))
  with check (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_calendar_sources.household_id and m.person = sp_calendar_sources.person));

create policy "own calendars delete" on public.sp_calendar_sources for delete to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_calendar_sources.household_id and m.person = sp_calendar_sources.person));

-- Like private.sp_touch, but created_by comes from the function (it inserts as the service role, so auth.uid() is null),
-- and the owner, household and fetch state can never be changed by an update from the browser.
create function private.sp_calendar_sources_touch() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.household_id := old.household_id;
    new.person := old.person;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.sp_calendar_sources_touch() from public, anon, authenticated;
create trigger sp_calendar_sources_touch before insert or update on public.sp_calendar_sources
  for each row execute function private.sp_calendar_sources_touch();

create table private.sp_calendar_feeds (
  source_id uuid primary key references public.sp_calendar_sources (id) on delete cascade,
  url_cipher text not null,   -- base64(iv || AES-GCM ciphertext); the key is the edge function secret SP_FEED_KEY
  cached_events jsonb,        -- events in the cached window only: uid, title, start, end, allDay
  cached_for date,            -- the Copenhagen date the cache was built for
  cached_at timestamptz
);
revoke all on private.sp_calendar_feeds from public, anon, authenticated;

-- The function's three ways in, callable by the service role only. security definer because the private schema is not
-- granted to the service role; each one checks its arguments itself.

-- A new calendar and its sealed address in one transaction. At most 10 calendars per person.
create function public.sp_calendar_add(
  p_household uuid, p_person text, p_user uuid, p_label text, p_color text, p_shared boolean, p_cipher text
) returns public.sp_calendar_sources
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.sp_calendar_sources;
begin
  if not exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = p_user and person = p_person
  ) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if (select count(*) from public.sp_calendar_sources where household_id = p_household and person = p_person) >= 10 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  insert into public.sp_calendar_sources (household_id, person, label, color, shared, position, created_by)
  values (
    p_household, p_person, btrim(p_label), p_color, p_shared,
    coalesce((select max(position) + 1 from public.sp_calendar_sources where household_id = p_household and person = p_person), 0),
    p_user)
  returning * into v_row;
  insert into private.sp_calendar_feeds (source_id, url_cipher) values (v_row.id, p_cipher);
  return v_row;
end;
$$;

-- The enabled calendars this person may see (own, or the other person's shared), own first, with sealed address and cache.
create function public.sp_calendar_feeds_for(p_household uuid, p_person text)
returns table (
  source_id uuid, person text, color text, shared boolean,
  url_cipher text, cached_events jsonb, cached_for date, cached_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.person, s.color, s.shared, f.url_cipher, f.cached_events, f.cached_for, f.cached_at
  from public.sp_calendar_sources s
  join private.sp_calendar_feeds f on f.source_id = s.id
  where s.household_id = p_household and s.enabled and (s.person = p_person or s.shared)
  order by (s.person = p_person) desc, s.position, s.created_at;
$$;

-- After a fetch: the events and the date they are for, or the error code. A failure keeps the old cache.
create function public.sp_calendar_save_cache(p_source uuid, p_events jsonb, p_for date, p_error text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_error is null then
    update private.sp_calendar_feeds set cached_events = p_events, cached_for = p_for, cached_at = now() where source_id = p_source;
    update public.sp_calendar_sources set last_fetched_at = now(), last_error = null where id = p_source;
  else
    update public.sp_calendar_sources set last_error = p_error where id = p_source;
  end if;
end;
$$;

revoke all on function public.sp_calendar_add(uuid, text, uuid, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.sp_calendar_feeds_for(uuid, text) from public, anon, authenticated;
revoke all on function public.sp_calendar_save_cache(uuid, jsonb, date, text) from public, anon, authenticated;
grant execute on function public.sp_calendar_add(uuid, text, uuid, text, text, boolean, text) to service_role;
grant execute on function public.sp_calendar_feeds_for(uuid, text) to service_role;
grant execute on function public.sp_calendar_save_cache(uuid, jsonb, date, text) to service_role;
