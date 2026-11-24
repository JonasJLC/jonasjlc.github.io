import { useCallback, useEffect, useState } from 'react';
import type { CategoryRow, Recipe } from './model';
import { subscribe } from './photo-jobs';
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
      // One call signs the photo and its thumbnail; views look either up by storage path.
      const photos = await signedPhotoUrls(recipes.flatMap((r) => [r.image_path, r.thumb_path].filter((p): p is string => !!p)));
      setState({ status: 'ready', recipes, categories, photos });
    } catch {
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // A photo job that finishes gives a recipe its photo: refetch so every view shows it.
  useEffect(() => subscribe((event) => { if (event === 'end') void reload(); }), [reload]);

  return { state, reload, retry: () => { setState({ status: 'loading' }); void reload(); } };
}
