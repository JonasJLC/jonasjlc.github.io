import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { colorOf, dayLink, label, nextToday, summary, timeRange, tomorrow, updatedLabel, type CalEvent } from '../lib/calendar/model';
import { useCalendar } from '../lib/calendar/use-calendar';
import { dayOfMonth, todayIso, weekdayLong } from '../lib/madplan/dates';
import { cn } from '../lib/utils';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Icon } from '../ui/icon';

function TomorrowEvent({ event }: { event: CalEvent }) {
  const c = colorOf(event.color);
  return (
    <span className={cn('flex min-w-0 gap-2 rounded-sp-inset py-1.5 pr-2', c.tint, c.ink)}>
      <span aria-hidden className={cn('w-0.75 shrink-0 rounded-sp-pill', c.bar)} />
      <span className="flex min-w-0 flex-col">
        <span className="sp-small truncate font-semibold">{label(event)}</span>
        <span className="sp-caption">{timeRange(event)}</span>
      </span>
    </span>
  );
}

/**
 * Hjem's calendar (Idé 7): today on the left (weekday, date, next event), tomorrow on the right (up to two events and
 * "+ N mere"). Read only; the whole card opens the phone's calendar at today (iOS) or Google Calendar's day view.
 * With no calendar yet it explains, in one sentence, why the calendars have to be added by address.
 */
export function CalendarCard({ householdId, onAdd }: { householdId: string | null; onAdd: () => void }) {
  const { state, retry } = useCalendar(householdId);
  const [now, setNow] = useState(() => new Date());
  // The next event moves on as the day passes, without a new fetch.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!householdId) return null;

  if (state.status === 'loading') {
    return <Card aria-busy="true" aria-label="Henter kalender" className="min-h-32 animate-pulse bg-sp-surface" />;
  }

  if (state.status === 'empty') {
    return (
      <section aria-labelledby="calendar-empty-title" className="sp-border-strong flex flex-col items-start gap-2 rounded-sp-card border-dashed border-sp-dash p-sp-pad-card">
        <Icon icon={CalendarDays} className="text-sp-primary" />
        <h2 id="calendar-empty-title" className="sp-title-section">Vis jeres kalendere her</h2>
        <p className="sp-body text-sp-muted">
          Strandparken er en webapp og kan ikke læse telefonens kalender, så I tilføjer hver kalender én gang med dens hemmelige adresse.
        </p>
        <Button inCard onClick={onAdd}>Tilføj kalender</Button>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <Card className="flex flex-col gap-sp-gap">
        <p role="alert" className="sp-body">Kalenderen kunne ikke hentes.</p>
        <Button variant="outline" onClick={retry}>Prøv igen</Button>
      </Card>
    );
  }

  const { result, failed } = state;
  const today = todayIso(now);
  const next = nextToday(result.events, now);
  const t = tomorrow(result.events, today);
  const stale = result.sources.filter((s) => s.stale && s.updatedAt).map((s) => s.updatedAt!).sort()[0];
  const href = dayLink(today, navigator.userAgent, navigator.maxTouchPoints);

  return (
    <section aria-label="Kalender">
      <a
        href={href}
        aria-label={summary(result.events, now)}
        className="grid grid-cols-2 gap-3 rounded-sp-card bg-sp-surface p-3.5 active:bg-sp-track"
        {...(href.startsWith('https:') ? { target: '_blank', rel: 'noopener' } : {})}
      >
        <span className="flex min-w-0 flex-col">
          <span className="sp-caption font-semibold uppercase tracking-widest text-sp-danger">{weekdayLong(today)}</span>
          <span className="sp-stat-lg">{dayOfMonth(today)}</span>
          {next ? (
            <span className="mt-1 flex min-w-0 flex-col">
              <span className="sp-small truncate font-semibold">{label(next)}</span>
              <span className="sp-caption text-sp-muted">{timeRange(next)}</span>
            </span>
          ) : (
            <span className="sp-small mt-1 text-sp-muted">Ingen flere i dag</span>
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="sp-body-strong">I morgen</span>
          {t.shown.length === 0 && <span className="sp-small text-sp-muted">Intet i kalenderen</span>}
          {t.shown.map((e, i) => <TomorrowEvent key={`${e.sourceId}-${e.start}-${i}`} event={e} />)}
          {t.more > 0 && <span className="sp-caption text-sp-muted">+ {t.more} mere</span>}
        </span>
        {(failed || stale) && (
          <span className="sp-caption col-span-2 text-sp-muted">
            {failed ? 'Kunne ikke opdatere' : `En kalender er ${updatedLabel(stale!, now)}`}
          </span>
        )}
      </a>
    </section>
  );
}
