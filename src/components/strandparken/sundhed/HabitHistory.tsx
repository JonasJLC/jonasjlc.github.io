import { Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { habitColors, isDueOn, weekProgress, type Completion, type Habit } from '../lib/habits/model';
import { addDays, dayOfMonth, isoWeek, mondayOf, weekDays, weekdayShort, type IsoDate } from '../lib/madplan/dates';
import { cn } from '../lib/utils';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';

/** The history shows this many weeks, newest first. */
export const HISTORY_ROWS = 8;

type Props = {
  habit: Habit | null;
  completions: Completion[];
  today: IsoDate;
  onClose: () => void;
  onEdit: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onRestore: (habit: Habit) => void;
};

/** The Monday of each week to list: this week back up to 8 weeks, but not before the week the habit was created. */
export function historyWeeks(habit: Habit, today: IsoDate): IsoDate[] {
  const first = mondayOf(habit.createdAt.slice(0, 10) < today ? habit.createdAt.slice(0, 10) : today);
  const out: IsoDate[] = [];
  for (let i = 0; i < HISTORY_ROWS; i++) {
    const monday = addDays(mondayOf(today), -7 * i);
    if (i > 0 && monday < first) break;
    out.push(monday);
  }
  return out;
}

/**
 * History sheet: the last weeks as rows of seven small day cells and "x af y". Filled is done, empty is not done and a faint
 * dash is a day the habit was not due. Nothing is marked as missed. From here: edit, archive, or restore an archived habit.
 */
export function HabitHistory({ habit, completions, today, onClose, onEdit, onArchive, onRestore }: Props) {
  return (
    <Sheet open={habit !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {habit && <Body habit={habit} completions={completions} today={today} onEdit={onEdit} onArchive={onArchive} onRestore={onRestore} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ habit, completions, today, onEdit, onArchive, onRestore }: Omit<Props, 'habit' | 'onClose'> & { habit: Habit }) {
  const c = habitColors[habit.color];
  const archived = habit.archivedAt !== null;
  const done = new Set(completions.filter((x) => x.habitId === habit.id).map((x) => x.date));
  return (
    <>
      <SheetHeader title={habit.title} eyebrow={archived ? 'Arkiveret' : 'De seneste uger'} />
      <ul className="flex flex-col gap-3" aria-label="Uger">
        {historyWeeks(habit, today).map((monday) => {
          const p = weekProgress(habit, completions, monday);
          return (
            <li key={monday} aria-label={`Uge ${isoWeek(monday)}: ${p.done} af ${p.target}`} className="flex items-center gap-3">
              <span aria-hidden="true" className="sp-caption w-12 shrink-0 text-sp-muted">Uge {isoWeek(monday)}</span>
              <span aria-hidden="true" className="grid flex-1 grid-cols-7 gap-1.5">
                {weekDays(monday).map((date) => {
                  const on = done.has(date);
                  const due = isDueOn(habit, date);
                  return (
                    <span
                      key={date}
                      title={`${weekdayShort(date)} ${dayOfMonth(date)}.`}
                      className={cn(
                        'flex aspect-square items-center justify-center rounded-full',
                        on ? cn(c.fill, 'text-sp-on-primary') : due && date <= today ? 'bg-sp-track' : 'bg-sp-track/40',
                      )}
                    />
                  );
                })}
              </span>
              <span aria-hidden="true" className="sp-small w-12 shrink-0 text-right text-sp-ink">{p.done} af {p.target}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-sp-gap flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onEdit(habit)}>
          <Icon icon={Pencil} size={18} />
          Rediger
        </Button>
        {archived ? (
          <Button variant="outline" onClick={() => onRestore(habit)}>
            <Icon icon={ArchiveRestore} size={18} />
            Gendan
          </Button>
        ) : (
          <Button variant="outline" onClick={() => onArchive(habit)}>
            <Icon icon={Archive} size={18} />
            Arkivér
          </Button>
        )}
      </div>
    </>
  );
}
