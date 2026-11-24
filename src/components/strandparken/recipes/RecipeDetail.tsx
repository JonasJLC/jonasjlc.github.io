import { ChevronLeft, Clock, Users } from 'lucide-react';
import { useState } from 'react';
import { formatQuantity, scaleIngredient } from '../lib/recipes/scale';
import type { Recipe } from '../lib/recipes/model';
import { PHOTO_EDGE, removePhoto, setArchived, setPhoto, uploadPhotoPair } from '../lib/recipes/repo';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DishImage } from '../ui/dish-image';
import { placeholderFor } from '../lib/recipes/placeholder';
import { Icon } from '../ui/icon';
import { SegmentedControl, SegmentedPanel } from '../ui/segmented-control';
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from '../ui/sheet';
import { RecipeActionBar } from './RecipeActionBar';
import { Stepper } from '../ui/stepper';
import { notify } from '../ui/toast';

type Props = { householdId: string | null; recipe: Recipe; category: string | null; photo?: string; /** The photo is still being fetched (Idé 1). */ pending?: boolean; onChanged: () => Promise<void> };

const heroButton = 'sp-button-sm inline-flex min-h-sp-target items-center rounded-sp-pill bg-sp-surface px-3.5 text-sp-ink shadow-sp-float active:bg-sp-track';

function Stat({ icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 px-2 py-3 not-first:border-l not-first:border-sp-line">
      <Icon icon={icon} size={18} className="text-sp-muted" />
      <span className="sp-body-strong">{value}</span>
      <span className="sp-caption text-sp-muted">{label}</span>
    </div>
  );
}

/** One recipe (UI spec §5.11): photo, overlapping sheet, persons stepper that scales the amounts, ingredients and steps. */
export function RecipeDetail({ householdId, recipe, category, photo, pending = false, onChanged }: Props) {
  const [persons, setPersons] = useState(recipe.base_servings);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const canEditPhoto = !!householdId && !recipe.archived_at;

  /** Skift billede: a photo from the library or the camera replaces the current one (1600 px plus a thumbnail). */
  const replacePhoto = async (file: File) => {
    if (!householdId) return;
    setPhotoBusy(true);
    try {
      const paths = await uploadPhotoPair(householdId, recipe.id, file, PHOTO_EDGE);
      let before;
      try {
        before = await setPhoto(recipe.id, paths);
      } catch (e) {
        await removePhoto(paths.imagePath, paths.thumbPath);
        throw e;
      }
      await removePhoto(before.image_path, before.thumb_path);
      await onChanged();
      notify('Billedet er skiftet.');
    } catch {
      notify('Billedet kunne ikke gemmes. Prøv igen.');
    } finally {
      setPhotoBusy(false);
    }
  };

  /** Fjern billede, with Fortryd: the old files are deleted only when the toast goes away without it being pressed. */
  const dropPhoto = async () => {
    setPhotoBusy(true);
    try {
      const before = await setPhoto(recipe.id, null);
      await onChanged();
      let undone = false;
      notify('Billedet er fjernet.', {
        onUndo: () => { undone = true; void setPhoto(recipe.id, before).then(onChanged).catch(() => notify('Det lykkedes ikke. Prøv igen.')); },
        onClosed: () => { if (!undone) void removePhoto(before.image_path, before.thumb_path); },
      });
    } catch {
      notify('Det lykkedes ikke. Prøv igen.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const archive = async (archived: boolean) => {
    setBusy(true);
    try {
      await setArchived(recipe.id, archived);
      await onChanged();
      if (archived) {
        notify('Opskriften er arkiveret.', { onUndo: () => void setArchived(recipe.id, false).then(onChanged) });
        location.hash = '#opskrifter';
      } else {
        notify('Opskriften er gendannet.');
      }
    } catch {
      notify('Det lykkedes ikke. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={householdId && !recipe.archived_at ? 'mb-sp-action flex flex-col' : 'flex flex-col'}>
      <div className="sp-bleed-top sp-photo-hero relative -mx-sp-page-x">
        <DishImage shape="cover" src={photo} name={recipe.title} placeholder={placeholderFor({ title: recipe.title, category, tags: recipe.tags })} pending={pending} live />
        <a
          href="#opskrifter"
          aria-label="Tilbage til opskrifter"
          className="absolute top-sp-page-top left-sp-page-x inline-flex size-11.5 items-center justify-center rounded-full bg-sp-surface text-sp-ink shadow-sp-float active:bg-sp-track"
        >
          <Icon icon={ChevronLeft} />
        </a>
        {canEditPhoto && (
          <div className="absolute top-sp-page-top right-sp-page-x flex gap-2">
            <label className={`${heroButton} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sp-primary ${photoBusy ? 'opacity-45' : ''}`}>
              Skift billede
              {/* accept="image/*": iOS offers the photo library and the camera. */}
              <input type="file" accept="image/*" className="sr-only" disabled={photoBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void replacePhoto(f); }} />
            </label>
            {recipe.image_path && <button type="button" disabled={photoBusy} onClick={() => void dropPhoto()} className={`${heroButton} disabled:opacity-45`}>Fjern billede</button>}
          </div>
        )}
      </div>

      <div className="sp-sheet-overlap relative -mx-sp-page-x flex flex-col gap-sp-gap rounded-t-sp-sheet bg-sp-surface px-sp-page-x pt-6 pb-6">
        <header className="flex flex-col gap-1">
          <h1 id="view-title" tabIndex={-1} className="sp-title-recipe">{recipe.title}</h1>
          {recipe.descriptor && <p className="sp-body text-sp-muted">{recipe.descriptor}</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            {category && <Badge>{category}</Badge>}
            {recipe.tags.map((t) => <Badge key={t}>{t}</Badge>)}
            {recipe.archived_at && <Badge tone="danger">Arkiveret</Badge>}
          </div>
        </header>

        <div className="flex border-y border-sp-line">
          <Stat icon={Clock} label="Tid" value={recipe.total_minutes ? `${recipe.total_minutes} min` : '–'} />
          <Stat icon={Users} label="Opskrift til" value={`${recipe.base_servings} pers.`} />
        </div>

        <Stepper value={persons} onChange={setPersons} />

        <SegmentedControl aria-label="Visning" defaultValue="ingredienser" options={[{ value: 'ingredienser', label: 'Ingredienser' }, { value: 'fremgang', label: 'Fremgangsmåde' }]}>
          <SegmentedPanel value="ingredienser" className="pt-sp-gap">
            {recipe.ingredients.length === 0 ? (
              <p className="sp-body text-sp-muted">Der er ingen ingredienser endnu. Tryk på Rediger for at tilføje dem.</p>
            ) : (
              <ul>
                {recipe.ingredients.map((i) => {
                  const q = formatQuantity(scaleIngredient(i, recipe.base_servings, persons), i.unit);
                  return (
                    <li key={i.id} className="flex min-h-11.5 items-baseline gap-3 border-t border-sp-line-soft py-3 first:border-t-0">
                      <span className="sp-col-amount sp-body-strong shrink-0">{q}</span>
                      <span className="sp-body min-w-0">
                        {i.name}
                        {i.note && <span className="text-sp-muted">, {i.note}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SegmentedPanel>
          <SegmentedPanel value="fremgang" className="pt-sp-gap">
            {recipe.steps.length === 0 ? (
              <p className="sp-body text-sp-muted">Der er ingen fremgangsmåde endnu. Tryk på Rediger for at skrive den.</p>
            ) : (
              <ol className="flex flex-col gap-sp-gap">
                {recipe.steps.map((s, n) => (
                  <li key={n} className="flex items-start gap-3">
                    <span aria-hidden="true" className="sp-body-strong inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sp-primary-tint text-sp-primary">{n + 1}</span>
                    <p className="sp-body min-w-0 pt-1 leading-normal">
                      <span className="sr-only">Trin {n + 1}: </span>
                      {s.text}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </SegmentedPanel>
        </SegmentedControl>

        <div className="flex flex-wrap items-center gap-2 border-t border-sp-line pt-sp-gap">
          <Button asChild variant="outline"><a href={`#opskrifter/${recipe.id}/rediger`}>Rediger</a></Button>
          {recipe.source_url && (
            <Button asChild variant="quiet"><a href={recipe.source_url} target="_blank" rel="noopener noreferrer">Se original</a></Button>
          )}
          {recipe.original_text && (
            <Sheet>
              <SheetTrigger asChild><Button variant="quiet">Original tekst</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader title="Original tekst" />
                <p className="sp-body whitespace-pre-wrap">{recipe.original_text}</p>
              </SheetContent>
            </Sheet>
          )}
          <Button variant="quiet" className="ml-auto" disabled={busy} onClick={() => void archive(!recipe.archived_at)}>
            {recipe.archived_at ? 'Gendan' : 'Arkivér'}
          </Button>
        </div>
      </div>
      {householdId && !recipe.archived_at && <RecipeActionBar householdId={householdId} recipe={recipe} persons={persons} />}
    </article>
  );
}
