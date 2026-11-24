-- Idé 15: habits under Sundhed › Vaner. Two tables, with the rules enforced by the database and not by the screen:
-- - a person writes only their own personal habit (owner 'a' or 'b'), and either person writes a shared one ('both' = Fælles);
-- - nobody ticks an automatic habit by hand;
-- - `source = 'automatic'` comes only from the service role (health-sync), never from a signed-in client.
-- Owner is a person key ('a' Camilla, 'b' Jonas, as household_members.person) or 'both'. Reminders are stored only (roadmap Q5).

create table public.sp_habits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner text not null check (owner in ('a', 'b', 'both')),
  title text not null check (length(btrim(title)) between 1 and 80),
  tracking text not null default 'manual' check (tracking in ('manual', 'automatic')),
  frequency text not null default 'daily' check (frequency in ('daily', 'per_week', 'weekdays')),
  per_week_count smallint check (per_week_count between 1 and 7),
  weekdays smallint[] check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]), -- ISO, 1 = Monday
  reminder_time time,
  color text not null default 'sage' check (color in ('sage', 'moss', 'sky', 'lavender', 'plum', 'rose', 'clay', 'sand')),
  icon text check (length(icon) <= 16), -- an emoji or a lucide icon key
  rule jsonb, -- {metric, op, threshold}
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (id, household_id),
  constraint sp_habits_frequency check (
    (frequency = 'daily' and per_week_count is null and weekdays is null) or
    (frequency = 'per_week' and per_week_count is not null and weekdays is null) or
    (frequency = 'weekdays' and cardinality(weekdays) between 1 and 7 and per_week_count is null)),
  constraint sp_habits_rule check (
    (tracking = 'manual' and rule is null) or
    (tracking = 'automatic' and rule ->> 'metric' in ('steps', 'sleep_score', 'activity_progress')
      and rule ->> 'op' in ('>=', '>') and jsonb_typeof(rule -> 'threshold') = 'number')),
  -- Automatic habits read one person's health data, so they are personal in this round (plan 15, open question 3).
  constraint sp_habits_automatic_personal check (tracking = 'manual' or owner in ('a', 'b'))
);
create index sp_habits_household_idx on public.sp_habits (household_id, archived_at);
create index sp_habits_created_by_idx on public.sp_habits (created_by);

create table public.sp_habit_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  habit_id uuid not null,
  date date not null,
  completed_by text not null check (completed_by in ('a', 'b')),
  source text not null default 'manual' check (source in ('manual', 'automatic')),
  created_at timestamptz not null default now(),
  unique (habit_id, date),
  foreign key (habit_id, household_id) references public.sp_habits (id, household_id) on delete cascade
);
create index sp_habit_completions_household_idx on public.sp_habit_completions (household_id, date);

-- Row-level security. Members read every habit and completion in their household (main spec §2.1: the other person's
-- personal habits are readable; the screen lists only Mine and Fælles). A person is the member row whose `person` key matches.
alter table public.sp_habits enable row level security;
revoke all on public.sp_habits from anon, authenticated;
grant select, insert, update, delete on public.sp_habits to authenticated;

create policy "members read habits" on public.sp_habits for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

create policy "write own or shared habit insert" on public.sp_habits for insert to authenticated
  with check (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_habits.household_id
      and (sp_habits.owner = 'both' or sp_habits.owner = m.person)));

create policy "write own or shared habit update" on public.sp_habits for update to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_habits.household_id
      and (sp_habits.owner = 'both' or sp_habits.owner = m.person)))
  with check (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_habits.household_id
      and (sp_habits.owner = 'both' or sp_habits.owner = m.person)));

create policy "write own or shared habit delete" on public.sp_habits for delete to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_habits.household_id
      and (sp_habits.owner = 'both' or sp_habits.owner = m.person)));

alter table public.sp_habit_completions enable row level security;
revoke all on public.sp_habit_completions from anon, authenticated;
grant select, insert, delete on public.sp_habit_completions to authenticated; -- no update: a completion is made or undone

create policy "members read completions" on public.sp_habit_completions for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

-- Tick or undo only a habit that is shared or yours, in your own household.
create policy "tick own or shared habit" on public.sp_habit_completions for insert to authenticated
  with check (exists (
    select 1 from public.household_members m
    join public.sp_habits h on h.household_id = m.household_id
    where m.user_id = (select auth.uid()) and m.household_id = sp_habit_completions.household_id
      and h.id = sp_habit_completions.habit_id and (h.owner = 'both' or h.owner = m.person)));

create policy "undo own or shared habit" on public.sp_habit_completions for delete to authenticated
  using (exists (
    select 1 from public.household_members m
    join public.sp_habits h on h.household_id = m.household_id
    where m.user_id = (select auth.uid()) and m.household_id = sp_habit_completions.household_id
      and h.id = sp_habit_completions.habit_id and (h.owner = 'both' or h.owner = m.person)));

-- Audit columns from the database, and the owner of a habit never changes (so a habit cannot be handed over to be edited).
create trigger sp_habits_touch before insert or update on public.sp_habits
  for each row execute function private.sp_touch();

create function private.sp_habits_guard() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.owner := old.owner;
  return new;
end;
$$;
revoke all on function private.sp_habits_guard() from public, anon, authenticated;
create trigger sp_habits_guard before update on public.sp_habits
  for each row execute function private.sp_habits_guard();

-- Completions made by a signed-in person: `completed_by` is the caller's person key, `source` is always 'manual', and an
-- automatic habit cannot be ticked (P0001). The service role (no auth.uid()) may store 'automatic' completions.
-- The habit is read as the caller, so a non-member learns nothing from the error.
create function private.sp_habit_completion_insert() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tracking text;
  v_person text;
begin
  if new.date > current_date + 1 then
    raise exception 'habit completion too far in the future' using errcode = '23514';
  end if;
  new.created_at := now();
  if v_uid is not null then
    select h.tracking into v_tracking from public.sp_habits h where h.id = new.habit_id and h.household_id = new.household_id;
    select m.person into v_person from public.household_members m where m.user_id = v_uid and m.household_id = new.household_id;
    if v_tracking = 'automatic' then
      raise exception 'automatic habits complete themselves' using errcode = 'P0001';
    end if;
    if v_person is not null then
      new.completed_by := v_person;
    end if;
    new.source := 'manual';
  end if;
  return new;
end;
$$;
revoke all on function private.sp_habit_completion_insert() from public, anon, authenticated;
create trigger sp_habit_completion_insert before insert on public.sp_habit_completions
  for each row execute function private.sp_habit_completion_insert();

-- An automatic completion is never undone by hand (P0001). Deleting the habit still removes it: that is a cascade, which
-- runs at trigger depth 2 or more.
create function private.sp_habit_completion_delete() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if old.source = 'automatic' and (select auth.uid()) is not null and pg_trigger_depth() = 1 then
    raise exception 'automatic completions cannot be undone' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
revoke all on function private.sp_habit_completion_delete() from public, anon, authenticated;
create trigger sp_habit_completion_delete before delete on public.sp_habit_completions
  for each row execute function private.sp_habit_completion_delete();

-- Live updates between the two phones. Full replica identity so DELETE events carry household_id for filters.
alter table public.sp_habits replica identity full;
alter table public.sp_habit_completions replica identity full;
alter publication supabase_realtime add table public.sp_habits, public.sp_habit_completions;
