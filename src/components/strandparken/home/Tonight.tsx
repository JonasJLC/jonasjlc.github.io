import { CalendarPlus, ChevronRight } from 'lucide-react';
import { todayIso } from '../lib/madplan/dates';
import { usePlan } from '../lib/madplan/use-plan';
import { useIdeas } from '../lib/ideas/use-ideas';
import { useRecipes } from '../lib/recipes/use-recipes';
import { tonightCard } from '../lib/home/tonight';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DishImage } from '../ui/dish-image';
import { Icon } from '../ui/icon';

/**
 * Hjem's "I aften" (idea 6): one compact card for today's dinner. The whole card is the link: a recipe opens the recipe,
 * an idea or free text opens today's Madplan sheet. Nothing planned shows a dashed card that leads to planning it.
 */
export function Tonight({ householdId }: { householdId: string | null }) {
  const today = todayIso();
  const { state, retry } = usePlan(householdId, today, today);
  const recipesState = useRecipes();
  const { ideas, photos: ideaPhotos } = useIdeas();

  if (!householdId) return <p className="sp-body text-sp-muted">Aftensmaden kræver, at appen er koblet til databasen.</p>;
  if (state.status === 'error') {
    return (
      <Card className="flex flex-col gap-sp-gap">
        <p role="alert" className="sp-body">Aftensmaden kunne ikke hentes.</p>
        <Button variant="outline" onClick={retry}>Prøv igen</Button>
      </Card>
    );
  }
  if (state.status === 'loading') {
    return (
      <Card className="flex min-h-23 items-center p-3.5 shadow-sp-hero">
        <p className="sp-body text-sp-muted" aria-live="polite">Henter aftensmad …</p>
      </Card>
    );
  }

  const r = recipesState.state.status === 'ready' ? recipesState.state : null;
  const recipes = r?.recipes ?? [];
  const categories = r?.categories ?? [];
  const photos = { ...r?.photos, ...ideaPhotos };
  const card = tonightCard(state.entries, recipes, ideas, photos, today, categories);

  if (card.kind === 'empty') {
    return (
      <section aria-labelledby="tonight-title" className="sp-border-strong flex flex-col items-start gap-2 rounded-sp-card border-dashed border-sp-dash p-sp-pad-card">
        <Icon icon={CalendarPlus} className="text-sp-primary" />
        <h2 id="tonight-title" className="sp-title-section">Hvad skal I have i aften?</h2>
        <p className="sp-body text-sp-muted">Der er ikke planlagt noget til {card.weekdayLong} endnu.</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          <Button asChild inCard><a href={card.href}>Planlæg i aften</a></Button>
          <Button asChild variant="quiet"><a href="#opskrifter">Vælg fra opskrifter</a></Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="I aften">
      <a
        href={card.href}
        aria-label={card.label}
        className="flex min-h-23 items-center gap-3 rounded-sp-card bg-sp-surface p-3.5 shadow-sp-hero active:bg-sp-track"
      >
        <span className="size-16 shrink-0 overflow-hidden rounded-sp-inset">
          <DishImage shape="cover" src={card.photo} name={card.title} placeholder={card.placeholder} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="sp-caption text-sp-muted">I aften</span>
          <span className="sp-body-strong line-clamp-2">{card.title}</span>
          <span className="sp-small text-sp-muted">{card.meta}</span>
        </span>
        <Icon icon={ChevronRight} className="shrink-0 text-sp-muted" />
      </a>
    </section>
  );
}
