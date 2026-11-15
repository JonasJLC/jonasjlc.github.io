/** The five views, in bottom-bar order. The current view lives in the URL hash so a refresh or a shared link opens the same screen. */
export const views = ['hjem', 'madplan', 'indkob', 'sundhed', 'opskrifter'] as const;
export type View = (typeof views)[number];

export const labels: Record<View, string> = {
  hjem: 'Hjem',
  madplan: 'Madplan',
  indkob: 'Indkøb',
  sundhed: 'Sundhed',
  opskrifter: 'Opskrifter',
};

const fallback: View = 'hjem';

/** `#opskrifter/abc?x=1` becomes `['opskrifter', 'abc']`: the path segments, without the query string. */
export function splitHash(hash: string): string[] {
  return hash.replace(/^#/, '').split('?')[0].split('/');
}

/** The segments after the view: `#opskrifter/abc/rediger` gives `['abc', 'rediger']`. Empty segments are dropped. */
export function subPath(hash: string): string[] {
  return splitHash(hash).slice(1).filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
}

/** `#madplan` becomes `madplan`. Anything unknown opens Hjem. A query string after the view is ignored. */
export function parseHash(hash: string): View {
  const [slug0] = splitHash(hash);
  let slug = slug0;
  try {
    slug = decodeURIComponent(slug);
  } catch {
    return fallback;
  }
  slug = slug.toLowerCase().replace('ø', 'o'); // #indkøb is accepted for #indkob
  return (views as readonly string[]).includes(slug) ? (slug as View) : fallback;
}

export const hrefFor = (view: View) => `#${view}`;
