import type { Tables } from '../../../../lib/supabase/database.types.ts';
import type { Idea } from '../ideas/model.ts';
import type { Recipe } from '../recipes/model.ts';
import { addDays } from './dates.ts';
import { categoryName, type Placeholder, placeholderFor } from '../recipes/placeholder.ts';

export type PlanEntry = Tables<'sp_meal_plan_entries'>;

/** One-tap dishes that are not recipes (design §5.3.3). */
export const quickDishes = ['Rester', 'Ude at spise', 'Takeaway'] as const;

export const defaultServings = 2;

export type Dish = {
  title: string;
  recipe: Recipe | null;
  /** Storage path of the recipe's or idea's photo. */
  imagePath: string | null;
  /** Storage path of the ~400 px thumbnail, for small pictures. Null when there is none; use `imagePath` then. */
  thumbPath: string | null;
  /** The tile shown without a photo (Idé 2). */
  placeholder: Placeholder;
};

type Category = { id: string; name: string };

/**
 * What a plan entry shows: the recipe's title, or the free text. An idea shows its title. The placeholder comes from a
 * recipe's tags and category (pass `categories` to use the category), an idea's tags, or the title.
 */
export function dishOf(entry: PlanEntry, recipes: readonly Recipe[], ideas: readonly Idea[] = [], categories: readonly Category[] = []): Dish {
  if (entry.recipe_id) {
    const recipe = recipes.find((r) => r.id === entry.recipe_id) ?? null;
    const title = recipe?.title ?? 'Opskrift';
    const placeholder = placeholderFor({ title, category: categoryName(categories, recipe?.category_id), tags: recipe?.tags });
    return { title, recipe, imagePath: recipe?.image_path ?? null, thumbPath: recipe?.thumb_path ?? null, placeholder };
  }
  if (entry.idea_id) {
    const idea = ideas.find((i) => i.id === entry.idea_id);
    const title = idea?.title ?? 'Aftensidé';
    return { title, recipe: null, imagePath: idea?.image_path ?? null, thumbPath: null, placeholder: placeholderFor({ title, tags: idea?.tags }) };
  }
  const title = entry.free_text || 'Aftensidé';
  return { title, recipe: null, imagePath: null, thumbPath: null, placeholder: placeholderFor({ title }) };
}

/** The entry on `date`, if any (one dinner per day). */
export const entryOn = (entries: readonly PlanEntry[], date: string) => entries.find((e) => e.date === date) ?? null;

export const cleanFreeText = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, 120);

/**
 * True when `entry` is a leftover dinner: the same recipe is planned the day before. Derived, nothing is stored. The later
 * day is the leftover, so it adds no ingredients to the shopping list.
 */
export const isLeftover = (entries: readonly PlanEntry[], entry: PlanEntry): boolean => {
  if (!entry.recipe_id) return false;
  const before = entryOn(entries, addDays(entry.date, -1));
  return before?.recipe_id === entry.recipe_id;
};
