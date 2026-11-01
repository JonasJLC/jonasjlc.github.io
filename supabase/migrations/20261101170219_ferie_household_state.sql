-- Ferieplan: one shared JSON state per household, protected by row-level security.
-- Access model: only members of a household can read or write its state. Members are added by
-- inviting an email (private.invite); the account is linked automatically on first sign-in.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Ferieplan',
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_id_idx on public.household_members (user_id);

create table public.ferie_state (
  household_id uuid primary key references public.households (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  -- Bumped on every update; clients send the version they read to detect lost updates.
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint ferie_state_size check (pg_column_size(data) < 1048576)
);

-- Invites live in a schema the Data API does not expose.
create table private.household_invites (
  email text primary key check (email = lower(email)),
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.ferie_state enable row level security;

revoke all on public.households, public.household_members, public.ferie_state from anon, authenticated;
grant select on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update on public.ferie_state to authenticated;

create policy "members read their household" on public.households
  for select to authenticated
  using (id in (select household_id from public.household_members where user_id = (select auth.uid())));

create policy "users read their own memberships" on public.household_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "members read state" on public.ferie_state
  for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

create policy "members create state" on public.ferie_state
  for insert to authenticated
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

create policy "members update state" on public.ferie_state
  for update to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())))
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

-- Version bump and audit columns are set by the database, never trusted from the client.
create function private.ferie_state_touch() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.household_id := old.household_id;
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger ferie_state_touch before update on public.ferie_state
  for each row execute function private.ferie_state_touch();

-- Links a new auth user to every household that invited their email.
create function private.claim_household_invites() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.household_members (household_id, user_id)
  select i.household_id, new.id
  from private.household_invites i
  where i.email = lower(new.email)
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.claim_household_invites() from public, anon, authenticated;

create trigger on_auth_user_claim_invites after insert on auth.users
  for each row execute function private.claim_household_invites();

-- Run by hand (SQL editor / MCP) to allow someone in: select private.invite('<household id>', 'name@example.com');
-- Also links the account straight away when that person has already signed in once.
create function private.invite(p_household uuid, p_email text) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  insert into private.household_invites (email, household_id)
  values (lower(trim(p_email)), p_household)
  on conflict (email) do update set household_id = excluded.household_id;

  insert into public.household_members (household_id, user_id)
  select p_household, u.id from auth.users u where lower(u.email) = lower(trim(p_email))
  on conflict do nothing;
end;
$$;
revoke all on function private.invite(uuid, text) from public, anon, authenticated;

-- Live updates between your two phones.
alter publication supabase_realtime add table public.ferie_state;
