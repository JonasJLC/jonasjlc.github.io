import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { bridgeKey, findBridges, type Bridge } from '../lib/bridges';
import { fmtRange, toISO, todayTime } from '../lib/dates';
import type { FerieState } from '../lib/types';
import { impact } from './helpers';

const SNOOZE_KEY = 'ferie.bridge-snooze';
const SNOOZE_MS = 7 * 864e5;

function snoozed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? '{}') as Record<string, number>; } catch { return {}; }
}
function snooze(key: string) {
  try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ ...snoozed(), [key]: Date.now() + SNOOZE_MS })); } catch { /* ignore */ }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Pops up once per visit with the best stretch of public holidays that few vacation days
 * can link together. "Ikke nu" hides that stretch for a week.
 */
export function BridgeTip({ state, onUse, year }: { state: FerieState; year: number; onUse: (from: number, to: number) => void }) {
  const bridge = useMemo<Bridge | undefined>(() => {
    const now = Date.now();
    const hidden = snoozed();
    return findBridges(state, todayTime(), year).find((b) => {
      if ((hidden[bridgeKey(b)] ?? 0) > now) return false;
      const span = { from: toISO(b.from), to: toISO(b.to), days: null };
      return !impact(state, 'both', span).some((i) => i.short || i.squeezes);
    });
  }, [state, year]);

  const key = bridge ? bridgeKey(bridge) : null;
  useEffect(() => {
    if (!bridge || !key) return;
    const id = `bridge-${key}`;
    toast(`Spar feriedage: ${fmtRange(bridge.from, bridge.to, year)}`, {
      id,
      duration: Infinity,
      description: `Med ${plural(bridge.cost, 'feriedag', 'feriedage')} får I ${bridge.total} fridage i træk (${bridge.holidays.join(', ')}). Der er ikke booket noget.`,
      action: { label: 'Lav rejse', onClick: () => onUse(bridge.from, bridge.to) },
      cancel: { label: 'Ikke nu', onClick: () => snooze(key) },
    });
    return () => { toast.dismiss(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, year]);

  return null;
}
