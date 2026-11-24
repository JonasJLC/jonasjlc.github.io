import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { addDays, dayOfMonth, isoWeek, longDate, mondayOf, weekDays, weekdayShort } from '../lib/madplan/dates';
import { dishOf, entryOn, type PlanEntry } from '../lib/madplan/model';
import { loadEntries } from '../lib/madplan/repo';
import type { Idea } from '../lib/ideas/model';
import type { Recipe } from '../lib/recipes/model';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';

type Props = {
  /** The day the meal is on now; it is shown but cannot be picked. */
  from: string;
  /** The week MadplanView shows, and its entries, so that week needs no extra fetch. */
  shownMonday: string;
  shownEntries: PlanEntry[];
  recipes: Recipe[];
  ideas: Idea[];
  busy: boolean;
  /** `entries` are the picked week's, so the caller can decide move or swap with `dropOutcome`. */
  onPick: (date: string, entries: PlanEntry[]) => void;
};

type WeekState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; entries: PlanEntry[] };

/** "Flyt til…": a week with ‹ › and its seven days, each "Tom" or "Byt med <titel>" (design §5.3.3). */
export function WeekPicker({ from, shownMonday, shownEntries, recipes, ideas, busy, onPick }: Props) {
  const [monday, setMonday] = useState(mondayOf(from));
  const days = useMemo(() => weekDays(monday), [monday]);
  const [loaded, setLoaded] = useState<WeekState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (monday === shownMonday) return;
    let gone = false;
    setLoaded({ status: 'loading' });
    loadEntries(days[0], days[6])
      .then((entries) => !gone && setLoaded({ status: 'ready', entries }))
      .catch(() => !gone && setLoaded({ status: 'error' }));
    return () => {
      gone = true;
    };
  }, [monday, shownMonday, days, attempt]);

  const week: WeekState = monday === shownMonday ? { status: 'ready', entries: shownEntries } : loaded;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="sp-body-strong">Flyt til</p>
        <div role="group" aria-label="Uge" className="flex items-center rounded-sp-pill bg-sp-surface">
          <button type="button" aria-label="Forrige uge" onClick={() => setMonday(addDays(monday, -7))} className="inline-flex size-sp-target items-center justify-center rounded-full active:bg-sp-track">
            <Icon icon={ChevronLeft} />
          </button>
          <span aria-live="polite" className="sp-body-strong min-w-16 text-center">Uge {isoWeek(monday)}</span>
          <button type="button" aria-label="Næste uge" onClick={() => setMonday(addDays(monday, 7))} className="inline-flex size-sp-target items-center justify-center rounded-full active:bg-sp-track">
            <Icon icon={ChevronRight} />
          </button>
        </div>
      </div>

      {week.status === 'error' ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="sp-body">Ugen kunne ikke hentes.</p>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>Prøv igen</Button>
        </div>
      ) : (
        <ul aria-label={`Vælg dag i uge ${isoWeek(monday)}`} aria-busy={week.status === 'loading'} className="flex flex-col gap-sp-gap-row">
          {days.map((d) => {
            const ready = week.status === 'ready';
            const other = ready ? entryOn(week.entries, d) : null;
            const own = d === from;
            const note = !ready ? '' : own ? 'Her nu' : other ? `Byt med ${dishOf(other, recipes, ideas).title}` : 'Tom';
            return (
              <li key={d}>
                <button
                  type="button"
                  disabled={busy || own || !ready}
                  aria-label={ready ? `${longDate(d)}: ${note}` : longDate(d)}
                  onClick={() => ready && onPick(d, week.entries)}
                  className="flex min-h-sp-target w-full items-center justify-between gap-3 rounded-sp-row bg-sp-surface px-4 text-left active:bg-sp-track disabled:opacity-45"
                >
                  <span className="sp-body-strong">{weekdayShort(d)} {dayOfMonth(d)}.</span>
                  <span className="sp-caption min-w-0 truncate text-sp-muted">{note}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
