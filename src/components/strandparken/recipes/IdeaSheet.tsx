import { useEffect, useMemo, useState } from 'react';
import { cleanTags, normaliseTag } from '../lib/recipes/model';
import { cleanTitle, emptyIdea, ideaProblem, type Idea, type IdeaDraft } from '../lib/ideas/model';
import { deleteIdea, saveIdea } from '../lib/ideas/repo';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { DishImage } from '../ui/dish-image';
import { Field } from '../ui/field';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';
import { notify } from '../ui/toast';

type Props = {
  householdId: string;
  /** `null` with `open` adds a new idea; an idea edits it. */
  idea: Idea | null;
  /** A signed link to the idea's current photo, if it has one. */
  photoUrl?: string;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

const area = 'sp-input sp-body min-h-24 w-full resize-y rounded-sp-row bg-sp-surface px-4 py-3 text-sp-ink placeholder:text-sp-muted';

/** Add or edit a dinner idea: only the title is required (design §5.3.2). */
export function IdeaSheet({ householdId, idea, photoUrl, open, onClose, onChanged }: Props) {
  const [draft, setDraft] = useState<IdeaDraft>(emptyIdea);
  const [tagText, setTagText] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const photo = removePhoto ? undefined : preview ?? photoUrl;

  useEffect(() => {
    if (!open) return;
    setDraft(idea ? { title: idea.title, note: idea.note ?? '', tags: idea.tags } : emptyIdea);
    setTagText('');
    setShown(false);
    setFile(null);
    setRemovePhoto(false);
  }, [open, idea]);

  const withTag = () => {
    const t = normaliseTag(tagText);
    return t ? cleanTags([...draft.tags, t]) : draft.tags;
  };
  const problem = ideaProblem(draft);

  const save = async () => {
    setShown(true);
    if (problem) return;
    setBusy(true);
    try {
      await saveIdea(householdId, idea?.id ?? null, { ...draft, title: cleanTitle(draft.title), tags: withTag() }, file ? { file } : removePhoto ? { remove: true } : null, idea?.image_path ?? null);
      await onChanged();
      notify(idea ? 'Idéen er gemt.' : 'Idéen er tilføjet.');
      onClose();
    } catch {
      notify('Idéen kunne ikke gemmes. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!idea) return;
    setBusy(true);
    try {
      await deleteIdea(idea.id, idea.image_path);
      await onChanged();
      notify('Idéen er fjernet.');
      onClose();
    } catch {
      notify('Idéen står på madplanen og kan ikke fjernes endnu. Fjern den fra dagen først.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader title={idea ? 'Idé' : 'Ny idé'} />
        <form className="flex flex-col gap-sp-gap" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div>
            <Field label="Navn på idéen" placeholder="F.eks. Fiskefrikadeller med remoulade" maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-invalid={shown && !!problem} />
            {shown && problem && <p role="alert" className="sp-small mt-1 px-2 text-sp-danger">{problem}</p>}
          </div>
          <label className="flex flex-col gap-1">
            <span className="sp-small text-sp-muted">Note (valgfri)</span>
            <textarea className={area} maxLength={1000} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
          <div className="flex flex-col gap-2">
            <Field label="Tilføj tag" placeholder="Tilføj tag, f.eks. hurtig" maxLength={40} value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setDraft({ ...draft, tags: withTag() }); setTagText(''); } }} />
            {draft.tags.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Tags (tryk for at fjerne)">
                {draft.tags.map((t) => <Chip key={t} selected onClick={() => setDraft({ ...draft, tags: draft.tags.filter((x) => x !== t) })}>{t} ×</Chip>)}
              </div>
            )}
          </div>
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
          <Button type="submit" disabled={busy}>Gem</Button>
          {idea && (
            <>
              <Button asChild variant="outline"><a href={`#opskrifter/ny/${idea.id}`} onClick={onClose}>Lav til opskrift</a></Button>
              <Button variant="quiet" className="text-sp-danger" disabled={busy} onClick={() => void remove()}>Fjern idé</Button>
            </>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
