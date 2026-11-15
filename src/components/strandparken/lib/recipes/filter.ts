import type { Recipe } from './model.ts';

export type RecipeFilter = { categoryId: string | null; tag: string | null; query: string };

export const fold = (s: string) => s.toLocaleLowerCase('da').normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Every word of the query must appear in the title, a tag or an ingredient name (design §5.3.1). Archived recipes are never listed. */
export function filterRecipes(recipes: readonly Recipe[], f: RecipeFilter): Recipe[] {
  const words = fold(f.query).split(/\s+/).filter(Boolean);
  return recipes.filter((r) => {
    if (r.archived_at) return false;
    if (f.categoryId && r.category_id !== f.categoryId) return false;
    if (f.tag && !r.tags.includes(f.tag)) return false;
    if (!words.length) return true;
    const hay = fold([r.title, r.descriptor ?? '', ...r.tags, ...r.ingredients.map((i) => i.name)].join(' \n '));
    return words.every((w) => hay.includes(w));
  });
}

/** Tags in use, most used first, then alphabetical. */
export function tagsInUse(recipes: readonly Recipe[]): string[] {
  const counts = new Map<string, number>();
  for (const r of recipes) if (!r.archived_at) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'da')).map(([t]) => t);
}

/** Newest first. */
export const byNewest = (a: Recipe, b: Recipe) => b.created_at.localeCompare(a.created_at);
