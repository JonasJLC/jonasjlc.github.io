-- Idé 5: one-off to-dos for the household, shown under Lister › To-do. No recurrence (roadmap Q3).
-- Owner is a person key ('a' Camilla, 'b' Jonas, as household_members.person) or 'both' (Fælles).
create table public.sp_todos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  owner text not null default 'both' check (owner in ('a', 'b', 'both')),
  due_date date,
  note text check (note is null or length(note) <= 1000),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint sp_todos_completed_pair check ((completed_at is null) = (completed_by is null))
);
create index sp_todos_household_idx on public.sp_todos (household_id, completed_at);
create index sp_todos_completed_by_idx on public.sp_todos (completed_by);
create index sp_todos_created_by_idx on public.sp_todos (created_by);

-- Row-level security: the same four member policies as the food tables.
alter table public.sp_todos enable row level security;
revoke all on public.sp_todos from anon, authenticated;
grant select, insert, update, delete on public.sp_todos to authenticated;
create policy "members read" on public.sp_todos for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create policy "members insert" on public.sp_todos for insert to authenticated
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create policy "members update" on public.sp_todos for update to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())))
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create policy "members delete" on public.sp_todos for delete to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

create trigger sp_todos_touch before insert or update on public.sp_todos
  for each row execute function private.sp_touch();

-- Who completed a to-do, and when, is set by the database, never trusted from the client.
create function private.sp_todos_completion() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    new.completed_at := now();
    new.completed_by := (select auth.uid());
  elsif new.completed_at is not null then
    new.completed_at := old.completed_at;  -- already done: keep the original time and person
    new.completed_by := old.completed_by;
  else
    new.completed_by := null;
  end if;
  return new;
end;
$$;
revoke all on function private.sp_todos_completion() from public, anon, authenticated;
create trigger sp_todos_completion before insert or update on public.sp_todos
  for each row execute function private.sp_todos_completion();

-- Live updates between the two phones. Full replica identity so DELETE events carry household_id for filters.
alter table public.sp_todos replica identity full;
alter publication supabase_realtime add table public.sp_todos;
