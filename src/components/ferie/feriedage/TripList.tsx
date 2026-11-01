import { sortedTrips, whoKeys } from '../lib/balance';
import { fmtN, fmtRange, fmtShort, toTime, todayTime } from '../lib/dates';
import { earliestAffordable } from '../lib/finder';
import type { FerieState, Trip } from '../lib/types';
import { PersonDots } from '../page';
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

  return (
    <section aria-labelledby="trips-h" className="rounded-panel bg-panel p-5">
      <h2 id="trips-h" className="mb-2 text-[15px] leading-6 font-semibold">
        Rejser{trips.length > 0 && <span className="ml-1.5 font-normal text-muted-foreground">{trips.length}</span>}
      </h2>
      {trips.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen rejser endnu. Tryk på første og sidste dag i kalenderen, eller på “Ny rejse”.</p>
      ) : (
        <ul className="flex flex-col">
          {trips.map((t) => {
            const from = toTime(t.from);
            const past = toTime(t.to) < today;
            // Excluding the trip itself so "before" is the balance prior to this trip.
            const own = impact(state, t.who, t, t.id);
            const maxDays = Math.max(0, ...own.map((s) => s.days));
            return (
              <li key={t.id} className="border-t border-rule first:border-t-0">
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className={`-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-accent ${past ? 'opacity-60' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium"><PersonDots who={t.who} /><span className="truncate">{t.name || 'Rejse'}</span></span>
                    <span className="block text-xs text-muted-foreground">
                      {fmtRange(from, toTime(t.to), year)} · {t.who === 'both' ? 'Begge' : personName(state, t.who)}
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
                  <span className="flex shrink-0 flex-col items-end">
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
