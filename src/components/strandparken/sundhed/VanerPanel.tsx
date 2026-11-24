import { ChevronDown, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { sourceNames, type DayView, type SourceStatus } from '../lib/health/model';
import { formatSteps } from '../lib/health/view';
import {
  detailLine, doneBy, todayCount, weekProgress, weeksInARow, type Habit,
} from '../lib/habits/model';
import type { HabitsState } from '../lib/habits/use-habits';
import { goalFraction, todayValueFor } from '../lib/habits/view';
import { mondayOf, type IsoDate } from '../lib/madplan/dates';
import { people, personFromKey } from '../lib/people';
import { notify } from '../ui/toast';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { Icon } from '../ui/icon';
import { HabitCard, HabitSkeleton } from './HabitCard';
import { HabitHistory } from './HabitHistory';
import { WeekRings } from './WeekRings';

type Filter = 'mine' | 'shared';

export type VanerPanelProps = {
  state: HabitsState;
  today: IsoDate;
  offline: boolean;
  /** The signed-in person's key. */
  me: 'a' | 'b' | null;
  /** The signed-in person's own health (automatic habits are personal). */
  health: { today: DayView | null; hidden: string[]; sources: SourceStatus[] };
  setDone: (habit: Habit, done: boolean) => Promise<boolean>;
  archive: (habit: Habit) => Promise<boolean>;
  restore: (habit: Habit) => Promise<boolean>;
  retry: () => void;
  onNew: () => void;
  onEdit: (habit: Habit) => void;
};

const Note = ({ children }: { children: React.ReactNode }) => <p className="sp-body text-sp-muted">{children}</p>;

/**
 * Sundhed › Vaner (idea 15): the week's rings, the chips Mine and Fælles with today's "n af m i dag", the habit cards, and a
 * collapsed list of archived habits. Weekly progress is the main view; nothing here marks a day as missed.
 */
export function VanerPanel({ state, today, offline, me, health, setDone, archive, restore, retry, onNew, onEdit }: VanerPanelProps) {
  const [filter, setFilter] = useState<Filter>('mine');
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const habits = state.status === 'ready' ? state.habits : [];
  const completions = state.status === 'ready' ? state.completions : [];
  const monday = mondayOf(today);

  const accepts = (h: Habit) => (filter === 'mine' ? h.owner === me : h.owner === 'both');
  const active = habits.filter((h) => h.archivedAt === null);
  const archived = habits.filter((h) => h.archivedAt !== null && (h.owner === me || h.owner === 'both'));
  // Rings and counts only cover the habits the viewer can see: their own and Fælles (the other person's stay private).
  const visible = useMemo(() => active.filter((h) => h.owner === me || h.owner === 'both'), [active, me]);
  const shown = visible.filter(accepts);
  const count = todayCount(habits, completions, today, (h) => (h.owner === me || h.owner === 'both') && accepts(h));
  const openHabit = habits.find((h) => h.id === openId) ?? null;
  const autoSource = [...new Set(health.sources.map((s) => sourceNames[s.source]))].join(' og ') || 'dine data';

  const tick = async (h: Habit, doneToday: boolean) => {
    await setDone(h, !doneToday);
  };

  const doArchive = async (h: Habit) => {
    setOpenId(null);
    if (!(await archive(h))) return;
    notify('Vanen er arkiveret', { onUndo: () => void restore(h) });
  };

  let body: React.ReactNode;
  if (state.status === 'loading') {
    body = <HabitSkeleton />;
  } else if (state.status === 'error') {
    body = (
      <div className="flex flex-col items-start gap-3">
        <Note>Vanerne kunne ikke hentes.</Note>
        <Button type="button" onClick={retry}>Prøv igen</Button>
      </div>
    );
  } else if (shown.length === 0) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <Note>{visible.length === 0 ? 'Ingen vaner endnu.' : filter === 'mine' ? 'Ingen vaner her endnu.' : 'Ingen fælles vaner endnu.'}</Note>
        <Button type="button" onClick={onNew}>Opret vane</Button>
      </div>
    );
  } else {
    body = (
      <ul className="flex flex-col gap-sp-gap-row" aria-label={filter === 'mine' ? 'Mine vaner' : 'Fælles vaner'}>
        {shown.map((h) => {
          const p = weekProgress(h, completions, monday);
          const value = h.tracking === 'automatic' ? todayValueFor(h.rule, health.today, health.hidden) : null;
          const doneToday = completions.some((c) => c.habitId === h.id && c.date === today);
          const by = doneBy(h, completions, today);
          const goal = goalFraction(h.rule, value);
          return (
            <HabitCard
              key={h.id}
              habit={h}
              detail={detailLine(h, p, value)}
              dots={p.dots}
              doneToday={doneToday}
              doneByName={by ? people[personFromKey(by) ?? 'jonas'].name : null}
              weeks={weeksInARow(h, completions, today)}
              goal={goal}
              goalText={goal !== null && value?.value != null && h.rule ? `${formatSteps(value.value)} af ${formatSteps(h.rule.threshold)}` : null}
              onToggle={() => void tick(h, doneToday)}
              onOpen={() => setOpenId(h.id)}
            />
          );
        })}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-sp-gap">
      {state.status === 'ready' && <WeekRings habits={visible} completions={completions} today={today} />}
      {offline && <p role="status" className="sp-small text-sp-muted">Du er offline. Det du ser, er det sidst hentede.</p>}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Vis">
          <Chip selected={filter === 'mine'} onClick={() => setFilter('mine')}>Mine</Chip>
          <Chip selected={filter === 'shared'} onClick={() => setFilter('shared')}>Fælles</Chip>
        </div>
        {state.status === 'ready' && count.total > 0 && (
          <span aria-live="polite" className="sp-small shrink-0 text-sp-muted">{count.done} af {count.total} i dag</span>
        )}
      </div>
      {body}
      {state.status === 'ready' && shown.some((h) => h.tracking === 'automatic') && (
        <p className="sp-caption flex items-center gap-1 text-sp-muted">
          <Icon icon={Zap} size={14} />
          udfyldes automatisk fra {autoSource}
        </p>
      )}
      {state.status === 'ready' && archived.length > 0 && (
        <div className="flex flex-col gap-2">
          <Button variant="quiet" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)} className="self-start">
            Arkiverede ({archived.length})
            <Icon icon={ChevronDown} size={18} className={showArchived ? 'rotate-180' : undefined} />
          </Button>
          {showArchived && (
            <ul className="flex flex-col gap-1">
              {archived.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => setOpenId(h.id)} className="sp-body flex min-h-sp-target w-full items-center rounded-sp-row bg-sp-surface px-sp-pad-card text-left text-sp-muted">
                    {h.icon ? `${h.icon} ` : ''}{h.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <HabitHistory
        habit={openHabit}
        completions={completions}
        today={today}
        onClose={() => setOpenId(null)}
        onEdit={(h) => { setOpenId(null); onEdit(h); }}
        onArchive={(h) => void doArchive(h)}
        onRestore={(h) => { setOpenId(null); void restore(h); }}
      />
    </div>
  );
}
