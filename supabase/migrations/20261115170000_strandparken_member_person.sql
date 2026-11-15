-- Strandparken: which person each household member is. `person` reuses the /ferie keys: 'a' = Camilla, 'b' = Jonas.
-- Clients can only read household_members (no insert/update grant), so neither `person` nor `is_owner`
-- (added by the feature_requests migration) can be changed from the browser.
-- Existing members are assigned by hand, not here, so no email addresses live in the repo:
--   update public.household_members set person = 'b' where user_id = (select id from auth.users where email = '...');

alter table public.household_members add column person text check (person in ('a', 'b'));

create unique index household_members_person_key on public.household_members (household_id, person) where person is not null;
create unique index household_members_one_owner on public.household_members (household_id) where is_owner;
