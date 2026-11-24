import type { Tables } from '../../../../lib/supabase/database.types.ts';

export type RecipeRow = Tables<'sp_recipes'>;
export type IngredientRow = Tables<'sp_recipe_ingredients'>;
export type CategoryRow = Tables<'sp_recipe_categories'>;

export type Step = { text: string };

/** A recipe with its ingredients, the shape every view works with. */
export type Recipe = Omit<RecipeRow, 'steps'> & { steps: Step[]; ingredients: IngredientRow[] };

/** `steps` is stored as jsonb. Accepts `[{text}]` and plain strings, drops blanks, never throws on odd data. */
export function parseSteps(value: unknown): Step[] {
  if (!Array.isArray(value)) return [];
  const out: Step[] = [];
  for (const v of value) {
    const text = typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as { text?: unknown }).text === 'string' ? (v as { text: string }).text : '';
    if (text.trim()) out.push({ text: text.trim() });
  }
  return out;
}

/** One ingredient line in the editor: amount is text so "1,5" can be typed. */
export type IngredientDraft = {
  key: string; amount: string; unit: string; name: string; note: string; scales: boolean;
  /** Set by an import (design D32); kept as is when the recipe is edited. */
  canonicalName?: string;
  groceryCategoryId?: string | null;
};

export type RecipeDraft = {
  title: string;
  descriptor: string;
  categoryId: string | null;
  tags: string[];
  baseServings: number;
  totalMinutes: string;
  ingredients: IngredientDraft[];
  steps: string[];
  sourceUrl: string;
  /** The pasted text an import came from, kept so the original wording can still be seen. */
  originalText?: string;
  /** The dish photo an import found (an https address). Fetched into Storage after the recipe is saved, never hotlinked. */
  imageUrl?: string;
};

export const emptyDraft = (categoryId: string | null = null): RecipeDraft => ({
  title: '', descriptor: '', categoryId, tags: [], baseServings: 4, totalMinutes: '', ingredients: [], steps: [], sourceUrl: '',
});

/** `1,5` and `1.5` both parse; empty is `null`; anything else is `undefined` (invalid). */
export function parseAmount(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  const n = Number(t);
  return n > 0 && n < 100000 ? n : undefined;
}

export type DraftProblem = { field: 'title' | 'servings' | 'minutes' | 'amount' | 'ingredient' | 'source'; index?: number; message: string };

/** What blocks saving. Danish messages: they are shown to the person. */
export function validateDraft(d: RecipeDraft): DraftProblem[] {
  const out: DraftProblem[] = [];
  if (!d.title.trim()) out.push({ field: 'title', message: 'Giv opskriften et navn.' });
  if (!Number.isInteger(d.baseServings) || d.baseServings < 1 || d.baseServings > 24) out.push({ field: 'servings', message: 'Antal personer skal være mellem 1 og 24.' });
  if (d.totalMinutes.trim() && !/^\d{1,4}$/.test(d.totalMinutes.trim())) out.push({ field: 'minutes', message: 'Tiden skal være et helt antal minutter.' });
  d.ingredients.forEach((i, index) => {
    if (!i.name.trim() && (i.amount.trim() || i.unit.trim())) out.push({ field: 'ingredient', index, message: 'Skriv hvad ingrediensen hedder.' });
    if (parseAmount(i.amount) === undefined) out.push({ field: 'amount', index, message: `"${i.amount}" er ikke en mængde.` });
  });
  const url = d.sourceUrl.trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) out.push({ field: 'source', message: 'Linket skal starte med http:// eller https://.' });
  return out;
}

export const normaliseTag = (t: string) => t.trim().replace(/^#/, '').toLocaleLowerCase('da');

/** Tags are lower-case, unique, non-empty. */
export function cleanTags(tags: string[]): string[] {
  return [...new Set(tags.map(normaliseTag).filter(Boolean))];
}

export function draftFromRecipe(r: Recipe): RecipeDraft {
  return {
    title: r.title,
    descriptor: r.descriptor ?? '',
    categoryId: r.category_id,
    tags: r.tags,
    baseServings: r.base_servings,
    totalMinutes: r.total_minutes === null ? '' : String(r.total_minutes),
    sourceUrl: r.source_url ?? '',
    originalText: r.original_text ?? undefined,
    steps: r.steps.map((s) => s.text),
    ingredients: [...r.ingredients]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        key: i.id,
        amount: i.amount === null ? '' : String(i.amount).replace('.', ','),
        unit: i.unit ?? '',
        name: i.name,
        note: i.note ?? '',
        scales: i.scales,
        canonicalName: i.canonical_name ?? undefined,
        groceryCategoryId: i.grocery_category_id,
      })),
  };
}

let counter = 0;
export const newIngredient = (): IngredientDraft => ({ key: `new-${Date.now()}-${counter++}`, amount: '', unit: '', name: '', note: '', scales: true });

/** The link a small picture should use: the thumbnail when it is signed, otherwise the full photo. */
export const smallPhotoUrl = (photos: Record<string, string>, thumbPath: string | null | undefined, imagePath: string | null | undefined): string | undefined =>
  (thumbPath ? photos[thumbPath] : undefined) ?? (imagePath ? photos[imagePath] : undefined);
