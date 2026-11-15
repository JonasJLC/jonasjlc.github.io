import type { Tables } from '../../../../lib/supabase/database.types.ts';
import type { Idea } from '../ideas/model.ts';
import type { Recipe } from '../recipes/model.ts';

export type PlanEntry = Tables<'sp_meal_plan_entries'>;

/** One-tap dishes that are not recipes (design §5.3.3). */
export const quickDishes = ['Rester', 'Ude at spise', 'Takeaway'] as const;

export const defaultServings = 2;

export type Dish = { title: string; recipe: Recipe | null };

/** What a plan entry shows: the recipe's title, or the free text. An idea shows its title. */
export function dishOf(entry: PlanEntry, recipes: readonly Recipe[], ideas: readonly Idea[] = []): Dish {
  if (entry.recipe_id) {
    const recipe = recipes.find((r) => r.id === entry.recipe_id) ?? null;
    return { title: recipe?.title ?? 'Opskrift', recipe };
  }
  if (entry.idea_id) return { title: ideas.find((i) => i.id === entry.idea_id)?.title ?? 'Aftensidé', recipe: null };
  if (entry.free_text) return { title: entry.free_text, recipe: null };
  return { title: 'Aftensidé', recipe: null };
}

/** The entry on `date`, if any (one dinner per day). */
export const entryOn = (entries: readonly PlanEntry[], date: string) => entries.find((e) => e.date === date) ?? null;

export const cleanFreeText = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, 120);
