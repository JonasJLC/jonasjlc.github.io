import { useCallback, useEffect, useState } from 'react';
import type { Idea } from './model';
import { loadIdeas } from './repo';

export type IdeasState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; ideas: Idea[] };

export function useIdeas() {
  const [state, setState] = useState<IdeasState>({ status: 'loading' });
  const reload = useCallback(async () => {
    try {
      setState({ status: 'ready', ideas: await loadIdeas() });
    } catch {
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { state, reload, ideas: state.status === 'ready' ? state.ideas : [] };
}
