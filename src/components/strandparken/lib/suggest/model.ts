// Candidates for "Foreslå ret" (design §5.3.5). Code decides what may be suggested; the model only ranks the list.
import { catalog, type CatalogItem, type Idea } from '../ideas/model.ts';
import { dislikeHits, ideaDislikeHits, type Profile } from '../profile/model.ts';
import { addDays, type IsoDate } from '../madplan/dates.ts';
import type { PlanEntry } from '../madplan/model.ts';
import { people } from '../people.ts';
import type { Recipe } from '../recipes/model.ts';

export const MAX_CANDIDATES = 60;
/** A dish planned in the past two weeks is not suggested again (design §5.3.5). */
export const REPEAT_DAYS = 14;
/** How far back "how often is it cooked" looks. */
export const HISTORY_DAYS = 90;

export type Candidate = {
  id: string;
  kind: 'recipe' | 'idea';
  title: string;
  tags: string[];
  ingredients: string[];
  cooked: number;
  savedRecently: boolean;
  dislikeHits: string[];
};

export type SuggestRequest = {
  candidates: Candidate[];
  week: string[];
  dislikes: string[];
  preferences: string[];
};

export type Built =
  | { status: 'ok'; request: SuggestRequest; items: Map<string, CatalogItem>; allFlagged: boolean }
  | { status: 'empty'; why: 'no-dishes' | 'all-used' };

type Args = {
  recipes: readonly Recipe[];
  ideas: readonly Idea[];
  dinnerCategoryId: string | null;
  /** The week being planned. */
  week: readonly PlanEntry[];
  /** Entries of the past HISTORY_DAYS days up to yesterday; a dish counts as cooked once its date has passed (D35). */
  history: readonly PlanEntry[];
  today: IsoDate;
  dislikes: readonly { word: string }[];
  profiles: readonly Profile[];
  /** Dishes already suggested for this day, so "Nyt forslag" gives another. */
  skip: ReadonlySet<string>;
  titleOf: (entry: PlanEntry) => string;
};

const idOf = (e: PlanEntry) => e.recipe_id ?? e.idea_id;
const idOfItem = (i: CatalogItem) => (i.kind === 'recipe' ? i.recipe.id : i.idea.id);

export function buildCandidates(a: Args): Built {
  const all = catalog(a.recipes, a.ideas, a.dinnerCategoryId);
  if (all.length === 0) return { status: 'empty', why: 'no-dishes' };

  const planned = new Set(a.week.map(idOf).filter((x): x is string => !!x));
  const recentFrom = addDays(a.today, -REPEAT_DAYS);
  const cookedCount = new Map<string, number>();
  for (const e of a.history) {
    const id = idOf(e);
    if (!id || e.date >= a.today) continue;
    cookedCount.set(id, (cookedCount.get(id) ?? 0) + 1);
  }
  const cookedRecently = new Set(a.history.filter((e) => e.date >= recentFrom && e.date < a.today).map(idOf).filter((x): x is string => !!x));

  const open = all.filter((i) => {
    const id = idOfItem(i);
    return !planned.has(id) && !cookedRecently.has(id) && !a.skip.has(id);
  });
  if (open.length === 0) return { status: 'empty', why: 'all-used' };

  const savedFrom = addDays(a.today, -REPEAT_DAYS);
  const toCandidate = (i: CatalogItem): Candidate => {
    const recipe = i.kind === 'recipe';
    const created = recipe ? i.recipe.created_at : i.idea.created_at;
    return {
      id: idOfItem(i),
      kind: i.kind,
      title: recipe ? i.recipe.title : i.idea.title,
      tags: (recipe ? i.recipe.tags : i.idea.tags).slice(0, 10),
      ingredients: recipe ? i.recipe.ingredients.map((g) => g.name).slice(0, 25) : [],
      cooked: Math.min(cookedCount.get(idOfItem(i)) ?? 0, 99),
      savedRecently: created.slice(0, 10) >= savedFrom,
      dislikeHits: recipe ? dislikeHits(i.recipe, a.dislikes) : ideaDislikeHits(i.idea, a.dislikes),
    };
  };

  const all2 = open.map((i) => ({ i, c: toCandidate(i) }));
  // A dish with a disliked word is left out while any other dish is left; only then is it offered, marked (design §5.3.5).
  const clean = all2.filter((x) => x.c.dislikeHits.length === 0);
  const chosen = (clean.length > 0 ? clean : all2).slice(0, MAX_CANDIDATES);

  return {
    status: 'ok',
    allFlagged: clean.length === 0,
    items: new Map(chosen.map((x) => [x.c.id, x.i])),
    request: {
      candidates: chosen.map((x) => x.c),
      week: a.week.map(a.titleOf).filter(Boolean).slice(0, 7),
      dislikes: a.dislikes.map((d) => d.word).slice(0, 50),
      preferences: a.profiles.filter((p) => p.preferences.trim()).map((p) => `${people[p.person].name}: ${p.preferences.trim()}`.slice(0, 600)).slice(0, 2),
    },
  };
}

export function suggestErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'rate_limited': return 'I har brugt dagens forslag. Prøv igen i morgen, eller vælg selv.';
    case 'budget_exceeded': return 'Månedens AI-budget er brugt. Vælg selv i mellemtiden.';
    case 'unauthorized': case 'forbidden': return 'Log ind igen og prøv igen.';
    case 'not_configured': return 'Forslag er ikke sat op endnu. Vælg selv.';
    default: return 'Jeg kunne ikke finde et forslag lige nu. Prøv igen, eller vælg selv.';
  }
}

export const emptyMessage = (why: 'no-dishes' | 'all-used') =>
  why === 'no-dishes'
    ? 'Der er ingen aftensretter at vælge imellem endnu. Tilføj en opskrift eller en idé først.'
    : 'Alt i aftensmad er enten på ugens plan eller lavet inden for de sidste 14 dage. Tilføj en opskrift eller en idé, så er der noget at vælge.';
