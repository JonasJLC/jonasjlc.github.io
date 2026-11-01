-- Run after the claim_only_verified_emails migration:
--   supabase db query --linked -f supabase/tests/claim_only_verified_emails.sql
-- Everything runs in a transaction that is rolled back, so no data is left behind.
-- Expected result rows:
--   unverified signup is linked            0
--   after verification is linked           1
--   invite() skips unverified existing user 0
--   verified later is linked               1
begin;
create temp table r (k text, v text);

select private.invite('f8ea36f6-2ce9-4b26-994a-0858c948c9f1', 'Victim@Example.com');
insert into auth.users (id, email, aud, role)
  values ('00000000-0000-0000-0000-0000000000c1', 'victim@example.com', 'authenticated', 'authenticated');
insert into r select 'unverified signup is linked', count(*)::text from public.household_members;
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000c1';
insert into r select 'after verification is linked', count(*)::text from public.household_members;

insert into auth.users (id, email, aud, role, email_confirmed_at)
  values ('00000000-0000-0000-0000-0000000000c3', 'late@example.com', 'authenticated', 'authenticated', null);
select private.invite('f8ea36f6-2ce9-4b26-994a-0858c948c9f1', 'late@example.com');
insert into r select 'invite() skips unverified existing user', count(*)::text
  from public.household_members where user_id = '00000000-0000-0000-0000-0000000000c3';
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000c3';
insert into r select 'verified later is linked', count(*)::text
  from public.household_members where user_id = '00000000-0000-0000-0000-0000000000c3';

select * from r;
rollback;
