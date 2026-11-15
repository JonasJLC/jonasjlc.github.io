import { useEffect, useState } from 'react';
import { cleanTags, normaliseTag } from '../lib/recipes/model';
import { cleanTitle, emptyIdea, ideaProblem, type Idea, type IdeaDraft } from '../lib/ideas/model';
import { deleteIdea, saveIdea } from '../lib/ideas/repo';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { Field } from '../ui/field';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';
import { notify } from '../ui/toast';

type Props = {
  householdId: string;
  /** `null` with `open` adds a new idea; an idea edits it. */
  idea: Idea | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

const area = 'sp-input sp-body min-h-24 w-full resize-y rounded-sp-row bg-sp-surface px-4 py-3 text-sp-ink placeholder:text-sp-muted';

/** Add or edit a dinner idea: only the title is required (design §5.3.2). */
export function IdeaSheet({ householdId, idea, open, onClose, onChanged }: Props) {
  const [draft, setDraft] = useState<IdeaDraft>(emptyIdea);
  const [tagText, setTagText] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(idea ? { title: idea.title, note: idea.note ?? '', tags: idea.tags } : emptyIdea);
    setTagText('');
    setShown(false);
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
      await saveIdea(householdId, idea?.id ?? null, { ...draft, title: cleanTitle(draft.title), tags: withTag() });
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
      await deleteIdea(idea.id);
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
