import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { dateLine, greetingFor } from '../lib/greeting';
import { people, type Person } from '../lib/people';
import { labels, type View } from '../lib/routes';
import { ForslagView } from '../forslag/ForslagView';
import { ProfileSection } from '../settings/ProfileSection';
import { Tonight } from '../home/Tonight';
import { ListerView } from '../lister/ListerView';
import { MadplanView } from '../madplan/MadplanView';
import { RecipesView } from '../recipes/RecipesView';
import { AvatarButton } from '../ui/avatar';
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

const Empty = ({ children }: { children: ReactNode }) => <p className="sp-body text-sp-muted">{children}</p>;

function HomeView({ person, householdId }: { person: Person; householdId: string | null }) {
  const now = new Date();
  return (
    <div className="flex flex-col gap-sp-gap-home">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="sp-small text-sp-muted">{dateLine(now)}</p>
          <Title>
            {greetingFor(now)}, {people[person].name}
          </Title>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <AvatarButton person={person} label="Indstillinger" />
          </SheetTrigger>
          <SheetContent>
            <SheetHeader title="Indstillinger" />
            <div className="flex flex-col gap-sp-gap">
              <ProfileSection householdId={householdId} person={person} />
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
      </header>
      <Tonight householdId={householdId} />
    </div>
  );
}

const placeholders: Record<Exclude<View, 'hjem' | 'opskrifter' | 'madplan' | 'lister'>, string> = {
  sundhed: 'Sundhed er ikke sat op endnu.',
};

/** The five views. Placeholders only: a title and one sentence, no sample data (U6 brings the fixtures). */
export function ViewFor({ view, path, person, householdId }: { view: View; path: string[]; person: Person; householdId: string | null }) {
  if (view === 'hjem' && path[0] === 'forslag') return <ForslagView householdId={householdId} />;
  if (view === 'hjem') return <HomeView person={person} householdId={householdId} />;
  if (view === 'madplan') return <MadplanView path={path} householdId={householdId} />;
  if (view === 'lister') return <ListerView path={path} householdId={householdId} />;
  if (view === 'opskrifter') return <RecipesView path={path} householdId={householdId} />;
  return (
    <div className="flex flex-col gap-sp-gap">
      <Title>{labels[view]}</Title>
      <Empty>{placeholders[view]}</Empty>
    </div>
  );
}
