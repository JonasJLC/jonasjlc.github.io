import { FileText, ImagePlus, Link2, PenLine, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { detectSource, findBySource, setPendingDraft, sourceName, toDraft, type ImportedRecipe, type ImportSource } from '../lib/recipes/import';
import { ImportError, importFromImages, importFromText, importFromUrl } from '../lib/recipes/import-client';
import type { CategoryRow, Recipe } from '../lib/recipes/model';
import { dinnerCategoryId } from '../lib/ideas/model';
import { loadGroceryCategories } from '../lib/shopping/repo';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';

type Step = 'choose' | 'link' | 'text' | 'images';

const area = 'sp-input sp-body min-h-40 w-full resize-y rounded-sp-row bg-sp-surface px-4 py-3 text-sp-ink placeholder:text-sp-muted';
const MAX_IMAGES = 4;

function Option({ icon, title, hint, onClick, href }: { icon: LucideIcon; title: string; hint: string; onClick?: () => void; href?: string }) {
  const cls = 'flex min-h-sp-row w-full items-center gap-3 rounded-sp-row bg-sp-surface px-4 py-3 text-left active:bg-sp-track';
  const body = (
    <>
      <Icon icon={icon} className="text-sp-primary" />
      <span className="min-w-0 flex-1">
        <span className="sp-body-strong block">{title}</span>
        <span className="sp-caption block text-sp-muted">{hint}</span>
      </span>
    </>
  );
  return href ? <a href={href} className={cls}>{body}</a> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

/** `Tilføj opskrift`: link, pasted text, screenshots or a blank editor (design §5.3.1). Every route ends in the editor, never in a saved recipe. */
export function AddRecipeSheet({ open, categories, recipes, onClose }: { open: boolean; categories: CategoryRow[]; recipes: Recipe[]; onClose: () => void }) {
  const [step, setStep] = useState<Step>('choose');
  const [link, setLink] = useState('');
  const [source, setSource] = useState<{ url: string; source: ImportSource } | null>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Recipe | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStep('choose'); setLink(''); setSource(null); setText(''); setFiles([]); setError(null); setBusy(false); setDuplicate(null);
    }
  }, [open]);

  const finish = async (recipe: ImportedRecipe) => {
    const groceries = await loadGroceryCategories().catch(() => []);
    setPendingDraft(toDraft(recipe, dinnerCategoryId(categories), groceries));
    onClose();
    location.hash = '#opskrifter/ny/importeret';
  };

  const run = async (job: () => Promise<ImportedRecipe>) => {
    setBusy(true);
    setError(null);
    try {
      await finish(await job());
    } catch (e) {
      setError(e instanceof ImportError ? e.message : 'Importen lykkedes ikke. Prøv igen, eller skriv opskriften selv.');
      setBusy(false);
    }
  };

  /** A page is fetched and read for you; a social post cannot be, so it asks for the caption or a screenshot instead. */
  const proceed = (found: { url: string; source: ImportSource }) => {
    setSource(found);
    setDuplicate(null);
    setError(null);
    if (found.source !== 'web') {
      setStep('text');
      return;
    }
    setBusy(true);
    importFromUrl(found.url).then(finish, (e) => {
      // The site could not be read (blocked, no recipe data, too big): the pasted text is the way on.
      setError(`${e instanceof ImportError ? e.message : 'Importen lykkedes ikke.'} Kopiér i stedet opskriftens tekst herind, eller brug skærmbilleder.`);
      setStep('text');
      setBusy(false);
    });
  };

  const continueLink = () => {
    const found = detectSource(link);
    if (!found) {
      setError('Det ligner ikke et link. Indsæt hele adressen, f.eks. https://…');
      return;
    }
    const existing = findBySource(recipes, found.url);
    if (existing && duplicate?.id !== existing.id) {
      setError(null);
      setDuplicate(existing);
      return;
    }
    proceed(found);
  };

  const back = step === 'choose' ? null : () => { setStep(step === 'text' && source ? 'link' : 'choose'); setError(null); setDuplicate(null); };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader title="Tilføj opskrift" />
        <div className="flex flex-col gap-sp-gap">
          {step === 'choose' && (
            <>
              <Option icon={Link2} title="Fra et link" hint="Instagram, TikTok eller en side" onClick={() => setStep('link')} />
              <Option icon={FileText} title="Indsæt tekst" hint="En tekst under et opslag eller fra en side" onClick={() => setStep('text')} />
              <Option icon={ImagePlus} title="Upload skærmbilleder" hint="Op til 4 billeder læses for dig" onClick={() => setStep('images')} />
              <Option icon={PenLine} title="Skriv selv" hint="En tom opskrift" href="#opskrifter/ny" />
            </>
          )}

          {step === 'link' && (
            <form className="flex flex-col gap-sp-gap" onSubmit={(e) => { e.preventDefault(); continueLink(); }}>
              <Field label="Link til opskriften" type="url" inputMode="url" placeholder="Indsæt link" value={link} disabled={busy} onChange={(e) => { setLink(e.target.value); setDuplicate(null); }} />
              {duplicate && (
                <p role="status" className="sp-body">
                  Den ligger allerede: <a className="underline" href={`#opskrifter/${duplicate.id}`} onClick={onClose}>{duplicate.title}</a>. Tryk på Hent alligevel, hvis du vil have en ekstra kopi.
                </p>
              )}
              <Button type="submit" disabled={busy}>{busy ? 'Henter og læser siden …' : duplicate ? 'Hent alligevel' : 'Fortsæt'}</Button>
            </form>
          )}

          {step === 'text' && (
            <form className="flex flex-col gap-sp-gap" onSubmit={(e) => { e.preventDefault(); void run(() => importFromText(text, source?.url)); }}>
              {source && (
                <p className="sp-body text-sp-muted" role="note">
                  {source.source === 'web'
                    ? 'Linket gemmes som kilde: kopiér opskriftens tekst herind, eller brug skærmbilleder.'
                    : `${sourceName[source.source]} lader ikke andre læse opslaget. Linket gemmes som kilde: kopiér teksten under opslaget herind, eller brug et skærmbillede.`}
                </p>
              )}
              <label className="flex flex-col gap-1">
                <span className="sp-small text-sp-muted">Opskriftens tekst</span>
                <textarea className={area} maxLength={20000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Indsæt teksten her" />
              </label>
              <Button type="submit" disabled={busy || text.trim().length < 10}>{busy ? 'Læser opskriften …' : 'Læs opskriften'}</Button>
              {source && <Button variant="outline" type="button" disabled={busy} onClick={() => setStep('images')}>Brug skærmbilleder i stedet</Button>}
            </form>
          )}

          {step === 'images' && (
            <div className="flex flex-col gap-sp-gap">
              <input
                ref={picker}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                aria-label="Vælg skærmbilleder"
                onChange={(e) => { setFiles([...(e.target.files ?? [])].slice(0, MAX_IMAGES)); setError(null); }}
              />
              <Button variant="outline" disabled={busy} onClick={() => picker.current?.click()}>{files.length ? 'Vælg andre billeder' : 'Vælg billeder'}</Button>
              {files.length > 0 && (
                <ul aria-label="Valgte billeder" className="sp-small text-sp-muted">
                  {files.map((f, n) => <li key={`${f.name}-${n}`} className="truncate">{f.name}</li>)}
                </ul>
              )}
              <Button disabled={busy || files.length === 0} onClick={() => void run(() => importFromImages(files, source?.url))}>{busy ? 'Læser billederne …' : 'Læs opskriften'}</Button>
            </div>
          )}

          {error && <p role="alert" className="sp-body text-sp-danger">{error}</p>}
          {back && <Button variant="quiet" disabled={busy} className="self-start" onClick={back}>Tilbage</Button>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
