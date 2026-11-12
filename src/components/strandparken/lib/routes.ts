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

/** `#madplan` becomes `madplan`. Anything unknown opens Hjem. A query string after the view is ignored. */
export function parseHash(hash: string): View {
  let slug = hash.replace(/^#/, '');
  slug = slug.split('?')[0];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    return fallback;
  }
  slug = slug.toLowerCase().replace('ø', 'o'); // #indkøb is accepted for #indkob
  return (views as readonly string[]).includes(slug) ? (slug as View) : fallback;
}

export const hrefFor = (view: View) => `#${view}`;
