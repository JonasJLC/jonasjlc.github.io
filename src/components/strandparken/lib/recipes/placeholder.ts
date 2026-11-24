import { fold } from './filter.ts';

/** The tone pairs in `strandparken.css` (`--sp-tone-<key>` and `--sp-tone-<key>-ink`). Ideas 14 and 15 reuse them. */
export const tones = ['clay', 'sage', 'honey', 'rose', 'mint', 'plum', 'sky', 'oat'] as const;
export type Tone = (typeof tones)[number];

export type PlaceholderIcon =
  | 'utensils' | 'salad' | 'sandwich' | 'egg' | 'croissant' | 'cake' | 'popcorn' | 'cup'
  | 'fish' | 'shrimp' | 'drumstick' | 'beef' | 'leaf' | 'soup' | 'wheat' | 'pizza' | 'flame' | 'ice-cream'
  | 'wine' | 'hamburger';

/** The tile shown for a dish without a photo (Idé 2): a soft tone and a food icon in the tone's ink. */
export type Placeholder = { tone: Tone; icon: PlaceholderIcon };

const p = (tone: Tone, icon: PlaceholderIcon): Placeholder => ({ tone, icon });

/** Tag words, folded. A tag matches when it is one of these words, or contains one as a whole word. */
const byTag: Record<string, Placeholder> = {
  fisk: p('sky', 'fish'), laks: p('sky', 'fish'), torsk: p('sky', 'fish'),
  rejer: p('sky', 'shrimp'), skaldyr: p('sky', 'shrimp'),
  kylling: p('honey', 'drumstick'),
  oksekod: p('clay', 'beef'), bof: p('clay', 'beef'), burger: p('clay', 'beef'),
  vegetar: p('sage', 'leaf'), vegansk: p('sage', 'leaf'), gront: p('sage', 'leaf'),
  suppe: p('clay', 'soup'),
  pasta: p('honey', 'wheat'),
  pizza: p('rose', 'pizza'),
  mexicansk: p('rose', 'flame'), staerk: p('rose', 'flame'),
  dessert: p('plum', 'cake'), kage: p('plum', 'cake'),
  is: p('mint', 'ice-cream'),
  salat: p('sage', 'salad'),
};

/** The D30 recipe categories, by folded name (ids differ per household). */
const byCategory: Record<string, Placeholder> = {
  aftensmad: p('clay', 'utensils'),
  'tilbehor & salat': p('sage', 'salad'),
  frokost: p('honey', 'sandwich'),
  'morgenmad & brunch': p('honey', 'egg'),
  bagvaerk: p('oat', 'croissant'),
  sodt: p('plum', 'cake'),
  'snacks & dip': p('rose', 'popcorn'),
  drikke: p('mint', 'cup'),
};

/** The one-tap dinners that are not recipes (`quickDishes` in the Madplan model). */
const byTitle: Record<string, Placeholder> = {
  rester: p('oat', 'utensils'),
  'ude at spise': p('plum', 'wine'),
  takeaway: p('honey', 'hamburger'),
};

/** Folded key: lower case, no accents, and the Danish letters spelled out (æ → ae, ø → o, å → a), single spaces. */
const key = (s: string) =>
  fold(s).replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').trim().replace(/\s+/g, ' ');

/** 32-bit FNV-1a: a small, stable string hash. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function fromTag(tag: string): Placeholder | null {
  const k = key(tag);
  if (byTag[k]) return byTag[k];
  for (const word of k.split(/[^a-z0-9]+/)) if (byTag[word]) return byTag[word];
  return null;
}

/**
 * The placeholder for a dish: the first of its own tags that names a food wins, then its category, then a fixed tile
 * for the quick dinners (Rester, Ude at spise, Takeaway), and otherwise a tone from a stable hash of the title with a
 * plain cutlery icon. The same dish always gets the same tile, and dishes without a match spread over all tones.
 */
export function placeholderFor(d: { title: string; category?: string | null; tags?: readonly string[] | null }): Placeholder {
  for (const tag of d.tags ?? []) {
    const hit = fromTag(tag);
    if (hit) return { ...hit };
  }
  const cat = d.category ? byCategory[key(d.category)] : undefined;
  if (cat) return { ...cat };
  const title = key(d.title);
  if (byTitle[title]) return { ...byTitle[title] };
  return { tone: tones[fnv1a(title) % tones.length], icon: 'utensils' };
}

/** The category name for a recipe's `category_id`, for `placeholderFor`. */
export const categoryName = (categories: readonly { id: string; name: string }[], id: string | null | undefined) =>
  (id && categories.find((c) => c.id === id)?.name) || null;
