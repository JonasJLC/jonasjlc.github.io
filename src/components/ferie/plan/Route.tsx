import { fmtShort, toISO } from '../lib/dates';
import { routeGroups, sortPlan, tripDates } from '../lib/plan';
import type { PlanItem, Trip, TripDay } from '../lib/types';
import { cn } from '../lib/utils';

/**
 * The route as a strip: each stay is as long as its nights, with the transport that takes
 * you there. Tapping a stay jumps to its first day.
 */
export function Route({
  trip, items, tdays, onGoto,
}: {
  trip: Trip; items: PlanItem[]; tdays: TripDay[]; onGoto: (ds: string) => void;
}) {
  const dates = tripDates(trip);
  if (!dates.length) return null;
  const nights = dates.length > 1 ? dates.slice(0, -1) : [];
  const groups = routeGroups(trip, tdays);
  const legs = (t: number) =>
    items.filter((x) => x.type === 'transport' && x.day === toISO(t)).sort(sortPlan).map((x) => x.title || 'Transport');
  const last = dates[dates.length - 1];
  const home = legs(last);
  const none = groups.every((g) => !g.base);
  const places = new Set(groups.filter((g) => g.base).map((g) => g.base.toLowerCase())).size;

  return (
    <section aria-labelledby="route-h" className="rounded-panel bg-panel p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="route-h" className="text-[15px] leading-6 font-semibold">Ruten</h2>
        <p className="text-xs text-muted-foreground">{nights.length} {nights.length === 1 ? 'nat' : 'nætter'} · {places} {places === 1 ? 'sted' : 'steder'}</p>
      </div>
      <div className="-mx-5 overflow-x-auto px-5">
        <ol className="flex min-w-[560px] items-stretch gap-1" aria-label="Rute">
          <li className="w-24 shrink-0 pr-2">
            <span className="block h-1.5 w-full rounded-full bg-cat-transport" aria-hidden />
            <span className="mt-2.5 block text-sm font-medium">Hjemme</span>
            <span className="block text-xs text-muted-foreground">Afrejse {fmtShort(dates[0])}</span>
          </li>
          {groups.map((g) => {
            const via = legs(g.from);
            return (
              <li key={g.from} className="min-w-0 basis-0" style={{ flexGrow: g.n }}>
                <button
                  type="button"
                  onClick={() => onGoto(toISO(g.from))}
                  className="group -mx-1 -my-1 block w-[calc(100%+0.5rem)] rounded-lg px-1 py-1 text-left transition-colors hover:bg-cat-overnatning-tint/60"
                >
                  <span className={cn('block h-1.5 w-full rounded-full', g.base ? 'bg-cat-overnatning' : 'hatch bg-muted')} aria-hidden />
                  <span className={cn('mt-2.5 block truncate text-sm', g.base ? 'font-medium' : 'text-muted-foreground')}>{g.base || 'Ikke valgt'}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {g.n} {g.n === 1 ? 'nat' : 'nætter'} fra {fmtShort(g.from)}
                  </span>
                  {via.length > 0 && <span className="block truncate text-xs text-muted-foreground">Med {via.join(', ').replace(/^./, (c) => c.toLowerCase())}</span>}
                </button>
              </li>
            );
          })}
          <li className="w-24 shrink-0 pl-2">
            <span className="block h-1.5 w-full rounded-full bg-cat-transport" aria-hidden />
            <span className="mt-2.5 block text-sm font-medium">Hjem</span>
            <span className="block text-xs text-muted-foreground">{fmtShort(last)}</span>
            {home.length > 0 && <span className="block truncate text-xs text-muted-foreground">Med {home.join(', ').replace(/^./, (c) => c.toLowerCase())}</span>}
          </li>
        </ol>
      </div>
      {none && (
        <p className="mt-4 text-sm text-muted-foreground">Skriv, hvor I sover hver nat under Dag for dag, så tegnes jeres rute her. Transport på de dage, hvor I skifter sted, vises på strækningen.</p>
      )}
    </section>
  );
}
