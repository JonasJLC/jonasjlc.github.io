import type { GroceryCategory } from '../shopping/model.ts';
import { cleanTags, newIngredient, type IngredientDraft, type RecipeDraft } from './model.ts';

/** What `recipe-import` returns (supabase/functions/recipe-import/logic.ts). */
export type ImportedRecipe = {
  title: string;
  descriptor: string | null;
  servings: number | null;
  totalMinutes: number | null;
  tags: string[];
  ingredients: { amount: number | null; unit: string | null; name: string; canonicalName: string; groceryCategory: string; note: string | null; scales: boolean }[];
  steps: string[];
  unsure: ('title' | 'servings' | 'time' | 'ingredients' | 'steps')[];
  sourceUrl: string | null;
  /** The photo address the page names, or null (also for text and screenshot imports). */
  imageUrl?: string | null;
  originalText: string | null;
};

export type ImportSource = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'web';

/** Social posts cannot be read from a server (design R2): the caption has to be pasted or screenshotted. */
export function detectSource(link: string): { url: string; source: ImportSource } | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`);
  } catch {
    return null;
  }
  if (!u.hostname.includes('.') || (u.protocol !== 'http:' && u.protocol !== 'https:')) return null;
  const host = u.hostname.replace(/^(www|m|vm|vt)\./, '');
  const source: ImportSource = /(^|\.)instagram\.com$/.test(host) ? 'instagram'
    : /(^|\.)tiktok\.com$/.test(host) ? 'tiktok'
    : /(^|\.)(facebook\.com|fb\.watch)$/.test(host) ? 'facebook'
    : /(^|\.)(youtube\.com|youtu\.be)$/.test(host) ? 'youtube'
    : 'web';
  return { url: u.toString(), source };
}

/** A link without the parts that do not change the page: scheme, `www.`, `#fragment`, tracking parameters, a trailing slash. */
export function normaliseUrl(link: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`);
    if (!u.hostname.includes('.')) return null;
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|igshid$|mc_)/i.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    const query = u.searchParams.toString();
    return `${u.hostname.toLowerCase().replace(/^(www|m)\./, '')}${u.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}`;
  } catch {
    return null;
  }
}

/** The recipe that was already imported from this link, if any (design §1.2: the same link twice is not a silent duplicate). */
export function findBySource<T extends { source_url: string | null }>(recipes: readonly T[], link: string): T | null {
  const wanted = normaliseUrl(link);
  return wanted ? recipes.find((r) => r.source_url && normaliseUrl(r.source_url) === wanted) ?? null : null;
}

export const sourceName: Record<ImportSource, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', web: 'siden' };

/** The editor's draft from an import. Every field stays editable; `unsure` lists what to double-check. */
export function toDraft(r: ImportedRecipe, dinnerCategoryId: string | null, groceryCategories: readonly GroceryCategory[]): RecipeDraft & { unsure: ImportedRecipe['unsure'] } {
  const categoryId = (name: string) => groceryCategories.find((c) => c.name === name)?.id ?? groceryCategories.find((c) => c.name === 'Andet')?.id ?? null;
  const ingredients: IngredientDraft[] = r.ingredients.map((i) => ({
    ...newIngredient(),
    amount: i.amount === null ? '' : String(i.amount).replace('.', ','),
    unit: i.unit ?? '',
    name: i.name,
    note: i.note ?? '',
    scales: i.scales,
    canonicalName: i.canonicalName.trim().toLocaleLowerCase('da') || undefined,
    groceryCategoryId: categoryId(i.groceryCategory),
  }));
  return {
    title: r.title.trim(),
    descriptor: r.descriptor?.trim() ?? '',
    categoryId: dinnerCategoryId,
    tags: cleanTags(r.tags.slice(0, 4)),
    baseServings: r.servings && r.servings >= 1 && r.servings <= 24 ? r.servings : 4,
    totalMinutes: r.totalMinutes && r.totalMinutes > 0 ? String(r.totalMinutes) : '',
    ingredients: ingredients.length ? ingredients : [newIngredient()],
    steps: r.steps.length ? r.steps.map((s) => s.trim()).filter(Boolean) : [''],
    sourceUrl: r.sourceUrl ?? '',
    originalText: r.originalText ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    // A missing servings or time is always worth a look, whatever the model said.
    unsure: [...new Set([...r.unsure, ...(r.servings ? [] : (['servings'] as const)), ...(r.totalMinutes ? [] : (['time'] as const))])],
  };
}

export const unsureLabel: Record<ImportedRecipe['unsure'][number], string> = {
  title: 'navnet', servings: 'antal personer', time: 'tiden', ingredients: 'ingredienserne', steps: 'fremgangsmåden',
};

/** A draft on its way from the add sheet to the editor. Held in memory only: a reload starts from a blank editor. */
let pending: (RecipeDraft & { unsure: ImportedRecipe['unsure'] }) | null = null;
export const setPendingDraft = (d: typeof pending) => { pending = d; };
export const peekPendingDraft = () => pending;
export const clearPendingDraft = () => { pending = null; };

/** What the person sees for each error code the function can return (design §4.7, ADR-07). */
export function importErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'not_a_recipe': return 'Jeg kunne ikke finde en opskrift i det. Prøv med mere tekst eller et tydeligere skærmbillede.';
    case 'rate_limited': return 'I har brugt dagens import. Prøv igen i morgen, eller skriv opskriften selv.';
    case 'budget_exceeded': return 'Månedens AI-budget er brugt. Skriv opskriften selv i mellemtiden.';
    case 'refused': return 'Det kunne ikke læses som en opskrift.';
    case 'bad_url': return 'Det ligner ikke en side, jeg kan hente. Linket skal begynde med https://.';
    case 'blocked': return 'Den adresse kan jeg ikke hente.';
    case 'fetch_failed': return 'Jeg kunne ikke hente siden.';
    case 'not_html': return 'Linket peger ikke på en side, jeg kan læse.';
    case 'too_large': return 'Siden er for stor til at blive læst.';
    case 'bad_request': return 'Teksten eller billedet kan ikke bruges. Tjek længden og formatet.';
    case 'unauthorized': case 'forbidden': return 'Log ind igen og prøv igen.';
    case 'not_configured': return 'Import er ikke sat op endnu. Skriv opskriften selv.';
    default: return 'Importen lykkedes ikke. Prøv igen, eller skriv opskriften selv.';
  }
}
