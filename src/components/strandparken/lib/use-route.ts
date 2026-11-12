import { useEffect, useState } from 'react';
import { hrefFor, parseHash, type View } from './routes';

/**
 * The current view from `location.hash`. An empty or unknown hash is replaced with the canonical one through
 * `history.replaceState` (no extra history entry), so a refresh keeps the view. Changing view scrolls to the top.
 */
export function useRoute(): View {
  const [view, setView] = useState<View>(() => parseHash(location.hash));

  useEffect(() => {
    const canonicalise = () => {
      const next = parseHash(location.hash);
      if (location.hash !== hrefFor(next)) history.replaceState(null, '', hrefFor(next));
      return next;
    };
    canonicalise();
    const onChange = () => {
      setView(canonicalise());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return view;
}
