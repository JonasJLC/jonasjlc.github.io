-- Feature requests are shared by /ferie and /strandparken. `app` keeps the two lists, chat prompts and issue labels
-- apart. Existing rows are Ferieplan requests. Clients set `app` on insert; the update grant (status, owner_note)
-- does not cover it, so it cannot change afterwards.
alter table public.feature_requests
  add column app text not null default 'ferie' check (app in ('ferie', 'strandparken'));

drop index if exists public.feature_requests_household_idx;
create index feature_requests_household_app_idx on public.feature_requests (household_id, app, created_at desc);
