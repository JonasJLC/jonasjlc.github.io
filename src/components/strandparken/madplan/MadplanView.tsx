import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, pointerWithin, useDraggable, useDroppable,
  useSensor, useSensors, type Announcements, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { tapHaptic } from '../lib/haptics';
import { addDays, dayOfMonth, isIsoDate, isoWeek, longDate, mondayOf, todayIso, weekDays, weekdayLong, weekdayShort, type IsoDate } from '../lib/madplan/dates';
import { applyOutcome, dayDroppable, dayOfDroppable, dropOutcome, edgeWeek, moveMessage, type DropOutcome } from '../lib/madplan/drag';
import { type Dish, dishOf, entryOn, type PlanEntry } from '../lib/madplan/model';
import { loadEntries, persistOutcome } from '../lib/madplan/repo';
import { usePlan } from '../lib/madplan/use-plan';
import { useProfiles } from '../lib/profile/use-profiles';
import { useIdeas } from '../lib/ideas/use-ideas';
import { useRecipes } from '../lib/recipes/use-recipes';
import { personsLabel } from '../lib/stepper';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { smallPhotoUrl } from '../lib/recipes/model';
import { DishImage, DishSlot } from '../ui/dish-image';
import { Icon } from '../ui/icon';
import { notify } from '../ui/toast';
import { MakeListButton } from '../shopping/ListButtons';
import { DaySheet } from './DaySheet';

const Title = () => (
  <h1 id="view-title" tabIndex={-1} className="sp-title-page">
    Madplan
  </h1>
);

/** Hovering a week arrow this long while dragging switches week, and again for each further week. */
const weekHoverMs = 600;

type DragData = { entry: PlanEntry; title: string };
const dragData = (data: { current?: unknown } | undefined) => (data?.current as DragData | undefined) ?? null;

// A touch or mouse drops where the pointer is; a keyboard drag has no pointer and goes to the nearest day row.
const collision: CollisionDetection = (args) =>
  args.pointerCoordinates
    ? pointerWithin(args)
    : closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => dayOfDroppable(c.id)) });

/** Arrow up and down jump one day row, instead of dnd-kit's default 25 px steps. */
const keyboardToDay: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  const down = event.code === 'ArrowDown';
  if (!down && event.code !== 'ArrowUp') return undefined;
  event.preventDefault();
  const from = context.collisionRect;
  if (!from) return undefined;
  let best: number | null = null;
  for (const c of context.droppableContainers.getEnabled()) {
    const rect = dayOfDroppable(c.id) ? context.droppableRects.get(c.id) : undefined;
    if (!rect) continue;
    const delta = rect.top - from.top;
    if ((down ? delta > 1 : delta < -1) && (best === null || Math.abs(delta) < Math.abs(best))) best = delta;
  }
  return best === null ? currentCoordinates : { x: currentCoordinates.x, y: currentCoordinates.y + best };
};

const overLabel = (id: string | number | undefined) => {
  const day = dayOfDroppable(id);
  if (day) return `Over ${weekdayLong(day)}`;
  if (id === 'week:next') return 'Over næste uge';
  if (id === 'week:prev') return 'Over forrige uge';
  return 'Ikke over en dag';
};

/**
 * Madplan: `#madplan` is this week, `#madplan/2026-11-16` the week containing that date. A planned meal can be
 * long-pressed and dragged to another day, or across weeks through the arrows (design §5.3.3).
 */
export function MadplanView({ path, householdId }: { path: string[]; householdId: string | null }) {
  const today = todayIso();
  const requested = path[0] && isIsoDate(path[0]) ? mondayOf(path[0]) : mondayOf(today);
  // While a drag runs, and after it lands in another week, the shown week is held here rather than in the hash: a
  // hash change would re-render the view and end the drag. The URL is updated with replaceState, which fires no
  // hashchange, so this is cleared on the next real navigation.
  const [held, setHeld] = useState<IsoDate | null>(null);
  useEffect(() => {
    const clear = () => setHeld(null);
    window.addEventListener('hashchange', clear);
    return () => window.removeEventListener('hashchange', clear);
  }, []);
  const monday = held ?? requested;
  const mondayRef = useRef(monday);
  mondayRef.current = monday;
  const days = useMemo(() => weekDays(monday), [monday]);
  const { state, reload, patch, retry } = usePlan(householdId, days[0], days[6]);
  const recipesState = useRecipes();
  const { ideas, photos: ideaPhotos } = useIdeas();
  const { dislikes, profiles } = useProfiles(householdId);
  const [open, setOpen] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DragData | null>(null);
  const hover = useRef<{ id: string | number | null; timer: number | undefined }>({ id: null, timer: undefined });
  // A keyboard drop ends on Space keydown; the keyup that follows must not "click" the row and open its sheet.
  const lastDrop = useRef(0);

  const sensors = useSensors(
    // Before 350 ms a touch is an ordinary tap or scroll; moving 8 px first cancels the long press.
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Enter keeps opening the sheet; Space lifts and drops.
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] }, coordinateGetter: keyboardToDay }),
  );

  useEffect(() => () => window.clearTimeout(hover.current.timer), []);

  if (!householdId) {
    return (
      <div className="flex flex-col gap-sp-gap">
        <Title />
        <p className="sp-body text-sp-muted">Madplanen kræver, at appen er koblet til databasen.</p>
      </div>
    );
  }

  const recipes = recipesState.state.status === 'ready' ? recipesState.state.recipes : [];
  const categories = recipesState.state.status === 'ready' ? recipesState.state.categories : [];
  const photos = { ...(recipesState.state.status === 'ready' ? recipesState.state.photos : {}), ...ideaPhotos };
  const entries = state.status === 'ready' ? state.entries : [];
  const thisWeek = mondayOf(today);
  const hrefFor = (m: string) => (m === thisWeek ? '#madplan' : `#madplan/${m}`);

  const changed = async (message: string, undo?: () => Promise<void>) => {
    await reload();
    notify(message, undo ? { onUndo: () => void undo().then(reload).catch(() => notify('Det lykkedes ikke. Prøv igen.')) } : {});
  };

  /** Move or swap: shown at once, saved, then toasted with Fortryd. Shared by drag and drop and "Flyt til…". */
  const move = async (entry: PlanEntry, outcome: Exclude<DropOutcome, { kind: 'none' }>): Promise<boolean> => {
    const message = outcome.kind === 'move' ? moveMessage('move', outcome.to) : moveMessage('swap', outcome.with.date, dishOf(outcome.with, recipes, ideas).title);
    const { run, undo } = persistOutcome(entry, outcome);
    patch((list) => applyOutcome(list, entry, outcome));
    try {
      await run();
    } catch {
      await reload();
      notify('Det lykkedes ikke. Prøv igen.');
      return false;
    }
    await changed(message, undo);
    return true;
  };

  const stopHover = () => {
    window.clearTimeout(hover.current.timer);
    hover.current = { id: null, timer: undefined };
  };
  const armHover = () => {
    window.clearTimeout(hover.current.timer);
    hover.current.timer = window.setTimeout(() => {
      const next = edgeWeek(hover.current.id, mondayRef.current);
      if (!next) return;
      setHeld(next);
      tapHaptic();
      armHover();
    }, weekHoverMs);
  };

  /** Ends a drag either way: the hash catches up with the week the drag ended in, without a scroll jump. */
  const finishDrag = () => {
    stopHover();
    setDragging(null);
    lastDrop.current = Date.now();
    const shown = mondayRef.current;
    if (location.hash !== hrefFor(shown)) history.replaceState(null, '', hrefFor(shown));
    if (shown === requested) setHeld(null);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = dragData(active.data);
    if (!data) return;
    setDragging(data);
    setHeld(mondayRef.current);
    tapHaptic();
  };

  const onDragOver = ({ over }: DragOverEvent) => {
    const id = over?.id ?? null;
    if (id === hover.current.id) return;
    stopHover();
    hover.current.id = id;
    if (edgeWeek(id, mondayRef.current)) armHover();
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const data = dragData(active.data) ?? dragging;
    finishDrag();
    const to = dayOfDroppable(over?.id);
    if (!data || !to) return;
    let weekEntries = entries;
    if (state.status !== 'ready') {
      // The week was still loading after a switch: ask for the target day itself.
      try {
        weekEntries = await loadEntries(to, to);
      } catch {
        notify('Det lykkedes ikke. Prøv igen.');
        return;
      }
    }
    const outcome = dropOutcome(data.entry.date, to, weekEntries);
    if (outcome.kind !== 'none') await move(data.entry, outcome);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const data = dragData(active.data);
      return data ? `Løftede ${data.title} fra ${weekdayLong(data.entry.date)}` : undefined;
    },
    onDragOver: ({ over }) => overLabel(over?.id),
    onDragEnd: ({ active, over }) => {
      const data = dragData(active.data);
      const to = dayOfDroppable(over?.id);
      if (!data || !to) return 'Ingen ændring';
      const outcome = dropOutcome(data.entry.date, to, entries);
      if (outcome.kind === 'none') return 'Ingen ændring';
      return outcome.kind === 'move' ? moveMessage('move', to) : moveMessage('swap', to, dishOf(outcome.with, recipes, ideas).title);
    },
    onDragCancel: () => 'Annulleret',
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      autoScroll={{ threshold: { x: 0, y: 0.15 } }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Tryk Enter for at åbne dagen. Tryk mellemrum for at løfte retten, brug pil op og ned til at vælge en dag, og tryk mellemrum igen for at slippe. Escape annullerer.',
        },
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={(e) => void onDragEnd(e)}
      onDragCancel={finishDrag}
    >
      <div className="flex flex-col gap-sp-gap">
        <header className="flex items-center justify-between gap-3">
          <Title />
          <nav aria-label="Uge" className="flex items-center rounded-sp-pill bg-sp-surface">
            <WeekArrow id="week:prev" href={hrefFor(addDays(monday, -7))} label="Forrige uge">
              <Icon icon={ChevronLeft} />
            </WeekArrow>
            <span aria-live="polite" className="sp-body-strong min-w-16 text-center">Uge {isoWeek(monday)}</span>
            <WeekArrow id="week:next" href={hrefFor(addDays(monday, 7))} label="Næste uge">
              <Icon icon={ChevronRight} />
            </WeekArrow>
          </nav>
        </header>

        {monday !== thisWeek && (
          <Button asChild variant="quiet" className="self-start">
            <a href="#madplan">Tilbage til denne uge</a>
          </Button>
        )}

        {state.status === 'error' && (
          <Card className="flex flex-col gap-sp-gap">
            <p role="alert" className="sp-body">Madplanen kunne ikke hentes.</p>
            <Button variant="outline" onClick={retry}>Prøv igen</Button>
          </Card>
        )}

        {state.status !== 'error' && (
          <ul aria-label="Ugens aftensmad" className="flex flex-col gap-sp-gap-row">
            {days.map((date) => (
              <li key={date}>
                <DayRow
                  date={date}
                  isToday={date === today}
                  entry={state.status === 'ready' ? entryOn(entries, date) : null}
                  loading={state.status === 'loading'}
                  recipes={recipes}
                  ideas={ideas}
                  categories={categories}
                  photos={photos}
                  onOpen={() => {
                    if (Date.now() - lastDrop.current > 400) setOpen(date);
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {state.status === 'ready' && <MakeListButton householdId={householdId} entries={entries} recipes={recipes} />}

        <DaySheet
          householdId={householdId}
          date={open}
          days={days}
          entries={entries}
          recipes={recipes}
          ideas={ideas}
          dislikes={dislikes}
          profiles={profiles}
          categories={categories}
          photos={photos}
          onClose={() => setOpen(null)}
          onChanged={changed}
          onMove={move}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <RowFace
            entry={dragging.entry}
            dish={dishOf(dragging.entry, recipes, ideas, categories)}
            photos={photos}
            className="sp-row-lifted bg-sp-surface"
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** A week arrow is a link and, while dragging, a drop zone that switches week after a short hover. */
function WeekArrow({ id, href, label, children }: { id: string; href: string; label: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <a
      ref={setNodeRef}
      href={href}
      aria-label={label}
      className={'inline-flex size-sp-target items-center justify-center rounded-full active:bg-sp-track ' + (isOver ? 'sp-row-drop-target' : '')}
    >
      {children}
    </a>
  );
}

/** The planned row's content, shared by the row itself and the lifted copy that follows the finger. */
function RowFace({ entry, dish, photos, className = '' }: { entry: PlanEntry; dish: Dish; photos: Record<string, string>; className?: string }) {
  return (
    <div className={'flex min-h-sp-row min-w-0 flex-1 items-center gap-3 rounded-sp-row px-3 py-2 text-left ' + className}>
      <DishImage shape="round" size={52} src={smallPhotoUrl(photos, dish.thumbPath, dish.imagePath)} name={dish.title} placeholder={dish.placeholder} />
      <span className="min-w-0 flex-1">
        <span className="sp-body-strong line-clamp-2 block">{dish.title}</span>
        <span className="sp-caption block text-sp-muted">{personsLabel(entry.servings ?? 2)}</span>
      </span>
    </div>
  );
}

type RowProps = {
  date: string;
  isToday: boolean;
  entry: PlanEntry | null;
  loading: boolean;
  recipes: Parameters<typeof dishOf>[1];
  ideas: Parameters<typeof dishOf>[2];
  categories: Parameters<typeof dishOf>[3];
  photos: Record<string, string>;
  onOpen: () => void;
};

function DayRow({ date, isToday, entry, loading, recipes, ideas, categories, photos, onOpen }: RowProps) {
  const dish = entry ? dishOf(entry, recipes, ideas, categories) : null;
  const photo = dish ? smallPhotoUrl(photos, dish.thumbPath, dish.imagePath) : undefined;
  const drop = useDroppable({ id: dayDroppable(date) });
  const drag = useDraggable({
    id: entry?.id ?? `empty:${date}`,
    disabled: !entry || loading,
    data: entry && dish ? ({ entry, title: dish.title } satisfies DragData) : undefined,
    attributes: { roleDescription: 'flytbar ret' },
  });
  const over = drop.isOver && !drag.isDragging;
  // Spread the drag handlers only on a planned row: an empty day is a drop target, never something to lift.
  const dragProps = entry && !loading ? { ...drag.attributes, ...drag.listeners } : {};
  return (
    <div ref={drop.setNodeRef} className="flex items-center gap-3">
      <div className="sp-sheet-date sp-col-date shrink-0 text-center" aria-hidden="true">
        <p className={isToday ? 'sp-body-strong text-sp-primary' : 'sp-body-strong'}>{weekdayShort(date)}</p>
        <p className="sp-caption text-sp-muted">{dayOfMonth(date)}</p>
      </div>
      <button
        type="button"
        ref={entry ? drag.setNodeRef : undefined}
        disabled={loading}
        onClick={onOpen}
        {...dragProps}
        aria-label={dish && entry ? `${longDate(date)}: ${dish.title}, ${personsLabel(entry.servings ?? 2)}. Åbn` : `${longDate(date)}: tilføj ret`}
        className={
          'sp-no-callout flex min-h-sp-row min-w-0 flex-1 touch-manipulation items-center gap-3 rounded-sp-row px-3 py-2 text-left ' +
          (over ? 'sp-row-drop-target ' : entry ? 'bg-sp-surface active:bg-sp-track ' : 'sp-border-strong border-dashed border-sp-dash active:bg-sp-track ') +
          (drag.isDragging ? 'opacity-40 ' : '') +
          (isToday && !over ? 'sp-ring-today' : '')
        }
      >
        {dish && entry ? (
          <>
            <DishImage shape="round" size={52} src={photo} name={dish.title} placeholder={dish.placeholder} />
            <span className="min-w-0 flex-1">
              <span className="sp-body-strong line-clamp-2 block">{dish.title}</span>
              <span className="sp-caption block text-sp-muted">{personsLabel(entry.servings ?? 2)}</span>
            </span>
          </>
        ) : (
          <>
            <DishSlot size={52} />
            <span className="sp-body-strong min-w-0 flex-1 text-sp-primary">{loading ? '' : 'Tilføj ret'}</span>
          </>
        )}
        {isToday && <Badge tone="positive">I dag</Badge>}
      </button>
    </div>
  );
}
