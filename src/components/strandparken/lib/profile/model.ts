import type { Tables } from '../../../../lib/supabase/database.types.ts';
import { fold } from '../recipes/filter.ts';
import type { Recipe } from '../recipes/model.ts';
import type { Idea } from '../ideas/model.ts';
import { people, personFromKey, type Person } from '../people.ts';

export type ProfileRow = Tables<'sp_profiles'>;

/** One person's dislikes and preferences. No allergies (design D55): they are not modelled anywhere. */
export type Profile = { person: Person; dislikes: string[]; preferences: string };

export const MAX_DISLIKES = 50;

/** Lower-case, single spaces, no leading #; empty and duplicate entries are dropped and the list is capped. */
export function cleanDislikes(items: readonly string[]): string[] {
  const out = items.map((t) => t.trim().replace(/\s+/g, ' ').toLocaleLowerCase('da').slice(0, 60)).filter(Boolean);
  return [...new Set(out)].slice(0, MAX_DISLIKES);
}

/** Comma, semicolon or line break separated text becomes a list: "koriander, svampe" is two dislikes. */
export const splitDislikes = (text: string) => cleanDislikes(text.split(/[,;\n]/));

export function toProfile(person: Person, row: ProfileRow | undefined): Profile {
  return { person, dislikes: row?.dislikes ?? [], preferences: row?.preferences ?? '' };
}

/** Both people's profiles, whether or not they have saved one yet. */
export function profilesFrom(rows: readonly ProfileRow[]): Record<Person, Profile> {
  const find = (person: Person) => toProfile(person, rows.find((r) => personFromKey(r.person) === person));
  return { jonas: find('jonas'), camilla: find('camilla') };
}

/** Dislikes from both profiles, for everything that suggests food (design §5.5.1): each word once, with who dislikes it. */
export function householdDislikes(profiles: Record<Person, Profile>): { word: string; people: Person[] }[] {
  const byWord = new Map<string, Person[]>();
  for (const p of [profiles.jonas, profiles.camilla]) {
    for (const word of p.dislikes) byWord.set(word, [...(byWord.get(word) ?? []), p.person]);
  }
  return [...byWord].map(([word, who]) => ({ word, people: who }));
}

/** The disliked words found in a recipe's title or ingredient names. A match inside a longer word counts ("svamp" in "champignon" does not, "løg" in "hvidløg" does). */
export function dislikeHits(recipe: Pick<Recipe, 'title' | 'ingredients'>, dislikes: readonly { word: string }[]): string[] {
  const hay = fold([recipe.title, ...recipe.ingredients.map((i) => i.name)].join(' \n '));
  return dislikes.filter((d) => hay.includes(fold(d.word))).map((d) => d.word);
}

/** An idea has no ingredient list, so only its title and tags can be checked (design §5.3.5). */
export function ideaDislikeHits(idea: Pick<Idea, 'title' | 'tags'>, dislikes: readonly { word: string }[]): string[] {
  const hay = fold([idea.title, ...idea.tags].join(' \n '));
  return dislikes.filter((d) => hay.includes(fold(d.word))).map((d) => d.word);
}

export const whoLabel = (who: Person[]) => who.map((p) => people[p].name).join(' og ');
