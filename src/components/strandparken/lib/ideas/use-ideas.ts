import { useCallback, useEffect, useState } from 'react';
import type { Idea } from './model';
import { signedPhotoUrls } from '../recipes/repo';
import { loadIdeas } from './repo';

export type IdeasState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; ideas: Idea[]; photos: Record<string, string> };

export function useIdeas() {
  const [state, setState] = useState<IdeasState>({ status: 'loading' });
  const reload = useCallback(async () => {
    try {
      const ideas = await loadIdeas();
      setState({ status: 'ready', ideas, photos: await signedPhotoUrls(ideas.flatMap((i) => (i.image_path ? [i.image_path] : []))) });
    } catch {
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { state, reload, ideas: state.status === 'ready' ? state.ideas : [], photos: state.status === 'ready' ? state.photos : {} };
}
