-- Idé 1: the photo address an import found, and when the app last tried to fetch it ("try once" for the backfill).
alter table public.sp_recipes
  add column image_source_url text check (image_source_url is null or image_source_url ~ '^https://'),
  add column image_fetch_attempted_at timestamptz;
