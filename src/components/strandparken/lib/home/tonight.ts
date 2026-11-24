// Hjem's "I aften" card (idea 6): which dish, which link and which meta line. Pure, so it can be tested without React.
import type { Idea } from '../ideas/model.ts';
import { weekdayLong, type IsoDate } from '../madplan/dates.ts';
import { defaultServings, dishOf, entryOn, type PlanEntry } from '../madplan/model.ts';
import { smallPhotoUrl, type Recipe } from '../recipes/model.ts';
import type { Placeholder } from '../recipes/placeholder.ts';
import { madplanDayHref } from '../routes.ts';
import { personsLabel } from '../stepper.ts';

export type TonightCard =
  | {
      kind: 'planned';
      title: string;
      /** The visible line under the name: "25 min · 2 pers." (the time only for a recipe that has one). */
      meta: string;
      /** The link's accessible name: "I aften: Quesadillas med oksekød, 25 min, 2 personer". */
      label: string;
      /** A recipe opens the recipe; an idea or free text has none, so it opens today's Madplan sheet. */
      href: string;
      photo?: string;
      /** The category- or tag-coloured tile shown without a photo (Idé 2). */
      placeholder: Placeholder;
    }
  | { kind: 'empty'; weekdayLong: string; href: string };

/** Today's dinner as the Hjem card shows it. `photos` maps storage paths to signed URLs. */
export function tonightCard(
  entries: readonly PlanEntry[],
  recipes: readonly Recipe[],
  ideas: readonly Idea[],
  photos: Record<string, string>,
  today: IsoDate,
  categories: readonly { id: string; name: string }[] = [],
): TonightCard {
  const dayHref = madplanDayHref(today);
  const entry = entryOn(entries, today);
  if (!entry) return { kind: 'empty', weekdayLong: weekdayLong(today), href: dayHref };
  const dish = dishOf(entry, recipes, ideas, categories);
  const servings = entry.servings ?? defaultServings;
  const minutes = dish.recipe?.total_minutes ? `${dish.recipe.total_minutes} min` : null;
  return {
    kind: 'planned',
    title: dish.title,
    meta: [minutes, `${servings} pers.`].filter(Boolean).join(' · '),
    label: `I aften: ${[dish.title, minutes, personsLabel(servings)].filter(Boolean).join(', ')}`,
    href: dish.recipe ? `#opskrifter/${dish.recipe.id}` : dayHref,
    photo: smallPhotoUrl(photos, dish.thumbPath, dish.imagePath),
    placeholder: dish.placeholder,
  };
}
