import { fold } from '../recipes/filter.ts';
import type { Tone } from '../recipes/placeholder.ts';

/** A grocery category's colour: one of Idé 2's tone pairs, or neutral (track and muted) for a category we do not know. */
export type CategoryTone = Tone | 'neutral';

/** Icon names, mapped to `lucide-react` icons in `CategoryHeading`, so this module stays free of React. */
export type CategoryIcon =
  | 'apple' | 'croissant' | 'beef' | 'sandwich' | 'milk' | 'snowflake' | 'wheat' | 'package' | 'leaf' | 'cup-soda'
  | 'candy' | 'spray-can' | 'shopping-basket' | 'list-checks';

export type CategoryStyle = { tone: CategoryTone; icon: CategoryIcon };

/** Full class strings, so Tailwind sees every one of them (as `people.ts` does for person colours). */
export const toneClasses: Record<CategoryTone, string> = {
  clay: 'bg-sp-tone-clay text-sp-tone-clay-ink',
  sage: 'bg-sp-tone-sage text-sp-tone-sage-ink',
  honey: 'bg-sp-tone-honey text-sp-tone-honey-ink',
  rose: 'bg-sp-tone-rose text-sp-tone-rose-ink',
  mint: 'bg-sp-tone-mint text-sp-tone-mint-ink',
  plum: 'bg-sp-tone-plum text-sp-tone-plum-ink',
  sky: 'bg-sp-tone-sky text-sp-tone-sky-ink',
  oat: 'bg-sp-tone-oat text-sp-tone-oat-ink',
  neutral: 'bg-sp-track text-sp-muted',
};

/** Lower case, no accents, "&" read as "og", single spaces: "Frugt og grønt" and "frugt & grønt" are the same category. */
export const categoryKey = (name: string) =>
  fold(name).replace(/&/g, ' og ').trim().replace(/\s+/g, ' ');

const s = (tone: CategoryTone, icon: CategoryIcon): CategoryStyle => ({ tone, icon });

/** The D31 categories (idea 14). Categories are editable, so anything else falls back to the neutral style. */
const byName: Record<string, CategoryStyle> = Object.fromEntries(
  ([
    ['Frugt & grønt', s('sage', 'apple')],
    ['Brød & bagværk', s('honey', 'croissant')],
    ['Kød & fisk', s('rose', 'beef')],
    ['Pålæg & køl', s('clay', 'sandwich')],
    ['Mejeri & æg', s('sky', 'milk')],
    ['Frost', s('sky', 'snowflake')],
    ['Kolonial', s('honey', 'wheat')],
    ['Konserves & glas', s('rose', 'package')],
    ['Krydderier, olie & bagning', s('oat', 'leaf')],
    ['Drikkevarer', s('mint', 'cup-soda')],
    ['Snacks & slik', s('plum', 'candy')],
    ['Husholdning & pleje', s('plum', 'spray-can')],
    ['Andet', s('neutral', 'shopping-basket')],
    // Idea 13's pantry group.
    ['Tjek at I har', s('neutral', 'list-checks')],
  ] as const).map(([name, style]) => [categoryKey(name), style]),
);

const fallback = s('neutral', 'shopping-basket');

/** The icon and tone for a grocery category name; unknown or renamed categories get the neutral basket. */
export function styleFor(categoryName: string | null | undefined): CategoryStyle {
  return { ...(byName[categoryKey(categoryName ?? '')] ?? fallback) };
}

/** "avocado, modne" → "Avocado, modne". Only the first letter changes. */
export const capitalise = (name: string) => (name ? name.charAt(0).toLocaleUpperCase('da') + name.slice(1) : name);

const spokenDays: Record<string, string> = {
  Man: 'mandag', Tir: 'tirsdag', Ons: 'onsdag', Tor: 'torsdag', Fre: 'fredag', Lør: 'lørdag', Søn: 'søndag', 'I dag': 'i dag',
};

/** The row button's accessible name: "Lime, 2 stk, til torsdag". The day tag ("Tor", "I dag", "27/11") is spelled out. */
export function rowLabel(name: string, amount: string, dayTag: string | null): string {
  return [capitalise(name), amount || null, dayTag ? `til ${spokenDays[dayTag] ?? dayTag}` : null].filter(Boolean).join(', ');
}
