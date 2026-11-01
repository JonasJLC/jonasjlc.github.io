import { fmtRange, toTime } from '../lib/dates';
import { kr } from '../lib/kasse';
import { bookStats, countdown, tripDates } from '../lib/plan';
import type { CheckItem, FerieState, PlanItem, Trip } from '../lib/types';
import { cn } from '../lib/utils';
import { Card } from '../ui/card';
import { personName } from '../kassen/helpers';

export function TripPicker({
  trips, selectedId, items, today, onSelect,
}: {
  trips: Trip[]; selectedId: string | null; items: PlanItem[]; today: number; onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Vælg rejse" className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {trips.map((t) => {
        const st = bookStats(items.filter((x) => x.tripId === t.id));
        const pct = st.need ? (st.booked / st.need) * 100 : 0;
        const on = t.id === selectedId;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(t.id)}
            className={cn('flex min-w-48 shrink-0 snap-start flex-col gap-1 rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-colors', on && 'border-foreground ring-2 ring-foreground/10')}
          >
            <b className="truncate font-display text-base">{t.name || 'Rejse'}</b>
            <span className="text-xs text-muted-foreground">{fmtRange(toTime(t.from), toTime(t.to), new Date(toTime(t.from)).getUTCFullYear())}, {countdown(t, today).toLowerCase()}</span>
            <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <i className="block h-full rounded-full bg-ok transition-[width]" style={{ width: `${pct}%` }} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function TripHeader({
  state, trip, items, checks, today,
}: {
  state: FerieState; trip: Trip; items: PlanItem[]; checks: CheckItem[]; today: number;
}) {
  const dates = tripDates(trip);
  const st = bookStats(items);
  const ideas = items.filter((x) => !x.day).length;
  const planned = items.length - ideas;
  const price = items.reduce((s, x) => s + (x.price ?? 0), 0);
  const chk = checks.filter((c) => c.tripId === trip.id);
  const done = chk.filter((c) => c.done).length;
  const who = trip.who === 'both' ? `${personName(state, 'a')} og ${personName(state, 'b')}` : personName(state, trip.who);
  const pct = st.need ? st.booked / st.need : 0;
  const C = 2 * Math.PI * 34;
  const stats = [
    { v: String(planned), l: 'planer' },
    { v: String(ideas), l: 'i idébanken' },
    { v: kr(price), l: 'planlagte udgifter' },
    ...(chk.length ? [{ v: `${done}/${chk.length}`, l: 'på huskelisten' }] : []),
  ];
  return (
    <Card className="flex-row items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ok">{countdown(trip, today)}</p>
        <h2 className="truncate font-display text-3xl font-extrabold tracking-tight">{trip.name || 'Rejse'}</h2>
        <p className="text-sm text-muted-foreground">
          {fmtRange(toTime(trip.from), toTime(trip.to), state.settings.year)}, {dates.length} {dates.length === 1 ? 'dag' : 'dage'}, {who}
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {stats.map((s) => (
            <div key={s.l}>
              <dd className="font-display text-xl font-bold leading-none tabular-nums">{s.v}</dd>
              <dt className="mt-0.5 text-xs text-muted-foreground">{s.l}</dt>
            </div>
          ))}
        </dl>
      </div>
      <div className="relative shrink-0" role="img" aria-label={st.need ? `${st.booked} af ${st.need} er booket` : 'Intet skal bookes endnu'}>
        <svg viewBox="0 0 84 84" width="96" height="96" aria-hidden>
          <circle cx="42" cy="42" r="34" fill="none" stroke="var(--muted)" strokeWidth="9" />
          <circle cx="42" cy="42" r="34" transform="rotate(-90 42 42)" fill="none" stroke="var(--ok)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} opacity={pct > 0 ? 1 : 0} style={{ transition: 'stroke-dashoffset .7s ease-out' }} />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center font-display leading-tight">
          <b className="text-lg tabular-nums">{st.booked}/{st.need}</b>
          <small className="text-[10px] text-muted-foreground">booket</small>
        </span>
      </div>
    </Card>
  );
}
