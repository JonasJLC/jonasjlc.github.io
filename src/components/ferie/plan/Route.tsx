import { Fragment } from 'react';
import { fmtShort, toISO } from '../lib/dates';
import { sortPlan, tripDates } from '../lib/plan';
import type { PlanItem, Trip, TripDay } from '../lib/types';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Group { base: string; from: number; n: number }

export function Route({
  trip, items, tdays, onGoto,
}: {
  trip: Trip; items: PlanItem[]; tdays: TripDay[]; onGoto: (ds: string) => void;
}) {
  const dates = tripDates(trip);
  if (!dates.length) return null;
  const nights = dates.length > 1 ? dates.slice(0, -1) : [];
  const groups: Group[] = [];
  for (const t of nights) {
    const base = (tdays.find((d) => d.tripId === trip.id && d.date === toISO(t))?.base ?? '').trim();
    const g = groups[groups.length - 1];
    if (g && g.base.toLowerCase() === base.toLowerCase()) g.n++;
    else groups.push({ base, from: t, n: 1 });
  }
  const legs = (t: number) =>
    items.filter((x) => x.type === 'transport' && x.day === toISO(t)).sort(sortPlan).map((x) => x.title || 'Transport');
  const Leg = ({ t }: { t: number }) => {
    const l = legs(t);
    return <li className="flex min-w-16 flex-1 items-end justify-center border-b-2 border-dashed px-1 pb-1 text-center text-[11px] text-muted-foreground" aria-hidden={!l.length}>{l.join(', ')}</li>;
  };
  const Stop = ({ title, sub, onClick, none }: { title: string; sub: string; onClick?: () => void; none?: boolean }) => {
    const body = (
      <>
        <span className={cn('size-3 rounded-full border-2 border-foreground', none ? 'bg-card' : 'bg-foreground')} />
        <b className={cn('max-w-28 truncate text-sm', none && 'font-medium text-muted-foreground')}>{title}</b>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </>
    );
    return (
      <li className="flex shrink-0 flex-col items-center gap-1">
        {onClick ? <button type="button" onClick={onClick} className="flex min-h-11 flex-col items-center gap-1 rounded-lg px-2 hover:bg-muted">{body}</button> : <div className="flex min-h-11 flex-col items-center gap-1 px-2">{body}</div>}
      </li>
    );
  };
  const last = dates[dates.length - 1];
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-lg">Ruten</CardTitle></CardHeader>
      <CardContent>
        <ol className="-mx-2 flex items-end overflow-x-auto pb-2" aria-label="Rute">
          <Stop title="Hjemme" sub={fmtShort(dates[0])} />
          {groups.map((g) => (
            <Fragment key={g.from}>
              <Leg t={g.from} />
              <Stop title={g.base || 'Ikke valgt'} sub={`${g.n} ${g.n === 1 ? 'nat' : 'nætter'}`} none={!g.base} onClick={() => onGoto(toISO(g.from))} />
            </Fragment>
          ))}
          <Leg t={last} />
          <Stop title="Hjem" sub={fmtShort(last)} />
        </ol>
        {groups.every((g) => !g.base) && (
          <p className="mt-2 text-xs text-muted-foreground">Skriv, hvor I sover hver nat, så tegnes jeres rute her. Transport på de dage, hvor I skifter sted, vises på strækningen.</p>
        )}
      </CardContent>
    </Card>
  );
}
