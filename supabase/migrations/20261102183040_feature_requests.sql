-- Ferieplan feature requests: household members describe what they wish the app could do in a
-- small AI chat (edge function `feature-chat`); the structured result lands here as a backlog.
-- Access model: every member of the household can read and add requests; only owners can change
-- the status or leave a note. Mark an owner by hand:
--   update public.household_members set is_owner = true
--   where user_id = (select id from auth.users where lower(email) = 'name@example.com');

alter table public.household_members add column is_owner boolean not null default false;

create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default '',
  title text not null check (char_length(title) between 3 and 120),
  summary text not null check (char_length(summary) between 3 and 1000),
  -- Extra fields from the chat: why it matters, area of the app, what "done" looks like.
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) < 8192),
  -- The conversation that produced the request, kept so the owner can read the original words.
  transcript jsonb not null default '[]'::jsonb check (pg_column_size(transcript) < 32768),
  status text not null default 'new' check (status in ('new', 'approved', 'building', 'done', 'declined')),
  owner_note text check (owner_note is null or char_length(owner_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feature_requests_household_idx on public.feature_requests (household_id, created_at desc);

alter table public.feature_requests enable row level security;

revoke all on public.feature_requests from anon, authenticated;
grant select, insert on public.feature_requests to authenticated;
-- Owners may only change these two columns; everything else is fixed once saved.
grant update (status, owner_note) on public.feature_requests to authenticated;

create policy "members read requests" on public.feature_requests
  for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

create policy "members add requests" on public.feature_requests
  for insert to authenticated
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

create policy "owners triage requests" on public.feature_requests
  for update to authenticated
  using (household_id in (
    select household_id from public.household_members where user_id = (select auth.uid()) and is_owner
  ))
  with check (household_id in (
    select household_id from public.household_members where user_id = (select auth.uid()) and is_owner
  ));

-- Author, name and the starting status are set by the database, never trusted from the client.
create function private.feature_requests_before_insert() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  new.created_by_name := left(coalesce(
    (select auth.jwt()) -> 'user_metadata' ->> 'full_name',
    (select auth.jwt()) ->> 'email',
    ''
  ), 80);
  new.status := 'new';
  new.owner_note := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger feature_requests_before_insert before insert on public.feature_requests
  for each row execute function private.feature_requests_before_insert();

create function private.feature_requests_touch() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger feature_requests_touch before update on public.feature_requests
  for each row execute function private.feature_requests_touch();

-- One row per chat turn, written only by the edge function (service role) to rate-limit the AI.
create table public.feature_chat_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  called_at timestamptz not null default now()
);
create index feature_chat_calls_user_idx on public.feature_chat_calls (user_id, called_at desc);
alter table public.feature_chat_calls enable row level security;
revoke all on public.feature_chat_calls from anon, authenticated;

-- Live updates between your two phones.
alter publication supabase_realtime add table public.feature_requests;
