import type { Tables } from '../../../../lib/supabase/database.types.ts';
import { isLeftover, type PlanEntry } from '../madplan/model.ts';
import { scaleIngredient } from '../recipes/scale.ts';
import type { Recipe } from '../recipes/model.ts';
import { ingredientFor, purchaseFor, type Ingredient, type Purchase } from './purchase.ts';

export type ShoppingRow = Tables<'sp_shopping_items'>;
export type GroceryCategory = Tables<'sp_grocery_categories'>;

/** ADR-08: one row per source, merged on display. `have` = "har hjemme" (kept so the review is not repeated), `cleared` = bought and cleared. */
export type Status = 'active' | 'have' | 'checked' | 'cleared';

// ---------------------------------------------------------------------------------------------------------------
// Names and units

/** Lower-case, single spaces, no parenthesised remark: "Løg (store)" and "løg" are the same ingredient. */
export const canonicalName = (name: string) =>
  name.replace(/\(.*?\)/g, ' ').trim().replace(/\s+/g, ' ').toLocaleLowerCase('da');

const unitAliases: Record<string, string> = { gr: 'g', gram: 'g', kilo: 'kg', liter: 'l', stk: 'stk', styk: 'stk', 'tsk.': 'tsk', 'spsk.': 'spsk' };
export const mass = { g: 1, kg: 1000 } as const;
export const volume = { ml: 1, cl: 10, dl: 100, l: 1000 } as const;

export const canonicalUnit = (unit: string | null) => {
  const u = (unit ?? '').trim().toLocaleLowerCase('da').replace(/\.$/, '');
  return unitAliases[u] ?? u;
};

type Family = 'mass' | 'volume' | 'other';

/** Units that can be added together share a family; "other" units only merge with themselves. */
function normalised(amount: number | null, unit: string | null): { family: Family; unit: string; amount: number | null } {
  const u = canonicalUnit(unit);
  if (amount !== null && u in mass) return { family: 'mass', unit: 'g', amount: amount * mass[u as keyof typeof mass] };
  if (amount !== null && u in volume) return { family: 'volume', unit: 'ml', amount: amount * volume[u as keyof typeof volume] };
  return { family: 'other', unit: u, amount };
}

/** Back to a unit a person reads: 1500 g is 1,5 kg, 250 ml is 2,5 dl. */
function readable(amount: number, family: Family, unit: string): { amount: number; unit: string } {
  if (family === 'mass') return amount >= 1000 ? { amount: amount / 1000, unit: 'kg' } : { amount, unit: 'g' };
  if (family === 'volume') {
    if (amount >= 1000) return { amount: amount / 1000, unit: 'l' };
    return amount >= 100 ? { amount: amount / 100, unit: 'dl' } : { amount, unit: 'ml' };
  }
  return { amount, unit };
}

// ---------------------------------------------------------------------------------------------------------------
// Category guess (design §5.3.4: "guessed from the name and can be changed")

/** Danish compounds put the key word last ("letmælk", "rugbrød"), so words match anywhere except a few that clash with other words. */
const guessWords: [string, string[]][] = [
  ['Frugt & grønt', ['løg', 'hvidløg', 'gulerod', 'gulerødder', 'kartoffel', 'kartofler', 'tomat', 'tomater', 'agurk', 'salat', 'spinat', 'kål', 'broccoli', 'blomkål', 'peberfrugt', 'squash', 'aubergine', 'champignon', 'svampe', 'porre', 'selleri', 'persille', 'dild', 'basilikum', 'purløg', 'koriander', 'timian', 'rosmarin', 'citron', 'lime', 'æble', 'æbler', 'banan', 'bananer', 'appelsin', 'avocado', 'ingefær', 'chili', 'rødbede', 'rødbeder', 'græskar', 'ærter', 'bønner', 'majs', 'frugt', 'grønt', 'bær', 'jordbær', 'blåbær']],
  ['Brød & bagværk', ['brød', 'boller', 'rundstykker', 'tortilla', 'wraps', 'pita', 'burgerboller', 'toast', 'baguette', 'flatbread']],
  ['Kød & fisk', ['kylling', 'kyllingebryst', 'hakket', 'oksekød', 'svinekød', 'flæsk', 'bacon', 'medister', 'pølse', 'pølser', 'frikadelle', 'laks', 'torsk', 'rejer', 'fisk', 'tun', 'skinke', 'bøf', 'culotte', 'nakkekød', 'lam', 'and', 'kalkun']],
  ['Pålæg & køl', ['pålæg', 'leverpostej', 'hummus', 'pesto', 'remoulade', 'salami', 'mortadella', 'pålægschokolade']],
  ['Mejeri & æg', ['mælk', 'fløde', 'smør', 'ost', 'parmesan', 'mozzarella', 'feta', 'æg', 'yoghurt', 'skyr', 'creme fraiche', 'cremefraiche', 'ymer', 'kærnemælk', 'piskefløde', 'madlavningsfløde', 'mascarpone', 'ricotta']],
  ['Frost', ['frost', 'frossen', 'frosne', 'is']],
  ['Kolonial', ['pasta', 'spaghetti', 'penne', 'ris', 'nudler', 'couscous', 'bulgur', 'havregryn', 'mel', 'hvedemel', 'linser', 'kikærter', 'müsli', 'cornflakes', 'sukker', 'bouillon', 'fond', 'kokosmælk']],
  ['Konserves & glas', ['flåede tomater', 'hakkede tomater', 'tomatpuré', 'dåse', 'dåsen', 'oliven', 'kapers', 'agurkesalat', 'syltede', 'bønner på dåse', 'ketchup', 'sennep']],
  ['Krydderier, olie & bagning', ['salt', 'peber', 'paprika', 'spidskommen', 'karry', 'kanel', 'oregano', 'chilipulver', 'gurkemeje', 'krydderi', 'olie', 'olivenolie', 'eddike', 'sojasauce', 'soja', 'bagepulver', 'natron', 'vaniljesukker', 'gær', 'maizena', 'honning', 'sirup']],
  ['Drikkevarer', ['vand', 'sodavand', 'juice', 'øl', 'vin', 'saft', 'kaffe', 'te', 'cola']],
  ['Snacks & slik', ['chips', 'slik', 'chokolade', 'kiks', 'nødder', 'mandler', 'peanuts', 'popcorn']],
  ['Husholdning & pleje', ['køkkenrulle', 'toiletpapir', 'opvask', 'sæbe', 'shampoo', 'tandpasta', 'affaldsposer', 'bagepapir', 'folie', 'vaskemiddel', 'servietter']],
];

/** Words that are also the start or end of unrelated words ("is" in "ris", "te" in "rosten"). */
const wordStartOnly = new Set(['is', 'te', 'and', 'øl', 'ris', 'lam', 'vin']);

const guesses: [string, RegExp][] = guessWords.map(([c, words]) => [
  c,
  new RegExp(words.map((w) => (wordStartOnly.has(w) ? `\\b${w}` : w)).join('|')),
]);

/** The name of the grocery category that fits `name` best; "Andet" when nothing does. */
export function guessCategoryName(name: string): string {
  const n = canonicalName(name);
  for (const [category, pattern] of guesses) if (pattern.test(n)) return category;
  return 'Andet';
}

/** The id to store: the guess if the household still has a category of that name, else "Andet", else none. */
export function guessCategoryId(name: string, categories: readonly GroceryCategory[]): string | null {
  const byName = (wanted: string) => categories.find((c) => c.name.trim().toLocaleLowerCase('da') === wanted.toLocaleLowerCase('da'));
  return (byName(guessCategoryName(name)) ?? byName('Andet'))?.id ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Merged display (D36)

export type Source = {
  rowId: string;
  /** Title of the dish, or null for a manual item. */
  dish: string | null;
  /** Date of the plan entry the row came from, when known. */
  date: string | null;
  /** The name, amount and unit as the recipe (or person) wrote them, never converted. */
  name: string;
  amount: number | null;
  unit: string | null;
};

export type Line = {
  /** Stable across merges: category-free, so a re-categorised line keeps its place in lists. */
  key: string;
  name: string;
  /** What to buy (idea 13), copied from `purchase` so older callers keep working. */
  amount: number | null;
  unit: string | null;
  categoryId: string | null;
  rows: ShoppingRow[];
  checked: boolean;
  /** Titles of the dishes the amounts come from, in the order they first appear. */
  dishes: string[];
  /** The `sp_unit_preferences` key: the ingredient table's key, or "?<canonical name>" for an unknown ingredient. */
  ingredientKey: string;
  purchase: Purchase;
  /** A basic such as salt or oil: shown under "Tjek at I har", without an amount, and not counted. */
  pantry: boolean;
  /** Every row behind the line with its original amount, for the item sheet. */
  sources: Source[];
};

const familyOf = (row: Pick<ShoppingRow, 'amount' | 'unit'>) => {
  const n = normalised(row.amount, row.unit);
  return n.family === 'other' ? n.unit : n.family;
};

export type MergeOptions = {
  /** Remembered units per ingredient key (`sp_unit_preferences`). */
  prefs?: Readonly<Record<string, string>>;
  /** The date of a plan entry, for the item sheet. */
  entryDate?: (planEntryId: string) => string | null;
};

/**
 * Rows of the same ingredient become one line (idea 13): known ingredients merge across name variants and units and show
 * what to buy, summed before rounding (`purchaseFor`). Unknown ingredients merge by name and unit family, as before.
 * Hidden statuses never appear. Stored amounts are never changed.
 */
export function mergeRows(
  rows: readonly ShoppingRow[],
  dishTitle: (recipeId: string) => string | null = () => null,
  { prefs = {}, entryDate = () => null }: MergeOptions = {},
): Line[] {
  type Draft = Omit<Line, 'amount' | 'unit' | 'purchase' | 'pantry' | 'checked'> & { ing: Ingredient | null };
  const lines = new Map<string, Draft>();
  for (const row of rows) {
    if (row.status !== 'active' && row.status !== 'checked') continue;
    const ing = ingredientFor(row.name);
    const canonical = row.canonical_name || canonicalName(row.name);
    const key = ing ? ing.key : `?${canonical}|${familyOf(row)}`;
    const dish = row.recipe_id ? dishTitle(row.recipe_id) : null;
    const source: Source = {
      rowId: row.id, dish, date: row.plan_entry_id ? entryDate(row.plan_entry_id) : null, name: row.name, amount: row.amount, unit: row.unit,
    };
    const line = lines.get(key);
    if (!line) {
      lines.set(key, {
        key, name: ing?.name ?? row.name, categoryId: row.grocery_category_id, rows: [row], dishes: dish ? [dish] : [],
        ingredientKey: ing ? ing.key : `?${canonical}`, sources: [source], ing,
      });
      continue;
    }
    line.rows.push(row);
    line.sources.push(source);
    line.categoryId ??= row.grocery_category_id;
    if (dish && !line.dishes.includes(dish)) line.dishes.push(dish);
  }
  return [...lines.values()].map(({ ing, ...line }) => {
    const purchase = purchaseFor(ing, line.rows, prefs[line.ingredientKey]);
    // A manual item typed without an amount stays without one ("Mælk", not "ca. 1 karton").
    const bare = line.rows.every((r) => r.amount === null && r.source === 'manual');
    const shown = bare && !purchase.pantry ? { ...purchase, amount: null, unit: null, approx: false } : purchase;
    return {
      ...line, purchase: shown, pantry: shown.pantry, amount: shown.amount, unit: shown.unit,
      checked: line.rows.every((r) => r.status === 'checked'),
    };
  });
}

export type Group = { categoryId: string | null; name: string; open: Line[]; done: Line[] };

export const pantryGroupId = 'pantry';

export type GroupOptions = {
  /** Idea 14: ticked lines leave their category for a separate "Købt" list (pantry lines stay in their own group). */
  doneSeparately: true;
  /** Keys of lines ticked on this phone a moment ago: they stay in place, shown ticked, until they settle. */
  settling?: ReadonlySet<string>;
};

/**
 * Idea 14's settling step. A just-ticked line (its key in `settling`) stays in `open`, shown ticked, so the person sees
 * the tick land before it moves. Unticking it makes it a plain open line again. Pantry lines never move to `bought`:
 * they are reminders, kept in "Tjek at I har".
 */
export function settle(lines: readonly Line[], settling: ReadonlySet<string> = new Set()) {
  const open: Line[] = [];
  const waiting: Line[] = [];
  const bought: Line[] = [];
  for (const line of lines) {
    if (!line.checked || line.pantry) open.push(line);
    else if (settling.has(line.key)) {
      open.push(line);
      waiting.push(line);
    } else bought.push(line);
  }
  return { open, settling: waiting, bought };
}

const byName = (a: Line, b: Line) => a.name.localeCompare(b.name, 'da');

/**
 * Lines grouped in store-walk order (the categories' `position`); lines without a category go last as "Andet". Ticked
 * lines collapse to the bottom of their group. Pantry lines form a trailing group "Tjek at I har" (idea 13).
 * With `{ doneSeparately: true }` (idea 14) ticked lines leave their groups for `bought` instead, once they have settled.
 */
export function groupLines(lines: readonly Line[], categories: readonly GroceryCategory[]): Group[];
export function groupLines(
  lines: readonly Line[], categories: readonly GroceryCategory[], options: GroupOptions,
): { groups: Group[]; bought: Line[] };
export function groupLines(lines: readonly Line[], categories: readonly GroceryCategory[], options?: GroupOptions) {
  const ordered = [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'da'));
  const known = new Set(ordered.map((c) => c.id));
  const groups: Group[] = ordered.map((c) => ({ categoryId: c.id, name: c.name, open: [], done: [] }));
  const loose: Group = { categoryId: null, name: 'Andet', open: [], done: [] };
  const pantry: Group = { categoryId: pantryGroupId, name: 'Tjek at I har', open: [], done: [] };
  const split = options ? settle(lines, options.settling) : null;
  const settling = new Set(split?.settling.map((l) => l.key));
  for (const line of [...(split ? split.open : lines)].sort(byName)) {
    const target = line.pantry
      ? pantry
      : line.categoryId && known.has(line.categoryId) ? groups.find((g) => g.categoryId === line.categoryId)! : loose;
    (line.checked && !settling.has(line.key) ? target.done : target.open).push(line);
  }
  const result = [...groups, loose, pantry].filter((g) => g.open.length + g.done.length > 0);
  return split ? { groups: result, bought: [...split.bought].sort(byName) } : result;
}

/** "x af y købt". Pantry lines are reminders, not purchases, so they count in neither number. */
export function counts(lines: readonly Line[]) {
  const buy = lines.filter((l) => !l.pantry);
  return { total: buy.length, done: buy.filter((l) => l.checked).length };
}

// ---------------------------------------------------------------------------------------------------------------
// Generating from the plan (repeatable)

/** One ingredient of one planned dinner, as it would be stored. */
export type Wanted = {
  planEntryId: string | null;
  recipeId: string;
  name: string;
  canonicalName: string;
  amount: number | null;
  unit: string | null;
  categoryId: string | null;
};

/** Ingredients of an entry's recipe scaled to the entry's persons. Lines with the same name and unit inside one recipe are summed. */
export function wantedFor(entry: PlanEntry, recipe: Recipe, categories: readonly GroceryCategory[]): Wanted[] {
  const persons = entry.servings ?? 2;
  const out = new Map<string, Wanted>();
  for (const i of recipe.ingredients) {
    const amount = scaleIngredient(i, recipe.base_servings, persons);
    const c = canonicalName(i.name);
    const unit = canonicalUnit(i.unit) || null;
    const key = `${c}|${normalised(amount, unit).family === 'other' ? unit ?? '' : normalised(amount, unit).family}`;
    const existing = out.get(key);
    if (existing) {
      const a = normalised(existing.amount, existing.unit);
      const b = normalised(amount, unit);
      if (a.amount !== null && b.amount !== null && a.family === b.family) {
        const sum = readable(a.amount + b.amount, a.family, a.unit);
        existing.amount = sum.amount;
        existing.unit = sum.unit;
      } else if (existing.amount === null) {
        existing.amount = amount;
        existing.unit = unit;
      }
      continue;
    }
    out.set(key, {
      planEntryId: entry.id || null, recipeId: recipe.id, name: i.name.trim(), canonicalName: c, amount, unit,
      categoryId: i.grocery_category_id ?? guessCategoryId(i.name, categories),
    });
  }
  return [...out.values()];
}

const sameQuantity = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 0.005);

export type Plan = {
  /** Entries nobody has been asked about yet: their ingredients go through the "har hjemme" review. */
  review: { entry: PlanEntry; recipe: Recipe; wanted: Wanted[] }[];
  /** Ingredients added to an entry that was already reviewed (the recipe changed since); added without asking. */
  add: Wanted[];
  /** Unticked rows whose amount no longer matches the plan (persons changed). */
  update: { id: string; amount: number | null; unit: string | null }[];
  /** Unticked rows of days that were removed or dishes that were swapped. */
  remove: string[];
};

const matchKey = (planEntryId: string, canonical: string, amount: number | null, unit: string | null) => {
  const n = normalised(amount, unit);
  return `${planEntryId}|${canonical}|${n.family === 'other' ? n.unit : n.family}`;
};

/**
 * What `Lav indkøbsliste` has to do for the entries of one week. Pure: it only compares the plan with the stored rows.
 * Ticked and cleared rows are never touched, `have` rows are never asked about again, and running it twice in a row
 * returns an empty plan (the second run sees its own rows).
 */
export function planGeneration(
  entries: readonly PlanEntry[],
  recipes: readonly Recipe[],
  rows: readonly ShoppingRow[],
  categories: readonly GroceryCategory[],
): Plan {
  const plan: Plan = { review: [], add: [], update: [], remove: [] };
  const planRows = rows.filter((r) => r.source === 'plan');
  const entryIds = new Set(entries.map((e) => e.id));
  // Leftover dinners (same recipe the day before) are not cooked again: they add no ingredients.
  const withRecipe = entries.filter((e) => e.recipe_id && !isLeftover(entries, e));

  for (const entry of withRecipe) {
    const recipe = recipes.find((r) => r.id === entry.recipe_id);
    if (!recipe) continue;
    const wanted = wantedFor(entry, recipe, categories);
    const mine = planRows.filter((r) => r.plan_entry_id === entry.id);
    if (mine.length === 0) {
      if (wanted.length) plan.review.push({ entry, recipe, wanted });
      continue;
    }
    const byKey = new Map(mine.map((r) => [matchKey(entry.id, r.canonical_name || canonicalName(r.name), r.amount, r.unit), r]));
    const seen = new Set<string>();
    for (const w of wanted) {
      const key = matchKey(entry.id, w.canonicalName, w.amount, w.unit);
      seen.add(key);
      const row = byKey.get(key);
      if (!row) plan.add.push(w);
      else if (row.status === 'active' && (!sameQuantity(row.amount, w.amount) || (row.unit ?? null) !== (w.unit ?? null))) {
        plan.update.push({ id: row.id, amount: w.amount, unit: w.unit });
      }
    }
    for (const [key, row] of byKey) if (!seen.has(key) && row.status !== 'checked' && row.status !== 'cleared') plan.remove.push(row.id);
  }

  // Rows of entries that are gone (the link was set to null when the entry was deleted) or are no longer a recipe dinner.
  for (const row of planRows) {
    const gone = row.plan_entry_id === null;
    const notRecipe = row.plan_entry_id !== null && entryIds.has(row.plan_entry_id) && !withRecipe.some((e) => e.id === row.plan_entry_id);
    if ((gone || notRecipe) && row.status !== 'checked' && row.status !== 'cleared') plan.remove.push(row.id);
  }
  return plan;
}

export const isEmptyPlan = (p: Plan) => p.review.length + p.add.length + p.update.length + p.remove.length === 0;

/** A row to store for a wanted plan ingredient. `have` rows are the ones the person said they already own. */
export function rowFor(householdId: string, w: Wanted, status: Status = 'active') {
  return {
    household_id: householdId,
    name: w.name,
    canonical_name: w.canonicalName,
    amount: w.amount,
    unit: w.unit,
    grocery_category_id: w.categoryId,
    status,
    source: w.planEntryId ? ('plan' as const) : ('recipe' as const),
    plan_entry_id: w.planEntryId,
    recipe_id: w.recipeId,
  };
}

/** A single recipe's ingredients for `persons`, as wanted lines (no plan entry). */
export function wantedForRecipe(recipe: Recipe, persons: number, categories: readonly GroceryCategory[]) {
  return wantedFor({ id: '', servings: persons } as PlanEntry, recipe, categories);
}
