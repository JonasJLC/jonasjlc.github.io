import { useEffect, useState } from 'react';
import { hrefFor, legacyAlias, parseHash, subPath, type View } from './routes';

/** `query` is the raw text after `?` (`for=a,b`); read it with `new URLSearchParams(query)` or `queryOf`. */
export type Route = { view: View; path: string[]; query: string };

const read = (): Route => {
  const q = location.hash.indexOf('?');
  return { view: parseHash(location.hash), path: subPath(location.hash), query: q >= 0 ? location.hash.slice(q + 1) : '' };
};

/**
 * The current view and any path below it, from `location.hash` (`#opskrifter/<id>/rediger`). An empty or unknown view is
 * replaced with the canonical one through `history.replaceState` (no extra history entry), so a refresh keeps the view.
 * Changing view or path scrolls to the top.
 */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);

  useEffect(() => {
    const canonicalise = () => {
      const alias = legacyAlias(location.hash); // `#indkob` → `#lister/indkob`, keeping the segment the old link meant
      if (alias) history.replaceState(null, '', alias);
      const view = parseHash(location.hash);
      const head = location.hash.replace(/^#/, '').split(/[/?]/)[0];
      if (head !== view) history.replaceState(null, '', hrefFor(view));
      return read();
    };
    canonicalise();
    const onChange = () => {
      setRoute(canonicalise());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
