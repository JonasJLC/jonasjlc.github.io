import { Check } from 'lucide-react';
import { useMemo } from 'react';
import { addDays, todayIso } from '../lib/madplan/dates';
import { usePlan } from '../lib/madplan/use-plan';
import { useRecipes } from '../lib/recipes/use-recipes';
import { useShopping } from '../lib/shopping/use-shopping';
import { itemsLabel, missingForHome, missingHref, missingLabel, type MissingLine } from '../lib/home/missing';
import { Icon } from '../ui/icon';

const Heading = () => <h2 id="missing-title" className="sp-title-section">Mangler at handle</h2>;

/** Right-hand status of a line: the count, "Klar" with a check, or "Ikke på listen endnu". */
function Status({ line, strong, readyText }: { line: MissingLine; strong: boolean; readyText: string }) {
  if (line.notOnList) return <span className="sp-small shrink-0 text-sp-muted">Ikke på listen endnu</span>;
  if (line.ready) {
    return (
      <span className="sp-small flex shrink-0 items-center gap-1 font-semibold text-sp-primary">
        <Icon icon={Check} size={16} />
        {readyText}
      </span>
    );
  }
  return <span className={'sp-small shrink-0 ' + (strong ? 'font-semibold text-sp-warn' : 'text-sp-muted')}>{itemsLabel(line.count)}</span>;
}

/**
 * Hjem's "Mangler at handle" (idea 8): only what is still unbought for today's and tomorrow's planned recipes, never the
 * whole list. The card is one link to Indkøb filtered to those meals. Days without a planned recipe have no line, and with
 * neither line the section is left out. A loading or failing list never shows an error here; Indkøb does that.
 */
export function MissingCard({ householdId }: { householdId: string | null }) {
  const today = todayIso();
  const { state } = useShopping(householdId);
  const plan = usePlan(householdId, today, addDays(today, 1));
  const recipesState = useRecipes();

  const recipes = recipesState.state.status === 'ready' ? recipesState.state.recipes : null;
  const missing = useMemo(
    () =>
      state.status === 'ready' && plan.state.status === 'ready' && recipes
        ? missingForHome(state.rows, plan.state.entries, recipes, state.categories, today)
        : null,
    [state, plan.state, recipes, today],
  );

  if (!householdId || state.status === 'error' || plan.state.status === 'error' || recipesState.state.status === 'error') return null;
  if (!missing) {
    return (
      <section aria-labelledby="missing-title" aria-busy="true" className="flex flex-col gap-2">
        <Heading />
        <div className="flex min-h-sp-row items-center rounded-sp-card bg-sp-surface p-3.5">
          <span className="h-3 w-2/3 rounded-sp-pill bg-sp-track" />
        </div>
      </section>
    );
  }
  const { tonight, tomorrow } = missing;
  if (!tonight && !tomorrow) return null;

  return (
    <section aria-labelledby="missing-title" className="flex flex-col gap-2">
      <Heading />
      <a
        href={missingHref(missing)}
        aria-label={missingLabel(missing)}
        className="flex flex-col divide-y divide-sp-line-soft rounded-sp-card bg-sp-surface px-3.5 active:bg-sp-track"
      >
        {tonight && (
          <span className="flex flex-col py-3">
            <span className="flex items-baseline justify-between gap-3">
              <span className="sp-body-strong">Til i aften</span>
              <Status line={tonight} strong readyText="Klar til i aften" />
            </span>
            {!tonight.ready && !tonight.notOnList && (
              <span className="sp-small text-sp-muted">
                {tonight.names.join(', ')}
                {tonight.more > 0 && ` + ${tonight.more} mere`}
              </span>
            )}
          </span>
        )}
        {tomorrow && (
          <span className="flex items-baseline justify-between gap-3 py-3">
            <span className="sp-small min-w-0 truncate text-sp-muted">Til i morgen · {tomorrow.title}</span>
            <Status line={tomorrow} strong={false} readyText="Klar" />
          </span>
        )}
      </a>
    </section>
  );
}
