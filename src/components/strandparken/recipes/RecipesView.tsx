import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { filterRecipes, tagsInUse } from '../lib/recipes/filter';
import { smallPhotoUrl, type Recipe } from '../lib/recipes/model';
import { useRecipes } from '../lib/recipes/use-recipes';
import { runBackfill, useRunningPhotoJobs } from '../lib/recipes/photo-jobs';
import { catalog, dinnerCategoryId } from '../lib/ideas/model';
import { useIdeas } from '../lib/ideas/use-ideas';
import type { Idea } from '../lib/ideas/model';
import { Badge } from '../ui/badge';
import { SegmentedControl, SegmentedPanel } from '../ui/segmented-control';
import { IdeaSheet } from './IdeaSheet';
import { AddRecipeSheet } from './AddRecipeSheet';
import { peekPendingDraft } from '../lib/recipes/import';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Chip } from '../ui/chip';
import { DishImage } from '../ui/dish-image';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { RecipeDetail } from './RecipeDetail';
import { RecipeEditor } from './RecipeEditor';

const Title = ({ children }: { children: string }) => (
  <h1 id="view-title" tabIndex={-1} className="sp-title-page">
    {children}
  </h1>
);

function minutesLabel(r: Recipe) {
  return r.total_minutes ? `${r.total_minutes} min` : `${r.base_servings} pers.`;
}

function RecipeCard({ recipe, photo, pending }: { recipe: Recipe; photo?: string; pending?: boolean }) {
  return (
    <a href={`#opskrifter/${recipe.id}`} className="block overflow-hidden rounded-sp-row bg-sp-surface active:bg-sp-track">
      <div className="sp-photo-card">
        <DishImage shape="cover" src={photo} name={recipe.title} pending={pending} />
      </div>
      <div className="p-3">
        <p className="sp-body-strong line-clamp-2 min-h-11">{recipe.title}</p>
        <p className="sp-caption text-sp-muted">{minutesLabel(recipe)}</p>
      </div>
    </a>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-sp-gap-grid">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-52 rounded-sp-row bg-sp-track" />
      ))}
    </div>
  );
}

/** Opskrifter: the grid at `#opskrifter`, a recipe at `#opskrifter/<id>`, the editor at `…/<id>/rediger` and `#opskrifter/ny`. */
export function RecipesView({ path, householdId }: { path: string[]; householdId: string | null }) {
  const { state, reload, retry } = useRecipes();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState('alle');
  const [ideaQuery, setIdeaQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [ideaOpen, setIdeaOpen] = useState<{ idea: Idea | null } | null>(null);
  const ideasState = useIdeas();
  const fetching = useRunningPhotoJobs();
  const recipes = state.status === 'ready' ? state.recipes : [];
  const shown = useMemo(() => filterRecipes(recipes, { categoryId, tag, query }), [recipes, categoryId, tag, query]);
  const tags = useMemo(() => tagsInUse(recipes), [recipes]);

  // Once per session: recipes with a link but no photo are tried once (Idé 1). Module-level flag, so remounting does nothing.
  const loaded = state.status === 'ready';
  useEffect(() => {
    if (householdId && loaded) void runBackfill(householdId, recipes);
  }, [householdId, loaded, recipes]);

  if (!householdId) {
    return (
      <div className="flex flex-col gap-sp-gap">
        <Title>Opskrifter</Title>
        <p className="sp-body text-sp-muted">Opskrifter kræver, at appen er koblet til databasen.</p>
      </div>
    );
  }

  const [first, second] = path;
  const ready = state.status === 'ready' ? state : null;

  if (first === 'ny' && ready) return <RecipeEditor key={second ?? 'ny'} householdId={householdId} recipe={null} categories={ready.categories} photos={{ ...ready.photos, ...ideasState.photos }} fromIdea={ideasState.ideas.find((i) => i.id === second) ?? null} imported={second === 'importeret' ? peekPendingDraft() : null} onSaved={async () => { await reload(); await ideasState.reload(); }} />;
  if (first && first !== 'ny') {
    if (!ready) return state.status === 'error' ? <ErrorBlock onRetry={retry} /> : <Skeleton />;
    const recipe = ready.recipes.find((r) => r.id === first);
    if (!recipe) {
      return (
        <div className="flex flex-col gap-sp-gap">
          <Title>Opskriften findes ikke</Title>
          <p className="sp-body text-sp-muted">Den er måske slettet, eller linket er forkert.</p>
          <Button asChild variant="outline"><a href="#opskrifter">Til opskrifterne</a></Button>
        </div>
      );
    }
    if (second === 'rediger') return <RecipeEditor householdId={householdId} recipe={recipe} categories={ready.categories} photos={ready.photos} onSaved={reload} />;
    return <RecipeDetail key={recipe.id} householdId={householdId} recipe={recipe} category={ready.categories.find((c) => c.id === recipe.category_id)?.name ?? null} photo={recipe.image_path ? ready.photos[recipe.image_path] : undefined} pending={fetching.has(recipe.id)} onChanged={reload} />;
  }

  return (
    <div className="flex flex-col gap-sp-gap">
      <header className="flex items-center justify-between gap-3">
        <Title>Opskrifter</Title>
        <Button variant="icon" tone="add" size="lg" aria-label="Tilføj opskrift" onClick={() => setAdding(true)}>
          <Icon icon={Plus} />
        </Button>
      </header>

      <SegmentedControl aria-label="Visning" value={segment} onValueChange={setSegment} options={[{ value: 'alle', label: 'Alle' }, { value: 'ideer', label: 'Aftensmadsidéer' }]}>
        <SegmentedPanel value="alle" className="flex flex-col gap-sp-gap pt-sp-gap">
        {state.status === 'loading' && <Skeleton />}
        {state.status === 'error' && <ErrorBlock onRetry={retry} />}

        {ready && ready.recipes.filter((r) => !r.archived_at).length === 0 && (
          <Card className="flex flex-col gap-sp-gap">
            <p className="sp-body">Her samles jeres opskrifter. Skriv den første, så er den klar til madplanen.</p>
            <Button asChild inCard><a href="#opskrifter/ny">Skriv en opskrift</a></Button>
          </Card>
        )}

        {ready && ready.recipes.some((r) => !r.archived_at) && (
          <>
            <Field label="Søg i opskrifter" type="search" placeholder="Søg på navn, tag eller ingrediens" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="-mx-sp-page-x flex gap-2 overflow-x-auto px-sp-page-x" role="group" aria-label="Kategori">
              <Chip selected={categoryId === null} onClick={() => setCategoryId(null)}>Alle</Chip>
              {ready.categories.map((c) => (
                <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>{c.name}</Chip>
              ))}
            </div>
            {tags.length > 0 && (
              <div className="-mx-sp-page-x flex gap-2 overflow-x-auto px-sp-page-x" role="group" aria-label="Tags">
                {tags.map((t) => (
                  <Chip key={t} selected={tag === t} onClick={() => setTag(tag === t ? null : t)}>{t}</Chip>
                ))}
              </div>
            )}
            {shown.length === 0 ? (
              <p role="status" className="sp-body text-sp-muted">Ingen opskrifter passer. Prøv at fjerne et filter.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-sp-gap-grid" aria-label="Opskrifter">
                {shown.map((r) => (
                  <li key={r.id}>
                    <RecipeCard recipe={r} photo={smallPhotoUrl(ready.photos, r.thumb_path, r.image_path)} pending={fetching.has(r.id)} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        </SegmentedPanel>
        <SegmentedPanel value="ideer" className="flex flex-col gap-sp-gap pt-sp-gap">
          {ready && (
            <>
              <Button onClick={() => setIdeaOpen({ idea: null })}>Tilføj idé</Button>
              <Field label="Søg i aftensmadsidéer" type="search" placeholder="Søg på navn eller tag" value={ideaQuery} onChange={(e) => setIdeaQuery(e.target.value)} />
              {(() => {
                const items = catalog(ready.recipes, ideasState.ideas, dinnerCategoryId(ready.categories), ideaQuery);
                if (items.length === 0) {
                  return <p role="status" className="sp-body text-sp-muted">{ideaQuery.trim() ? 'Intet passer.' : 'Her samles alt, I kan finde på at lave til aftensmad. Skriv den første idé, så er den klar til madplanen.'}</p>;
                }
                return (
                  <ul className="grid grid-cols-2 gap-sp-gap-grid" aria-label="Aftensmadsidéer">
                    {items.map((item) => (
                      <li key={item.kind === 'recipe' ? item.recipe.id : item.idea.id}>
                        {item.kind === 'recipe' ? (
                          <RecipeCard recipe={item.recipe} photo={smallPhotoUrl(ready.photos, item.recipe.thumb_path, item.recipe.image_path)} pending={fetching.has(item.recipe.id)} />
                        ) : (
                          <button type="button" onClick={() => setIdeaOpen({ idea: item.idea })} className="sp-border-strong flex h-full min-h-52 w-full flex-col items-start justify-between gap-3 rounded-sp-row border-dashed border-sp-dash p-3 text-left active:bg-sp-track">
                            <Badge>Idé</Badge>
                            {item.idea.image_path && ideasState.photos[item.idea.image_path] && (
                              <span className="block aspect-video w-full overflow-hidden rounded-sp-inset"><DishImage shape="cover" src={ideasState.photos[item.idea.image_path]} name={item.idea.title} /></span>
                            )}
                            <span className="sp-title-card line-clamp-4">{item.idea.title}</span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </>
          )}
          {state.status === 'loading' && <Skeleton />}
        </SegmentedPanel>
      </SegmentedControl>

      <AddRecipeSheet open={adding} categories={state.status === 'ready' ? state.categories : []} recipes={recipes} onClose={() => setAdding(false)} />
      <IdeaSheet householdId={householdId} idea={ideaOpen?.idea ?? null} photoUrl={ideaOpen?.idea?.image_path ? ideasState.photos[ideaOpen.idea.image_path] : undefined} open={ideaOpen !== null} onClose={() => setIdeaOpen(null)} onChanged={ideasState.reload} />
    </div>
  );
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="flex flex-col gap-sp-gap">
      <p role="alert" className="sp-body">Opskrifterne kunne ikke hentes.</p>
      <Button variant="outline" onClick={onRetry}>Prøv igen</Button>
    </Card>
  );
}
