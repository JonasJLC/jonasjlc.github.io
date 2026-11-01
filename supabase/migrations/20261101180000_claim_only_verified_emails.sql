-- Only link an invited email to a household once that email is verified.
-- Before: the link was made when the auth user row was created, so someone who knew an invited
-- address could sign up with it (email/password) and be linked before proving they own it.
-- Google sign-in marks the email as verified on creation, so invited Google accounts still work.

create or replace function private.claim_household_invites() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  insert into public.household_members (household_id, user_id)
  select i.household_id, new.id
  from private.household_invites i
  where i.email = lower(new.email)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_claim_invites on auth.users;
create trigger on_auth_user_claim_invites
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function private.claim_household_invites();

create or replace function private.invite(p_household uuid, p_email text) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  insert into private.household_invites (email, household_id)
  values (lower(trim(p_email)), p_household)
  on conflict (email) do update set household_id = excluded.household_id;

  insert into public.household_members (household_id, user_id)
  select p_household, u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null
  on conflict do nothing;
end;
$$;
