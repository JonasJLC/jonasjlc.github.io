-- Idé 13: a unit chosen in the shopping list is remembered per ingredient for the household.
-- `ingredient_key` is a key from src/components/strandparken/lib/shopping/ingredients-dk.ts, or "?<canonical name>" for an
-- unknown ingredient. `unit = 'recipe'` means "show the recipe amount, rounded up". No realtime: preferences are read
-- when the list loads.
create table public.sp_unit_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  ingredient_key text not null check (length(ingredient_key) between 1 and 120),
  unit text not null check (unit in ('stk','g','kg','ml','l','dåse','bakke','pakke','bæger','karton','glas','pose','bundt','net','flaske','tube','recipe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (household_id, ingredient_key)
);

-- Same household policy shape as the Phase 1 tables.
alter table public.sp_unit_preferences enable row level security;
revoke all on public.sp_unit_preferences from anon, authenticated;
grant select, insert, update, delete on public.sp_unit_preferences to authenticated;
create policy "members read" on public.sp_unit_preferences for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create policy "members insert" on public.sp_unit_preferences for insert to authenticated
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create policy "members update" on public.sp_unit_preferences for update to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())))
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create policy "members delete" on public.sp_unit_preferences for delete to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create trigger sp_unit_preferences_touch before insert or update on public.sp_unit_preferences
  for each row execute function private.sp_touch();
