import { ChevronRight, Plus } from 'lucide-react';
import { sortedTrips, tripDays, whoKeys } from '../lib/balance';
import { fmtN, fmtRange, fmtShort, toTime, todayTime } from '../lib/dates';
import { earliestAffordable } from '../lib/finder';
import type { FerieState, Trip } from '../lib/types';
import { Button } from '../ui/button';
import { impact, personColor, personName } from './helpers';

export function TripList({
  state, onEdit, onNew,
}: {
  state: FerieState; onEdit: (t: Trip) => void; onNew: () => void;
}) {
  const trips = sortedTrips(state.trips);
  const today = todayTime();
  const { extraOff, year } = state.settings;

  return (
    <section aria-label="Rejser" className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight">Rejser</h2>
        <Button size="sm" variant="outline" onClick={onNew}><Plus />Ny rejse</Button>
      </div>
      {trips.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Ingen rejser endnu. Vælg datoer i kalenderen, eller tryk på “Ny rejse”.
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {trips.map((t) => {
            const days = tripDays(t, extraOff);
            const from = toTime(t.from);
            const past = toTime(t.to) < today;
            // Excluding the trip itself so "before" is the balance prior to this trip.
            const own = impact(state, t.who, from, days, t.id);
            return (
              <li key={t.id} className="border-b last:border-0">
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className={`flex w-full items-stretch gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted ${past ? 'opacity-60' : ''}`}
                >
                  <span
                    className="w-1.5 shrink-0 rounded-full"
                    style={{
                      background: t.who === 'both'
                        ? `linear-gradient(${personColor('a')} 50%, ${personColor('b')} 50%)`
                        : personColor(t.who),
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-display text-base">{t.name || 'Rejse'}</b>
                    <span className="block text-sm text-muted-foreground">
                      {fmtRange(from, toTime(t.to), year)} · {t.who === 'both' ? 'Begge' : personName(state, t.who)}
                    </span>
                    <span className="mt-1 flex flex-col gap-0.5 text-xs">
                      {own.map((s) => {
                        const short = s.lowest < -1e-9;
                        const when = short ? earliestAffordable(state, days, [s.k], today, t.id) : null;
                        return (
                          <span key={s.k} className={short ? 'font-semibold text-warn' : 'text-muted-foreground'}>
                            {whoKeys(t.who).length > 1 && <>{personName(state, s.k)}: </>}
                            {fmtN(s.before)} → {fmtN(s.after)}
                            {short && (when ? ` · nok dage fra ${fmtShort(when, true)}` : ' · mangler dage')}
                          </span>
                        );
                      })}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end justify-between">
                    <b className="font-display text-xl leading-none">{fmtN(days)}</b>
                    <span className="text-[11px] text-muted-foreground">feriedage</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
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
