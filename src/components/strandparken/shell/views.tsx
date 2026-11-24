import { ChevronRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { dateLine, greetingFor } from '../lib/greeting';
import { people, type Person } from '../lib/people';
import type { View } from '../lib/routes';
import { ForslagView } from '../forslag/ForslagView';
import { CalendarSheet } from '../settings/CalendarSettings';
import { ConnectSheet } from '../settings/ConnectSheet';
import { ProfileSection } from '../settings/ProfileSection';
import { connectResult, errorText, sourceNames } from '../lib/health/model';
import { syncHealth } from '../lib/health/repo';
import { useHealthSyncOnOpen } from '../lib/health/use-health';
import { notify } from '../ui/toast';
import { CalendarCard } from '../home/CalendarCard';
import { MissingCard } from '../home/MissingCard';
import { JeresDag } from '../home/JeresDag';
import { Tonight } from '../home/Tonight';
import { ListerView } from '../lister/ListerView';
import { MadplanView } from '../madplan/MadplanView';
import { RecipesView } from '../recipes/RecipesView';
import { SundhedView } from '../sundhed/SundhedView';
import { Avatar, AvatarButton } from '../ui/avatar';
import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTrigger } from '../ui/sheet';

/** Every view's heading. Focus moves here when the view changes, so keyboard and screen reader users land on the new screen. */
function Title({ children }: { children: ReactNode }) {
  return (
    <h1 id="view-title" tabIndex={-1} className="sp-title-page">
      {children}
    </h1>
  );
}

const otherPerson = (person: Person): Person => (person === 'jonas' ? 'camilla' : 'jonas');

/** After Oura's consent page the callback lands on `#hjem?forbundet=oura` (or an error): say so once, then clean the address. */
function useConnectResult() {
  useEffect(() => {
    const r = connectResult(location.hash);
    if (!r) return;
    history.replaceState(null, '', '#hjem');
    if (r.kind === 'connected') {
      notify(`${sourceNames[r.source]} er forbundet.`);
      void syncHealth(true).catch(() => null);
    } else if (r.kind === 'cancelled') {
      notify('Forbindelsen blev ikke oprettet.');
    } else {
      notify(errorText(r.code) ?? 'Forbindelsen mislykkedes. Prøv igen.');
    }
  }, []);
}

/** Settings row that opens "Forbind enheder" in its own sheet. */
function HealthRow({ person, householdId }: { person: Person; householdId: string | null }) {
  if (!householdId) return null;
  return (
    <section aria-labelledby="health-title" className="flex flex-col gap-2">
      <h3 id="health-title" className="sp-title-group">Sundhed</h3>
      <Sheet>
        <SheetTrigger asChild>
          <button type="button" className="block w-full text-left">
            <Card className="flex min-h-sp-row items-center justify-between gap-3 active:bg-sp-track">
              <span className="flex min-w-0 flex-col">
                <span className="sp-body-strong">Forbind enheder</span>
                <span className="sp-small text-sp-muted">Oura, Garmin og din cyklus</span>
              </span>
              <Icon icon={ChevronRight} className="shrink-0 text-sp-muted" />
            </Card>
          </button>
        </SheetTrigger>
        <ConnectSheet householdId={householdId} person={person} />
      </Sheet>
    </section>
  );
}

/**
 * Hjem is the household dashboard (roadmap Q7): header, Kalender, I aften, Jeres dag, Mangler at handle, about one phone
 * screen tall. Each later idea drops its section into the slot marked for it.
 */
function HomeView({ person, householdId }: { person: Person; householdId: string | null }) {
  useConnectResult();
  const now = new Date();
  const [calendarsOpen, setCalendarsOpen] = useState(false);
  return (
    <div className="flex flex-col gap-sp-gap">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="sp-small text-sp-muted">{dateLine(now)}</p>
          <Title>
            {greetingFor(now)}, {people[person].name}
          </Title>
        </div>
        {/* Both members, overlapping by a third. The other person's avatar is decorative; the signed-in person's is the settings button in front. */}
        <div className="flex shrink-0 items-center">
          <Avatar person={otherPerson(person)} decorative className="ring-2 ring-sp-bg" />
          <Sheet>
            <SheetTrigger asChild>
              <AvatarButton person={person} label="Indstillinger" className="relative -ml-3.5 ring-2 ring-sp-bg" />
            </SheetTrigger>
            <SheetContent>
              <SheetHeader title="Indstillinger" />
              <div className="flex flex-col gap-sp-gap">
                <ProfileSection householdId={householdId} person={person} />
                <HealthRow householdId={householdId} person={person} />
                <section aria-labelledby="calendars-title" className="flex flex-col gap-2">
                  <h3 id="calendars-title" className="sp-title-group">Kalendere</h3>
                  <button type="button" onClick={() => setCalendarsOpen(true)} className="block text-left">
                    <Card className="flex min-h-sp-row items-center justify-between gap-3 active:bg-sp-track">
                      <span className="flex min-w-0 flex-col">
                        <span className="sp-body-strong">Kalendere på forsiden</span>
                        <span className="sp-small text-sp-muted">Vælg hvilke kalendere der vises</span>
                      </span>
                      <Icon icon={ChevronRight} className="shrink-0 text-sp-muted" />
                    </Card>
                  </button>
                </section>
                <section aria-labelledby="forslag-title" className="flex flex-col gap-2">
                  <h3 id="forslag-title" className="sp-title-group">Forslag</h3>
                  <SheetClose asChild>
                    <a href="#hjem/forslag" className="block">
                      <Card className="flex min-h-sp-row items-center justify-between gap-3 active:bg-sp-track">
                        <span className="flex min-w-0 flex-col">
                          <span className="sp-body-strong">Ønsker til appen</span>
                          <span className="sp-small text-sp-muted">Fortæl hvad der mangler</span>
                        </span>
                        <Icon icon={ChevronRight} className="shrink-0 text-sp-muted" />
                      </Card>
                    </a>
                  </SheetClose>
                </section>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <CalendarCard householdId={householdId} onAdd={() => setCalendarsOpen(true)} />
      <CalendarSheet open={calendarsOpen} onOpenChange={setCalendarsOpen} householdId={householdId} person={person} />
      <Tonight householdId={householdId} />
      <JeresDag householdId={householdId} person={person} />
      <MissingCard householdId={householdId} />
    </div>
  );
}

/** The five views. */
export function ViewFor({ view, path, person, householdId }: { view: View; path: string[]; person: Person; householdId: string | null }) {
  useHealthSyncOnOpen(householdId);
  if (view === 'hjem' && path[0] === 'forslag') return <ForslagView householdId={householdId} />;
  if (view === 'hjem') return <HomeView person={person} householdId={householdId} />;
  if (view === 'madplan') return <MadplanView path={path} householdId={householdId} />;
  if (view === 'lister') return <ListerView path={path} householdId={householdId} />;
  if (view === 'sundhed') return <SundhedView path={path} person={person} householdId={householdId} />;
  return <RecipesView path={path} householdId={householdId} />;
}
