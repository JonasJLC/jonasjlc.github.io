import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addDays, dayOfMonth, isIsoDate, isoWeek, longDate, mondayOf, todayIso, weekDays, weekdayShort } from '../lib/madplan/dates';
import { dishOf, entryOn, type PlanEntry } from '../lib/madplan/model';
import { usePlan } from '../lib/madplan/use-plan';
import { useProfiles } from '../lib/profile/use-profiles';
import { useIdeas } from '../lib/ideas/use-ideas';
import { useRecipes } from '../lib/recipes/use-recipes';
import { personsLabel } from '../lib/stepper';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DishImage, DishSlot } from '../ui/dish-image';
import { Icon } from '../ui/icon';
import { notify } from '../ui/toast';
import { MakeListButton } from '../shopping/ListButtons';
import { DaySheet } from './DaySheet';

const Title = () => (
  <h1 id="view-title" tabIndex={-1} className="sp-title-page">
    Madplan
  </h1>
);

/** Madplan: `#madplan` is this week, `#madplan/2026-11-16` the week containing that date. */
export function MadplanView({ path, householdId }: { path: string[]; householdId: string | null }) {
  const today = todayIso();
  const requested = path[0] && isIsoDate(path[0]) ? mondayOf(path[0]) : mondayOf(today);
  const days = useMemo(() => weekDays(requested), [requested]);
  const { state, reload, retry } = usePlan(householdId, days[0], days[6]);
  const recipesState = useRecipes();
  const { ideas } = useIdeas();
  const { dislikes } = useProfiles(householdId);
  const [open, setOpen] = useState<string | null>(null);

  if (!householdId) {
    return (
      <div className="flex flex-col gap-sp-gap">
        <Title />
        <p className="sp-body text-sp-muted">Madplanen kræver, at appen er koblet til databasen.</p>
      </div>
    );
  }

  const recipes = recipesState.state.status === 'ready' ? recipesState.state.recipes : [];
  const photos = recipesState.state.status === 'ready' ? recipesState.state.photos : {};
  const entries = state.status === 'ready' ? state.entries : [];
  const thisWeek = mondayOf(today);
  const hrefFor = (monday: string) => (monday === thisWeek ? '#madplan' : `#madplan/${monday}`);

  const changed = async (message: string, undo?: () => Promise<void>) => {
    await reload();
    notify(message, undo ? { onUndo: () => void undo().then(reload).catch(() => notify('Det lykkedes ikke. Prøv igen.')) } : {});
  };

  return (
    <div className="flex flex-col gap-sp-gap">
      <header className="flex items-center justify-between gap-3">
        <Title />
        <nav aria-label="Uge" className="flex items-center rounded-sp-pill bg-sp-surface">
          <a href={hrefFor(addDays(requested, -7))} aria-label="Forrige uge" className="inline-flex size-sp-target items-center justify-center rounded-full active:bg-sp-track">
            <Icon icon={ChevronLeft} />
          </a>
          <span aria-live="polite" className="sp-body-strong min-w-16 text-center">Uge {isoWeek(requested)}</span>
          <a href={hrefFor(addDays(requested, 7))} aria-label="Næste uge" className="inline-flex size-sp-target items-center justify-center rounded-full active:bg-sp-track">
            <Icon icon={ChevronRight} />
          </a>
        </nav>
      </header>

      {requested !== thisWeek && (
        <Button asChild variant="quiet" className="self-start">
          <a href="#madplan">Tilbage til denne uge</a>
        </Button>
      )}

      {state.status === 'error' && (
        <Card className="flex flex-col gap-sp-gap">
          <p role="alert" className="sp-body">Madplanen kunne ikke hentes.</p>
          <Button variant="outline" onClick={retry}>Prøv igen</Button>
        </Card>
      )}

      {state.status !== 'error' && (
        <ul aria-label="Ugens aftensmad" className="flex flex-col gap-sp-gap-row">
          {days.map((date) => (
            <li key={date}>
              <DayRow
                date={date}
                isToday={date === today}
                entry={state.status === 'ready' ? entryOn(entries, date) : null}
                loading={state.status === 'loading'}
                recipes={recipes}
                ideas={ideas}
                photos={photos}
                onOpen={() => setOpen(date)}
              />
            </li>
          ))}
        </ul>
      )}

      {state.status === 'ready' && <MakeListButton householdId={householdId} entries={entries} recipes={recipes} />}

      <DaySheet
        householdId={householdId}
        date={open}
        days={days}
        entries={entries}
        recipes={recipes}
        ideas={ideas}
        dislikes={dislikes}
        photos={photos}
        onClose={() => setOpen(null)}
        onChanged={changed}
      />
    </div>
  );
}

type RowProps = {
  date: string;
  isToday: boolean;
  entry: PlanEntry | null;
  loading: boolean;
  recipes: Parameters<typeof dishOf>[1];
  ideas: Parameters<typeof dishOf>[2];
  photos: Record<string, string>;
  onOpen: () => void;
};

function DayRow({ date, isToday, entry, loading, recipes, ideas, photos, onOpen }: RowProps) {
  const dish = entry ? dishOf(entry, recipes, ideas) : null;
  const photo = dish?.recipe?.image_path ? photos[dish.recipe.image_path] : undefined;
  return (
    <div className="flex items-center gap-3">
      <div className="sp-sheet-date sp-col-date shrink-0 text-center" aria-hidden="true">
        <p className={isToday ? 'sp-body-strong text-sp-primary' : 'sp-body-strong'}>{weekdayShort(date)}</p>
        <p className="sp-caption text-sp-muted">{dayOfMonth(date)}</p>
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={onOpen}
        aria-label={dish && entry ? `${longDate(date)}: ${dish.title}, ${personsLabel(entry.servings ?? 2)}. Åbn` : `${longDate(date)}: tilføj ret`}
        className={
          'flex min-h-sp-row min-w-0 flex-1 items-center gap-3 rounded-sp-row px-3 py-2 text-left ' +
          (entry ? 'bg-sp-surface active:bg-sp-track ' : 'sp-border-strong border-dashed border-sp-dash active:bg-sp-track ') +
          (isToday ? 'sp-ring-today' : '')
        }
      >
        {dish && entry ? (
          <>
            <DishImage shape="round" size={52} src={photo} name={dish.title} />
            <span className="min-w-0 flex-1">
              <span className="sp-body-strong line-clamp-2 block">{dish.title}</span>
              <span className="sp-caption block text-sp-muted">{personsLabel(entry.servings ?? 2)}</span>
            </span>
          </>
        ) : (
          <>
            <DishSlot size={52} />
            <span className="sp-body-strong min-w-0 flex-1 text-sp-primary">{loading ? '' : 'Tilføj ret'}</span>
          </>
        )}
        {isToday && <Badge tone="positive">I dag</Badge>}
      </button>
    </div>
  );
}
