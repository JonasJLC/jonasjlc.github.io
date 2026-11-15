-- Strandparken row-level security tests (design §2.1, §9.1). Run after the strandparken migrations:
--   supabase db query --linked -f supabase/tests/strandparken_policies.sql
-- Everything runs in a transaction that is rolled back, so no data is left behind.
-- The result is one row: `failures` must be 0 and `failing` empty.
begin;

create temp table r (name text, expected text, actual text);
grant all on r to authenticated, anon;

-- Two households with one member each, plus a signed-in user who belongs to none.
insert into public.households (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'T1'), ('00000000-0000-0000-0000-0000000000a2', 'T2');
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000b1', 'u1@example.test', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000b2', 'u2@example.test', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000b3', 'u3@example.test', 'authenticated', 'authenticated', now());
insert into public.household_members (household_id, user_id, person, is_owner) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'b', true),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 'a', false);
select private.sp_seed_categories(id) from public.households where id in
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');

insert into r select 'seed: recipe categories per household', '8', count(*)::text
  from public.sp_recipe_categories where household_id = '00000000-0000-0000-0000-0000000000a1';
insert into r select 'seed: grocery categories per household', '13', count(*)::text
  from public.sp_grocery_categories where household_id = '00000000-0000-0000-0000-0000000000a1';
select private.sp_seed_categories('00000000-0000-0000-0000-0000000000a1');
insert into r select 'seed: running it again adds nothing', '8', count(*)::text
  from public.sp_recipe_categories where household_id = '00000000-0000-0000-0000-0000000000a1';

-- Helper: records the SQLSTATE a statement raises ('ok' when it succeeds).
create function pg_temp.try(p_name text, p_expected text, p_sql text) returns void
language plpgsql as $$
declare s text := 'ok';
begin
  begin execute p_sql; exception when others then s := sqlstate; end;
  insert into r values (p_name, p_expected, s);
end;
$$;
grant execute on function pg_temp.try(text, text, text) to authenticated, anon;

-- Test data written as the superuser: a recipe, an idea and a plan entry in household 1.
insert into public.sp_recipes (id, household_id, title) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Lasagne');
insert into public.sp_recipe_categories (id, household_id, name, position) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Ekstra', 99);
insert into public.sp_dinner_ideas (id, household_id, title) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'Tacos');

-- Member of household 1 (U1) ---------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

insert into r select 'member reads own recipe categories', '9', count(*)::text from public.sp_recipe_categories;
insert into r select 'member reads own recipes only', '1', count(*)::text from public.sp_recipes;
select pg_temp.try('member can add a recipe', 'ok',
  $$insert into public.sp_recipes (id, household_id, title) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Brød')$$);
insert into r select 'created_by is set from the session', 'true', (created_by = '00000000-0000-0000-0000-0000000000b1')::text
  from public.sp_recipes where id = '00000000-0000-0000-0000-0000000000c2';
select pg_temp.try('created_by cannot be forged', 'ok',
  $$insert into public.sp_recipes (household_id, title, created_by) values ('00000000-0000-0000-0000-0000000000a1', 'Falsk', '00000000-0000-0000-0000-0000000000b2')$$);
insert into r select 'forged created_by was replaced', '0', count(*)::text from public.sp_recipes where created_by = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.try('cannot write into another household', '42501',
  $$insert into public.sp_recipes (household_id, title) values ('00000000-0000-0000-0000-0000000000a2', 'Snyd')$$);
select pg_temp.try('household_id cannot be moved', 'ok',
  $$update public.sp_recipes set household_id = '00000000-0000-0000-0000-0000000000a2' where id = '00000000-0000-0000-0000-0000000000c1'$$);
insert into r select 'household_id stayed put', '1', count(*)::text from public.sp_recipes where id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.try('plan entry needs exactly one dish (none)', '23514',
  $$insert into public.sp_meal_plan_entries (household_id, date) values ('00000000-0000-0000-0000-0000000000a1', '2026-12-01')$$);
select pg_temp.try('plan entry needs exactly one dish (two)', '23514',
  $$insert into public.sp_meal_plan_entries (household_id, date, recipe_id, free_text) values ('00000000-0000-0000-0000-0000000000a1', '2026-12-01', '00000000-0000-0000-0000-0000000000c1', 'x')$$);
select pg_temp.try('plan entry with a recipe', 'ok',
  $$insert into public.sp_meal_plan_entries (household_id, date, recipe_id) values ('00000000-0000-0000-0000-0000000000a1', '2026-12-01', '00000000-0000-0000-0000-0000000000c1')$$);
select pg_temp.try('one plan entry per day', '23505',
  $$insert into public.sp_meal_plan_entries (household_id, date, idea_id) values ('00000000-0000-0000-0000-0000000000a1', '2026-12-01', '00000000-0000-0000-0000-0000000000d1')$$);
select pg_temp.try('shopping item with an unknown status', '23514',
  $$insert into public.sp_shopping_items (household_id, name, status) values ('00000000-0000-0000-0000-0000000000a1', 'Mælk', 'weird')$$);
select pg_temp.try('shopping item', 'ok',
  $$insert into public.sp_shopping_items (household_id, name, recipe_id) values ('00000000-0000-0000-0000-0000000000a1', 'Mælk', '00000000-0000-0000-0000-0000000000c1')$$);
select pg_temp.try('members cannot edit household_members', '42501',
  $$update public.household_members set person = 'a'$$);
select pg_temp.try('members cannot make themselves owner', '42501',
  $$update public.household_members set is_owner = true$$);
insert into r select 'member can read own membership with person', 'b', person from public.household_members;
select pg_temp.try('member uploads to own folder', 'ok',
  $$insert into storage.objects (bucket_id, name, owner_id) values ('sp-recipes', '00000000-0000-0000-0000-0000000000a1/p.jpg', '00000000-0000-0000-0000-0000000000b1')$$);
select pg_temp.try('member cannot upload to another household folder', '42501',
  $$insert into storage.objects (bucket_id, name, owner_id) values ('sp-recipes', '00000000-0000-0000-0000-0000000000a2/p.jpg', '00000000-0000-0000-0000-0000000000b1')$$);
select pg_temp.try('member cannot upload outside a household folder', '42501',
  $$insert into storage.objects (bucket_id, name, owner_id) values ('sp-documents', 'loose.pdf', '00000000-0000-0000-0000-0000000000b1')$$);
insert into r select 'member reads own storage objects', '1', count(*)::text from storage.objects where bucket_id = 'sp-recipes';

-- Member of household 2 (U2) ---------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;

insert into r select 'other household sees none of the recipes', '0', count(*)::text from public.sp_recipes;
insert into r select 'other household sees none of the plan', '0', count(*)::text from public.sp_meal_plan_entries;
insert into r select 'other household sees none of the shopping list', '0', count(*)::text from public.sp_shopping_items;
insert into r select 'other household sees none of the storage objects', '0', count(*)::text from storage.objects where bucket_id = 'sp-recipes';
insert into r select 'other household sees only its own categories', '8', count(*)::text from public.sp_recipe_categories;
select pg_temp.try('cannot reference another household category', '23503',
  $$insert into public.sp_recipes (household_id, title, category_id) values ('00000000-0000-0000-0000-0000000000a2', 'X', '00000000-0000-0000-0000-0000000000e1')$$);
select pg_temp.try('cannot reference another household recipe', '23503',
  $$insert into public.sp_meal_plan_entries (household_id, date, recipe_id) values ('00000000-0000-0000-0000-0000000000a2', '2026-12-02', '00000000-0000-0000-0000-0000000000c1')$$);
with d as (update public.sp_recipes set title = 'Hacked' where id = '00000000-0000-0000-0000-0000000000c1' returning 1)
  insert into r select 'cannot update another household recipe', '0', count(*)::text from d;
with d as (delete from public.sp_recipes where id = '00000000-0000-0000-0000-0000000000c1' returning 1)
  insert into r select 'cannot delete another household recipe', '0', count(*)::text from d;

-- Signed in, but a member of nothing (U3) --------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
set local role authenticated;

insert into r select 'non-member sees no recipes', '0', count(*)::text from public.sp_recipes;
insert into r select 'non-member sees no categories', '0', count(*)::text from public.sp_recipe_categories;
insert into r select 'non-member sees no grocery categories', '0', count(*)::text from public.sp_grocery_categories;
insert into r select 'non-member sees no ideas', '0', count(*)::text from public.sp_dinner_ideas;
insert into r select 'non-member sees no ingredients', '0', count(*)::text from public.sp_recipe_ingredients;
insert into r select 'non-member sees no plan', '0', count(*)::text from public.sp_meal_plan_entries;
insert into r select 'non-member sees no shopping list', '0', count(*)::text from public.sp_shopping_items;
insert into r select 'non-member sees no storage objects', '0', count(*)::text from storage.objects where bucket_id in ('sp-recipes', 'sp-documents');
insert into r select 'non-member sees no households', '0', count(*)::text from public.households;
select pg_temp.try('non-member cannot add a recipe', '42501',
  $$insert into public.sp_recipes (household_id, title) values ('00000000-0000-0000-0000-0000000000a1', 'Snyd')$$);

-- Not signed in -----------------------------------------------------------------------------------------------
reset role;
set local role anon;
select pg_temp.try('anon cannot read recipes', '42501', $$select * from public.sp_recipes$$);
select pg_temp.try('anon cannot read the shopping list', '42501', $$select * from public.sp_shopping_items$$);

reset role;
-- One result row: failures must be 0 and `failing` empty. (Remove the filter to see every check.)
select count(*) filter (where expected <> actual) as failures, count(*) as checks,
       coalesce(json_agg(r) filter (where expected <> actual), '[]'::json) as failing
from r;
rollback;
