import { useEffect, useRef } from 'react';
import type { Person } from '../lib/people';
import { labels } from '../lib/routes';
import { useRoute } from '../lib/use-route';
import { Toaster } from '../ui/toast';
import { BottomBar } from './BottomBar';
import { ViewFor } from './views';

/**
 * One scrolling column, fluid from 360 px and centred at 520 px from 560 px up (UI spec §4). Content never sits under the
 * fixed bar. When the view changes, the title of the new view gets focus and the document title follows.
 */
export function AppShell({ person, householdId }: { person: Person; householdId: string | null }) {
  const { view, path } = useRoute();
  const first = useRef(true);

  useEffect(() => {
    document.title = view === 'hjem' ? 'Strandparken' : `${labels[view]} · Strandparken`;
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById('view-title')?.focus();
  }, [view, path.join('/')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <main className="mx-auto w-full max-w-sp-column px-sp-page-x pt-sp-top-safe pb-sp-bar-clear">
        <ViewFor view={view} path={path} person={person} householdId={householdId} />
      </main>
      <BottomBar current={view} />
      <Toaster />
    </>
  );
}
