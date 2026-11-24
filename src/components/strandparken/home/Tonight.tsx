import { Clock, Users } from 'lucide-react';
import { addDays, dayOfMonth, mondayOf, todayIso, weekdayShort } from '../lib/madplan/dates';
import { dishOf, entryOn } from '../lib/madplan/model';
import { usePlan } from '../lib/madplan/use-plan';
import { useIdeas } from '../lib/ideas/use-ideas';
import { useRecipes } from '../lib/recipes/use-recipes';
import { personsLabel } from '../lib/stepper';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { smallPhotoUrl } from '../lib/recipes/model';
import { DishImage } from '../ui/dish-image';
import { Icon } from '../ui/icon';

/** Hjem v1 (design §5.6): tonight's dinner and the rest of the week. Tasks and habits arrive with Phase 4. */
export function Tonight({ householdId }: { householdId: string | null }) {
  const today = todayIso();
  const sunday = addDays(mondayOf(today), 6);
  const { state, retry } = usePlan(householdId, today, sunday);
  const recipesState = useRecipes();
  const { ideas, photos: ideaPhotos } = useIdeas();

  if (!householdId) return <p className="sp-body text-sp-muted">Aftensmad og ugen kræver, at appen er koblet til databasen.</p>;
  if (state.status === 'error') {
    return (
      <Card className="flex flex-col gap-sp-gap">
        <p role="alert" className="sp-body">Aftensmaden kunne ikke hentes.</p>
        <Button variant="outline" onClick={retry}>Prøv igen</Button>
      </Card>
    );
  }

  const ready = state.status === 'ready';
  const recipes = recipesState.state.status === 'ready' ? recipesState.state.recipes : [];
  const categories = recipesState.state.status === 'ready' ? recipesState.state.categories : [];
  const photos = { ...(recipesState.state.status === 'ready' ? recipesState.state.photos : {}), ...ideaPhotos };
  const entries = ready ? state.entries : [];
  const tonight = ready ? entryOn(entries, today) : null;
  const dish = tonight ? dishOf(tonight, recipes, ideas, categories) : null;
  const photo = dish ? smallPhotoUrl(photos, dish.thumbPath, dish.imagePath) : undefined;
  const rest = [1, 2, 3, 4, 5, 6].map((n) => addDays(today, n)).filter((d) => d <= sunday);

  return (
    <>
      <section aria-labelledby="tonight-title" className="flex flex-col gap-2">
        <h2 id="tonight-title" className="sp-title-section">I aften</h2>
        <Card className="flex flex-col gap-3">
          {!ready ? (
            <p className="sp-body text-sp-muted" aria-live="polite">Henter aftensmad …</p>
          ) : dish && tonight ? (
            <>
              <div className="flex items-center gap-3">
                <DishImage shape="round" size={64} src={photo} name={dish.title} placeholder={dish.placeholder} />
                <div className="min-w-0 flex-1">
                  <p className="sp-title-card line-clamp-2">{dish.title}</p>
                  <p className="sp-caption flex flex-wrap items-center gap-x-3 text-sp-muted">
                    {dish.recipe?.total_minutes ? <span className="inline-flex items-center gap-1"><Icon icon={Clock} size={14} />{dish.recipe.total_minutes} min</span> : null}
                    <span className="inline-flex items-center gap-1"><Icon icon={Users} size={14} />{personsLabel(tonight.servings ?? 2)}</span>
                  </p>
                </div>
              </div>
              {dish.recipe && <Button asChild inCard><a href={`#opskrifter/${dish.recipe.id}`}>Se opskrift</a></Button>}
            </>
          ) : (
            <>
              <p className="sp-body text-sp-muted">Der er ikke planlagt aftensmad i dag.</p>
              <Button asChild inCard><a href="#madplan">Tilføj ret</a></Button>
            </>
          )}
        </Card>
      </section>

      {rest.length > 0 && (
        <section aria-labelledby="week-title" className="flex flex-col gap-2">
          <h2 id="week-title" className="sp-title-section">Resten af ugen</h2>
          <ul className="grid grid-cols-4 gap-sp-gap-grid">
            {rest.slice(0, 4).map((date) => {
              const e = ready ? entryOn(entries, date) : null;
              const d = e ? dishOf(e, recipes, ideas, categories) : null;
              const img = d ? smallPhotoUrl(photos, d.thumbPath, d.imagePath) : undefined;
              return (
                <li key={date}>
                  <a href="#madplan" aria-label={`${weekdayShort(date)} ${dayOfMonth(date)}: ${d ? d.title : 'ingen ret planlagt'}`} className="flex h-full flex-col items-center gap-2 rounded-sp-row bg-sp-surface px-1 py-3 text-center active:bg-sp-track">
                    <span className="sp-caption text-sp-muted font-semibold">{weekdayShort(date)} {dayOfMonth(date)}</span>
                    {d ? <DishImage shape="round" size={56} src={img} name={d.title} placeholder={d.placeholder} /> : <span aria-hidden="true" className="size-14 rounded-full border-2 border-dashed border-sp-dash" />}
                    <span className="sp-caption line-clamp-2 min-h-8 leading-tight">{d ? d.title : '–'}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
