import type { Tables } from '../../../../lib/supabase/database.types.ts';
import { cleanTags } from '../recipes/model.ts';
import { fold } from '../recipes/filter.ts';
import type { Recipe } from '../recipes/model.ts';

export type Idea = Tables<'sp_dinner_ideas'>;

export type CatalogItem = { kind: 'recipe'; recipe: Recipe } | { kind: 'idea'; idea: Idea };

export const cleanTitle = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, 200);

export type IdeaDraft = { title: string; note: string; tags: string[] };
export const emptyIdea: IdeaDraft = { title: '', note: '', tags: [] };

export const ideaProblem = (d: IdeaDraft) => (cleanTitle(d.title) ? null : 'Giv idéen et navn.');

export const cleanIdea = (d: IdeaDraft) => ({ title: cleanTitle(d.title), note: d.note.trim() || null, tags: cleanTags(d.tags) });

/**
 * The catalog of dinner options (design §5.3.2): every Aftensmad recipe plus every idea that has not become a recipe,
 * newest first, filtered by the words of `query` (title, tags, note). Without an Aftensmad category all recipes count.
 */
export function catalog(recipes: readonly Recipe[], ideas: readonly Idea[], dinnerCategoryId: string | null, query = ''): CatalogItem[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const items: CatalogItem[] = [
    ...recipes.filter((r) => !r.archived_at && (!dinnerCategoryId || r.category_id === dinnerCategoryId)).map((recipe) => ({ kind: 'recipe' as const, recipe })),
    ...ideas.filter((i) => !i.promoted_recipe_id).map((idea) => ({ kind: 'idea' as const, idea })),
  ];
  const created = (i: CatalogItem) => (i.kind === 'recipe' ? i.recipe.created_at : i.idea.created_at);
  const hay = (i: CatalogItem) => fold(i.kind === 'recipe' ? [i.recipe.title, ...i.recipe.tags].join(' \n ') : [i.idea.title, i.idea.note ?? '', ...i.idea.tags].join(' \n '));
  return items
    .filter((i) => words.every((w) => hay(i).includes(w)))
    .sort((a, b) => created(b).localeCompare(created(a)));
}

/** The id of the Aftensmad category, if the household still has one. */
export const dinnerCategoryId = (categories: readonly { id: string; name: string }[]) => categories.find((c) => c.name === 'Aftensmad')?.id ?? null;
