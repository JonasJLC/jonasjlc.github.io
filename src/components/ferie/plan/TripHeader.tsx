import { PlusIcon } from 'lucide-react';
import { fmtRange, fmtShort, toTime } from '../lib/dates';
import { bookByLabel, bookStats, countdown, tripDates, typeInfo } from '../lib/plan';
import type { CheckItem, FerieState, PlanItem, Trip } from '../lib/types';
import { cn } from '../lib/utils';
import { Money, PageTitle, PersonDots } from '../page';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { personName } from '../kassen/helpers';

/** The trips as underline tabs; scrolls sideways on a phone. */
export function TripPicker({
  trips, selectedId, today, onSelect,
}: {
  trips: Trip[]; selectedId: string | null; today: number; onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Vælg rejse" className="-mx-4 mb-6 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mb-8">
      <div className="flex min-w-max gap-7 border-b border-rule pr-4 sm:pr-0">
        {trips.map((t) => {
          const on = t.id === selectedId;
          return (
            <button
              key={t.id}
              type="button"
              aria-current={on ? 'true' : undefined}
              onClick={() => onSelect(t.id)}
              className={cn(
                'relative flex items-baseline gap-2 pt-1 pb-3 text-sm whitespace-nowrap transition-colors',
                on ? 'font-medium text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <PersonDots who={t.who} className="self-center" />
              {t.name || 'Rejse'}
              <span className="hidden text-xs font-normal text-muted-foreground sm:inline">{countdown(t, today).toLowerCase()}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** The trip's title row (dates, people, the next booking deadline) and its numbers. */
export function TripHeader({
  state, trip, items, checks, today, onNew,
}: {
  state: FerieState; trip: Trip; items: PlanItem[]; checks: CheckItem[]; today: number; onNew: () => void;
}) {
  const dates = tripDates(trip);
  const st = bookStats(items);
  const ideas = items.filter((x) => !x.day).length;
  const planned = items.length - ideas;
  const price = items.reduce((s, x) => s + (x.price ?? 0), 0);
  const chk = checks.filter((c) => c.tripId === trip.id);
  const done = chk.filter((c) => c.done).length;
  const who = trip.who === 'both' ? `${personName(state, 'a')} og ${personName(state, 'b')}` : personName(state, trip.who);
  const next = items
    .filter((x) => x.status === 'tobook' && x.bookBy)
    .sort((a, b) => a.bookBy.localeCompare(b.bookBy))[0];
  const nb = next ? bookByLabel(next, today) : null;
  const left = st.need - st.booked;

  const cells: { label: string; value: React.ReactNode; sub?: React.ReactNode }[] = [
    {
      label: 'Booket',
      value: st.need ? <>{st.booked}<span className="text-base text-muted-foreground"> af {st.need}</span></> : <span className="text-muted-foreground">–</span>,
      sub: st.need ? <Progress className="mt-2" value={(st.booked / st.need) * 100} aria-label={`${st.booked} af ${st.need} er booket`} /> : <span>Intet skal bookes endnu</span>,
    },
    { label: 'Planer på dagene', value: planned },
    { label: 'I idébanken', value: ideas },
    { label: 'Planlagte udgifter', value: <Money value={price} /> },
    {
      label: 'Huskeliste',
      value: chk.length ? <>{done}<span className="text-base text-muted-foreground"> af {chk.length}</span></> : <span className="text-muted-foreground">–</span>,
    },
  ];

  return (
    <>
      <PageTitle
        title={trip.name || 'Rejse'}
        actions={<Button onClick={onNew}><PlusIcon aria-hidden />Ny plan</Button>}
      >
        <span className="text-foreground">{fmtRange(toTime(trip.from), toTime(trip.to), state.settings.year)}</span>
        {' · '}{dates.length} {dates.length === 1 ? 'dag' : 'dage'} · {who} · {countdown(trip, today).toLowerCase()}
        <br />
        {next && nb ? (
          <span className={nb.over ? 'font-medium text-warn' : nb.soon ? 'text-caution' : undefined}>
            {next.title || typeInfo(next.type).label} {nb.over ? `skulle have været booket ${fmtShort(toTime(next.bookBy))}` : `skal bookes senest ${fmtShort(toTime(next.bookBy))}`}
            {left > 1 ? `, og ${left - 1} mere venter.` : '.'}
          </span>
        ) : left > 0 ? (
          `${left} ${left === 1 ? 'ting mangler' : 'ting mangler'} at blive booket.`
        ) : st.need > 0 ? 'Alt, der skal bookes, er booket.' : 'Ingen bookinger endnu.'}
      </PageTitle>
      <section aria-label="Rejsen i tal" className="rounded-panel bg-panel px-5 py-4">
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-5 md:gap-0 md:divide-x md:divide-rule">
          {cells.map((c, i) => (
            <div key={c.label} className={cn('min-w-0 md:px-5 md:first:pl-0 md:last:pr-0', i === 0 && 'col-span-2 md:col-span-1')}>
              <dt className="text-[13px] text-muted-foreground">{c.label}</dt>
              <dd className="text-2xl leading-9 tabular-nums">{c.value}</dd>
              {c.sub && <dd className="text-xs text-muted-foreground">{c.sub}</dd>}
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
