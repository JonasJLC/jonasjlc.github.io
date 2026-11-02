import { getClient } from './remote';

export type TipTopic = 'indrejse' | 'sundhed' | 'regler';

export const TOPIC_LABEL: Record<TipTopic, string> = {
  indrejse: 'Visum og indrejse',
  sundhed: 'Sundhed og vaccinationer',
  regler: 'Lokale regler og skikke',
};

export type Tips =
  | { type: 'tips'; country: string; updated: string; sourceUrl: string; tips: { topic: TipTopic; text: string }[] }
  | { type: 'unavailable'; reason: 'unknown_place' | 'no_guide'; country?: string; sourceUrl?: string };

const CACHE_KEY = 'ferie-tips:';
const CACHE_MS = 7 * 24 * 3_600_000;

const key = (dest: string) => CACHE_KEY + dest.trim().toLowerCase();

/** A saved answer for this destination, if it is under a week old. */
export function cachedTips(dest: string): Tips | null {
  try {
    const raw = localStorage.getItem(key(dest));
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: Tips };
    return Date.now() - at < CACHE_MS && data?.type === 'tips' ? data : null;
  } catch {
    return null;
  }
}

/** Danish, user-facing message for a failed call. */
export async function askTips(destination: string): Promise<Tips> {
  const c = await getClient();
  const { data, error } = await c.functions.invoke('destination-tips', { body: { destination } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new Error('Du har hentet mange tips på kort tid. Prøv igen om lidt.');
    if (status === 503) throw new Error('Tips er ikke sat op endnu.');
    throw new Error('Tipsene kunne ikke hentes lige nu. Prøv igen om lidt.');
  }
  if (!data || (data.type !== 'tips' && data.type !== 'unavailable')) {
    throw new Error('Tipsene kunne ikke hentes lige nu. Prøv igen om lidt.');
  }
  if (data.type === 'tips') {
    try { localStorage.setItem(key(destination), JSON.stringify({ at: Date.now(), data })); } catch { /* ignore */ }
  }
  return data as Tips;
}
