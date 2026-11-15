import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRecipes } from '../lib/recipes/use-recipes';
import { formatQuantity } from '../lib/recipes/scale';
import { counts, groupLines, guessCategoryId, mergeRows, type Line } from '../lib/shopping/model';
import { removeRows, restoreDeleted } from '../lib/shopping/repo';
import { useShopping } from '../lib/shopping/use-shopping';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Field } from '../ui/field';
import { notify } from '../ui/toast';
import { ItemSheet } from './ItemSheet';

const Title = () => (
  <h1 id="view-title" tabIndex={-1} className="sp-title-page">
    Indkøb
  </h1>
);

/** Indkøb: one shared list in store-walk order, ticks visible on both phones, manual items, clear with undo (design §5.3.4). */
export function IndkobView({ householdId }: { householdId: string | null }) {
  const { state, reload, setStatus, addItem, offline, pending, retry } = useShopping(householdId);
  const recipesState = useRecipes();
  const [text, setText] = useState('');
  const [open, setOpen] = useState<Line | null>(null);

  const recipes = recipesState.state.status === 'ready' ? recipesState.state.recipes : [];
  const rows = state.status === 'ready' ? state.rows : [];
  const categories = state.status === 'ready' ? state.categories : [];
  const lines = useMemo(
    () => mergeRows(rows, (id) => recipes.find((r) => r.id === id)?.title ?? null),
    [rows, recipes],
  );
  const groups = useMemo(() => groupLines(lines, categories), [lines, categories]);
  const { total, done } = counts(lines);

  if (!householdId) {
    return (
      <div className="flex flex-col gap-sp-gap">
        <Title />
        <p className="sp-body text-sp-muted">Indkøbslisten kræver, at appen er koblet til databasen.</p>
      </div>
    );
  }

  const failed = () => notify('Det lykkedes ikke. Prøv igen.');

  const tick = (line: Line, checked: boolean) => {
    void setStatus(line.rows.map((r) => r.id), checked ? 'checked' : 'active');
  };

  const add = async () => {
    const name = text.trim();
    if (!name) return;
    setText('');
    await addItem(name, guessCategoryId(name, categories));
  };

  const clearDone = async () => {
    const ids = lines.filter((l) => l.checked).flatMap((l) => l.rows.map((r) => r.id));
    if (!ids.length) return;
    await setStatus(ids, 'cleared');
    notify(ids.length === 1 ? '1 vare er ryddet.' : `${ids.length} varer er ryddet.`, { onUndo: () => void setStatus(ids, 'checked') });
  };

  const remove = async (line: Line) => {
    const removed = line.rows;
    setOpen(null);
    try {
      await removeRows(removed.map((r) => r.id));
      await reload();
      notify(`${line.name} er fjernet.`, { onUndo: () => void restoreDeleted(removed).then(reload).catch(failed) });
    } catch {
      failed();
    }
  };

  return (
    <div className="flex flex-col gap-sp-gap">
      <header>
        <Title />
        {(offline || pending > 0) && (
          <p role="status" className="sp-small mt-1 inline-block rounded-sp-pill bg-sp-track px-3 py-1 text-sp-muted">
            {offline ? 'Offline – viser senest hentede' : 'Sender ændringer …'}
            {offline && pending > 0 ? ` · ${pending} ${pending === 1 ? 'ændring venter' : 'ændringer venter'}` : ''}
          </p>
        )}
        {state.status === 'ready' && total > 0 && (
          <p className="sp-small text-sp-muted" aria-live="polite">{done} af {total} {total === 1 ? 'vare er' : 'varer er'} købt</p>
        )}
      </header>

      <form onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <Field
          label="Tilføj vare"
          placeholder="Tilføj vare"
          value={text}
          maxLength={200}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          action={{ label: 'Tilføj vare til listen', icon: Plus, onClick: () => void add() }}
        />
      </form>

      {state.status === 'error' && (
        <Card className="flex flex-col gap-sp-gap">
          <p role="alert" className="sp-body">Indkøbslisten kunne ikke hentes.</p>
          <Button variant="outline" onClick={retry}>Prøv igen</Button>
        </Card>
      )}

      {state.status === 'ready' && total === 0 && (
        <p className="sp-body text-sp-muted">Indkøbslisten er tom. Skriv en vare ovenfor, eller lav en liste fra madplanen.</p>
      )}

      {groups.map((g) => (
        <section key={g.categoryId ?? 'none'} aria-labelledby={`group-${g.categoryId ?? 'none'}`} className="flex flex-col gap-2">
          <h2 id={`group-${g.categoryId ?? 'none'}`} className="sp-title-group">{g.name}</h2>
          <ul className="overflow-hidden rounded-sp-row bg-sp-surface">
            {[...g.open, ...g.done].map((line) => (
              <li key={line.key} className="flex min-h-13.5 items-center gap-1 border-t border-sp-line-soft pr-4 pl-1 first:border-t-0">
                <Checkbox aria-labelledby={`line-${line.key}`} checked={line.checked} onCheckedChange={(c) => tick(line, c === true)} />
                <button type="button" onClick={() => setOpen(line)} className="flex min-h-13.5 min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span id={`line-${line.key}`} className={'sp-body block font-medium ' + (line.checked ? 'text-sp-muted line-through' : '')}>{line.name}</span>
                    {line.dishes.length > 0 && <span className="sp-caption block text-sp-muted">{line.dishes.join(', ')}</span>}
                  </span>
                  <span className="sp-small shrink-0 text-sp-muted">{formatQuantity(line.amount, line.unit)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {done > 0 && (
        <Button variant="quiet" className="self-center" onClick={() => void clearDone()}>Ryd afkrydsede</Button>
      )}

      <ItemSheet line={open} categories={categories} onClose={() => setOpen(null)} onChanged={reload} onRemove={(l) => void remove(l)} />
    </div>
  );
}
