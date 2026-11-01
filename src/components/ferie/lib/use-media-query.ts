import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => (typeof matchMedia === 'function' ? matchMedia(query).matches : false));
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
