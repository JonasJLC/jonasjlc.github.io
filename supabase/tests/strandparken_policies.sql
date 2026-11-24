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
select pg_temp.try('member saves a unit preference', 'ok',
  $$insert into public.sp_unit_preferences (household_id, ingredient_key, unit) values ('00000000-0000-0000-0000-0000000000a1', 'tomat', 'stk')$$);
select pg_temp.try('one unit preference per ingredient', '23505',
  $$insert into public.sp_unit_preferences (household_id, ingredient_key, unit) values ('00000000-0000-0000-0000-0000000000a1', 'tomat', 'g')$$);
select pg_temp.try('unit preference with an unknown unit', '23514',
  $$insert into public.sp_unit_preferences (household_id, ingredient_key, unit) values ('00000000-0000-0000-0000-0000000000a1', 'lime', 'spsk')$$);
select pg_temp.try('member changes a unit preference', 'ok',
  $$update public.sp_unit_preferences set unit = 'bakke' where ingredient_key = 'tomat'$$);
insert into r select 'member reads own unit preferences', 'bakke', unit from public.sp_unit_preferences;
select pg_temp.try('cannot save a unit preference for another household', '42501',
  $$insert into public.sp_unit_preferences (household_id, ingredient_key, unit) values ('00000000-0000-0000-0000-0000000000a2', 'lime', 'stk')$$);
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
select pg_temp.try('member adds a to-do', 'ok',
  $$insert into public.sp_todos (id, household_id, title) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Ring til VVS')$$);
insert into r select 'a new to-do is Fælles by default', 'both', owner from public.sp_todos where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.try('to-do owner must be a, b or both', '23514',
  $$insert into public.sp_todos (household_id, title, owner) values ('00000000-0000-0000-0000-0000000000a1', 'X', 'x')$$);
select pg_temp.try('to-do title cannot be blank', '23514',
  $$insert into public.sp_todos (household_id, title) values ('00000000-0000-0000-0000-0000000000a1', '   ')$$);
select pg_temp.try('member completes a to-do with a forged completed_by', 'ok',
  $$update public.sp_todos set completed_at = '2000-01-01', completed_by = '00000000-0000-0000-0000-0000000000b2' where id = '00000000-0000-0000-0000-0000000000f1'$$);
insert into r select 'completed_by is the caller, completed_at is now', 'true',
  (completed_by = '00000000-0000-0000-0000-0000000000b1' and completed_at > now() - interval '1 minute')::text
  from public.sp_todos where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.try('a done to-do keeps who completed it', 'ok',
  $$update public.sp_todos set completed_at = now(), completed_by = '00000000-0000-0000-0000-0000000000b2', title = 'Ring til VVS i dag' where id = '00000000-0000-0000-0000-0000000000f1'$$);
insert into r select 'completed_by stayed the caller', '00000000-0000-0000-0000-0000000000b1', completed_by::text
  from public.sp_todos where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.try('to-do inserted as done is stamped by the database', 'ok',
  $$insert into public.sp_todos (id, household_id, title, completed_at, completed_by) values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'Gammel', '2000-01-01', '00000000-0000-0000-0000-0000000000b2')$$);
insert into r select 'restored done to-do carries the caller', '00000000-0000-0000-0000-0000000000b1', completed_by::text
  from public.sp_todos where id = '00000000-0000-0000-0000-0000000000f2';
select pg_temp.try('member reopens a to-do', 'ok',
  $$update public.sp_todos set completed_at = null where id = '00000000-0000-0000-0000-0000000000f2'$$);
insert into r select 'reopened to-do has no completed_by', 'true', (completed_by is null)::text
  from public.sp_todos where id = '00000000-0000-0000-0000-0000000000f2';
select pg_temp.try('cannot add a to-do to another household', '42501',
  $$insert into public.sp_todos (household_id, title) values ('00000000-0000-0000-0000-0000000000a2', 'Snyd')$$);
insert into r select 'member reads own to-dos', '2', count(*)::text from public.sp_todos;

-- Member of household 2 (U2) ---------------------------------------------------------------------------------
reset role;
-- Profiles: U1 is person 'b' in household 1; U4 joins household 1 as person 'a'.
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000b4', 'u4@example.test', 'authenticated', 'authenticated', now());
insert into public.household_members (household_id, user_id, person, is_owner) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b4', 'a', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.try('person writes own profile', 'ok',
  $$insert into public.sp_profiles (household_id, person, dislikes) values ('00000000-0000-0000-0000-0000000000a1', 'b', '{koriander}')$$);
select pg_temp.try('person cannot write the other person''s profile', '42501',
  $$insert into public.sp_profiles (household_id, person) values ('00000000-0000-0000-0000-0000000000a1', 'a')$$);
select pg_temp.try('person cannot write a profile in another household', '42501',
  $$insert into public.sp_profiles (household_id, person) values ('00000000-0000-0000-0000-0000000000a2', 'b')$$);
select pg_temp.try('one profile per person', '23505',
  $$insert into public.sp_profiles (household_id, person) values ('00000000-0000-0000-0000-0000000000a1', 'b')$$);
select pg_temp.try('person cannot hand their profile to the other person', '42501',
  $$update public.sp_profiles set person = 'a' where person = 'b'$$);
select pg_temp.try('person cannot delete a profile', '42501', $$delete from public.sp_profiles where person = 'b'$$);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'both people read both profiles', '1', count(*)::text from public.sp_profiles;
select pg_temp.try('the other person cannot change it', 'ok', $$update public.sp_profiles set dislikes = '{}' where person = 'b'$$);
insert into r select 'the other person''s update changed nothing', '{koriander}', dislikes::text from public.sp_profiles where person = 'b';

-- Calendars (Idé 7): U1 is 'b' and U4 is 'a' in household 1. Rows are made by the calendar function's service-role helper.
reset role;
select public.sp_calendar_add('00000000-0000-0000-0000-0000000000a1', 'b', '00000000-0000-0000-0000-0000000000b1', 'Jonas privat', 'cal-1', false, 'cipher-private');
select public.sp_calendar_add('00000000-0000-0000-0000-0000000000a1', 'b', '00000000-0000-0000-0000-0000000000b1', 'Fælles', 'cal-2', true, 'cipher-shared');
insert into r select 'calendar: add stores a feed with each calendar', '2', count(*)::text
  from private.sp_calendar_feeds f join public.sp_calendar_sources s on s.id = f.source_id where s.household_id = '00000000-0000-0000-0000-0000000000a1';
insert into r select 'calendar: add sets created_by and positions', '{0,1}', array_agg(position order by position)::text
  from public.sp_calendar_sources where household_id = '00000000-0000-0000-0000-0000000000a1' and created_by = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.try('calendar: add refuses a person key that is not the caller''s', '42501',
  $$select public.sp_calendar_add('00000000-0000-0000-0000-0000000000a1', 'a', '00000000-0000-0000-0000-0000000000b1', 'Snyd', 'cal-1', false, 'c')$$);
insert into r select 'calendar: feeds for the owner lists both', '2', count(*)::text from public.sp_calendar_feeds_for('00000000-0000-0000-0000-0000000000a1', 'b');
insert into r select 'calendar: feeds for the other person lists only the shared one', 'cipher-shared', string_agg(url_cipher, ',')
  from public.sp_calendar_feeds_for('00000000-0000-0000-0000-0000000000a1', 'a');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'calendar: owner reads own private and shared calendars', '2', count(*)::text from public.sp_calendar_sources;
select pg_temp.try('calendar: the browser cannot add a calendar', '42501',
  $$insert into public.sp_calendar_sources (household_id, person, label, color) values ('00000000-0000-0000-0000-0000000000a1', 'b', 'X', 'cal-1')$$);
select pg_temp.try('calendar: owner renames and hides a calendar', 'ok',
  $$update public.sp_calendar_sources set label = 'Arbejde', enabled = false where label = 'Jonas privat'$$);
insert into r select 'calendar: hidden calendars are not fetched', '1', count(*)::text from public.sp_calendar_sources where enabled;
select pg_temp.try('calendar: owner cannot set the fetch state', '42501', $$update public.sp_calendar_sources set last_error = 'blocked'$$);
select pg_temp.try('calendar: owner cannot hand a calendar to the other person', '42501', $$update public.sp_calendar_sources set person = 'a'$$);
select pg_temp.try('calendar: authenticated cannot read the feeds', '42501', $$select * from private.sp_calendar_feeds$$);
select pg_temp.try('calendar: authenticated cannot call feeds_for', '42501', $$select * from public.sp_calendar_feeds_for('00000000-0000-0000-0000-0000000000a1', 'b')$$);
select pg_temp.try('calendar: authenticated cannot call add', '42501',
  $$select public.sp_calendar_add('00000000-0000-0000-0000-0000000000a1', 'b', '00000000-0000-0000-0000-0000000000b1', 'X', 'cal-1', false, 'c')$$);
select pg_temp.try('calendar: authenticated cannot call save_cache', '42501',
  $$select public.sp_calendar_save_cache(gen_random_uuid(), null, null, 'blocked')$$);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'calendar: the other person reads only the shared calendar', 'Fælles', string_agg(label, ',') from public.sp_calendar_sources;
with d as (update public.sp_calendar_sources set label = 'Hacked' returning 1)
  insert into r select 'calendar: the other person cannot update a shared calendar', '0', count(*)::text from d;
with d as (delete from public.sp_calendar_sources returning 1)
  insert into r select 'calendar: the other person cannot delete a shared calendar', '0', count(*)::text from d;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
with d as (delete from public.sp_calendar_sources where label = 'Arbejde' returning 1)
  insert into r select 'calendar: owner deletes a calendar', '1', count(*)::text from d;
reset role;
insert into r select 'calendar: deleting a calendar deletes its feed', '1', count(*)::text
  from private.sp_calendar_feeds f join public.sp_calendar_sources s on s.id = f.source_id where s.household_id = '00000000-0000-0000-0000-0000000000a1';

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;

insert into r select 'other household sees none of the recipes', '0', count(*)::text from public.sp_recipes;
insert into r select 'other household sees none of the plan', '0', count(*)::text from public.sp_meal_plan_entries;
insert into r select 'other household sees none of the shopping list', '0', count(*)::text from public.sp_shopping_items;
insert into r select 'other household sees none of the to-dos', '0', count(*)::text from public.sp_todos;
insert into r select 'other household sees none of the calendars', '0', count(*)::text from public.sp_calendar_sources;
with d as (update public.sp_todos set title = 'Hacked' where id = '00000000-0000-0000-0000-0000000000f1' returning 1)
  insert into r select 'cannot update another household to-do', '0', count(*)::text from d;
with d as (delete from public.sp_todos where id = '00000000-0000-0000-0000-0000000000f1' returning 1)
  insert into r select 'cannot delete another household to-do', '0', count(*)::text from d;
insert into r select 'other household sees none of the unit preferences', '0', count(*)::text from public.sp_unit_preferences;
with d as (update public.sp_unit_preferences set unit = 'g' returning 1)
  insert into r select 'cannot change another household unit preference', '0', count(*)::text from d;
with d as (delete from public.sp_unit_preferences returning 1)
  insert into r select 'cannot delete another household unit preference', '0', count(*)::text from d;
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
with d as (update public.sp_recipes set image_fetch_attempted_at = now() where id = '00000000-0000-0000-0000-0000000000c1' returning 1)
  insert into r select 'cannot update another household recipe photo fetch state', '0', count(*)::text from d;

-- Health (idea 10): in household 1, U4 is Camilla ('a') and U1 is Jonas ('b'). Rows written as the superuser, as the
-- edge functions do with the service role.
reset role;
insert into public.sp_health_daily (household_id, person, date, source, sleep_score, activity_progress, activity_goal, activity_goal_unit, steps) values
  ('00000000-0000-0000-0000-0000000000a1', 'a', current_date, 'oura', 81, 0.5, 500, 'kcal', 8000),
  ('00000000-0000-0000-0000-0000000000a1', 'b', current_date, 'garmin', 70, 0.7, 10000, 'steps', 7000);
insert into private.sp_integration_tokens (household_id, person, provider, access_ciphertext) values
  ('00000000-0000-0000-0000-0000000000a1', 'a', 'oura', 'iv.ct');
insert into public.sp_health_connections (household_id, person, source, last_error, step_goal) values
  ('00000000-0000-0000-0000-0000000000a1', 'a', 'oura', 'upstream', 9000);
insert into public.sp_cycle_log (household_id, person, period_start) values
  ('00000000-0000-0000-0000-0000000000a1', 'a', current_date - 4);
-- The single-use refresh lease (run as the superuser, standing in for the service role).
insert into r select 'health: a claim takes the refresh lease', 'true,1', claimed::text || ',' || version
  from public.sp_health_token_claim_refresh('00000000-0000-0000-0000-0000000000a1', 'a', 'oura', 30);
insert into r select 'health: a second claim is refused while the lease runs', 'false', claimed::text
  from public.sp_health_token_claim_refresh('00000000-0000-0000-0000-0000000000a1', 'a', 'oura', 30);
insert into r select 'health: an overtaken refresh is not stored', 'false',
  public.sp_health_token_store_refresh('00000000-0000-0000-0000-0000000000a1', 'a', 'oura', 7, 'x', 'y', now())::text;
insert into r select 'health: the claimed refresh is stored once', 'true',
  public.sp_health_token_store_refresh('00000000-0000-0000-0000-0000000000a1', 'a', 'oura', 1, 'x', 'y', now())::text;
insert into r select 'health: storing frees the lease', 'true,2', claimed::text || ',' || version
  from public.sp_health_token_claim_refresh('00000000-0000-0000-0000-0000000000a1', 'a', 'oura', 30);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'health: owner reads own rows only', '1', count(*)::text from public.sp_health_daily;
insert into r select 'health: owner gets every own metric', '81,8000,0.500', concat_ws(',', sleep_score, steps, activity_progress)
  from public.sp_health_for('a', current_date, current_date) where source = 'oura';
insert into r select 'health: nothing hidden from the owner', '{}', hidden::text from public.sp_health_for('a', current_date, current_date) where source = 'oura';
insert into r select 'health: cycle day counts from the period start', '5', cycle_day::text
  from public.sp_health_for('a', current_date, current_date) where source = 'manual';
insert into r select 'health: owner reads own cycle log', '1', count(*)::text from public.sp_cycle_log;
insert into r select 'health: owner sees own error and goal', 'upstream,9000', concat_ws(',', last_error, step_goal)
  from public.sp_health_sources() where person = 'a';
insert into r select 'health: no sharing rows hides every metric', '{sleep_score,activity,steps,cycle_day}', hidden::text
  from public.sp_health_for('b', current_date, current_date) limit 1;
select pg_temp.try('health: authenticated cannot insert health rows', '42501',
  $$insert into public.sp_health_daily (household_id, person, date, source, steps) values ('00000000-0000-0000-0000-0000000000a1', 'a', current_date - 1, 'oura', 1)$$);
select pg_temp.try('health: authenticated cannot update health rows', '42501', $$update public.sp_health_daily set steps = 1$$);
select pg_temp.try('health: tokens are not readable', '42501', $$select * from private.sp_integration_tokens$$);
select pg_temp.try('health: token functions are service role only', '42501',
  $$select * from public.sp_health_token_get('00000000-0000-0000-0000-0000000000a1', 'a', 'oura')$$);
select pg_temp.try('health: connections are written by functions only', '42501',
  $$insert into public.sp_health_connections (household_id, person, source) values ('00000000-0000-0000-0000-0000000000a1', 'a', 'garmin')$$);
select pg_temp.try('health: owner shares sleep', 'ok',
  $$insert into public.sp_health_sharing (household_id, person, metric, shared) values ('00000000-0000-0000-0000-0000000000a1', 'a', 'sleep_score', true), ('00000000-0000-0000-0000-0000000000a1', 'a', 'steps', false)$$);
select pg_temp.try('health: cannot write sharing for the other person', '42501',
  $$insert into public.sp_health_sharing (household_id, person, metric, shared) values ('00000000-0000-0000-0000-0000000000a1', 'b', 'steps', true)$$);
select pg_temp.try('health: owner logs a period start', 'ok',
  $$insert into public.sp_cycle_log (household_id, person, period_start) values ('00000000-0000-0000-0000-0000000000a1', 'a', current_date - 40)$$);
select pg_temp.try('health: cannot log a period for the other person', '42501',
  $$insert into public.sp_cycle_log (household_id, person, period_start) values ('00000000-0000-0000-0000-0000000000a1', 'b', current_date)$$);

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'health: other member reads none of her rows directly', '0', count(*)::text from public.sp_health_daily where person = 'a';
insert into r select 'health: a shared metric comes through', '81', sleep_score::text
  from public.sp_health_for('a', current_date, current_date) where source = 'oura';
insert into r select 'health: an unshared metric is null', 'null,null', concat_ws(',', coalesce(steps::text, 'null'), coalesce(activity_goal::text, 'null'))
  from public.sp_health_for('a', current_date, current_date) where source = 'oura';
insert into r select 'health: hidden lists the unshared metrics', '{activity,steps,cycle_day}', hidden::text
  from public.sp_health_for('a', current_date, current_date) where source = 'oura';
insert into r select 'health: hidden cycle day leaves no manual rows', '0', count(*)::text
  from public.sp_health_for('a', current_date - 10, current_date) where source = 'manual';
insert into r select 'health: other member cannot read her cycle log', '0', count(*)::text from public.sp_cycle_log;
with d as (delete from public.sp_cycle_log where person = 'a' returning 1)
  insert into r select 'health: other member cannot delete her cycle log', '0', count(*)::text from d;
insert into r select 'health: other member sees her source and last sync, not the error', 'oura,null,null', concat_ws(',', source, coalesce(last_error, 'null'), coalesce(step_goal::text, 'null'))
  from public.sp_health_sources() where person = 'a';
insert into r select 'health: other member reads her sharing rows', '2', count(*)::text from public.sp_health_sharing where person = 'a';
with d as (update public.sp_health_sharing set shared = true where person = 'a' returning 1)
  insert into r select 'health: other member cannot change her sharing', '0', count(*)::text from d;

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
set local role authenticated;
select pg_temp.try('health: owner switches sleep off', 'ok', $$update public.sp_health_sharing set shared = false where person = 'a' and metric = 'sleep_score'$$);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'health: switching off takes effect at once', 'null', coalesce(sleep_score::text, 'null')
  from public.sp_health_for('a', current_date, current_date) where source = 'oura';

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'health: another household gets zero rows', '0', count(*)::text from public.sp_health_for('a', current_date - 10, current_date);
insert into r select 'health: another household sees no sources', '0', count(*)::text from public.sp_health_sources();
insert into r select 'health: another household sees no sharing rows', '0', count(*)::text from public.sp_health_sharing;

-- Habits (idea 15): in household 1, U1 is Jonas ('b') and U4 is Camilla ('a'). Seeded without a session, as the service role
-- (no auth.uid()): Camilla's habit, a shared one, Jonas's, and one automatic steps habit each.
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.sp_habits (id, household_id, owner, title) values
  ('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-0000000000a1', 'a', 'Camillas vane'),
  ('00000000-0000-0000-0000-00000000ab02', '00000000-0000-0000-0000-0000000000a1', 'both', 'Fælles vane'),
  ('00000000-0000-0000-0000-00000000ab03', '00000000-0000-0000-0000-0000000000a1', 'b', 'Jonas'' vane');
insert into public.sp_habits (id, household_id, owner, title, tracking, rule) values
  ('00000000-0000-0000-0000-00000000ab04', '00000000-0000-0000-0000-0000000000a1', 'a', 'Camilla 8.000 skridt', 'automatic', '{"metric":"steps","op":">=","threshold":8000}'),
  ('00000000-0000-0000-0000-00000000ab05', '00000000-0000-0000-0000-0000000000a1', 'b', 'Jonas 8.000 skridt', 'automatic', '{"metric":"steps","op":">=","threshold":8000}');
insert into r select 'habits: both tables are published to Realtime', '2', count(*)::text
  from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('sp_habits', 'sp_habit_completions');
insert into r select 'habits: full replica identity on both tables', '2', count(*)::text
  from pg_class where oid in ('public.sp_habits'::regclass, 'public.sp_habit_completions'::regclass) and relreplident = 'f';
select pg_temp.try('habits: the service role stores an automatic completion', 'ok',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by, source) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab05', current_date, 'b', 'automatic')$$);
insert into r select 'habits: the service role keeps source automatic', 'automatic', source
  from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab05';
select pg_temp.try('habits: the service role stores an automatic completion for Camilla', 'ok',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by, source) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab04', current_date, 'a', 'automatic')$$);

-- Jonas
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'habits: a member reads every habit in the household, personal ones included', '5', count(*)::text from public.sp_habits;
select pg_temp.try('habits: Jonas cannot add a habit for Camilla', '42501',
  $$insert into public.sp_habits (household_id, owner, title) values ('00000000-0000-0000-0000-0000000000a1', 'a', 'Snyd')$$);
select pg_temp.try('habits: Jonas adds his own habit', 'ok',
  $$insert into public.sp_habits (id, household_id, owner, title) values ('00000000-0000-0000-0000-00000000ab06', '00000000-0000-0000-0000-0000000000a1', 'b', 'Drik vand')$$);
select pg_temp.try('habits: Jonas adds a shared habit', 'ok',
  $$insert into public.sp_habits (household_id, owner, title, frequency, per_week_count) values ('00000000-0000-0000-0000-0000000000a1', 'both', 'Gå tur', 'per_week', 3)$$);
select pg_temp.try('habits: another household cannot be written to', '42501',
  $$insert into public.sp_habits (household_id, owner, title) values ('00000000-0000-0000-0000-0000000000a2', 'b', 'Snyd')$$);
select pg_temp.try('habits: a blank title is refused', '23514',
  $$insert into public.sp_habits (household_id, owner, title) values ('00000000-0000-0000-0000-0000000000a1', 'b', '  ')$$);
select pg_temp.try('habits: a shared habit cannot be automatic', '23514',
  $$insert into public.sp_habits (household_id, owner, title, tracking, rule) values ('00000000-0000-0000-0000-0000000000a1', 'both', 'X', 'automatic', '{"metric":"steps","op":">=","threshold":1}')$$);
select pg_temp.try('habits: an automatic habit needs a rule', '23514',
  $$insert into public.sp_habits (household_id, owner, title, tracking) values ('00000000-0000-0000-0000-0000000000a1', 'b', 'X', 'automatic')$$);
select pg_temp.try('habits: a manual habit has no rule', '23514',
  $$insert into public.sp_habits (household_id, owner, title, rule) values ('00000000-0000-0000-0000-0000000000a1', 'b', 'X', '{"metric":"steps","op":">=","threshold":1}')$$);
select pg_temp.try('habits: per-week needs a count', '23514',
  $$insert into public.sp_habits (household_id, owner, title, frequency) values ('00000000-0000-0000-0000-0000000000a1', 'b', 'X', 'per_week')$$);
select pg_temp.try('habits: weekdays must be 1 to 7', '23514',
  $$insert into public.sp_habits (household_id, owner, title, frequency, weekdays) values ('00000000-0000-0000-0000-0000000000a1', 'b', 'X', 'weekdays', array[0, 8]::smallint[])$$);
select pg_temp.try('habits: weekdays habit with days', 'ok',
  $$insert into public.sp_habits (household_id, owner, title, frequency, weekdays) values ('00000000-0000-0000-0000-0000000000a1', 'b', 'Mandag og onsdag', 'weekdays', array[1, 3]::smallint[])$$);
select pg_temp.try('habits: colour must be from the palette', '23514',
  $$insert into public.sp_habits (household_id, owner, title, color) values ('00000000-0000-0000-0000-0000000000a1', 'b', 'X', 'pink')$$);
with d as (update public.sp_habits set title = 'Hacked' where id = '00000000-0000-0000-0000-00000000ab01' returning 1)
  insert into r select 'habits: Jonas cannot update Camilla''s habit', '0', count(*)::text from d;
with d as (delete from public.sp_habits where id = '00000000-0000-0000-0000-00000000ab01' returning 1)
  insert into r select 'habits: Jonas cannot delete Camilla''s habit', '0', count(*)::text from d;
with d as (update public.sp_habits set title = 'Fælles vane (rettet)' where id = '00000000-0000-0000-0000-00000000ab02' returning 1)
  insert into r select 'habits: Jonas edits a shared habit', '1', count(*)::text from d;
select pg_temp.try('habits: owner cannot be handed over', 'ok',
  $$update public.sp_habits set owner = 'a' where id = '00000000-0000-0000-0000-00000000ab03'$$);
insert into r select 'habits: owner stayed', 'b', owner from public.sp_habits where id = '00000000-0000-0000-0000-00000000ab03';
select pg_temp.try('habits: a personal habit cannot be made shared by update', 'ok',
  $$update public.sp_habits set owner = 'both' where id = '00000000-0000-0000-0000-00000000ab03'$$);
insert into r select 'habits: personal stayed personal', 'b', owner from public.sp_habits where id = '00000000-0000-0000-0000-00000000ab03';
with d as (update public.sp_habits set archived_at = now() where id = '00000000-0000-0000-0000-00000000ab06' returning 1)
  insert into r select 'habits: Jonas archives his own habit', '1', count(*)::text from d;

-- Ticking
select pg_temp.try('habits: Jonas ticks the shared habit', 'ok',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab02', current_date, 'b')$$);
select pg_temp.try('habits: completed_by cannot be spoofed', 'ok',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab02', current_date - 1, 'a')$$);
insert into r select 'habits: completed_by is the caller', 'b', completed_by
  from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab02' and date = current_date - 1;
select pg_temp.try('habits: a client insert with source automatic is stored as manual', 'ok',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by, source) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab02', current_date - 2, 'b', 'automatic')$$);
insert into r select 'habits: source was forced to manual', 'manual', source
  from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab02' and date = current_date - 2;
select pg_temp.try('habits: one completion per habit and day', '23505',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab02', current_date, 'b')$$);
select pg_temp.try('habits: Jonas ticks his own habit', 'ok',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab03', current_date, 'b')$$);
select pg_temp.try('habits: Jonas cannot tick Camilla''s habit', '42501',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab01', current_date, 'b')$$);
select pg_temp.try('habits: ticking an automatic habit fails (his own)', 'P0001',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab05', current_date - 1, 'b')$$);
select pg_temp.try('habits: ticking an automatic habit fails (Camilla''s)', 'P0001',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by, source) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab04', current_date - 1, 'a', 'automatic')$$);
select pg_temp.try('habits: a completion more than a day ahead is refused', '23514',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab03', current_date + 3, 'b')$$);
select pg_temp.try('habits: tomorrow is allowed (time zones)', 'ok',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab03', current_date + 1, 'b')$$);
select pg_temp.try('habits: a completion cannot point into another household', '42501',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000ab02', current_date, 'b')$$);
select pg_temp.try('habits: a completion cannot be edited', '42501',
  $$update public.sp_habit_completions set completed_by = 'a' where habit_id = '00000000-0000-0000-0000-00000000ab02'$$);
with d as (delete from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab02' and date = current_date - 2 returning 1)
  insert into r select 'habits: Jonas undoes his tick of the shared habit', '1', count(*)::text from d;
select pg_temp.try('habits: an automatic completion cannot be undone by hand', 'P0001',
  $$delete from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab05'$$);
insert into r select 'habits: the automatic completion is still there', '1', count(*)::text
  from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab05';

-- Camilla
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'habits: Camilla reads Jonas''s personal habits too', '1', count(*)::text from public.sp_habits where id = '00000000-0000-0000-0000-00000000ab03';
select pg_temp.try('habits: Camilla adds her own habit', 'ok',
  $$insert into public.sp_habits (household_id, owner, title) values ('00000000-0000-0000-0000-0000000000a1', 'a', 'Strække ud')$$);
select pg_temp.try('habits: Camilla cannot add a habit for Jonas', '42501',
  $$insert into public.sp_habits (household_id, owner, title) values ('00000000-0000-0000-0000-0000000000a1', 'b', 'Snyd')$$);
with d as (update public.sp_habits set title = 'Hacked' where id = '00000000-0000-0000-0000-00000000ab03' returning 1)
  insert into r select 'habits: Camilla cannot update Jonas''s habit', '0', count(*)::text from d;
with d as (delete from public.sp_habits where id = '00000000-0000-0000-0000-00000000ab03' returning 1)
  insert into r select 'habits: Camilla cannot delete Jonas''s habit', '0', count(*)::text from d;
select pg_temp.try('habits: Camilla cannot tick Jonas''s habit', '42501',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab03', current_date - 1, 'a')$$);
with d as (delete from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab03' returning 1)
  insert into r select 'habits: Camilla cannot undo Jonas''s tick', '0', count(*)::text from d;
select pg_temp.try('habits: Camilla ticks her own habit', 'ok',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab01', current_date, 'b')$$);
insert into r select 'habits: completed_by is Camilla whatever was sent', 'a', completed_by
  from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab01';
select pg_temp.try('habits: Camilla cannot tick her automatic habit', 'P0001',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab04', current_date - 2, 'a')$$);
with d as (delete from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab02' and date = current_date returning 1)
  insert into r select 'habits: either member undoes a shared tick', '1', count(*)::text from d;
select pg_temp.try('habits: Camilla ticks the shared habit', 'ok',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab02', current_date, 'a')$$);

-- Cascade: deleting a habit removes its completions, automatic ones included (Jonas deletes his own automatic habit)
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
with d as (delete from public.sp_habits where id = '00000000-0000-0000-0000-00000000ab05' returning 1)
  insert into r select 'habits: Jonas deletes his automatic habit', '1', count(*)::text from d;
insert into r select 'habits: its completions went with it', '0', count(*)::text
  from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab05';
with d as (delete from public.sp_habits where id = '00000000-0000-0000-0000-00000000ab03' returning 1)
  insert into r select 'habits: Jonas deletes his own manual habit', '1', count(*)::text from d;
insert into r select 'habits: its ticks went with it', '0', count(*)::text
  from public.sp_habit_completions where habit_id = '00000000-0000-0000-0000-00000000ab03';

-- Another household (U2)
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'habits: another household sees no habits', '0', count(*)::text from public.sp_habits;
insert into r select 'habits: another household sees no completions', '0', count(*)::text from public.sp_habit_completions;
select pg_temp.try('habits: another household cannot add a habit to household 1', '42501',
  $$insert into public.sp_habits (household_id, owner, title) values ('00000000-0000-0000-0000-0000000000a1', 'both', 'Snyd')$$);
select pg_temp.try('habits: another household cannot tick a habit of household 1', '42501',
  $$insert into public.sp_habit_completions (household_id, habit_id, date, completed_by) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ab02', current_date - 3, 'a')$$);
with d as (delete from public.sp_habits where id = '00000000-0000-0000-0000-00000000ab02' returning 1)
  insert into r select 'habits: another household cannot delete a habit of household 1', '0', count(*)::text from d;

-- Signed in, but a member of nothing (U3) --------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'health: non-member gets zero rows', '0', count(*)::text from public.sp_health_for('a', current_date - 10, current_date);
insert into r select 'health: non-member sees no health rows', '0', count(*)::text from public.sp_health_daily;

insert into r select 'non-member sees no recipes', '0', count(*)::text from public.sp_recipes;
insert into r select 'non-member sees no categories', '0', count(*)::text from public.sp_recipe_categories;
insert into r select 'non-member sees no grocery categories', '0', count(*)::text from public.sp_grocery_categories;
insert into r select 'non-member sees no ideas', '0', count(*)::text from public.sp_dinner_ideas;
insert into r select 'non-member sees no ingredients', '0', count(*)::text from public.sp_recipe_ingredients;
insert into r select 'non-member sees no plan', '0', count(*)::text from public.sp_meal_plan_entries;
insert into r select 'non-member sees no shopping list', '0', count(*)::text from public.sp_shopping_items;
insert into r select 'non-member sees no to-dos', '0', count(*)::text from public.sp_todos;
insert into r select 'non-member sees no habits', '0', count(*)::text from public.sp_habits;
insert into r select 'non-member sees no habit completions', '0', count(*)::text from public.sp_habit_completions;
insert into r select 'non-member sees no calendars', '0', count(*)::text from public.sp_calendar_sources;
insert into r select 'non-member sees no unit preferences', '0', count(*)::text from public.sp_unit_preferences;
insert into r select 'non-member sees no storage objects', '0', count(*)::text from storage.objects where bucket_id in ('sp-recipes', 'sp-documents');
insert into r select 'non-member sees no households', '0', count(*)::text from public.households;
select pg_temp.try('non-member cannot add a recipe', '42501',
  $$insert into public.sp_recipes (household_id, title) values ('00000000-0000-0000-0000-0000000000a1', 'Snyd')$$);

-- Not signed in -----------------------------------------------------------------------------------------------
reset role;
set local role anon;
select pg_temp.try('anon cannot read recipes', '42501', $$select * from public.sp_recipes$$);
select pg_temp.try('anon cannot read the shopping list', '42501', $$select * from public.sp_shopping_items$$);
select pg_temp.try('anon cannot read the to-dos', '42501', $$select * from public.sp_todos$$);
select pg_temp.try('anon cannot read habits', '42501', $$select * from public.sp_habits$$);
select pg_temp.try('anon cannot read habit completions', '42501', $$select * from public.sp_habit_completions$$);
select pg_temp.try('anon cannot read calendars', '42501', $$select * from public.sp_calendar_sources$$);
select pg_temp.try('anon cannot read unit preferences', '42501', $$select * from public.sp_unit_preferences$$);
select pg_temp.try('anon cannot call sp_health_for', '42501', $$select * from public.sp_health_for('a', current_date, current_date)$$);

reset role;
-- One result row: failures must be 0 and `failing` empty. (Remove the filter to see every check.)
select count(*) filter (where expected <> actual) as failures, count(*) as checks,
       coalesce(json_agg(r) filter (where expected <> actual), '[]'::json) as failing
from r;
rollback;
