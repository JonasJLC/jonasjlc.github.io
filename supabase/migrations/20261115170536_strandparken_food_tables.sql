-- Strandparken Phase 1 tables (design §6): categories, recipes, ingredients, dinner ideas, meal plan, shopping list.
-- Every table carries household_id with row-level security: members read and write their own household only.
-- Child rows reference their parent through (id, household_id), so a row can never point into another household.

-- Audit columns are set by the database, never trusted from the client.
create function private.sp_touch() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.created_at := now();
  else
    new.household_id := old.household_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Shared shape: id, household_id, created_at, updated_at, created_by.
create table public.sp_recipe_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (id, household_id)
);

create table public.sp_grocery_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (id, household_id)
);

create table public.sp_recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  descriptor text,
  category_id uuid,
  tags text[] not null default '{}',
  base_servings integer not null default 4 check (base_servings between 1 and 100),
  total_minutes integer check (total_minutes >= 0),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  source_url text,
  original_text text,
  image_path text,
  thumb_path text,
  nutrition jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (id, household_id),
  foreign key (category_id, household_id) references public.sp_recipe_categories (id, household_id) on delete set null (category_id)
);
create unique index sp_recipes_source_url_key on public.sp_recipes (household_id, source_url) where source_url is not null;
create index sp_recipes_household_idx on public.sp_recipes (household_id, archived_at);

create table public.sp_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  recipe_id uuid not null,
  position integer not null default 0,
  amount numeric check (amount >= 0),
  unit text,
  name text not null check (length(btrim(name)) between 1 and 200),
  canonical_name text,
  grocery_category_id uuid,
  food_ref text,
  scales boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  foreign key (recipe_id, household_id) references public.sp_recipes (id, household_id) on delete cascade,
  foreign key (grocery_category_id, household_id) references public.sp_grocery_categories (id, household_id) on delete set null (grocery_category_id)
);
create index sp_recipe_ingredients_recipe_idx on public.sp_recipe_ingredients (recipe_id, position);

create table public.sp_dinner_ideas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  image_path text,
  note text,
  tags text[] not null default '{}',
  promoted_recipe_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (id, household_id),
  foreign key (promoted_recipe_id, household_id) references public.sp_recipes (id, household_id) on delete set null (promoted_recipe_id)
);

create table public.sp_meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  recipe_id uuid,
  idea_id uuid,
  free_text text check (free_text is null or length(btrim(free_text)) > 0),
  servings integer check (servings between 1 and 100),
  calendar_event_id text,
  calendar_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (id, household_id),
  unique (household_id, date),
  -- Exactly one of recipe, idea or free text. Recipes are archived rather than deleted, so no cascade here.
  constraint sp_meal_plan_one_dish check (num_nonnulls(recipe_id, idea_id, free_text) = 1),
  foreign key (recipe_id, household_id) references public.sp_recipes (id, household_id),
  foreign key (idea_id, household_id) references public.sp_dinner_ideas (id, household_id)
);

create table public.sp_shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  canonical_name text,
  amount numeric check (amount >= 0),
  unit text,
  grocery_category_id uuid,
  status text not null default 'active' check (status in ('active', 'have', 'checked', 'cleared')),
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'recipe', 'plan')),
  plan_entry_id uuid,
  recipe_id uuid,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  foreign key (grocery_category_id, household_id) references public.sp_grocery_categories (id, household_id) on delete set null (grocery_category_id),
  foreign key (plan_entry_id, household_id) references public.sp_meal_plan_entries (id, household_id) on delete set null (plan_entry_id),
  foreign key (recipe_id, household_id) references public.sp_recipes (id, household_id) on delete set null (recipe_id)
);
create index sp_shopping_items_household_idx on public.sp_shopping_items (household_id, status);

-- Foreign-key columns without their own index (cascade and set-null lookups).
create index sp_recipes_category_idx on public.sp_recipes (category_id);
create index sp_recipe_ingredients_category_idx on public.sp_recipe_ingredients (grocery_category_id);
create index sp_dinner_ideas_promoted_idx on public.sp_dinner_ideas (promoted_recipe_id);
create index sp_meal_plan_recipe_idx on public.sp_meal_plan_entries (recipe_id);
create index sp_meal_plan_idea_idx on public.sp_meal_plan_entries (idea_id);
create index sp_shopping_items_category_idx on public.sp_shopping_items (grocery_category_id);
create index sp_shopping_items_plan_idx on public.sp_shopping_items (plan_entry_id);
create index sp_shopping_items_recipe_idx on public.sp_shopping_items (recipe_id);

-- Row-level security: one policy per command, the same shape on every table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'sp_recipe_categories', 'sp_grocery_categories', 'sp_recipes', 'sp_recipe_ingredients',
    'sp_dinner_ideas', 'sp_meal_plan_entries', 'sp_shopping_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy "members read" on public.%I for select to authenticated
      using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())))$p$, t);
    execute format($p$create policy "members insert" on public.%I for insert to authenticated
      with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())))$p$, t);
    execute format($p$create policy "members update" on public.%I for update to authenticated
      using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())))
      with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())))$p$, t);
    execute format($p$create policy "members delete" on public.%I for delete to authenticated
      using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())))$p$, t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.sp_touch()', t || '_touch', t);
  end loop;
end;
$$;

-- Default categories (design D30, D31), editable afterwards. Idempotent: only fills a household that has none.
create function private.sp_seed_categories(p_household uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  insert into public.sp_recipe_categories (household_id, name, position)
  select p_household, n, o - 1
  from unnest(array['Aftensmad', 'Tilbehør & salat', 'Frokost', 'Morgenmad & brunch', 'Bagværk', 'Sødt', 'Snacks & dip', 'Drikke'])
    with ordinality as c(n, o)
  where not exists (select 1 from public.sp_recipe_categories where household_id = p_household);

  insert into public.sp_grocery_categories (household_id, name, position)
  select p_household, n, o - 1
  from unnest(array['Frugt & grønt', 'Brød & bagværk', 'Kød & fisk', 'Pålæg & køl', 'Mejeri & æg', 'Frost', 'Kolonial',
    'Konserves & glas', 'Krydderier, olie & bagning', 'Drikkevarer', 'Snacks & slik', 'Husholdning & pleje', 'Andet'])
    with ordinality as c(n, o)
  where not exists (select 1 from public.sp_grocery_categories where household_id = p_household);
end;
$$;
revoke all on function private.sp_seed_categories(uuid) from public, anon, authenticated;

select private.sp_seed_categories(id) from public.households;

-- Live updates between the two phones. Full replica identity so DELETE events carry household_id for filters.
alter table public.sp_shopping_items replica identity full;
alter table public.sp_meal_plan_entries replica identity full;
alter publication supabase_realtime add table public.sp_shopping_items, public.sp_meal_plan_entries;
