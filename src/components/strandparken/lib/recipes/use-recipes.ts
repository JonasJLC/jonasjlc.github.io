import { useCallback, useEffect, useState } from 'react';
import type { CategoryRow, Recipe } from './model';
import { loadCategories, loadRecipes, signedPhotoUrls } from './repo';

export type RecipesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; recipes: Recipe[]; categories: CategoryRow[]; photos: Record<string, string> };

/** Recipes, categories and photo links for the household. `reload` refetches after a save or archive. */
export function useRecipes() {
  const [state, setState] = useState<RecipesState>({ status: 'loading' });

  const reload = useCallback(async () => {
    try {
      const [recipes, categories] = await Promise.all([loadRecipes(), loadCategories()]);
      const photos = await signedPhotoUrls(recipes.flatMap((r) => (r.image_path ? [r.image_path] : [])));
      setState({ status: 'ready', recipes, categories, photos });
    } catch {
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload, retry: () => { setState({ status: 'loading' }); void reload(); } };
}
