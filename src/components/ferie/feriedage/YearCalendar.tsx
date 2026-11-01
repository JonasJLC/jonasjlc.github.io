import { memo, useMemo } from 'react';
import { DAY, MONTHS, fmtLong, isoWeek, isWeekend, toTime, todayTime } from '../lib/dates';
import { dayOffName, holidayName } from '../lib/holidays';
import type { DayOff, FerieState, PersonKey, Trip } from '../lib/types';
import { involves } from '../lib/balance';
import { cn } from '../lib/utils';
import { personColor, personName } from './helpers';

export interface Selection {
  from: number | null;
  to: number | null;
}

const HEAD = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

function cellStyle(keys: PersonKey[], free: boolean): React.CSSProperties | undefined {
  if (!keys.length) return undefined;
  const tone = (k: PersonKey) =>
    free ? `color-mix(in srgb, ${personColor(k)} 38%, transparent)` : personColor(k);
  const base =
    keys.length === 2
      ? `linear-gradient(135deg, ${tone('a')} 50%, ${tone('b')} 50%)`
      : `linear-gradient(${tone(keys[0])}, ${tone(keys[0])})`;
  // Person B also gets stripes, so colour is never the only signal.
  const stripes =
    keys.length === 1 && keys[0] === 'b'
      ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.28) 0 3px, transparent 3px 7px), '
      : '';
  return { backgroundImage: stripes + base };
}

interface Props {
  state: FerieState;
  selection: Selection;
  onPick: (t: number) => void;
}

export function YearCalendar({ state, selection, onPick }: Props) {
  const Y = state.settings.year;
  const offA = state.settings.people.a.daysOff;
  const offB = state.settings.people.b.daysOff;
  const nameA = personName(state, 'a');
  const nameB = personName(state, 'b');

  const byDay = useMemo(() => {
    const m = new Map<number, Trip[]>();
    for (const tr of state.trips) {
      const a = toTime(tr.from), b = toTime(tr.to);
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      for (let t = a; t <= b; t += DAY) {
        const l = m.get(t);
        if (l) l.push(tr); else m.set(t, [tr]);
      }
    }
    return m;
  }, [state.trips]);

  const lo = selection.from === null ? null : Math.min(selection.from, selection.to ?? selection.from);
  const hi = selection.from === null ? null : Math.max(selection.from, selection.to ?? selection.from);
  const today = todayTime();

  return (
    <section aria-label={`Kalender ${Y}`} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-xl font-bold tracking-tight">Kalender {Y}</h2>
        <p className="text-sm text-muted-foreground">
          Tryk på en startdato og en slutdato for at lave en rejse. Tryk på en rejse for at rette den.
        </p>
      </div>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="inline-flex items-center gap-1.5"><i className="size-3 rounded" style={{ background: personColor('a') }} />{personName(state, 'a')}</li>
        <li className="inline-flex items-center gap-1.5"><i className="size-3 rounded" style={{ background: personColor('b'), backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 2px, transparent 2px 5px)' }} />{personName(state, 'b')}</li>
        <li className="inline-flex items-center gap-1.5"><i className="size-3 rounded" style={{ backgroundImage: `linear-gradient(135deg, ${personColor('a')} 50%, ${personColor('b')} 50%)` }} />Begge</li>
        <li className="inline-flex items-center gap-1.5"><i className="size-3 rounded border-2 border-holiday" />Helligdag eller fast fridag</li>
        <li>Lys farve = fri dag, koster ikke ferie</li>
      </ul>
      <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
        {MONTHS.map((name, m) => (
          <Month key={m} Y={Y} m={m} name={name} byDay={byDay} offA={offA} offB={offB} nameA={nameA} nameB={nameB} lo={lo} hi={hi} today={today} onPick={onPick} />
        ))}
      </div>
    </section>
  );
}

interface MonthProps {
  Y: number; m: number; name: string; byDay: Map<number, Trip[]>;
  offA: DayOff[]; offB: DayOff[]; nameA: string; nameB: string;
  lo: number | null; hi: number | null; today: number; onPick: (t: number) => void;
}

const Month = memo(function Month({ Y, m, name, byDay, offA, offB, nameA, nameB, lo, hi, today, onPick }: MonthProps) {
  const first = Date.UTC(Y, m, 1);
  const days = new Date(Date.UTC(Y, m + 1, 0)).getUTCDate();
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const weeks = Math.ceil((lead + days) / 7);

  return (
    <div>
      <h3 className="mb-1.5 font-display text-base font-bold capitalize">{name}</h3>
      <div role="grid" aria-label={`${name} ${Y}`} className="grid grid-cols-[1.4rem_repeat(7,minmax(0,1fr))] gap-y-0.5 text-center text-xs">
        <span aria-hidden />
        {HEAD.map((h, i) => (
          <span key={i} aria-hidden className="pb-1 text-[11px] font-semibold text-muted-foreground">{h}</span>
        ))}
        {Array.from({ length: weeks }, (_, w) => {
          const rowStart = first + (w * 7 - lead) * DAY;
          return (
            <div key={w} role="row" className="contents">
              <span aria-hidden className="self-center text-[10px] text-muted-foreground/70">{isoWeek(rowStart + 3 * DAY)}</span>
              {Array.from({ length: 7 }, (_, d) => {
                const idx = w * 7 + d - lead;
                if (idx < 0 || idx >= days) return <span key={d} role="gridcell" />;
                const t = first + idx * DAY;
                const official = holidayName(t);
                const offFor = { a: !!dayOffName(t, offA), b: !!dayOffName(t, offB) };
                const offName = dayOffName(t, offA) ?? dayOffName(t, offB);
                const weekend = isWeekend(t);
                const trips = byDay.get(t) ?? [];
                const keys = (['a', 'b'] as PersonKey[]).filter((k) => trips.some((tr) => involves(tr, k)));
                // Free when nobody it concerns has to take vacation that day.
                const free = weekend || !!official || (keys.length ? keys : (['a', 'b'] as PersonKey[])).every((k) => offFor[k]);
                const partly = !official && !!offName && !(offFor.a && offFor.b);
                const hol = official ?? (offName && (partly ? `${offName} (fri for ${offFor.a ? nameA : nameB})` : offName));
                const selected = lo !== null && hi !== null && t >= lo && t <= hi;
                const edge = selected && (t === lo || t === hi);
                const label = [
                  fmtLong(t),
                  hol,
                  ...trips.map((tr) => `rejse: ${tr.name || 'Rejse'}`),
                  selected ? 'valgt' : '',
                ].filter(Boolean).join(', ');
                return (
                  <span key={d} role="gridcell" className="p-px">
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={selected}
                      onClick={() => onPick(t)}
                      style={cellStyle(keys, free)}
                      className={cn(
                        'relative flex aspect-square w-full items-center justify-center rounded-lg text-[13px] font-medium tabular-nums transition-transform active:scale-90',
                        free && !keys.length && 'text-muted-foreground',
                        keys.length > 0 && !free && 'font-bold text-card',
                        keys.length > 0 && free && 'text-foreground',
                        hol && (partly ? 'ring-1 ring-inset ring-holiday/45' : 'ring-1 ring-inset ring-holiday'),
                        !keys.length && !selected && 'hover:bg-muted',
                        selected && 'bg-foreground/15 ring-2 ring-inset ring-foreground',
                        edge && 'bg-foreground text-background ring-0',
                        t === today && 'after:absolute after:bottom-0.5 after:size-1 after:rounded-full after:bg-warn',
                      )}
                    >
                      {idx + 1}
                    </button>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});
