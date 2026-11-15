import { ArrowDown, ArrowUp, ChevronLeft, Plus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ComponentProps } from 'react';
import { cleanTags, draftFromRecipe, emptyDraft, newIngredient, normaliseTag, validateDraft, type CategoryRow, type Recipe, type RecipeDraft } from '../lib/recipes/model';
import { saveRecipe } from '../lib/recipes/repo';
import { promoteIdea } from '../lib/ideas/repo';
import type { Idea } from '../lib/ideas/model';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Chip } from '../ui/chip';
import { DishImage } from '../ui/dish-image';
import { Icon } from '../ui/icon';
import { Stepper } from '../ui/stepper';
import { notify } from '../ui/toast';

const input = 'sp-input w-full rounded-sp-inset bg-sp-bg px-4 py-3 text-sp-ink placeholder:text-sp-muted';

function Labelled({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="sp-body-strong">{label}</label>
      {children(id)}
    </div>
  );
}

const Text = (props: ComponentProps<'input'>) => <input {...props} className={input} />;

type Props = {
  householdId: string;
  recipe: Recipe | null;
  categories: CategoryRow[];
  photos: Record<string, string>;
  onSaved: () => Promise<void>;
  /** Turning a dinner idea into a recipe: the draft starts from the idea, and saving moves its planned days to the recipe. */
  fromIdea?: Idea | null;
};

/** Create (`#opskrifter/ny`) or edit (`#opskrifter/<id>/rediger`) a recipe. Nothing is saved until `Gem`. */
export function RecipeEditor({ householdId, recipe, categories, photos, onSaved, fromIdea = null }: Props) {
  const [draft, setDraft] = useState<RecipeDraft>(() => (recipe ? draftFromRecipe(recipe) : { ...emptyDraft(categories.find((c) => c.name === 'Aftensmad')?.id ?? null), ...(fromIdea ? { title: fromIdea.title, descriptor: fromIdea.note ?? '', tags: fromIdea.tags } : {}), ingredients: [newIngredient()], steps: [''] }));
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [tagText, setTagText] = useState('');
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState(false);
  const problems = useMemo(() => validateDraft(draft), [draft]);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const set = (patch: Partial<RecipeDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const back = recipe ? `#opskrifter/${recipe.id}` : '#opskrifter';
  const photo = removePhoto ? undefined : preview ?? (recipe?.image_path ? photos[recipe.image_path] : undefined);
  const problemAt = (field: string, index?: number) => (shown ? problems.find((p) => p.field === field && p.index === index)?.message : undefined);

  const addTag = () => {
    const t = normaliseTag(tagText);
    if (t) set({ tags: cleanTags([...draft.tags, t]) });
    setTagText('');
  };

  const save = async () => {
    setShown(true);
    if (problems.length) return;
    setSaving(true);
    try {
      const id = await saveRecipe(householdId, {
        id: recipe?.id ?? null,
        draft: { ...draft, tags: cleanTags(tagText.trim() ? [...draft.tags, tagText] : draft.tags) },
        previous: recipe,
        photo: file ? { file } : removePhoto ? { remove: true } : null,
      });
      if (fromIdea) await promoteIdea(fromIdea.id, id);
      await onSaved();
      notify(recipe ? 'Opskriften er gemt.' : 'Opskriften er tilføjet.');
      location.hash = `#opskrifter/${id}`;
    } catch {
      notify('Opskriften kunne ikke gemmes. Prøv igen.');
      setSaving(false);
    }
  };

  const moveStep = (n: number, by: -1 | 1) => {
    const steps = [...draft.steps];
    [steps[n], steps[n + by]] = [steps[n + by], steps[n]];
    set({ steps });
  };

  return (
    <form className="flex flex-col gap-sp-gap" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <header className="flex items-center gap-3">
        <Button asChild variant="icon" aria-label="Annullér"><a href={back}><Icon icon={ChevronLeft} /></a></Button>
        <h1 id="view-title" tabIndex={-1} className="sp-title-page">{recipe ? 'Rediger opskrift' : 'Ny opskrift'}</h1>
      </header>

      <Card className="flex flex-col gap-sp-gap">
        <Labelled label="Navn">
          {(id) => <Text id={id} value={draft.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={!!problemAt('title')} autoComplete="off" />}
        </Labelled>
        {problemAt('title') && <p role="alert" className="sp-small text-sp-danger">{problemAt('title')}</p>}
        <Labelled label="Kort beskrivelse">
          {(id) => <Text id={id} value={draft.descriptor} onChange={(e) => set({ descriptor: e.target.value })} placeholder="Fx cremet pasta med hvidløg" />}
        </Labelled>

        <div className="flex items-center gap-3">
          <div className="size-20 shrink-0 overflow-hidden rounded-sp-inset"><DishImage shape="cover" src={photo} name={draft.title || '?'} /></div>
          <div className="flex flex-col items-start gap-1">
            <label className="sp-button-sm sp-border-strong inline-flex min-h-sp-target cursor-pointer items-center rounded-sp-pill border-sp-primary px-3.5 text-sp-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sp-primary active:bg-sp-track">
              {photo ? 'Skift billede' : 'Vælg billede'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemovePhoto(false); e.target.value = ''; }} />
            </label>
            {photo && <Button variant="quiet" onClick={() => { setFile(null); setRemovePhoto(true); }}>Fjern billede</Button>}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-sp-gap">
        <fieldset className="flex flex-col gap-2">
          <legend className="sp-body-strong mb-2">Kategori</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip key={c.id} selected={draft.categoryId === c.id} onClick={() => set({ categoryId: draft.categoryId === c.id ? null : c.id })}>{c.name}</Chip>
            ))}
          </div>
        </fieldset>
        <Labelled label="Tags">
          {(id) => (
            <>
              {draft.tags.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Valgte tags">
                  {draft.tags.map((t) => (
                    <li key={t}>
                      <button type="button" aria-label={`Fjern tag ${t}`} onClick={() => set({ tags: draft.tags.filter((x) => x !== t) })} className="sp-caption-strong inline-flex min-h-sp-target items-center gap-1 rounded-sp-pill bg-sp-track px-3 active:bg-sp-line">
                        {t}<Icon icon={X} size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Text id={id} value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Fx hurtig, vegetar" />
                <Button variant="icon" tone="add" aria-label="Tilføj tag" onClick={addTag}><Icon icon={Plus} /></Button>
              </div>
            </>
          )}
        </Labelled>
        <Stepper value={draft.baseServings} onChange={(baseServings) => set({ baseServings })} limits={{ min: 1, max: 24 }} />
        <Labelled label="Samlet tid i minutter">
          {(id) => <Text id={id} inputMode="numeric" value={draft.totalMinutes} onChange={(e) => set({ totalMinutes: e.target.value })} aria-invalid={!!problemAt('minutes')} />}
        </Labelled>
        {problemAt('minutes') && <p role="alert" className="sp-small text-sp-danger">{problemAt('minutes')}</p>}
      </Card>

      <Card className="flex flex-col gap-sp-gap">
        <h2 className="sp-title-section">Ingredienser</h2>
        <ul className="flex flex-col gap-sp-gap">
          {draft.ingredients.map((i, n) => {
            const patch = (p: Partial<typeof i>) => set({ ingredients: draft.ingredients.map((x) => (x.key === i.key ? { ...x, ...p } : x)) });
            const bad = problemAt('amount', n) ?? problemAt('ingredient', n);
            return (
              <li key={i.key} className="flex flex-col gap-2 border-t border-sp-line-soft pt-sp-gap first:border-t-0 first:pt-0">
                <div className="flex gap-2">
                  <input aria-label={`Mængde, ingrediens ${n + 1}`} inputMode="decimal" placeholder="Mængde" value={i.amount} onChange={(e) => patch({ amount: e.target.value })} className={`${input} w-24 shrink-0`} aria-invalid={!!bad} />
                  <input aria-label={`Enhed, ingrediens ${n + 1}`} placeholder="Enhed" value={i.unit} onChange={(e) => patch({ unit: e.target.value })} className={`${input} w-24 shrink-0`} />
                  <input aria-label={`Navn, ingrediens ${n + 1}`} placeholder="Ingrediens" value={i.name} onChange={(e) => patch({ name: e.target.value })} className={`${input} min-w-0 flex-1`} />
                </div>
                <div className="flex items-center gap-2">
                  <input aria-label={`Note, ingrediens ${n + 1}`} placeholder="Note (fx hakket)" value={i.note} onChange={(e) => patch({ note: e.target.value })} className={`${input} min-w-0 flex-1`} />
                  <Checkbox aria-label={`Skalerer med antal personer, ingrediens ${n + 1}`} checked={i.scales} onCheckedChange={(v) => patch({ scales: v === true })} />
                  <span className="sp-caption text-sp-muted">Skalerer</span>
                  <Button variant="icon" aria-label={`Fjern ingrediens ${n + 1}`} onClick={() => set({ ingredients: draft.ingredients.filter((x) => x.key !== i.key) })}><Icon icon={X} /></Button>
                </div>
                {bad && <p role="alert" className="sp-small text-sp-danger">{bad}</p>}
              </li>
            );
          })}
        </ul>
        <Button variant="outline" onClick={() => set({ ingredients: [...draft.ingredients, newIngredient()] })}><Icon icon={Plus} />Tilføj ingrediens</Button>
      </Card>

      <Card className="flex flex-col gap-sp-gap">
        <h2 className="sp-title-section">Fremgangsmåde</h2>
        <ol className="flex flex-col gap-sp-gap">
          {draft.steps.map((s, n) => (
            <li key={n} className="flex items-start gap-2">
              <span aria-hidden="true" className="sp-body-strong mt-2 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sp-primary-tint text-sp-primary">{n + 1}</span>
              <textarea aria-label={`Trin ${n + 1}`} rows={3} value={s} onChange={(e) => set({ steps: draft.steps.map((x, k) => (k === n ? e.target.value : x)) })} className={`${input} min-w-0 flex-1`} />
              <div className="flex flex-col">
                <Button variant="icon" aria-label={`Flyt trin ${n + 1} op`} disabled={n === 0} onClick={() => moveStep(n, -1)}><Icon icon={ArrowUp} /></Button>
                <Button variant="icon" aria-label={`Flyt trin ${n + 1} ned`} disabled={n === draft.steps.length - 1} onClick={() => moveStep(n, 1)}><Icon icon={ArrowDown} /></Button>
                <Button variant="icon" aria-label={`Fjern trin ${n + 1}`} onClick={() => set({ steps: draft.steps.filter((_, k) => k !== n) })}><Icon icon={X} /></Button>
              </div>
            </li>
          ))}
        </ol>
        <Button variant="outline" onClick={() => set({ steps: [...draft.steps, ''] })}><Icon icon={Plus} />Tilføj trin</Button>
      </Card>

      <Card className="flex flex-col gap-sp-gap">
        <Labelled label="Kilde (link)">
          {(id) => <Text id={id} type="url" inputMode="url" value={draft.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} placeholder="https://" aria-invalid={!!problemAt('source')} />}
        </Labelled>
        {problemAt('source') && <p role="alert" className="sp-small text-sp-danger">{problemAt('source')}</p>}
      </Card>

      {shown && problems.length > 0 && <p role="alert" className="sp-small text-sp-danger">Ret felterne markeret ovenfor, så kan opskriften gemmes.</p>}
      <Button type="submit" disabled={saving}>{saving ? 'Gemmer …' : 'Gem'}</Button>
      <Button asChild variant="quiet"><a href={back}>Annullér</a></Button>
    </form>
  );
}
