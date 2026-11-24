import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { isIsoDate, longDate } from '../lib/madplan/dates';
import { asOwner, cleanNote, cleanTitle, NOTE_MAX, owners, TITLE_MAX, type Owner, type Todo } from '../lib/todo/model';
import type { TodoPatch } from '../lib/todo/repo';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { Icon } from '../ui/icon';
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet';
import { Textarea } from '../ui/textarea';

type Props = {
  todo: Todo | null;
  onClose: () => void;
  /** Resolves false when the change did not go through. */
  onSave: (todo: Todo, patch: TodoPatch) => Promise<boolean>;
  onDelete: (todo: Todo) => void;
};

const inputClass = 'sp-input h-12.5 w-full rounded-sp-pill bg-sp-surface px-5 text-sp-ink placeholder:text-sp-muted';

/** Tap a to-do: change its title, owner, due date and note, or delete it (the accessible alternative to swiping). */
export function TodoSheet({ todo, onClose, onSave, onDelete }: Props) {
  return (
    <Sheet open={todo !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {todo && <TodoForm key={todo.id} todo={todo} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
      </SheetContent>
    </Sheet>
  );
}

function TodoForm({ todo, onClose, onSave, onDelete }: Props & { todo: Todo }) {
  const [title, setTitle] = useState(todo.title);
  const [owner, setOwner] = useState<Owner>(asOwner(todo.owner));
  const [due, setDue] = useState(todo.due_date ?? '');
  const [note, setNote] = useState(todo.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const clean = cleanTitle(title);
    if (!clean) return setError('Skriv hvad der skal gøres.');
    if (due && !isIsoDate(due)) return setError('Datoen er ikke gyldig.');
    if (note.trim().length > NOTE_MAX) return setError(`Noten må højst være ${NOTE_MAX} tegn.`);
    setError(null);
    setBusy(true);
    const ok = await onSave(todo, { title: clean, owner, due_date: due || null, note: cleanNote(note) });
    setBusy(false);
    if (ok) onClose();
    else setError('Det lykkedes ikke. Prøv igen.');
  };

  return (
    <>
      <SheetHeader title="Rediger to-do" eyebrow={todo.due_date ? `Senest ${longDate(todo.due_date)}` : undefined} />
      <form className="flex flex-col gap-sp-gap" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="flex flex-col gap-1">
          <span className="sp-small text-sp-muted">Hvad skal gøres</span>
          <input className={inputClass} value={title} maxLength={TITLE_MAX} autoComplete="off" enterKeyHint="done" onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div role="group" aria-labelledby="todo-owner" className="flex flex-col gap-2">
          <span id="todo-owner" className="sp-small text-sp-muted">Hvem</span>
          <div className="flex flex-wrap gap-2">
            {owners.map((o) => (
              <Chip key={o.value} selected={owner === o.value} onClick={() => setOwner(o.value)}>{o.label}</Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="todo-due" className="sp-small text-sp-muted">Dato (valgfri)</label>
          <div className="flex items-center gap-2">
            <input id="todo-due" type="date" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} />
            {due && <Button type="button" variant="quiet" onClick={() => setDue('')}>Fjern dato</Button>}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="sp-small text-sp-muted">Note (valgfri)</span>
          <Textarea maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && <p role="alert" className="sp-small text-sp-danger">{error}</p>}

        <Button type="submit" disabled={busy}>Gem</Button>
        <button
          type="button"
          className="sp-button-sm inline-flex min-h-sp-target items-center gap-2 self-center rounded-sp-pill px-3 text-sp-danger active:bg-sp-danger-tint"
          onClick={() => onDelete(todo)}
        >
          <Icon icon={Trash2} size={18} /> Slet
        </button>
      </form>
    </>
  );
}
