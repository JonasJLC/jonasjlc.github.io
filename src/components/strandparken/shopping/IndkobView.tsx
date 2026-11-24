import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dayTagFor, filterLabel, forIds, linesFor } from '../lib/home/missing';
import { addDays, todayIso } from '../lib/madplan/dates';
import { usePlan } from '../lib/madplan/use-plan';
import { listerHref } from '../lib/routes';
import { useRoute } from '../lib/use-route';
import { useRecipes } from '../lib/recipes/use-recipes';
import { styleFor } from '../lib/shopping/category-style';
import { counts, groupLines, guessCategoryId, mergeRows, pantryGroupId, type Line } from '../lib/shopping/model';
import { removeRows, restoreDeleted } from '../lib/shopping/repo';
import { useShopping } from '../lib/shopping/use-shopping';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { ProgressBar } from '../ui/progress-bar';
import { notify } from '../ui/toast';
import { CategoryHeading, CategoryTile } from './CategoryHeading';
import { ItemSheet } from './ItemSheet';
import { ShoppingRow } from './ShoppingRow';

/** How long a row ticked on this phone stays in place before it moves to "Købt" (idea 14). Same with reduced motion. */
const SETTLE_MS = 3000;
const HINT_KEY = 'sp-indkob-hint-seen';

function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}
function rememberHint() {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    // No storage (private window): the hint just shows again next time.
  }
}

export type ShoppingProgress = { done: number; total: number };

/**
 * Indkøb: one shared list in store-walk order, ticks visible on both phones, manual items, clear with undo (design §5.3.4).
 * The page title belongs to `ListerView`; this view reports "x af y købt" through `onProgress` for its header row and
 * draws the progress bar at its own top, right under the segmented control (idea 14).
 */
export function IndkobView({ householdId, onProgress }: { householdId: string | null; onProgress?: (p: ShoppingProgress | null) => void }) {
  const { state, reload, setStatus, addItem, setUnit, offline, pending, retry } = useShopping(householdId);
  const recipesState = useRecipes();
  const [text, setText] = useState('');
  const [open, setOpen] = useState<Line | null>(null);
  /** "Tjek at I har" starts collapsed: it is a reminder, not part of the shop. So does "Købt". */
  const [pantryOpen, setPantryOpen] = useState(false);
  const [boughtOpen, setBoughtOpen] = useState(false);
  const [hint, setHint] = useState(() => !hintSeen());
  // Lines ticked on this phone in the last few seconds stay in place, shown ticked. A tick from the other phone
  // arrives through realtime without a key here, so it moves straight away.
  const [settling, setSettling] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const id of t.values()) clearTimeout(id);
      t.clear();
    };
  }, []);
  const unsettle = useCallback((key: string) => {
    const t = timers.current.get(key);
    if (t) clearTimeout(t);
    timers.current.delete(key);
    setSettling((s) => {
      if (!s.has(key)) return s;
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  }, []);

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
  const { groups, bought } = useMemo(() => groupLines(lines, categories, { doneSeparately: true, settling }), [lines, categories, settling]);
  const { total, done } = counts(lines);
  const ready = state.status === 'ready';
  // The sheet follows the live line, so a new unit or a tick from the other phone shows at once.
  const openLine = open ? allLines.find((l) => l.key === open.key) ?? open : null;
  const toneOf = (line: Line) => styleFor(line.categoryId ? categories.find((c) => c.id === line.categoryId)?.name : null).tone;

  useEffect(() => {
    onProgress?.(ready && total > 0 ? { done, total } : null);
  }, [onProgress, ready, done, total]);
  useEffect(() => () => onProgress?.(null), [onProgress]);

  if (!householdId) {
    return <p className="sp-body text-sp-muted">Indkøbslisten kræver, at appen er koblet til databasen.</p>;
  }

  const failed = () => notify('Det lykkedes ikke. Prøv igen.');

  const tick = (line: Line, checked: boolean) => {
    if (checked && !line.pantry) {
      unsettle(line.key);
      setSettling((s) => new Set(s).add(line.key));
      timers.current.set(line.key, setTimeout(() => unsettle(line.key), SETTLE_MS));
    } else unsettle(line.key);
    void setStatus(line.rows.map((r) => r.id), checked ? 'checked' : 'active');
  };

  const openSheet = (line: Line) => {
    setOpen(line);
    if (hint) {
      setHint(false);
      rememberHint();
    }
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

  const row = (line: Line, tone = toneOf(line)) => (
    <ShoppingRow key={line.key} line={line} tone={tone} dayTag={dayTagFor(line, dateOf, today)} onTick={tick} onOpen={openSheet} />
  );

  const disclosure = (id: string, name: string, count: number, expanded: boolean, toggle: () => void) => (
    <CategoryHeading id={id} name={name}>
      <button type="button" aria-expanded={expanded} aria-controls={`${id}-list`} onClick={toggle} className="flex min-h-sp-target flex-1 items-center gap-2.5 text-left">
        <CategoryTile name={name} />
        <span className="flex-1">{name} · {count}</span>
        <Icon icon={expanded ? ChevronDown : ChevronRight} size={18} className="text-sp-muted" />
      </button>
    </CategoryHeading>
  );

  return (
    <div className="flex flex-col gap-sp-gap">
      {ready && total > 0 && <ProgressBar value={done} max={total} label="Købt" />}

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

      {(offline || pending > 0) && (
        <p role="status" className="sp-small self-start rounded-sp-pill bg-sp-track px-3 py-1 text-sp-muted">
          {offline ? 'Offline – viser senest hentede' : 'Sender ændringer …'}
          {offline && pending > 0 ? ` · ${pending} ${pending === 1 ? 'ændring venter' : 'ændringer venter'}` : ''}
        </p>
      )}

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

      {ready && filtered && lines.length === 0 && (
        <p className="sp-body text-sp-muted">Der er ingen varer til de valgte måltider på listen.</p>
      )}

      {ready && !filtered && total === 0 && (
        <p className="sp-body text-sp-muted">Indkøbslisten er tom. Skriv en vare ovenfor, eller lav en liste fra madplanen.</p>
      )}

      {groups.map((g) => {
        const id = `group-${g.categoryId ?? 'none'}`;
        const isPantry = g.categoryId === pantryGroupId;
        const items = [...g.open, ...g.done];
        const tone = styleFor(g.name).tone;
        return (
          <section key={g.categoryId ?? 'none'} aria-labelledby={id} className="flex flex-col gap-1.5">
            {isPantry ? disclosure(id, g.name, items.length, pantryOpen, () => setPantryOpen((o) => !o)) : <CategoryHeading id={id} name={g.name} />}
            {(!isPantry || pantryOpen) && (
              <ul id={`${id}-list`} className="overflow-hidden rounded-sp-row bg-sp-surface">
                <AnimatePresence initial={false}>{items.map((line) => row(line, tone))}</AnimatePresence>
              </ul>
            )}
          </section>
        );
      })}

      {bought.length > 0 && (
        <section aria-labelledby="group-bought" className="flex flex-col gap-1.5">
          {disclosure('group-bought', 'Købt', bought.length, boughtOpen, () => setBoughtOpen((o) => !o))}
          {boughtOpen && (
            <>
              <ul id="group-bought-list" className="overflow-hidden rounded-sp-row bg-sp-surface">
                <AnimatePresence initial={false}>{bought.map((line) => row(line))}</AnimatePresence>
              </ul>
              <Button variant="quiet" className="self-center" onClick={() => void clearDone()}>Ryd afkrydsede</Button>
            </>
          )}
        </section>
      )}

      {hint && ready && total > 0 && (
        <p className="sp-caption text-center text-sp-muted">Tryk på en vare for at se, hvilke retter den er til</p>
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
