import { useEffect, useState } from 'react';
import { addDays, dayOfMonth, longDate, todayIso, weekdayShort } from '../lib/madplan/dates';
import { entryOn, type PlanEntry } from '../lib/madplan/model';
import { addEntry, loadEntries } from '../lib/madplan/repo';
import type { Recipe } from '../lib/recipes/model';
import { personsLabel } from '../lib/stepper';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from '../ui/sheet';
import { notify } from '../ui/toast';

const DAYS = 14;

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; entries: PlanEntry[] };

/** `Til madplan` on the recipe page: the next two weeks, free days to pick. A planned day is shown but not replaced here. */
export function PlanRecipeButton({ householdId, recipe, persons, className }: { householdId: string; recipe: Recipe; persons: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const today = todayIso();

  const load = () => {
    setState({ status: 'loading' });
    loadEntries(today, addDays(today, DAYS - 1)).then(
      (entries) => setState({ status: 'ready', entries }),
      () => setState({ status: 'error' }),
    );
  };
  useEffect(() => {
    if (open) load();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (date: string) => {
    setBusy(true);
    try {
      await addEntry(householdId, date, { recipeId: recipe.id }, persons);
      setOpen(false);
      notify(`${recipe.title} står på ${longDate(date)}.`);
    } catch {
      notify('Det lykkedes ikke. Prøv igen.');
      load(); // somebody else may have filled the day just now
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <SheetTrigger asChild>
        <Button variant="outline" className={className}>Til madplan</Button>
      </SheetTrigger>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader title="Til madplan" eyebrow={`${recipe.title} til ${personsLabel(persons)}`} />
        {state.status === 'loading' && <p role="status" className="sp-body text-sp-muted">Henter madplanen …</p>}
        {state.status === 'error' && (
          <div className="flex flex-col gap-sp-gap">
            <p role="alert" className="sp-body">Madplanen kunne ikke hentes.</p>
            <Button variant="outline" onClick={load}>Prøv igen</Button>
          </div>
        )}
        {state.status === 'ready' && (
          <ul aria-label="Vælg en dag" className="flex flex-col gap-sp-gap-row">
            {Array.from({ length: DAYS }, (_, n) => addDays(today, n)).map((date) => {
              const taken = entryOn(state.entries, date) !== null;
              return (
                <li key={date}>
                  <button
                    type="button"
                    disabled={busy || taken}
                    onClick={() => void pick(date)}
                    className="flex min-h-sp-row w-full items-center gap-3 rounded-sp-row bg-sp-surface px-3 py-2 text-left active:bg-sp-track disabled:opacity-45"
                  >
                    <span className="w-12 shrink-0 text-center">
                      <span className={date === today ? 'sp-body-strong block text-sp-primary' : 'sp-body-strong block'}>{weekdayShort(date)}</span>
                      <span className="sp-caption block text-sp-muted">{dayOfMonth(date)}</span>
                    </span>
                    <span className={taken ? 'sp-body min-w-0 flex-1 text-sp-muted' : 'sp-body-strong min-w-0 flex-1 text-sp-primary'}>
                      {taken ? 'Der er allerede en ret' : date === today ? 'I dag' : 'Ledig'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
