import { sortedTrips, whoKeys } from '../lib/balance';
import { MONTHS_SHORT, fmtN, fmtRange, fmtShort, toTime, todayTime } from '../lib/dates';
import { countdown } from '../lib/plan';
import { cn } from '../lib/utils';
import { earliestAffordable } from '../lib/finder';
import type { FerieState, Trip } from '../lib/types';
import { Avatars } from '../page';
import { fmtHours } from '../lib/units';
import { fmtDaysRange, impact, personName } from './helpers';

export function TripList({
  state, onEdit,
}: {
  state: FerieState; onEdit: (t: Trip) => void;
}) {
  const trips = sortedTrips(state.trips);
  const today = todayTime();
  const { year } = state.settings;

  const next = trips.find((t) => toTime(t.to) >= today);
  const names = { a: personName(state, 'a'), b: personName(state, 'b') };
  const tone = (t: Trip) => (t.who === 'a' ? 'bg-person-a-tint text-person-a' : t.who === 'b' ? 'bg-person-b-tint text-person-b' : 'bg-data-tint text-data-ink');

  return (
    <section aria-labelledby="trips-h">
      <h2 id="trips-h" className="mb-3 text-[15px] leading-6 font-semibold">
        Rejser{trips.length > 0 && <span className="ml-1.5 font-normal text-muted-foreground">{trips.length}</span>}
      </h2>
      {trips.length === 0 ? (
        <p className="rounded-panel bg-panel p-5 text-sm text-muted-foreground">Ingen rejser endnu. Tryk på første og sidste dag i kalenderen, eller på “Ny rejse”.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {trips.map((t) => {
            const from = toTime(t.from);
            const d = new Date(from);
            const past = toTime(t.to) < today;
            const isNext = t.id === next?.id;
            // Excluding the trip itself so "before" is the balance prior to this trip.
            const own = impact(state, t.who, t, t.id);
            const maxDays = Math.max(0, ...own.map((s) => s.days));
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className={cn(
                    'flex w-full items-stretch gap-3 rounded-card bg-card p-2.5 text-left shadow-card transition-[box-shadow,background-color] hover:shadow-lift',
                    isNext && 'ring-2 ring-data/50',
                    past && 'bg-transparent shadow-none ring-1 ring-rule hover:bg-card',
                  )}
                >
                  <span className={cn('flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-2', past ? 'bg-muted text-muted-foreground' : tone(t))} aria-hidden>
                    <span className="text-[22px] leading-6 font-semibold tabular-nums">{d.getUTCDate()}</span>
                    <span className="text-[11px] font-semibold tracking-[0.06em] uppercase">{MONTHS_SHORT[d.getUTCMonth()].replace('.', '')}</span>
                  </span>
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="flex items-center gap-2">
                      <span className={cn('truncate text-sm font-semibold', past && 'text-muted-foreground')}>{t.name || 'Rejse'}</span>
                      {isNext && <span className="shrink-0 rounded-full bg-data-tint px-2 py-0.5 text-[11px] font-medium text-data-ink">{countdown(t, today)}</span>}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Avatars who={t.who} names={names} size="size-4 text-[9px] ring-1" />
                      {fmtRange(from, toTime(t.to), year)}
                    </span>
                    <span className="mt-1 flex flex-col text-xs tabular-nums">
                      {own.map((s) => {
                        const when = s.short ? earliestAffordable(state, s.days, [s.k], today, t.id) : null;
                        return (
                          <span key={s.k} className={s.short ? 'font-medium text-warn' : 'text-muted-foreground'}>
                            {whoKeys(t.who).length > 1 && <>{personName(state, s.k)} </>}
                            {fmtN(s.before)} → <span className={s.short ? undefined : 'text-foreground'}>{fmtN(s.after)}</span>
                            {s.short && (when ? ` · nok dage fra ${fmtShort(when, true)}` : ' · mangler dage')}
                            {s.squeezes && <span className="text-caution"> · gør en senere rejse for dyr</span>}
                          </span>
                        );
                      })}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end py-0.5 pr-1">
                    <span className="text-lg leading-6 tabular-nums">{fmtDaysRange(own.map((s) => s.days))}</span>
                    <span className="text-xs text-muted-foreground">dage · {fmtHours(maxDays, state.settings)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
