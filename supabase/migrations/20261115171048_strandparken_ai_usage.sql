-- Strandparken AI usage log (design §4.4, §4.5, D48). One row per model call, written only by edge functions
-- (service role). The household owner can read the log; nobody else can. The same rows back the per-person
-- daily rate limit and the monthly cost cap that the shared Anthropic helper enforces.

create table public.sp_ai_usage (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  person text not null check (person in ('a', 'b')),
  function text not null check (length(function) between 1 and 80),
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- Estimated, in DKK, from the price table in the shared helper (an upper bound: cache tokens count as input).
  cost_dkk numeric(10, 4) not null default 0 check (cost_dkk >= 0),
  ok boolean not null default true,
  -- A short code such as 'invalid_output' or 'upstream', never page text, prompts or health data.
  error text check (error is null or length(error) <= 80),
  created_at timestamptz not null default now()
);
create index sp_ai_usage_person_day_idx on public.sp_ai_usage (household_id, person, created_at desc);
create index sp_ai_usage_user_idx on public.sp_ai_usage (user_id);

alter table public.sp_ai_usage enable row level security;
revoke all on public.sp_ai_usage from anon, authenticated;
grant select on public.sp_ai_usage to authenticated;

create policy "owner reads usage" on public.sp_ai_usage
  for select to authenticated
  using (household_id in (
    select household_id from public.household_members where user_id = (select auth.uid()) and is_owner
  ));

-- What the helper needs before every model call, in one round trip: this person's calls today and the
-- household's spend this month, both in Copenhagen time. Callable by the service role only.
create function public.sp_ai_usage_totals(p_household uuid, p_person text)
returns table (calls_today integer, month_cost_dkk numeric)
language sql stable security invoker set search_path = ''
as $$
  select
    (count(*) filter (where person = p_person
       and created_at >= date_trunc('day', now() at time zone 'Europe/Copenhagen') at time zone 'Europe/Copenhagen'))::integer,
    coalesce(sum(cost_dkk), 0)
  from public.sp_ai_usage
  where household_id = p_household
    and created_at >= date_trunc('month', now() at time zone 'Europe/Copenhagen') at time zone 'Europe/Copenhagen';
$$;
revoke all on function public.sp_ai_usage_totals(uuid, text) from public, anon, authenticated;
grant execute on function public.sp_ai_usage_totals(uuid, text) to service_role;
