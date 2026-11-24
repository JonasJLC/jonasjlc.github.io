import { Activity, CalendarHeart, Moon } from 'lucide-react';
import { people, type Person } from '../lib/people';
import { sundhedHref } from '../lib/routes';
import type { DayCard, DayCardRow } from '../lib/health/view';
import { cn } from '../lib/utils';
import { Avatar } from '../ui/avatar';
import { Icon } from '../ui/icon';
import { ProgressBar } from '../ui/progress-bar';

const rowIcon = { sleep: Moon, cycle: CalendarHeart, activity: Activity } as const;

/** One row read aloud: "aktivitet 65 procent", "søvn ingen data i nat". */
const spoken = (r: DayCardRow) => `${r.label.toLowerCase()} ${r.text.replace('%', ' procent').toLowerCase()}`;

/**
 * One member's card in "Jeres dag" (idea 12). The whole card links to Sundhed for that person. Shows the day's rows (sleep,
 * cycle, activity with a thin bar), the sync line, or a short note when nothing is connected or shared.
 */
export function PersonDayCard({ person, card, isOwner }: { person: Person; card: DayCard; isOwner: boolean }) {
  const name = people[person].name;
  const notConnected = card.empty === 'not-connected';
  const summary = notConnected
    ? 'ikke forbundet'
    : card.empty === 'not-shared'
      ? 'deler ikke sine tal'
      : card.rows.map(spoken).join(', ');
  return (
    <a
      href={sundhedHref(person)}
      aria-label={`${name}: ${summary}. Åbn Sundhed.`}
      className="flex h-full min-w-0 flex-col gap-3 rounded-sp-card bg-sp-surface p-sp-pad-card active:bg-sp-track"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Avatar person={person} size={34} decorative />
        <span className="sp-body-strong truncate">{name}</span>
      </span>

      {card.empty ? (
        <span className="flex flex-col gap-1">
          <span className="sp-small text-sp-muted">{notConnected ? 'Ikke forbundet' : 'Deler ikke sine tal'}</span>
          {notConnected && isOwner && <span className="sp-small font-semibold text-sp-primary">Forbind</span>}
        </span>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {card.rows.map((r) => {
            const key = r.metric === 'sleep_score' ? 'sleep' : r.metric === 'cycle_day' ? 'cycle' : 'activity';
            return (
              <li key={r.metric} className="flex flex-col gap-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="sp-small flex min-w-0 items-center gap-1.5 text-sp-muted">
                    <Icon icon={rowIcon[key]} size={16} className="shrink-0" />
                    <span className="truncate">{r.label}</span>
                  </span>
                  <span className={cn('shrink-0 text-right', r.missing ? 'sp-small text-sp-muted' : 'sp-body-strong')}>{r.text}</span>
                </span>
                {r.bar !== undefined && <ProgressBar value={r.bar} max={1} label={`${r.label}, mål`} valueText={r.text} />}
              </li>
            );
          })}
        </ul>
      )}

      {card.sync && <span className="sp-caption mt-auto text-sp-muted">{card.sync}</span>}
    </a>
  );
}
