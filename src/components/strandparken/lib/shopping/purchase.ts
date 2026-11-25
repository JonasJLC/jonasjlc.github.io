/**
 * Buyable amounts on the shopping list (idea 13, ADR-08 "Display conversion"). Pure functions, no I/O.
 *
 * Rows keep the recipe's amount. On display, the rows of one ingredient are converted to that ingredient's base measure
 * (g, ml or stk), summed across recipes and name variants, and only then rounded once to something a Danish supermarket
 * sells: whole pieces, whole packages, or loose weight rounded up to 100 g. Basics go to "Tjek at I har".
 */
import { canonicalName, canonicalUnit, mass, volume } from './model.ts';
import { formatQuantity } from '../recipes/scale.ts';
import { ingredients, type Ingredient, type Measure } from './ingredients-dk.ts';

export type { Ingredient } from './ingredients-dk.ts';

// ---------------------------------------------------------------------------------------------------------------
// Name lookup

let index: Map<string, Ingredient> | null = null;
/** Built on first use (not at import), so the circular import with `model.ts` is harmless. */
const byAlias = () => {
  if (!index) {
    index = new Map();
    for (const ing of ingredients) for (const alias of ing.aliases) index.set(alias, ing);
  }
  return index;
};

/** The table entry for a line's `ingredientKey`; `null` for unknown ingredients ("?…"). */
export const ingredientByKey = (key: string): Ingredient | null => ingredients.find((i) => i.key === key) ?? null;

/** Size, quality and preparation words in front of the ingredient: "store tomater", "finthakket løg". */
const leadingWords = new Set([
  'store', 'stor', 'stort', 'små', 'lille', 'mellemstore', 'mellemstor', 'friske', 'frisk', 'friskt', 'modne', 'moden',
  'økologiske', 'økologisk', 'øko', 'finthakket', 'finthakkede', 'grofthakket', 'grofthakkede', 'groft', 'fint', 'revet',
  'revne', 'skåret', 'skårne', 'kogte', 'kogt', 'tørrede', 'frosne', 'frossen', 'dansk', 'danske', 'gode', 'ca',
]);

/** Trailing clauses that do not change what is bought: "tun i vand", "løg i tern", "salt og peber". */
const clause = /\s+(i|på|med|uden|til|og|eller|eventuelt|evt)\s+.*$/;

function forms(name: string): string[] {
  let n = canonicalName(name).split(',')[0].replace(/\s*\d+(?:[.,]\d+)?\s*%/g, ' ').replace(/\s+/g, ' ').trim();
  const out = [n];
  const words = n.split(' ');
  while (words.length > 1 && leadingWords.has(words[0])) words.shift();
  n = words.join(' ');
  out.push(n);
  const short = n.replace(clause, '').trim();
  if (short) out.push(short);
  return [...new Set(out)];
}

/**
 * The table entry for an ingredient name, or `null` when it is not in the table. Exact names (and their variants) win,
 * so "rødløg" is never "løg"; otherwise the last word decides, as Danish compounds put the key word last ("letmælk",
 * "bøftomater"), and the longest matching name wins.
 */
export function ingredientFor(name: string): Ingredient | null {
  const map = byAlias();
  const all = forms(name);
  for (const f of all) {
    const hit = map.get(f);
    if (hit) return hit;
  }
  const words = all[all.length - 1].split(' ').filter(Boolean);
  const last = words[words.length - 1];
  if (!last) return null;
  if (map.has(last)) return map.get(last)!;
  let best: [string, Ingredient] | null = null;
  for (const [alias, ing] of map) {
    if (alias.length >= 3 && !alias.includes(' ') && last.endsWith(alias) && (!best || alias.length > best[0].length)) best = [alias, ing];
  }
  if (best) return best[1];
  return map.get(words[0]) ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Base measure

const spoonMl: Record<string, number> = { tsk: 5, spsk: 15, knsp: 0.5, krm: 1 };
/** Recipe units for packages, singular. */
const packAliases: Record<string, string> = {
  dåser: 'dåse', ds: 'dåse', bakker: 'bakke', pk: 'pakke', pakker: 'pakke', pkt: 'pakke', bægre: 'bæger', kartoner: 'karton',
  poser: 'pose', bundter: 'bundt', flasker: 'flaske', fl: 'flaske', tuber: 'tube', stykker: 'stk',
};
const unitOf = (unit: string | null) => {
  const u = canonicalUnit(unit);
  return packAliases[u] ?? u;
};

export type Base = { value: number; measure: Measure; approx: boolean };

/** The measure an ingredient is summed in: its package's, pieces for count items, grams for loose weight. */
export function baseMeasure(ing: Ingredient): Measure {
  if (ing.pack) return ing.pack.measure;
  return ing.rule === 'count' ? 'stk' : 'g';
}

function convert(ing: Ingredient, q: Base, to: Measure): Base | null {
  if (q.measure === to) return q;
  let { value, approx } = q;
  // Through grams: every measure can reach grams if the ingredient knows the factor.
  let grams: number;
  if (q.measure === 'g') grams = value;
  else if (q.measure === 'ml') {
    if (!ing.gramsPerMl) approx = true;
    grams = value * (ing.gramsPerMl ?? 1);
  } else {
    if (!ing.pieceGrams) return null;
    grams = value * ing.pieceGrams;
  }
  if (to === 'g') value = grams;
  else if (to === 'ml') {
    if (!ing.gramsPerMl) approx = true;
    value = grams / (ing.gramsPerMl ?? 1);
  } else {
    if (!ing.pieceGrams) return null;
    value = grams / ing.pieceGrams;
  }
  return { value, measure: to, approx };
}

/** One recipe amount in the ingredient's base measure; `null` when there is no amount or the unit cannot be converted. */
export function toBase(ing: Ingredient, amount: number | null, unit: string | null, to: Measure = baseMeasure(ing)): Base | null {
  if (amount === null || !Number.isFinite(amount) || amount < 0) return null;
  const u = unitOf(unit);
  let q: Base;
  if (ing.per && u in ing.per) q = { value: amount * ing.per[u], measure: baseMeasure(ing), approx: false };
  else if (u === '' || u === 'stk') q = { value: amount, measure: 'stk', approx: false };
  else if (u in mass) q = { value: amount * mass[u as keyof typeof mass], measure: 'g', approx: false };
  else if (u in volume) q = { value: amount * volume[u as keyof typeof volume], measure: 'ml', approx: false };
  else if ((u === 'tsk' || u === 'spsk') && ing.spoonGrams) q = { value: amount * ing.spoonGrams[u], measure: 'g', approx: false };
  else if (u in spoonMl) q = { value: amount * spoonMl[u], measure: 'ml', approx: false };
  else if (ing.pack && u === ing.pack.unit) q = { value: amount * ing.pack.size, measure: ing.pack.measure, approx: false };
  else return null;
  return convert(ing, q, to);
}

// ---------------------------------------------------------------------------------------------------------------
// Purchase quantity

export type Part = { amount: number | null; unit: string | null };
export type Purchase = {
  amount: number | null;
  unit: string | null;
  pantry: boolean;
  approx: boolean;
  /** What the packages hold in total ("1 bakke" holds 1000 g), so the list shows count and amount together. */
  contains?: { amount: number; unit: 'g' | 'ml' | 'stk' };
};

const EPS = 1e-9;
const ceilTo = (value: number, step: number) => Math.ceil(value / step - EPS) * step;
const round2 = (n: number) => Math.round(n * 1000) / 1000;
const none: Purchase = { amount: null, unit: null, pantry: false, approx: false };
const of = (amount: number, unit: string, approx = false): Purchase => ({ amount: round2(amount), unit, pantry: false, approx });

/** Grams rounded up to 100 g, shown as kg from 1000 g ("1,2 kg"). */
const byWeight = (grams: number, approx: boolean, forceKg = false): Purchase => {
  const g = Math.max(100, ceilTo(grams, 100));
  return g >= 1000 || forceKg ? of(g / 1000, 'kg', approx) : of(g, 'g', approx);
};
/** Millilitres rounded up to 1 dl, shown as l from 1000 ml. */
const byVolume = (ml: number, approx: boolean, forceL = false): Purchase => {
  const v = Math.max(100, ceilTo(ml, 100));
  return v >= 1000 || forceL ? of(v / 1000, 'l', approx) : of(v, 'ml', approx);
};

/**
 * The recipe amount rounded up in its own readable unit (unknown ingredients, and the "Opskriftens mængde" choice):
 * spoons, fed, bundt, dåse and stk to whole numbers, g to the next 10 g, dl to whole dl, l to the next half litre.
 * Only parts in the first part's unit family are summed; others make the result approximate.
 */
export function recipeRounded(parts: readonly Part[]): Purchase {
  const given = parts.filter((p) => p.amount !== null && Number.isFinite(p.amount));
  if (!given.length) return none;
  const family = (u: string) => (u in mass ? 'mass' : u in volume ? 'volume' : u === '' ? 'stk' : u);
  const first = family(unitOf(given[0].unit));
  let sum = 0;
  let approx = false;
  for (const p of given) {
    const u = unitOf(p.unit);
    if (family(u) !== first) {
      approx = true;
      continue;
    }
    sum += p.amount! * (first === 'mass' ? mass[u as keyof typeof mass] : first === 'volume' ? volume[u as keyof typeof volume] : 1);
  }
  if (!(sum > 0)) return none;
  if (first === 'mass') {
    const g = ceilTo(sum, 10);
    return g >= 1000 ? of(g / 1000, 'kg', approx) : of(g, 'g', approx);
  }
  if (first === 'volume') {
    if (sum >= 1000) return of(ceilTo(sum / 1000, 0.5), 'l', approx);
    if (sum >= 100) return of(ceilTo(sum / 100, 1), 'dl', approx);
    return of(ceilTo(sum, 10), 'ml', approx);
  }
  return of(ceilTo(sum, 1), first, approx);
}

/** Every part with an amount summed in `to`; `missed` counts parts with an amount that could not be converted. */
function total(ing: Ingredient, parts: readonly Part[], to: Measure) {
  let value = 0;
  let converted = 0;
  let missed = 0;
  let approx = false;
  for (const p of parts) {
    if (p.amount === null) continue;
    const b = toBase(ing, p.amount, p.unit, to);
    if (!b) {
      missed++;
      continue;
    }
    value += b.value;
    converted++;
    approx ||= b.approx;
  }
  return { value, converted, approx: approx || missed > 0 };
}

function byRule(ing: Ingredient, parts: readonly Part[]): Purchase {
  if (ing.pack) {
    const t = total(ing, parts, ing.pack.measure);
    if (t.converted === 0 || !(t.value > 0)) return of(1, ing.pack.unit, true);
    return of(Math.max(1, Math.ceil(t.value / ing.pack.size - EPS)), ing.pack.unit, t.approx);
  }
  if (ing.rule === 'count') {
    const t = total(ing, parts, 'stk');
    if (t.converted === 0 || !(t.value > 0)) return of(1, 'stk', true);
    return of(Math.max(1, Math.ceil(t.value - EPS)), 'stk', t.approx);
  }
  const t = total(ing, parts, 'g');
  if (t.converted === 0 || !(t.value > 0)) {
    const r = recipeRounded(parts);
    return r.amount === null ? of(1, 'stk', true) : { ...r, approx: true };
  }
  return byWeight(t.value, t.approx);
}

/** A preferred unit, or `null` when it does not apply to this ingredient (the default is used then). */
function byPreference(ing: Ingredient, parts: readonly Part[], pref: string): Purchase | null {
  if (pref === 'recipe') {
    const r = recipeRounded(parts);
    if (!r.approx) return r.amount === null ? null : r;
    const t = total(ing, parts, baseMeasure(ing));
    return t.converted ? recipeRounded([{ amount: t.value, unit: baseMeasure(ing) }]) : r;
  }
  if (ing.pack && pref === ing.pack.unit) return byRule(ing, parts);
  const to: Measure | null = pref === 'stk' ? 'stk' : pref === 'g' || pref === 'kg' ? 'g' : pref === 'ml' || pref === 'l' ? 'ml' : null;
  if (!to) return null;
  const t = total(ing, parts, to);
  if (t.converted === 0 || !(t.value > 0)) return null;
  if (to === 'stk') return of(Math.max(1, Math.ceil(t.value - EPS)), 'stk', t.approx);
  if (to === 'g') return byWeight(t.value, t.approx, pref === 'kg');
  return byVolume(t.value, t.approx, pref === 'l');
}

/**
 * What to buy for the summed parts of one ingredient. `pref` is the household's remembered unit for it (a package unit,
 * "stk", "g", "kg", "ml", "l" or "recipe"). Unknown ingredients: whole pieces if every amount is a count, otherwise the
 * recipe amount rounded up.
 */
export function purchaseFor(ing: Ingredient | null, parts: readonly Part[], pref?: string): Purchase {
  if (!ing) {
    const given = parts.filter((p) => p.amount !== null);
    if (given.length && given.every((p) => ['', 'stk'].includes(unitOf(p.unit)))) {
      const sum = given.reduce((s, p) => s + p.amount!, 0);
      return sum > 0 ? of(Math.max(1, Math.ceil(sum - EPS)), 'stk') : none;
    }
    return recipeRounded(parts);
  }
  if (ing.rule === 'pantry') {
    if (!ing.pack || ing.pantryBelow === undefined) return { ...none, pantry: true };
    const t = total(ing, parts, ing.pack.measure);
    if (t.converted === 0 || t.value <= ing.pantryBelow) return { ...none, pantry: true };
  }
  return withContents(ing, (pref && byPreference(ing, parts, pref)) || byRule(ing, parts));
}

/** A package count gets the total it holds, from the table's package size (never for pieces: "1 æble" stays "1 æble"). */
function withContents(ing: Ingredient, p: Purchase): Purchase {
  if (!ing.pack || p.amount === null || p.unit !== ing.pack.unit) return p;
  return { ...p, contains: { amount: round2(p.amount * ing.pack.size), unit: ing.pack.measure } };
}

/** What the unit picker offers: the package unit, "stk" when pieces make sense, g (or ml for liquids), and the recipe amount. */
export function unitOptions(ing: Ingredient | null): string[] {
  if (!ing || (ing.rule === 'pantry' && !ing.pantryBelow)) return [];
  const base = baseMeasure(ing);
  const out: string[] = [];
  if (ing.pack) out.push(ing.pack.unit);
  if (base === 'stk' || ing.pieceGrams) out.push('stk');
  if (base === 'ml') out.push('ml');
  else if (base === 'g' || ing.pieceGrams) out.push('g');
  out.push('recipe');
  return out;
}

/** Danish plural after a number: "2 dåser", "1 dåse". */
const plurals: Record<string, string> = {
  dåse: 'dåser', bakke: 'bakker', pakke: 'pakker', bæger: 'bægre', karton: 'kartoner', glas: 'glas', pose: 'poser',
  bundt: 'bundter', net: 'net', flaske: 'flasker', tube: 'tuber',
};
export const unitLabel = (amount: number | null, unit: string | null) => (unit && amount !== null && amount > 1 ? plurals[unit] ?? unit : unit);

/** "2 dåser (800 gram)", "ca. 1 bundt", "1,2 kg"; empty for a pantry line or a line without an amount. */
export function purchaseText(p: Purchase): string {
  if (p.pantry || p.amount === null) return '';
  const text = formatQuantity(p.amount, unitLabel(p.amount, p.unit));
  const full = text && p.contains ? `${text} (${formatQuantity(p.contains.amount, p.contains.unit === 'g' ? 'gram' : p.contains.unit)})` : text;
  return full && p.approx ? `ca. ${full}` : full;
}

/** Label for a unit-picker chip. */
export const optionLabel = (unit: string) =>
  ({ recipe: 'Opskriftens mængde', g: 'Vægt (g/kg)', ml: 'Rumfang (ml/l)', stk: 'Stk' } as Record<string, string>)[unit] ??
  unit.charAt(0).toLocaleUpperCase('da') + unit.slice(1);
