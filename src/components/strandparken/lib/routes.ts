import { isIsoDate, type IsoDate } from './madplan/dates.ts';

/** The five views, in bottom-bar order. The current view lives in the URL hash so a refresh or a shared link opens the same screen. */
export const views = ['hjem', 'madplan', 'lister', 'sundhed', 'opskrifter'] as const;
export type View = (typeof views)[number];

export const labels: Record<View, string> = {
  hjem: 'Hjem',
  madplan: 'Madplan',
  lister: 'Lister',
  sundhed: 'Sundhed',
  opskrifter: 'Opskrifter',
};

const fallback: View = 'hjem';

/**
 * Old first segments that must keep working, and the hash path they now open. `#indkob` (and `#indkøb`) was the shopping tab
 * before idea 4; it is now the Indkøb segment of Lister.
 */
const aliases: Record<string, string> = {
  indkob: 'lister/indkob',
};

/** `#opskrifter/abc?x=1` becomes `['opskrifter', 'abc']`: the path segments, without the query string. */
export function splitHash(hash: string): string[] {
  return hash.replace(/^#/, '').split('?')[0].split('/');
}

/** The segments after the view: `#opskrifter/abc/rediger` gives `['abc', 'rediger']`. Empty segments are dropped. */
export function subPath(hash: string): string[] {
  return splitHash(hash).slice(1).filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
}

/** The first segment, decoded, lower-cased and with `ø` folded to `o` (so `#indkøb` reads as `indkob`). Null if malformed. */
function headSlug(hash: string): string | null {
  try {
    return decodeURIComponent(splitHash(hash)[0]).toLowerCase().replace(/ø/g, 'o');
  } catch {
    return null;
  }
}

/** `#madplan` becomes `madplan`. Anything unknown opens Hjem. A query string after the view is ignored. Old aliases map to their view. */
export function parseHash(hash: string): View {
  const slug = headSlug(hash);
  if (slug === null) return fallback;
  const target = Object.hasOwn(aliases, slug) ? aliases[slug].split('/')[0] : slug;
  return (views as readonly string[]).includes(target) ? (target as View) : fallback;
}

/**
 * The canonical hash for an old address, or null when the hash is not an alias: `#indkob` and `#indkøb` give `#lister/indkob`.
 * A query string is kept; anything after the old slug is dropped.
 */
export function legacyAlias(hash: string): string | null {
  const slug = headSlug(hash);
  if (slug === null || !Object.hasOwn(aliases, slug)) return null;
  const q = hash.indexOf('?');
  return `#${aliases[slug]}${q >= 0 ? hash.slice(q) : ''}`;
}

export const hrefFor = (view: View) => `#${view}`;

/** The segments of Lister, in segmented-control order. Later ideas add a segment here and a panel in `ListerView`. */
export const listerSegments = ['indkob', 'todo'] as const;
export type ListerSegment = (typeof listerSegments)[number];

/** The selected Lister segment from the sub-path (`#lister/todo` gives `todo`). Empty or unknown is Indkøb. */
export const listerSegment = (path: readonly string[]): ListerSegment =>
  (listerSegments as readonly string[]).includes(path[0] ?? '') ? (path[0] as ListerSegment) : 'indkob';

export const listerHref = (segment: ListerSegment) => `#lister/${segment}`;

/** `#madplan/<date>/dag` opens that day's sheet in Madplan (idea 6), for example from Hjem's "Planlæg i aften". */
export const madplanDayHref = (date: IsoDate) => `#madplan/${date}/dag`;

/** The date whose sheet the Madplan sub-path asks to open (`['2026-11-19', 'dag']` gives `2026-11-19`), or null. */
export const madplanDay = (path: readonly string[]): IsoDate | null => (path[1] === 'dag' && isIsoDate(path[0] ?? '') ? path[0] : null);
