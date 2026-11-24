import { Plus, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { todayIso } from '../lib/madplan/dates';
import {
  asOwner, cleanTitle, dueLabel, filterTodos, groupTodos, isOverdue, newTodoOwner, ownerLabel, owners, TITLE_MAX,
  type Owner, type Todo,
} from '../lib/todo/model';
import { useTodos } from '../lib/todo/use-todos';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Chip } from '../ui/chip';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { OwnerAvatar } from '../ui/avatar';
import { notify } from '../ui/toast';
import { TodoSheet } from './TodoSheet';

/** Swipe left past this many pixels and let go to delete; the row can travel at most `SWIPE_MAX`. */
const SWIPE_DELETE = 80;
const SWIPE_MAX = 120;

const failed = () => notify('Det lykkedes ikke. Prøv igen.');

/**
 * Lister › To-do (idea 5): one shared list of one-off to-dos. Quick add at the top, owner chips (none selected shows all),
 * then Snart, Når der er tid and a collapsed Klaret. Tap a row to edit it; swipe left (or "Slet" in the sheet) to delete.
 */
export function TodoView({ householdId }: { householdId: string | null }) {
  const { state, offline, add, update, toggle, remove, restore, retry } = useTodos(householdId);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<Owner>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [open, setOpen] = useState<Todo | null>(null);
  const today = todayIso();

  const todos = state.status === 'ready' ? state.todos : [];
  const groups = useMemo(() => groupTodos(filterTodos(todos, selected), today), [todos, selected, today]);
  const newOwner = newTodoOwner(selected);

  if (!householdId) {
    return <p className="sp-body text-sp-muted">To-do-listen kræver, at appen er koblet til databasen.</p>;
  }

  const submit = async () => {
    const title = cleanTitle(text);
    if (!title) return;
    setText('');
    if (!(await add(title, newOwner))) {
      setText(title);
      failed();
    }
  };

  const toggleChip = (owner: Owner) => {
    const next = new Set(selected);
    if (next.has(owner)) next.delete(owner);
    else next.add(owner);
    setSelected(next);
  };

  const tick = async (todo: Todo, done: boolean) => {
    if (!(await toggle(todo, done))) failed();
  };

  const del = async (todo: Todo) => {
    setOpen(null);
    if (!(await remove(todo))) return failed();
    notify('To-do slettet.', { onUndo: () => void restore(todo).then((ok) => ok || failed()) });
  };

  const openCount = groups.snart.length + groups.naarDerErTid.length;

  return (
    <div className="flex flex-col gap-sp-gap">
      {offline && (
        <p role="status" className="sp-small inline-block self-start rounded-sp-pill bg-sp-track px-3 py-1 text-sp-muted">
          Offline – viser senest hentede
        </p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field
          label="Tilføj to-do"
          placeholder="Tilføj to-do"
          value={text}
          maxLength={TITLE_MAX}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          action={{ label: 'Tilføj to-do til listen', icon: Plus, onClick: () => void submit() }}
        />
      </form>

      <div className="flex flex-col gap-1">
        <div role="group" aria-label="Vis to-dos for" className="flex flex-wrap gap-2">
          {owners.map((o) => (
            <Chip key={o.value} selected={selected.has(o.value)} onClick={() => toggleChip(o.value)}>{o.label}</Chip>
          ))}
        </div>
        {selected.size === 1 && <p className="sp-small text-sp-muted">Nye to-dos: {ownerLabel(newOwner)}</p>}
      </div>

      {state.status === 'loading' && <p role="status" className="sp-body text-sp-muted">Henter to-dos …</p>}

      {state.status === 'error' && (
        <Card className="flex flex-col gap-sp-gap">
          <p role="alert" className="sp-body">To-do-listen kunne ikke hentes.</p>
          <Button variant="outline" onClick={retry}>Prøv igen</Button>
        </Card>
      )}

      {state.status === 'ready' && openCount === 0 && (
        <p className="sp-body text-sp-muted">
          {selected.size === 0 ? 'Intet på listen. Skriv en to-do ovenfor.' : 'Ingen åbne to-dos her.'}
        </p>
      )}

      <Group id="todo-snart" title="Snart" todos={groups.snart} today={today} onTick={tick} onOpen={setOpen} onDelete={del} />
      <Group id="todo-tid" title="Når der er tid" todos={groups.naarDerErTid} today={today} onTick={tick} onOpen={setOpen} onDelete={del} />

      {groups.klaret.length > 0 && (
        <section aria-labelledby="todo-klaret" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 id="todo-klaret" className="sp-title-section">Klaret</h2>
            <Button variant="quiet" aria-expanded={showDone} aria-controls="todo-klaret-list" onClick={() => setShowDone(!showDone)}>
              {showDone ? 'Skjul klarede' : `Vis klarede (${groups.klaret.length})`}
            </Button>
          </div>
          {showDone && <Rows listId="todo-klaret-list" todos={groups.klaret} today={today} onTick={tick} onOpen={setOpen} onDelete={del} />}
        </section>
      )}

      <TodoSheet todo={open} onClose={() => setOpen(null)} onSave={update} onDelete={(t) => void del(t)} />
    </div>
  );
}

type RowHandlers = {
  today: string;
  onTick: (todo: Todo, done: boolean) => void;
  onOpen: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
};

function Group({ id, title, todos, ...handlers }: RowHandlers & { id: string; title: string; todos: Todo[] }) {
  if (!todos.length) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="sp-title-section">{title}</h2>
      <Rows todos={todos} {...handlers} />
    </section>
  );
}

function Rows({ todos, listId, ...handlers }: RowHandlers & { todos: Todo[]; listId?: string }) {
  return (
    <ul id={listId} className="overflow-hidden rounded-sp-row bg-sp-surface">
      <AnimatePresence initial={false}>
        {todos.map((t) => <Row key={t.id} todo={t} {...handlers} />)}
      </AnimatePresence>
    </ul>
  );
}

/**
 * One to-do. The row slides horizontally only (`dragDirectionLock`), so vertical scrolling is never captured. The red
 * layer underneath is decoration (`aria-hidden`); the sheet's "Slet" is the accessible way to delete.
 */
function Row({ todo, today, onTick, onOpen, onDelete }: RowHandlers & { todo: Todo }) {
  const reduce = useReducedMotion();
  const dragged = useRef(false);
  const done = !!todo.completed_at;
  const overdue = isOverdue(todo, today);
  const label = todo.due_date ? dueLabel(todo.due_date, today) : null;
  const titleId = `todo-${todo.id}`;

  const end = (_: unknown, info: PanInfo) => {
    if (info.offset.x <= -SWIPE_DELETE) onDelete(todo);
    // A drag ends with a click on whatever is under the finger; let the next tick of the event loop clear the flag.
    window.setTimeout(() => (dragged.current = false), 0);
  };

  return (
    <motion.li
      layout={reduce ? false : 'position'}
      exit={reduce ? undefined : { opacity: 0, x: -SWIPE_MAX, transition: { duration: 0.18 } }}
      className="relative overflow-hidden border-t border-sp-line-soft first:border-t-0"
    >
      <div aria-hidden className="absolute inset-0 flex items-center justify-end bg-sp-danger-tint pr-6 text-sp-danger">
        <Icon icon={Trash2} />
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -SWIPE_MAX, right: 0 }}
        dragElastic={0.05}
        dragSnapToOrigin
        onDragStart={() => (dragged.current = true)}
        onDragEnd={end}
        className="relative flex min-h-sp-row items-center gap-1 bg-sp-surface pr-4 pl-1 touch-pan-y"
      >
        <Checkbox aria-labelledby={titleId} checked={done} onCheckedChange={(c) => onTick(todo, c === true)} />
        <button
          type="button"
          onClick={() => !dragged.current && onOpen(todo)}
          className="flex min-h-sp-row min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span id={titleId} className={'sp-body min-w-0 flex-1 font-medium ' + (done ? 'text-sp-muted line-through' : '')}>
            {todo.title}
          </span>
          {label && (
            <span className={'sp-small shrink-0 ' + (overdue ? 'font-semibold text-sp-warn' : 'text-sp-muted')}>
              <span className="sr-only">{overdue ? 'Forfalden: ' : 'Dato: '}</span>
              {label}
            </span>
          )}
          <OwnerAvatar owner={asOwner(todo.owner)} />
        </button>
      </motion.div>
    </motion.li>
  );
}
