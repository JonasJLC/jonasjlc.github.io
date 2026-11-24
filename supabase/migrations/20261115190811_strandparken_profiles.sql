-- Strandparken person profiles (design §5.5.1, D55): dislikes and preferences, one row per person.
-- Both people read both profiles (suggestions use them); each person writes only their own. Allergies are out of scope (D55).

create table public.sp_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  person text not null check (person in ('a', 'b')),
  dislikes text[] not null default '{}' check (cardinality(dislikes) <= 50),
  preferences text check (preferences is null or length(preferences) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (household_id, person)
);

alter table public.sp_profiles enable row level security;
revoke all on public.sp_profiles from anon, authenticated;
grant select, insert, update on public.sp_profiles to authenticated;

create policy "members read profiles" on public.sp_profiles for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

-- A person is the member row whose `person` key matches: the browser cannot change that key (no write grant on household_members).
create policy "own profile insert" on public.sp_profiles for insert to authenticated
  with check (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_profiles.household_id and m.person = sp_profiles.person));

create policy "own profile update" on public.sp_profiles for update to authenticated
  using (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_profiles.household_id and m.person = sp_profiles.person))
  with check (exists (
    select 1 from public.household_members m
    where m.user_id = (select auth.uid()) and m.household_id = sp_profiles.household_id and m.person = sp_profiles.person));

create trigger sp_profiles_touch before insert or update on public.sp_profiles for each row execute function private.sp_touch();
