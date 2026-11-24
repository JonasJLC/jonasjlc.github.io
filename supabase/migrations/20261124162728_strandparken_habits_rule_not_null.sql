-- Fix for 20261124162651: an automatic habit with no rule passed sp_habits_rule, because `rule ->> 'metric' in (...)` is
-- NULL when rule is NULL and a CHECK that evaluates to NULL passes. Every operand is now true or false, never NULL.
alter table public.sp_habits drop constraint sp_habits_rule;
alter table public.sp_habits add constraint sp_habits_rule check (
  (tracking = 'manual' and rule is null) or
  (tracking = 'automatic' and rule is not null
    and coalesce(rule ->> 'metric' in ('steps', 'sleep_score', 'activity_progress'), false)
    and coalesce(rule ->> 'op' in ('>=', '>'), false)
    and jsonb_typeof(rule -> 'threshold') is not distinct from 'number'));
