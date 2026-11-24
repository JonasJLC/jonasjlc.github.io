import { Check, Flame, Sprout, Zap } from 'lucide-react';
import { habitColors, type Habit } from '../lib/habits/model';
import { cn } from '../lib/utils';
import { Icon } from '../ui/icon';
import { ProgressBar } from '../ui/progress-bar';

export type HabitCardProps = {
  habit: Habit;
  /** "Hver dag · 3 af 7 denne uge". */
  detail: string;
  dots: boolean[];
  doneToday: boolean;
  /** First name of who completed a shared habit today, for "· Jonas". */
  doneByName: string | null;
  /** Whole weeks in a row with the target met; the flame shows from 2 (roadmap Q4). */
  weeks: number;
  /** 0 to 1: today's value over the goal, for numeric automatic habits whose value the viewer may see. */
  goal: number | null;
  goalText: string | null;
  onToggle: () => void;
  onOpen: () => void;
};

/**
 * One habit (image7): a tinted icon tile, title, detail line and one dot per target this week, with a 44 px check on the
 * right. Tapping the card opens its history; the check is its own button. Automatic habits show a bolt until the rule is met
 * and cannot be pressed. A missed day is just an empty dot: no red, no warning.
 */
export function HabitCard({ habit, detail, dots, doneToday, doneByName, weeks, goal, goalText, onToggle, onOpen }: HabitCardProps) {
  const c = habitColors[habit.color];
  const automatic = habit.tracking === 'automatic';
  const checkLabel = automatic
    ? doneToday ? `${habit.title}: udfyldt automatisk i dag` : `${habit.title}: udfyldes automatisk`
    : `${habit.title}: udført i dag`;
  return (
    <li className="flex items-center gap-1 rounded-sp-card bg-sp-surface py-2 pr-2 pl-sp-pad-card" data-slot="habit-card">
      <button type="button" onClick={onOpen} aria-label={`${habit.title}, ${detail}. Åbn historik`} className="flex min-h-sp-target min-w-0 flex-1 items-center gap-3 rounded-sp-row py-1.5 text-left">
        <span aria-hidden="true" className={cn('flex size-12 shrink-0 items-center justify-center rounded-sp-row text-2xl', c.tint, c.ink)}>
          {habit.icon ? <span>{habit.icon}</span> : <Icon icon={Sprout} size={24} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1" aria-hidden="true">
          <span className="flex items-baseline justify-between gap-2">
            <span className="sp-body-strong min-w-0 truncate">
              {habit.title}
              {doneToday && doneByName && habit.owner === 'both' && <span className="sp-small font-normal text-sp-muted"> · {doneByName}</span>}
            </span>
            {weeks >= 2 && (
              <span className="sp-caption inline-flex shrink-0 items-center gap-0.5 text-sp-muted">
                <Icon icon={Flame} size={14} />
                {weeks} uger
              </span>
            )}
          </span>
          <span className="sp-small truncate text-sp-muted">{detail}</span>
          <span className="flex flex-wrap gap-1">
            {dots.map((on, i) => (
              <span key={i} className={cn('size-2 rounded-full', on ? c.fill : 'bg-sp-track')} />
            ))}
          </span>
          {goal !== null && <ProgressBar value={goal} max={1} label={`${habit.title}, mål i dag`} valueText={goalText ?? undefined} className="mt-0.5" />}
        </span>
      </button>
      <button
        type="button"
        onClick={automatic ? undefined : onToggle}
        aria-pressed={automatic ? undefined : doneToday}
        aria-disabled={automatic || undefined}
        aria-label={checkLabel}
        className={cn(
          'sp-border-strong inline-flex size-sp-target shrink-0 items-center justify-center rounded-full',
          c.border,
          doneToday ? cn(c.fill, 'text-sp-on-primary') : cn('bg-transparent', c.text),
          automatic && 'cursor-default',
        )}
      >
        {doneToday ? (
          <Icon icon={Check} size={20} strokeWidth={2.6} className="animate-sp-tick motion-reduce:animate-none" />
        ) : automatic ? (
          <Icon icon={Zap} size={20} />
        ) : null}
      </button>
    </li>
  );
}

/** Grey placeholder cards while the habits load. */
export function HabitSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Henter vaner" className="flex flex-col gap-sp-gap-row">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 rounded-sp-card bg-sp-surface p-sp-pad-card">
          <span className="size-12 shrink-0 rounded-sp-row bg-sp-track" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-1/2 rounded-sp-pill bg-sp-track" />
            <span className="h-3 w-3/4 rounded-sp-pill bg-sp-track" />
          </span>
          <span className="size-sp-target shrink-0 rounded-full bg-sp-track" />
        </li>
      ))}
    </ul>
  );
}
