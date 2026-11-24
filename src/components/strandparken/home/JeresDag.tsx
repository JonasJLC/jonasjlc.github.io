import { copenhagenToday } from '../lib/health/model';
import { dayCard, type DayCard } from '../lib/health/view';
import { useHealth, type HealthStatus } from '../lib/health/use-health';
import type { Person } from '../lib/people';
import { PersonDayCard } from './PersonDayCard';

const members: Person[] = ['camilla', 'jonas'];

function Skeleton() {
  return (
    <div aria-hidden className="flex h-full min-h-32 flex-col gap-3 rounded-sp-card bg-sp-surface p-sp-pad-card">
      <span className="h-3 w-2/3 rounded-sp-pill bg-sp-track" />
      <span className="h-3 w-full rounded-sp-pill bg-sp-track" />
      <span className="h-3 w-1/2 rounded-sp-pill bg-sp-track" />
    </div>
  );
}

/**
 * Hjem's "Jeres dag" (idea 12): one compact card per member, Camilla left and Jonas right, under "I aften". Each card is
 * the day's sleep, cycle and activity as the viewer may see them, and links to Sundhed. Hidden when neither member has a
 * source connected yet, so the Hjem layout does not carry an empty section.
 */
export function JeresDag({ householdId, person }: { householdId: string | null; person: Person }) {
  const camilla = useHealth(householdId, 'camilla');
  const jonas = useHealth(householdId, 'jonas');
  if (!householdId) return null;

  const today = copenhagenToday();
  const now = new Date();
  const cards: Record<Person, { status: HealthStatus; card: DayCard | null }> = {
    camilla: { status: camilla.status, card: camilla.status === 'ready' ? cardFor('camilla', camilla, person, today, now) : null },
    jonas: { status: jonas.status, card: jonas.status === 'ready' ? cardFor('jonas', jonas, person, today, now) : null },
  };

  const bothUnconnected = members.every((m) => cards[m].card?.empty === 'not-connected');
  if (bothUnconnected) return null;

  return (
    <section aria-labelledby="jeres-dag-title" className="flex flex-col gap-2">
      <h2 id="jeres-dag-title" className="sp-title-section">Jeres dag</h2>
      <div className="grid grid-cols-2 items-stretch gap-sp-gap-grid">
        {members.map((m) => {
          const { status, card } = cards[m];
          if (status === 'loading') return <Skeleton key={m} />;
          if (status === 'error' || !card) {
            return (
              <div key={m} className="rounded-sp-card bg-sp-surface p-sp-pad-card">
                <p className="sp-small text-sp-muted">Tallene kunne ikke hentes.</p>
              </div>
            );
          }
          return <PersonDayCard key={m} person={m} card={card} isOwner={m === person} />;
        })}
      </div>
    </section>
  );
}

function cardFor(
  member: Person,
  health: ReturnType<typeof useHealth>,
  viewer: Person,
  today: string,
  now: Date,
): DayCard {
  return dayCard({ days: health.days, today, hidden: health.hidden, sources: health.sources, isOwner: member === viewer, now });
}
