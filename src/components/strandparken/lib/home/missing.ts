// Hjem's "Mangler at handle" (idea 8) and the day tags on Indkøb. Pure, so it can be tested without React.
import { addDays, weekdayLong, weekdayShort, type IsoDate } from '../madplan/dates.ts';
import { entryOn, type PlanEntry } from '../madplan/model.ts';
import type { Recipe } from '../recipes/model.ts';
import { listerHref } from '../routes.ts';
import { groupLines, mergeRows, type GroceryCategory, type Line, type ShoppingRow } from '../shopping/model.ts';

export type MissingLine = {
  entryId: string;
  /** The planned recipe's title. */
  title: string;
  /** Unbought lines for this meal, pantry basics left out. */
  count: number;
  /** Up to three unbought line names, in store-walk order. */
  names: string[];
  /** How many unbought lines are not named. */
  more: number;
  /** Everything for this meal is bought (or at home). */
  ready: boolean;
  /** A recipe is planned but `Lav indkøbsliste` has not put it on the list. */
  notOnList: boolean;
};

export type Missing = { tonight: MissingLine | null; tomorrow: MissingLine | null };

const shownNames = 3;

/** One day's line: only a planned recipe counts; free text and ideas have nothing to buy. */
function lineFor(
  rows: readonly ShoppingRow[], entries: readonly PlanEntry[], recipes: readonly Recipe[],
  categories: readonly GroceryCategory[], date: IsoDate,
): MissingLine | null {
  const entry = entryOn(entries, date);
  if (!entry?.recipe_id) return null;
  const title = recipes.find((r) => r.id === entry.recipe_id)?.title ?? '';
  const mine = rows.filter((r) => r.plan_entry_id === entry.id);
  if (mine.length === 0) return { entryId: entry.id, title, count: 0, names: [], more: 0, ready: false, notOnList: true };
  // Merged per day, so a line's count belongs to this meal; `have` and `cleared` rows are bought and drop out here.
  const open = groupLines(mergeRows(mine).filter((l) => !l.pantry), categories).flatMap((g) => g.open);
  const names = open.slice(0, shownNames).map((l) => l.name);
  return { entryId: entry.id, title, count: open.length, names, more: open.length - names.length, ready: open.length === 0, notOnList: false };
}

/** What is still unbought for today's and tomorrow's planned recipes. Manual and recipe-only rows never count. */
export function missingForHome(
  rows: readonly ShoppingRow[], entries: readonly PlanEntry[], recipes: readonly Recipe[],
  categories: readonly GroceryCategory[], today: IsoDate,
): Missing {
  return {
    tonight: lineFor(rows, entries, recipes, categories, today),
    tomorrow: lineFor(rows, entries, recipes, categories, addDays(today, 1)),
  };
}

export const itemsLabel = (n: number) => (n === 1 ? '1 vare' : `${n} varer`);

/** "a, b og c". */
const joinAnd = (parts: readonly string[]) =>
  parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}`;

const lower = (s: string) => s.toLocaleLowerCase('da');

function spoken(line: MissingLine): string {
  if (line.notOnList) return 'ikke på listen endnu';
  if (line.ready) return 'alt er købt';
  const names = line.names.map(lower);
  return `${itemsLabel(line.count)}, ${line.more > 0 ? `${names.join(', ')} og ${line.more} mere` : joinAnd(names)}`;
}

/** The card's accessible name: "Mangler at handle: til i aften 2 varer, lime og avocado. Til i morgen, carbonara, 4 varer." */
export function missingLabel({ tonight, tomorrow }: Missing): string {
  const parts: string[] = [];
  if (tonight) parts.push(tonight.ready && !tonight.notOnList ? 'klar til i aften.' : `til i aften ${spoken(tonight)}.`);
  if (tomorrow) {
    const what = tomorrow.notOnList ? 'ikke på listen endnu' : tomorrow.ready ? 'alt er købt' : itemsLabel(tomorrow.count);
    parts.push(`${parts.length ? 'Til' : 'til'} i morgen, ${lower(tomorrow.title)}, ${what}.`);
  }
  return `Mangler at handle: ${parts.join(' ')}`;
}

/** The query that filters Indkøb to the meals shown on the card. */
export const forParam = 'for';

/** `#lister/indkob?for=<tonight>,<tomorrow>`: only meals that have rows on the list; without any, the plain list. */
export function missingHref({ tonight, tomorrow }: Missing): string {
  const ids = [tonight, tomorrow].filter((l): l is MissingLine => !!l && !l.notOnList).map((l) => l.entryId);
  return ids.length ? `${listerHref('indkob')}?${forParam}=${ids.map(encodeURIComponent).join(',')}` : listerHref('indkob');
}

/** The entry ids named by `?for=a,b`, or an empty list. */
export const forIds = (query: URLSearchParams): string[] =>
  (query.get(forParam) ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** Lines with at least one row for one of the entries. */
export const linesFor = (lines: readonly Line[], ids: readonly string[]): Line[] => {
  const wanted = new Set(ids);
  return lines.filter((l) => l.rows.some((r) => r.plan_entry_id !== null && wanted.has(r.plan_entry_id)));
};

/** The banner over a filtered Indkøb: "Viser varer til i aften og i morgen". */
export function filterLabel(ids: readonly string[], dateOf: (entryId: string) => IsoDate | null, today: IsoDate): string {
  const dates = [...new Set(ids.map(dateOf))].filter((d): d is IsoDate => d !== null).sort();
  if (dates.length !== ids.length || dates.length === 0) return 'Viser varer til de valgte måltider';
  const tomorrow = addDays(today, 1);
  const words = dates.map((d) => (d === today ? 'i aften' : d === tomorrow ? 'i morgen' : weekdayLong(d)));
  return `Viser varer til ${joinAnd(words)}`;
}

/**
 * The day tag on an Indkøb row: the earliest upcoming plan date among the line's rows. "I dag" for today, the short
 * weekday ("Tor") within six days, else "27/11". Null for manual and recipe-only rows and for past days.
 */
export function dayTagFor(line: Line, dateOf: (entryId: string) => IsoDate | null, today: IsoDate): string | null {
  const dates = line.rows
    .map((r) => (r.plan_entry_id ? dateOf(r.plan_entry_id) : null))
    .filter((d): d is IsoDate => d !== null && d >= today)
    .sort();
  const date = dates[0];
  if (!date) return null;
  if (date === today) return 'I dag';
  if (date <= addDays(today, 6)) return weekdayShort(date);
  return `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;
}
