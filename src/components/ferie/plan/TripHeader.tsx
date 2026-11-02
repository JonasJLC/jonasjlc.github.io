import { ArrowRightIcon, CheckCheckIcon, LightbulbIcon, ListChecksIcon, PlusIcon, WalletIcon } from 'lucide-react';
import { fmtRange, fmtShort, toTime } from '../lib/dates';
import { bookByLabel, bookStats, countdown, routeGroups, sortPlan, tripClock, tripDates, typeInfo } from '../lib/plan';
import type { CheckItem, FerieState, Flight, PlanItem, Trip } from '../lib/types';
import { kr } from '../lib/kasse';
import { cn } from '../lib/utils';
import { Avatars, IconChip, Money } from '../page';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { personName } from '../kassen/helpers';
import { AddFlight, FlightCard } from './FlightCard';

const namesOf = (state: FerieState) => ({ a: personName(state, 'a'), b: personName(state, 'b') });

/** The trips as pill chips; scrolls sideways on a phone. */
export function TripPicker({
  state, trips, selectedId, today, onSelect,
}: {
  state: FerieState; trips: Trip[]; selectedId: string | null; today: number; onSelect: (id: string) => void;
}) {
  const names = namesOf(state);
  return (
    <nav aria-label="Vælg rejse" className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mb-8">
      <div className="flex min-w-max gap-2">
        {trips.map((t) => {
          const on = t.id === selectedId;
          const past = toTime(t.to) < today;
          return (
            <button
              key={t.id}
              type="button"
              aria-current={on ? 'true' : undefined}
              onClick={() => onSelect(t.id)}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full pr-4 pl-1.5 text-sm whitespace-nowrap transition-colors',
                on ? 'bg-foreground font-medium text-background' : 'bg-card text-foreground shadow-card hover:bg-accent',
                past && !on && 'text-muted-foreground',
              )}
            >
              <Avatars who={t.who} names={names} size={cn('size-7', on && 'ring-foreground')} />
              {t.name || 'Rejse'}
              <span className={cn('text-xs font-normal', on ? 'text-background/70' : 'text-muted-foreground')}>{countdown(t, today).toLowerCase()}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** The trip's countdown, route and next deadline, its flights, and its numbers as tiles. */
export function TripHeader({
  state, trip, items, checks, today, onNew, onNewFlight, onEdit,
}: {
  state: FerieState; trip: Trip; items: PlanItem[]; checks: CheckItem[]; today: number;
  onNew: () => void; onNewFlight: () => void; onEdit: (it: PlanItem) => void;
}) {
  const names = namesOf(state);
  const dates = tripDates(trip);
  const st = bookStats(items);
  const ideas = items.filter((x) => !x.day).length;
  const price = items.reduce((s, x) => s + (x.price ?? 0), 0);
  const bookedPrice = items.reduce((s, x) => s + (x.status === 'booked' ? x.price ?? 0 : 0), 0);
  const chk = checks.filter((c) => c.tripId === trip.id);
  const done = chk.filter((c) => c.done).length;
  const who = trip.who === 'both' ? `${names.a} og ${names.b}` : names[trip.who];
  const next = items
    .filter((x) => x.status === 'tobook' && x.bookBy)
    .sort((a, b) => a.bookBy.localeCompare(b.bookBy))[0];
  const nb = next ? bookByLabel(next, today) : null;
  const left = st.need - st.booked;
  const clock = tripClock(trip, today);
  const stops = routeGroups(trip, state.tdays).map((g) => g.base).filter(Boolean);
  const flights = items
    .filter((x): x is PlanItem & { flight: Flight } => !!x.flight && !!x.day)
    .sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || sortPlan(a, b));
  const shown = flights.length > 2 ? [flights[0], flights[flights.length - 1]] : flights;

  const go = (id: string) => () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const tiles: { label: string; icon: React.ReactNode; tone: string; value: React.ReactNode; sub?: React.ReactNode; onClick?: () => void }[] = [
    {
      label: 'Booket', icon: <CheckCheckIcon />, tone: 'bg-ok-tint text-ok-ink',
      value: st.need ? <>{st.booked}<span className="text-base text-muted-foreground"> af {st.need}</span></> : <span className="text-muted-foreground">–</span>,
      sub: st.need ? <Progress value={(st.booked / st.need) * 100} aria-label={`${st.booked} af ${st.need} er booket`} /> : 'Intet skal bookes endnu',
      onClick: go('tobook'),
    },
    { label: 'Planlagte udgifter', icon: <WalletIcon />, tone: 'bg-data-tint text-data-ink', value: <Money value={price} />, sub: price ? <>Heraf <span className="text-foreground">{kr(bookedPrice)}</span> booket</> : 'Ingen priser endnu' },
    {
      label: 'Huskeliste', icon: <ListChecksIcon />, tone: 'bg-cat-mad-tint text-cat-mad-ink',
      value: chk.length ? <>{done}<span className="text-base text-muted-foreground"> af {chk.length}</span></> : <span className="text-muted-foreground">–</span>,
      sub: chk.length ? <Progress value={(done / chk.length) * 100} aria-label={`${done} af ${chk.length} klaret`} /> : 'Ingen ting endnu',
      onClick: go('huskeliste'),
    },
    {
      label: 'Idébanken', icon: <LightbulbIcon />, tone: 'bg-cat-oplevelse-tint text-cat-oplevelse-ink',
      value: ideas, sub: ideas === 1 ? 'idé uden en dag' : 'idéer uden en dag', onClick: go('idebank'),
    },
  ];

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="title-serif text-[40px] sm:text-[52px]">{trip.name || 'Rejse'}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-6 text-muted-foreground">
            <Avatars who={trip.who} names={names} />
            <span className="text-foreground">{fmtRange(toTime(trip.from), toTime(trip.to), state.settings.year)}</span>
            <span aria-hidden>·</span>{dates.length} {dates.length === 1 ? 'dag' : 'dage'}
            <span aria-hidden>·</span>{who}
          </p>
        </div>
        <Button onClick={onNew}><PlusIcon aria-hidden />Ny plan</Button>
      </header>

      <div className="grid gap-3 lg:grid-cols-12">
        <section aria-label="Nedtælling og rute" className="flex min-w-0 flex-col rounded-panel bg-panel p-5 lg:col-span-5">
          <p className="flex items-end gap-3">
            <span className="title-serif text-[76px] leading-[0.8] tabular-nums">{clock.n}</span>
            <span className="pb-1 text-[15px] leading-5">
              {clock.kind === 'before' && <>{clock.n === 1 ? 'dag' : 'dage'}<br /><span className="text-muted-foreground">til afrejse</span></>}
              {clock.kind === 'during' && <>dag af {clock.of}<br /><span className="text-muted-foreground">I er afsted nu</span></>}
              {clock.kind === 'after' && <>{clock.n === 1 ? 'dag' : 'dage'} siden<br /><span className="text-muted-foreground">I kom hjem</span></>}
            </span>
          </p>
          <ol aria-label="Ruten" className="mt-6 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            {['Hjemme', ...(stops.length ? stops : ['Ikke valgt']), 'Hjem'].map((s, i, a) => (
              <li key={`${s}-${i}`} className="flex items-center gap-1.5">
                <span className={cn(i === 0 || i === a.length - 1 ? 'text-muted-foreground' : 'font-medium', s === 'Ikke valgt' && 'font-normal text-muted-foreground')}>{s}</span>
                {i < a.length - 1 && <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden />}
              </li>
            ))}
          </ol>
          <p className="mt-auto pt-5 text-sm leading-5">
            {next && nb ? (
              <span className={nb.over ? 'font-medium text-warn' : nb.soon ? 'text-caution' : 'text-muted-foreground'}>
                {next.title || typeInfo(next.type).label} {nb.over ? `skulle have været booket ${fmtShort(toTime(next.bookBy))}` : `skal bookes senest ${fmtShort(toTime(next.bookBy))}`}
                {left > 1 ? `, og ${left - 1} mere venter.` : '.'}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {left > 0 ? `${left} ${left === 1 ? 'ting mangler' : 'ting mangler'} at blive booket.` : st.need > 0 ? 'Alt, der skal bookes, er booket.' : 'Ingen bookinger endnu.'}
              </span>
            )}
          </p>
        </section>

        <section aria-label="Fly" className="grid min-w-0 content-start gap-3 lg:col-span-7">
          {shown.map((f) => <FlightCard key={f.id} item={f} onEdit={onEdit} notch="bg-background" />)}
          {shown.length === 0 && <AddFlight onAdd={onNewFlight} />}
        </section>

        <ul aria-label="Rejsen i tal" className="grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-4">
          {tiles.map((t) => {
            const body = (
              <>
                <span className="flex items-center gap-2.5">
                  <IconChip tone={t.tone}>{t.icon}</IconChip>
                  <span className="text-[13px] leading-4 text-muted-foreground">{t.label}</span>
                </span>
                <span className="mt-3 block text-2xl leading-8 tabular-nums">{t.value}</span>
                {t.sub && <span className="mt-1 block text-xs text-muted-foreground">{t.sub}</span>}
              </>
            );
            return (
              <li key={t.label} className="min-w-0">
                {t.onClick ? (
                  <button type="button" onClick={t.onClick} className="block h-full w-full rounded-card bg-panel p-4 text-left transition-colors hover:bg-accent">{body}</button>
                ) : (
                  <div className="h-full rounded-card bg-panel p-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
