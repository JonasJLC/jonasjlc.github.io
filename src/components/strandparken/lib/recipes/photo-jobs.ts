// Fetching a recipe's photo in the background (Idé 1): `recipe-image` downloads it, the browser resizes it (1200 px plus a
// 400 px thumbnail) and uploads both, then the recipe row points at them. A recipe is usable while this runs, and every
// view can ask whether a recipe's photo is still on its way. State is in memory only: a job interrupted by closing the app
// leaves `image_source_url` set and `image_fetch_attempted_at` empty, and the backfill picks it up on the next visit to Opskrifter.
import { useSyncExternalStore } from 'react';
import { getClient } from '../auth';
import { backfillCandidates, type PhotoRecipe, type PhotoSource } from './photo-jobs-model';
import { fillPhotoIfEmpty, IMPORTED_PHOTO_EDGE, markPhotoAttempted, removePhoto, uploadPhotoPair } from './repo';

type Job = { householdId: string; recipeId: string; source: PhotoSource; done: Promise<void>; run: () => void };

const MAX_PARALLEL = 2;
const jobs = new Map<string, Job>(); // queued or running, by recipe id
const waiting: Job[] = [];
let active = 0;
let snapshot: ReadonlySet<string> = new Set();
const watchers = new Set<() => void>();
const listeners = new Set<(event: 'start' | 'end', recipeId: string) => void>();

function publish(event: 'start' | 'end', recipeId: string) {
  snapshot = new Set(jobs.keys());
  watchers.forEach((w) => w());
  listeners.forEach((l) => l(event, recipeId));
}

export const statusOf = (recipeId: string): 'running' | 'idle' => (jobs.has(recipeId) ? 'running' : 'idle');

/** Calls `fn` when a job starts or ends (a view reloads on `end`, to pick up the new photo). Returns the unsubscribe function. */
export function subscribe(fn: (event: 'start' | 'end', recipeId: string) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The ids of recipes whose photo is on its way, for views that show "Henter billede…". */
export function useRunningPhotoJobs(): ReadonlySet<string> {
  return useSyncExternalStore(
    (notify) => { watchers.add(notify); return () => { watchers.delete(notify); }; },
    () => snapshot,
    () => snapshot,
  );
}

function decode(data: string, mediaType: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mediaType });
}

/** Never throws: a photo that cannot be fetched only means the recipe stays without one. */
async function perform({ householdId, recipeId, source }: Job): Promise<void> {
  try {
    const c = await getClient();
    const { data, error } = await c.functions.invoke('recipe-image', { body: source });
    if (error || !data?.data) throw new Error('no image');
    const paths = await uploadPhotoPair(householdId, recipeId, decode(data.data, data.mediaType), IMPORTED_PHOTO_EDGE);
    if (!(await fillPhotoIfEmpty(recipeId, paths).catch(() => false))) await removePhoto(paths.imagePath, paths.thumbPath);
  } catch {
    await markPhotoAttempted(recipeId).catch(() => {}); // tried once: the backfill leaves this recipe alone from now on
  }
}

function pump() {
  while (active < MAX_PARALLEL && waiting.length) {
    active++;
    waiting.shift()!.run();
  }
}

/** Starts fetching a recipe's photo. One job per recipe: a second call for the same recipe returns the first one's promise. Never rejects. */
export function start(householdId: string, recipeId: string, source: PhotoSource): Promise<void> {
  const existing = jobs.get(recipeId);
  if (existing) return existing.done;
  let finish!: () => void;
  const done = new Promise<void>((r) => { finish = r; });
  const job: Job = {
    householdId, recipeId, source, done,
    run: () => {
      void perform(job).finally(() => {
        jobs.delete(recipeId);
        active--;
        publish('end', recipeId);
        finish();
        pump();
      });
    },
  };
  jobs.set(recipeId, job);
  waiting.push(job);
  publish('start', recipeId);
  pump();
  return done;
}

let backfilled = false;

/**
 * Once per session: tries the recipes that have a link (or an interrupted import's photo address) but no photo, one at a
 * time. Each recipe is tried once ever (`image_fetch_attempted_at`), so a page without a picture is not asked again.
 */
export async function runBackfill(householdId: string, recipes: readonly PhotoRecipe[]): Promise<void> {
  if (backfilled) return;
  backfilled = true;
  for (const c of backfillCandidates(recipes)) await start(householdId, c.id, c.source);
}
