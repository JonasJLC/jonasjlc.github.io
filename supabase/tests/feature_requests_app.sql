-- feature_requests.app policy tests. Run after 20261124093354_feature_requests_app.sql:
--   supabase db query --linked -f supabase/tests/feature_requests_app.sql
-- Everything runs in a transaction that is rolled back, so no data is left behind.
-- The result is one row: `failures` must be 0 and `failing` empty.
begin;

create temp table r (name text, expected text, actual text);
grant all on r to authenticated, anon;

insert into public.households (id, name) values
  ('00000000-0000-0000-0000-0000000000f1', 'FR1'), ('00000000-0000-0000-0000-0000000000f2', 'FR2');
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000f4', 'fr-owner@example.test', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000f5', 'fr-member@example.test', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000f6', 'fr-other@example.test', 'authenticated', 'authenticated', now()),
  ('00000000-0000-0000-0000-0000000000f7', 'fr-outsider@example.test', 'authenticated', 'authenticated', now());
insert into public.household_members (household_id, user_id, person, is_owner) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f4', 'a', true),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f5', 'b', false),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f6', 'a', true);

create function pg_temp.try(p_name text, p_expected text, p_sql text) returns void
language plpgsql as $$
declare s text := 'ok';
begin
  begin execute p_sql; exception when others then s := sqlstate; end;
  insert into r values (p_name, p_expected, s);
end;
$$;
grant execute on function pg_temp.try(text, text, text) to authenticated, anon;

-- Member of household 1 ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.try('member adds a strandparken request', 'ok',
  $$insert into public.feature_requests (id, household_id, title, summary, app) values ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000f1', 'Sidst købt ind', 'Se hvem der handlede sidst', 'strandparken')$$);
select pg_temp.try('member adds a request without app', 'ok',
  $$insert into public.feature_requests (id, household_id, title, summary) values ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000f1', 'Ferieting', 'Noget i Ferieplan')$$);
select pg_temp.try('app outside the allowed list is rejected', '23514',
  $$insert into public.feature_requests (household_id, title, summary, app) values ('00000000-0000-0000-0000-0000000000f1', 'Ugyldig', 'Ugyldig app', 'other')$$);

insert into r select 'strandparken row starts as new', 'new', status from public.feature_requests where id = '00000000-0000-0000-0000-0000000000a9';
insert into r select 'strandparken row has no issue link', 'true',
  (github_issue_number is null and github_issue_url is null)::text from public.feature_requests where id = '00000000-0000-0000-0000-0000000000a9';
insert into r select 'row without app reads back as ferie', 'ferie', app from public.feature_requests where id = '00000000-0000-0000-0000-0000000000a8';
insert into r select 'member sees both apps in own household', '2', count(*)::text from public.feature_requests;

-- Owner of household 1 ----------------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f4","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.try('owner cannot change app', '42501',
  $$update public.feature_requests set app = 'ferie' where id = '00000000-0000-0000-0000-0000000000a9'$$);
select pg_temp.try('owner changes status', 'ok',
  $$update public.feature_requests set status = 'approved' where id = '00000000-0000-0000-0000-0000000000a9'$$);
insert into r select 'owner status change took effect', 'approved', status from public.feature_requests where id = '00000000-0000-0000-0000-0000000000a9';
insert into r select 'app is unchanged after the denied update', 'strandparken', app from public.feature_requests where id = '00000000-0000-0000-0000-0000000000a9';

-- Plain member cannot triage --------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f5","role":"authenticated"}', true);
set local role authenticated;
with u as (update public.feature_requests set status = 'done' where id = '00000000-0000-0000-0000-0000000000a9' returning 1)
insert into r select 'non-owner member cannot change status', '0', count(*)::text from u;

-- Member of another household, and someone in no household ---------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f6","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'other household sees no requests', '0', count(*)::text from public.feature_requests;

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f7","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'non-member reads nothing (strandparken)', '0', count(*)::text from public.feature_requests where app = 'strandparken';
insert into r select 'non-member reads nothing (ferie)', '0', count(*)::text from public.feature_requests where app = 'ferie';

reset role;
select count(*) filter (where expected <> actual) as failures, count(*) as checks,
       coalesce(json_agg(r) filter (where expected <> actual), '[]'::json) as failing
from r;
rollback;
