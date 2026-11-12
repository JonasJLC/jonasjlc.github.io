import type { ReactNode } from 'react';
import { dateLine, greetingFor } from '../lib/greeting';
import { people, type Person } from '../lib/people';
import { labels, type View } from '../lib/routes';
import { AvatarButton } from '../ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from '../ui/sheet';

/** Every view's heading. Focus moves here when the view changes, so keyboard and screen reader users land on the new screen. */
function Title({ children }: { children: ReactNode }) {
  return (
    <h1 id="view-title" tabIndex={-1} className="sp-title-page">
      {children}
    </h1>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="sp-body text-sp-muted">{children}</p>;

function HomeView({ person }: { person: Person }) {
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
            <Empty>Her samles profil, mål og forbindelser, når de er sat op.</Empty>
          </SheetContent>
        </Sheet>
      </header>
      <Empty>Aftensmad, ugen og dagens opgaver samles her, når de er sat op.</Empty>
    </div>
  );
}

const placeholders: Record<Exclude<View, 'hjem'>, string> = {
  madplan: 'Ugens aftensmad dukker op her, når I begynder at planlægge.',
  indkob: 'Indkøbslisten er tom. Varer kommer til, når I laver en liste.',
  sundhed: 'Sundhed er ikke sat op endnu.',
  opskrifter: 'Opskrifterne dukker op her, når I har tilføjet nogle.',
};

/** The five views. Placeholders only: a title and one sentence, no sample data (U6 brings the fixtures). */
export function ViewFor({ view, person }: { view: View; person: Person }) {
  if (view === 'hjem') return <HomeView person={person} />;
  return (
    <div className="flex flex-col gap-sp-gap">
      <Title>{labels[view]}</Title>
      <Empty>{placeholders[view]}</Empty>
    </div>
  );
}
