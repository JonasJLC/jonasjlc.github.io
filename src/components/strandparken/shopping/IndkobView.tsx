import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { dayTagFor, filterLabel, forIds, linesFor } from '../lib/home/missing';
import { addDays, todayIso } from '../lib/madplan/dates';
import { usePlan } from '../lib/madplan/use-plan';
import { listerHref } from '../lib/routes';
import { useRoute } from '../lib/use-route';
import { useRecipes } from '../lib/recipes/use-recipes';
import { counts, groupLines, guessCategoryId, mergeRows, pantryGroupId, type Line } from '../lib/shopping/model';
import { purchaseText } from '../lib/shopping/purchase';
import { removeRows, restoreDeleted } from '../lib/shopping/repo';
import { useShopping } from '../lib/shopping/use-shopping';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { notify } from '../ui/toast';
import { ItemSheet } from './ItemSheet';

/** The day a planned meal's item is for ("Tor"), at the right of the row (idea 8). Its own component so idea 14 can move it. */
function DayTag({ label }: { label: string }) {
  return <span className="sp-caption shrink-0 rounded-sp-pill bg-sp-track px-2 py-0.5 text-sp-muted">{label}</span>;
}

const Title = () => (
  <h1 id="view-title" tabIndex={-1} className="sp-title-page">
    Indkøb
  </h1>
);

/**
 * Indkøb: one shared list in store-walk order, ticks visible on both phones, manual items, clear with undo (design §5.3.4).
 * Inside Lister the page title belongs to `ListerView`, which passes `showTitle={false}`.
 */
export function IndkobView({ householdId, showTitle = true }: { householdId: string | null; showTitle?: boolean }) {
  const { state, reload, setStatus, addItem, setUnit, offline, pending, retry } = useShopping(householdId);
  const recipesState = useRecipes();
  const [text, setText] = useState('');
  const [open, setOpen] = useState<Line | null>(null);
  /** "Tjek at I har" starts collapsed: it is a reminder, not part of the shop. */
  const [pantryOpen, setPantryOpen] = useState(false);
  // `#lister/indkob?for=<entry>,<entry>` (from Hjem's "Mangler at handle") shows only those meals' items.
  const { query } = useRoute();
  const filter = useMemo(() => forIds(new URLSearchParams(query)), [query]);
  // Two weeks of plan entries label rows with their day, live when a meal moves on the other phone.
  const today = todayIso();
  const plan = usePlan(householdId, today, addDays(today, 13));

  const recipes = recipesState.state.status === 'ready' ? recipesState.state.recipes : [];
  const rows = state.status === 'ready' ? state.rows : [];
  const categories = state.status === 'ready' ? state.categories : [];
  const dates = state.status === 'ready' ? state.dates : null;
  const prefs = state.status === 'ready' ? state.prefs : undefined;
  const planDates = useMemo(
    () => (plan.state.status === 'ready' ? Object.fromEntries(plan.state.entries.map((e) => [e.id, e.date])) : {}),
    [plan.state],
  );
  const dateOf = (id: string): string | null => planDates[id] ?? dates?.[id] ?? null;
  const allLines = useMemo(
    () => mergeRows(rows, (id) => recipes.find((r) => r.id === id)?.title ?? null, { prefs, entryDate: (id) => dates?.[id] ?? null }),
    [rows, recipes, dates, prefs],
  );
  const filtered = filter.length > 0;
  const lines = useMemo(() => (filtered ? linesFor(allLines, filter) : allLines), [allLines, filter, filtered]);
  const groups = useMemo(() => groupLines(lines, categories), [lines, categories]);
  const { total, done } = counts(lines);
  // The sheet follows the live line, so a new unit or a tick from the other phone shows at once.
  const openLine = open ? allLines.find((l) => l.key === open.key) ?? open : null;

  if (!householdId) {
    return (
      <div className="flex flex-col gap-sp-gap">
        {showTitle && <Title />}
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
    // A manual item belongs to no meal, so the filtered view would swallow it without a word.
    if (filtered) notify('Tilføjet – vises under Vis alle');
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
        {showTitle && <Title />}
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

      {filtered && (
        <div className="flex items-center justify-between gap-3 rounded-sp-row bg-sp-primary-tint py-1 pr-1 pl-4">
          <p className="sp-small">{filterLabel(filter, dateOf, today)}</p>
          <Button variant="quiet" onClick={() => location.replace(listerHref('indkob'))}>Vis alle</Button>
        </div>
      )}

      {state.status === 'error' && (
        <Card className="flex flex-col gap-sp-gap">
          <p role="alert" className="sp-body">Indkøbslisten kunne ikke hentes.</p>
          <Button variant="outline" onClick={retry}>Prøv igen</Button>
        </Card>
      )}

      {state.status === 'ready' && filtered && lines.length === 0 && (
        <p className="sp-body text-sp-muted">Der er ingen varer til de valgte måltider på listen.</p>
      )}

      {state.status === 'ready' && !filtered && total === 0 && (
        <p className="sp-body text-sp-muted">Indkøbslisten er tom. Skriv en vare ovenfor, eller lav en liste fra madplanen.</p>
      )}

      {groups.map((g) => {
        const id = `group-${g.categoryId ?? 'none'}`;
        const isPantry = g.categoryId === pantryGroupId;
        const items = [...g.open, ...g.done];
        return (
          <section key={g.categoryId ?? 'none'} aria-labelledby={id} className="flex flex-col gap-2">
            {isPantry ? (
              <h2 id={id} className="sp-title-group">
                <button
                  type="button"
                  aria-expanded={pantryOpen}
                  aria-controls={`${id}-list`}
                  onClick={() => setPantryOpen((o) => !o)}
                  className="flex min-h-sp-target items-center gap-2 text-left"
                >
                  <Icon icon={pantryOpen ? ChevronDown : ChevronRight} size={18} />
                  {g.name} · {items.length}
                </button>
              </h2>
            ) : (
              <h2 id={id} className="sp-title-group">{g.name}</h2>
            )}
            {(!isPantry || pantryOpen) && (
              <ul id={`${id}-list`} className="overflow-hidden rounded-sp-row bg-sp-surface">
                {items.map((line) => {
                  const tag = dayTagFor(line, dateOf, today);
                  return (
                    <li key={line.key} className="flex min-h-13.5 items-center gap-1 border-t border-sp-line-soft pr-4 pl-1 first:border-t-0">
                      <Checkbox aria-labelledby={`line-${line.key}`} checked={line.checked} onCheckedChange={(c) => tick(line, c === true)} />
                      <button type="button" onClick={() => setOpen(line)} className="flex min-h-13.5 min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="min-w-0 flex-1">
                          <span id={`line-${line.key}`} className={'sp-body block font-medium ' + (line.checked ? 'text-sp-muted line-through' : '')}>{line.name}</span>
                          {!isPantry && line.dishes.length > 0 && <span className="sp-caption block text-sp-muted">{line.dishes.join(', ')}</span>}
                        </span>
                        {!isPantry && <span className="sp-small shrink-0 text-sp-muted">{purchaseText(line.purchase)}</span>}
                        {tag && <DayTag label={tag} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {lines.some((l) => l.checked) && (
        <Button variant="quiet" className="self-center" onClick={() => void clearDone()}>Ryd afkrydsede</Button>
      )}

      <ItemSheet
        line={openLine}
        categories={categories}
        prefs={prefs ?? {}}
        offline={offline}
        onClose={() => setOpen(null)}
        onChanged={reload}
        onUnit={setUnit}
        onRemove={(l) => void remove(l)}
      />
    </div>
  );
}
