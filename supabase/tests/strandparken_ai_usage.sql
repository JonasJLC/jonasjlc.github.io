-- sp_ai_usage policy and totals tests (design §2.1, §4.5, D48). Run after the strandparken_ai_usage migration:
--   supabase db query --linked -f supabase/tests/strandparken_ai_usage.sql
-- Rolled back at the end. One result row: `failures` must be 0 and `failing` empty.
begin;

create temp table r (name text, expected text, actual text);
grant all on r to authenticated, anon, service_role;
create function pg_temp.try(p_name text, p_expected text, p_sql text) returns void
language plpgsql as $$
declare s text := 'ok';
begin
  begin execute p_sql; exception when others then s := sqlstate; end;
  insert into r values (p_name, p_expected, s);
end;
$$;
grant execute on function pg_temp.try(text, text, text) to authenticated, anon, service_role;

insert into public.households (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'T1'), ('00000000-0000-0000-0000-0000000000a2', 'T2');
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000b1', 'owner@example.test', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000b2', 'partner@example.test', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000b3', 'other@example.test', 'authenticated', 'authenticated', now());
insert into public.household_members (household_id, user_id, person, is_owner) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'b', true),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'a', false),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b3', 'b', true);

-- Two calls today by person b, one by person a, one last month by b, one in the other household.
insert into public.sp_ai_usage (household_id, user_id, person, function, model, input_tokens, output_tokens, cost_dkk, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'b', 'recipe-import', 'claude-haiku-5-5', 1000, 200, 0.5, now()),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'b', 'recipe-import', 'claude-haiku-5-5', 1000, 200, 0.25, now()),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'a', 'meal-suggest', 'claude-haiku-5-5', 500, 100, 1.0, now()),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'b', 'recipe-import', 'claude-haiku-5-5', 500, 100, 9.0, now() - interval '40 days'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b3', 'b', 'meal-suggest', 'claude-haiku-5-5', 500, 100, 5.0, now());

-- Service role: the totals the helper reads.
set local role service_role;
insert into r select 'totals: person b calls today', '2', calls_today::text from public.sp_ai_usage_totals('00000000-0000-0000-0000-0000000000a1', 'b');
insert into r select 'totals: person a calls today', '1', calls_today::text from public.sp_ai_usage_totals('00000000-0000-0000-0000-0000000000a1', 'a');
insert into r select 'totals: household cost this month ignores last month and other households', '1.7500', month_cost_dkk::text from public.sp_ai_usage_totals('00000000-0000-0000-0000-0000000000a1', 'b');
select pg_temp.try('service role can log a call', 'ok',
  $$insert into public.sp_ai_usage (household_id, person, function, model) values ('00000000-0000-0000-0000-0000000000a1', 'b', 't', 'm')$$);
select pg_temp.try('service role cannot log an unknown person', '23514',
  $$insert into public.sp_ai_usage (household_id, person, function, model) values ('00000000-0000-0000-0000-0000000000a1', 'x', 't', 'm')$$);
select pg_temp.try('a long error is refused', '23514',
  $$insert into public.sp_ai_usage (household_id, person, function, model, error) values ('00000000-0000-0000-0000-0000000000a1', 'b', 't', 'm', repeat('x', 200))$$);

-- Household owner (U1).
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'owner reads own household log only', '5', count(*)::text from public.sp_ai_usage;
select pg_temp.try('owner cannot write the log', '42501',
  $$insert into public.sp_ai_usage (household_id, person, function, model) values ('00000000-0000-0000-0000-0000000000a1', 'b', 't', 'm')$$);
select pg_temp.try('owner cannot edit the log', '42501', $$update public.sp_ai_usage set cost_dkk = 0$$);
select pg_temp.try('owner cannot delete from the log', '42501', $$delete from public.sp_ai_usage$$);
select pg_temp.try('members cannot call the totals function', '42501',
  $$select * from public.sp_ai_usage_totals('00000000-0000-0000-0000-0000000000a1', 'b')$$);

-- Partner, not owner (U2).
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'non-owner member reads no usage rows', '0', count(*)::text from public.sp_ai_usage;

-- Not signed in.
reset role;
set local role anon;
select pg_temp.try('anon cannot read usage', '42501', $$select * from public.sp_ai_usage$$);
select pg_temp.try('anon cannot call the totals function', '42501',
  $$select * from public.sp_ai_usage_totals('00000000-0000-0000-0000-0000000000a1', 'b')$$);

reset role;
select count(*) filter (where expected <> actual) as failures, count(*) as checks,
       coalesce(json_agg(r) filter (where expected <> actual), '[]'::json) as failing
from r;
rollback;
