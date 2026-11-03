import { FoldBody, FoldButton, useFold } from '../fold';
import { memo, useMemo } from 'react';
import { DAY, MONTHS, fmtLong, isoWeek, isWeekend, toTime, todayTime } from '../lib/dates';
import { dayOffName, holidayName } from '../lib/holidays';
import type { DayOff, FerieState, PersonKey, Trip } from '../lib/types';
import { involves } from '../lib/balance';
import type { Bridge } from '../lib/bridges';
import { cn } from '../lib/utils';
import { personName } from './helpers';

export interface Selection {
  from: number | null;
  to: number | null;
}

const HEAD = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

/** The band behind a trip day: each person's pale tint, the two mixed when both go. */
function band(keys: PersonKey[]): string | undefined {
  if (!keys.length) return undefined;
  if (keys.length === 2) return 'color-mix(in srgb, color-mix(in srgb, var(--person-a) 50%, var(--person-b)) 20%, var(--panel))';
  return `color-mix(in srgb, var(--person-${keys[0]}) 20%, var(--panel))`;
}

interface Props {
  state: FerieState;
  selection: Selection;
  bridges: Bridge[];
  onPick: (t: number) => void;
}

export function YearCalendar({ state, selection, bridges, onPick }: Props) {
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

  const bridgeDays = useMemo(() => {
    const m = new Map<number, Bridge>();
    for (const b of bridges) for (let t = b.from; t <= b.to; t += DAY) m.set(t, b);
    return m;
  }, [bridges]);

  const lo = selection.from === null ? null : Math.min(selection.from, selection.to ?? selection.from);
  const hi = selection.from === null ? null : Math.max(selection.from, selection.to ?? selection.from);
  const today = todayTime();

  const fold = useFold('calendar');
  const swatch = 'inline-block h-3.5 w-5 rounded';
  return (
    <section aria-labelledby="cal-h" className="rounded-panel bg-panel p-5">
      <div className={`flex flex-col gap-1 ${fold.folded ? '' : 'mb-4'}`}>
        <h2 id="cal-h" className="text-[15px] leading-6 font-semibold">
          <FoldButton folded={fold.folded} onToggle={fold.toggle} controls="cal-body">Kalender {Y}</FoldButton>
        </h2>
        {!fold.folded && <p className="text-sm text-muted-foreground">Tryk på første og sidste dag for at lave en rejse. Tryk på en rejse for at rette den.</p>}
      </div>
      <FoldBody id="cal-body" folded={fold.folded}>
      <ul className="mb-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Forklaring">
        <li className="inline-flex items-center gap-1.5"><i className={swatch} style={{ background: band(['a']) }} />{nameA}</li>
        <li className="inline-flex items-center gap-1.5"><i className={swatch} style={{ background: band(['b']) }} />{nameB}</li>
        <li className="inline-flex items-center gap-1.5"><i className={swatch} style={{ background: band(['a', 'b']) }} />Begge</li>
        <li className="inline-flex items-center gap-1.5"><i className={`${swatch} hatch`} style={{ backgroundColor: band(['a', 'b']) }} />Fri dag i rejsen</li>
        <li className="inline-flex items-center gap-1.5"><i className="inline-block h-1 w-5 rounded-full bg-bridge" />Forslag: mange fridage for få feriedage</li>
        <li className="inline-flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-holiday" />Helligdag eller fast fridag</li>
        <li className="inline-flex items-center gap-1.5"><i className="size-3.5 rounded-full ring-1 ring-inset ring-data" />I dag</li>
      </ul>
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
        {MONTHS.map((name, m) => (
          <Month key={m} Y={Y} m={m} name={name} byDay={byDay} bridgeDays={bridgeDays} offA={offA} offB={offB} nameA={nameA} nameB={nameB} lo={lo} hi={hi} today={today} onPick={onPick} />
        ))}
      </div>
      </FoldBody>
    </section>
  );
}

interface MonthProps {
  Y: number; m: number; name: string; byDay: Map<number, Trip[]>; bridgeDays: Map<number, Bridge>;
  offA: DayOff[]; offB: DayOff[]; nameA: string; nameB: string;
  lo: number | null; hi: number | null; today: number; onPick: (t: number) => void;
}

const Month = memo(function Month({ Y, m, name, byDay, bridgeDays, offA, offB, nameA, nameB, lo, hi, today, onPick }: MonthProps) {
  const first = Date.UTC(Y, m, 1);
  const days = new Date(Date.UTC(Y, m + 1, 0)).getUTCDate();
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const weeks = Math.ceil((lead + days) / 7);

  return (
    <div>
      <h3 className="mb-2 text-[13px] font-semibold capitalize">{name}</h3>
      <div role="grid" aria-label={`${name} ${Y}`} className="grid grid-cols-[1.5rem_repeat(7,minmax(0,1fr))] gap-y-1 text-center">
        <span aria-hidden />
        {HEAD.map((h, i) => (
          <span key={i} aria-hidden className="pb-0.5 text-[11px] text-muted-foreground">{h}</span>
        ))}
        {Array.from({ length: weeks }, (_, w) => {
          const rowStart = first + (w * 7 - lead) * DAY;
          return (
            <div key={w} role="row" className="contents">
              <span aria-hidden className="self-center text-left text-[11px] text-muted-foreground/80 tabular-nums">{isoWeek(rowStart + 3 * DAY)}</span>
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
                // A trip reads as one band: round it only where it starts or ends, or at the week's edge.
                const prev = byDay.get(t - DAY)?.some((tr) => trips.includes(tr)) && d > 0 && idx > 0;
                const next = byDay.get(t + DAY)?.some((tr) => trips.includes(tr)) && d < 6 && idx < days - 1;
                const selPrev = selected && t > (lo as number) && d > 0 && idx > 0;
                const selNext = selected && t < (hi as number) && d < 6 && idx < days - 1;
                const sug = bridgeDays.get(t);
                const sugPrev = !!sug && bridgeDays.get(t - DAY) === sug && d > 0 && idx > 0;
                const sugNext = !!sug && bridgeDays.get(t + DAY) === sug && d < 6 && idx < days - 1;
                const label = [
                  fmtLong(t),
                  hol,
                  sug && `foreslået ferieperiode: ${sug.total} fridage for ${sug.cost} ${sug.cost === 1 ? 'feriedag' : 'feriedage'}`,
                  ...trips.map((tr) => `rejse: ${tr.name || 'Rejse'}`),
                  keys.length && free ? 'koster ikke ferie' : '',
                  selected ? 'valgt' : '',
                ].filter(Boolean).join(', ');
                const inBand = keys.length > 0 || selected;
                return (
                  <span key={d} role="gridcell" className="relative">
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={selected}
                      onClick={() => onPick(t)}
                      style={!selected ? { backgroundColor: band(keys) } : undefined}
                      className={cn(
                        'relative flex h-9 w-full items-center justify-center text-[13px] tabular-nums transition-colors md:h-8',
                        !inBand && 'rounded-lg hover:bg-accent',
                        inBand && !(selected ? selPrev : prev) && 'rounded-l-lg',
                        inBand && !(selected ? selNext : next) && 'rounded-r-lg',
                        keys.length > 0 && !selected && 'hover:brightness-95',
                        keys.length > 0 && free && !selected && 'hatch',
                        free && !keys.length && 'text-muted-foreground',
                        keys.length > 0 && !free && 'font-medium text-foreground',
                        keys.length > 0 && free && 'text-muted-foreground',
                        selected && 'bg-foreground/10',
                        edge && 'rounded-lg bg-foreground font-medium text-background',
                        t === today && !edge && 'font-semibold text-data',
                      )}
                    >
                      {t === today && !edge && <span aria-hidden className="absolute inset-0.5 rounded-md ring-1 ring-inset ring-data" />}
                      {idx + 1}
                      {sug && (
                        <span
                          aria-hidden
                          className={cn('absolute right-0 bottom-0 left-0 h-1 bg-bridge', !sugPrev && 'rounded-l-full', !sugNext && 'rounded-r-full')}
                        />
                      )}
                      {hol && (
                        <span
                          aria-hidden
                          className={cn('absolute top-1 right-1 size-1.5 rounded-full', partly ? 'ring-1 ring-inset ring-holiday' : 'bg-holiday')}
                        />
                      )}
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
