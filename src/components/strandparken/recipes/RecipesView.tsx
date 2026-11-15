import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { filterRecipes, tagsInUse } from '../lib/recipes/filter';
import type { Recipe } from '../lib/recipes/model';
import { useRecipes } from '../lib/recipes/use-recipes';
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

function RecipeCard({ recipe, photo }: { recipe: Recipe; photo?: string }) {
  return (
    <a href={`#opskrifter/${recipe.id}`} className="block overflow-hidden rounded-sp-row bg-sp-surface active:bg-sp-track">
      <div className="sp-photo-card">
        <DishImage shape="cover" src={photo} name={recipe.title} />
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
  const recipes = state.status === 'ready' ? state.recipes : [];
  const shown = useMemo(() => filterRecipes(recipes, { categoryId, tag, query }), [recipes, categoryId, tag, query]);
  const tags = useMemo(() => tagsInUse(recipes), [recipes]);

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

  if (first === 'ny' && ready) return <RecipeEditor householdId={householdId} recipe={null} categories={ready.categories} photos={ready.photos} onSaved={reload} />;
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
    return <RecipeDetail key={recipe.id} householdId={householdId} recipe={recipe} category={ready.categories.find((c) => c.id === recipe.category_id)?.name ?? null} photo={recipe.image_path ? ready.photos[recipe.image_path] : undefined} onChanged={reload} />;
  }

  return (
    <div className="flex flex-col gap-sp-gap">
      <header className="flex items-center justify-between gap-3">
        <Title>Opskrifter</Title>
        <Button asChild variant="icon" tone="add" size="lg" aria-label="Tilføj opskrift">
          <a href="#opskrifter/ny"><Icon icon={Plus} /></a>
        </Button>
      </header>

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
                  <RecipeCard recipe={r} photo={r.image_path ? ready.photos[r.image_path] : undefined} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
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
