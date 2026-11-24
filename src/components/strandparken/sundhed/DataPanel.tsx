import { useMemo } from 'react';
import { copenhagenToday } from '../lib/health/model';
import { useHealth } from '../lib/health/use-health';
import { freshness, sourceLine, todayTiles, trend, viewerCanSee } from '../lib/health/view';
import { people, type Person } from '../lib/people';
import { ConnectSheet } from '../settings/ConnectSheet';
import { Button } from '../ui/button';
import { Sheet, SheetTrigger } from '../ui/sheet';
import { MetricTile, TileSkeleton } from './MetricTile';
import { SharingSettings } from './SharingSettings';
import { TrendBars } from './TrendBars';

type Props = {
  householdId: string | null;
  /** Whose numbers to show. */
  person: Person;
  /** The signed-in person. */
  me: Person;
};

const Note = ({ children }: { children: React.ReactNode }) => <p className="sp-body text-sp-muted">{children}</p>;

/**
 * Sundhed › Data (idea 11): the source line, today's tiles, the 7-day trends for sleep and activity and, for the owner,
 * the sharing switches. Numbers only, no interpretation. The database already left out what the owner does not share.
 */
export function DataPanel({ householdId, person, me }: Props) {
  const isOwner = person === me;
  const name = people[person].name;
  const { days, sources, hidden, status, reload } = useHealth(householdId, person);
  const today = copenhagenToday();

  const model = useMemo(() => {
    const fresh = freshness(days, today);
    const hasCycle = days.some((d) => d.cycle_day != null);
    return {
      tiles: todayTiles(fresh.day, hidden, isOwner, hasCycle),
      sleep: hidden.includes('sleep_score') ? null : trend(days, today, 'sleep_score'),
      activity: hidden.includes('activity') ? null : trend(days, today, 'activity'),
      hasAny: days.some((d) => [d.sleep_score, d.activity, d.steps, d.cycle_day].some((v) => v != null)),
    };
  }, [days, hidden, isOwner, today]);

  const line = sourceLine(sources);

  let body: React.ReactNode;
  if (!householdId || status === 'loading') {
    body = <TileSkeleton />;
  } else if (status === 'error') {
    body = (
      <div className="flex flex-col items-start gap-3">
        <Note>Tallene kunne ikke hentes.</Note>
        <Button type="button" onClick={() => void reload()}>Prøv igen</Button>
      </div>
    );
  } else if (!viewerCanSee(hidden)) {
    body = <Note>{name} deler ikke sine tal med dig.</Note>;
  } else if (sources.length === 0 && !model.hasAny) {
    body = isOwner ? (
      <div className="flex flex-col items-start gap-3">
        <Note>Forbind en enhed for at se dine tal her.</Note>
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button">Forbind enhed</Button>
          </SheetTrigger>
          <ConnectSheet householdId={householdId} person={me} />
        </Sheet>
      </div>
    ) : (
      <Note>{name} har ikke forbundet en enhed endnu.</Note>
    );
  } else {
    body = (
      <>
        <div className="grid grid-cols-2 gap-sp-gap">
          {model.tiles.map((t) => <MetricTile key={t.key} tile={t} />)}
        </div>
        {model.sleep && <TrendBars title="Søvn, 7 dage" trend={model.sleep} />}
        {model.activity && <TrendBars title="Aktivitet, 7 dage" trend={model.activity} suffix="%" />}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-sp-gap">
      {line && status === 'ready' && <p className="sp-small text-sp-muted">{line}</p>}
      {body}
      {isOwner && householdId && status === 'ready' && <SharingSettings householdId={householdId} person={me} />}
    </div>
  );
}
