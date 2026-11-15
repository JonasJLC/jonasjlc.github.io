import type { Tables } from '../../../../lib/supabase/database.types.ts';
import type { Recipe } from '../recipes/model.ts';

export type PlanEntry = Tables<'sp_meal_plan_entries'>;

/** One-tap dishes that are not recipes (design §5.3.3). */
export const quickDishes = ['Rester', 'Ude at spise', 'Takeaway'] as const;

export const defaultServings = 2;

export type Dish = { title: string; recipe: Recipe | null };

/** What a plan entry shows: the recipe's title, or the free text. Entries pointing at an idea are handled in slice 1.7. */
export function dishOf(entry: PlanEntry, recipes: readonly Recipe[]): Dish {
  if (entry.recipe_id) {
    const recipe = recipes.find((r) => r.id === entry.recipe_id) ?? null;
    return { title: recipe?.title ?? 'Opskrift', recipe };
  }
  if (entry.free_text) return { title: entry.free_text, recipe: null };
  return { title: 'Aftensidé', recipe: null };
}

/** The entry on `date`, if any (one dinner per day). */
export const entryOn = (entries: readonly PlanEntry[], date: string) => entries.find((e) => e.date === date) ?? null;

export const cleanFreeText = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, 120);
