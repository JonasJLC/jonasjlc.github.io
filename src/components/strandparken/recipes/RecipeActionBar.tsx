import { useEffect } from 'react';
import type { Recipe } from '../lib/recipes/model';
import { AddRecipeButton } from '../shopping/ListButtons';
import { PlanRecipeButton } from './PlanRecipeSheet';

/** The recipe page's sticky bar (UI spec §5.11): `Til madplan` and `Læg på indkøbslisten`, above the bottom bar. */
export function RecipeActionBar({ householdId, recipe, persons }: { householdId: string; recipe: Recipe; persons: number }) {
  useEffect(() => {
    document.documentElement.dataset.spAction = '';
    return () => {
      delete document.documentElement.dataset.spAction;
    };
  }, []);

  return (
    <div
      role="region"
      aria-label="Handlinger"
      className="fixed inset-x-0 bottom-sp-bar-safe z-30 flex h-sp-action justify-center border-t border-sp-line bg-sp-surface"
    >
      <div className="flex w-full max-w-sp-column items-center gap-3 px-sp-page-x">
        <PlanRecipeButton householdId={householdId} recipe={recipe} persons={persons} className="min-h-13" />
        <AddRecipeButton householdId={householdId} recipe={recipe} persons={persons} className="min-w-0 flex-1" />
      </div>
    </div>
  );
}
