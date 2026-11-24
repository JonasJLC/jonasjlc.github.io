import { dayCounts, dayRing, type Completion, type Habit } from '../lib/habits/model';
import { dayOfMonth, mondayOf, weekdayLong, weekdayShort, weekDays, type IsoDate } from '../lib/madplan/dates';
import { cn } from '../lib/utils';

const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const label = (habits: Habit[], cs: Completion[], date: IsoDate, today: IsoDate) => {
  const c = dayCounts(habits, cs, date, today);
  const day = `${weekdayLong(date)} ${dayOfMonth(date)}.`;
  if (date > today) return day;
  return c ? `${day}: ${c.done} af ${c.total} ${c.total === 1 ? 'vane' : 'vaner'}` : `${day}: ingen vaner`;
};

/**
 * This week, Monday to Sunday: the weekday letter above a ring with the date inside. The ring fills in the primary colour by
 * how many of that day's habits were completed. A day with nothing due, and every future day, is an empty track. Never red.
 */
export function WeekRings({ habits, completions, today }: { habits: Habit[]; completions: Completion[]; today: IsoDate }) {
  const days = weekDays(mondayOf(today));
  return (
    <ol aria-label="Ugen" className="grid grid-cols-7 gap-1">
      {days.map((date) => {
        const fill = dayRing(habits, completions, date, today);
        const isToday = date === today;
        return (
          <li key={date} aria-label={label(habits, completions, date, today)} className="flex flex-col items-center gap-1">
            <span aria-hidden="true" className={cn('sp-caption', isToday ? 'font-semibold text-sp-ink' : 'text-sp-muted')}>
              {weekdayShort(date).charAt(0).toUpperCase()}
            </span>
            <span aria-hidden="true" className="relative inline-flex size-10 items-center justify-center">
              <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90" focusable="false">
                <circle cx="20" cy="20" r={RADIUS} fill="none" strokeWidth="3.5" className="stroke-sp-track" />
                {fill !== null && fill > 0 && (
                  <circle
                    cx="20" cy="20" r={RADIUS} fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-sp-primary"
                    strokeDasharray={`${fill * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  />
                )}
              </svg>
              <span className={cn('sp-small relative', isToday ? 'font-bold text-sp-ink' : 'text-sp-ink')}>{dayOfMonth(date)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
