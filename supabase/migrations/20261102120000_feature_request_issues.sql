-- Each feature request is mirrored to a GitHub issue (edge function `create-issue`) so the owner can
-- triage and build from GitHub. Only the structured request goes public, never the transcript.
-- The columns are written by the edge function with the service role; clients can only read them
-- (no insert/update grant covers them: inserts are column-unrestricted, so the trigger resets them).

alter table public.feature_requests
  add column github_issue_number integer,
  add column github_issue_url text check (github_issue_url is null or github_issue_url like 'https://github.com/%');

-- Clients must not be able to claim an issue link on insert.
create or replace function private.feature_requests_before_insert() returns trigger
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
  new.github_issue_number := null;
  new.github_issue_url := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;
