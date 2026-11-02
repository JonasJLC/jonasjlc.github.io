import { useDndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BedDoubleIcon, HouseIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Checkbox } from '../ui/checkbox';
import { MONTHS_SHORT, WEEKDAYS, toISO } from '../lib/dates';
import { holidayName } from '../lib/holidays';
import { dayLoad, sortPlan } from '../lib/plan';
import type { DayOff, PlanItem, PlanType } from '../lib/types';
import { cn } from '../lib/utils';
import { IconChip } from '../page';
import { AddPlan } from './AddPlan';
import { PlaceInput, type Place } from './PlaceInput';

/** A sortable drop target. Its empty slot only shows while something is being dragged. */
export function DropList({ id, items, children, empty, always = false, gap = 'gap-2' }: {
  id: string; items: PlanItem[]; children: (it: PlanItem) => React.ReactNode; empty: string; always?: boolean; gap?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `list:${id}` });
  const { active } = useDndContext();
  const sorted = [...items].sort(sortPlan);
  const showEmpty = sorted.length === 0 && (always || active !== null);
  return (
    <SortableContext items={sorted.map((x) => x.id)} strategy={verticalListSortingStrategy}>
      <ul ref={setNodeRef} className={cn('flex min-h-2 flex-col rounded-xl transition-colors', gap, isOver && 'bg-data-tint')}>
        {sorted.map((it) => children(it))}
        {showEmpty && <li className="flex h-11 items-center justify-center rounded-xl border-[1.5px] border-dashed border-input text-xs text-muted-foreground">{empty}</li>}
      </ul>
    </SortableContext>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tick the other nights this stay also covers, then copy it onto all of them at once. */
function NightPicker({ nights, stay, onApply }: {
  nights: readonly { t: number; index: number }[]; stay: string; onApply: (times: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const panelId = useId();
  if (nights.length === 0) return null;
  const toggle = (t: number, on: boolean) => setPicked((s) => {
    const next = new Set(s);
    if (on) next.add(t); else next.delete(t);
    return next;
  });
  const close = () => { setOpen(false); setPicked(new Set()); };
  return (
    <div className="w-full">
      <button
        type="button"
        className="rounded-md px-1 py-1 text-xs font-medium text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:no-underline disabled:opacity-50"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={!stay.trim()}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Samme sted flere nætter
      </button>
      {open && (
        <fieldset id={panelId} className="mt-2 rounded-xl bg-muted/50 p-3">
          <legend className="px-1 text-xs text-muted-foreground">Vælg de nætter, I sover på {stay.trim()}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {nights.map(({ t, index }) => {
              const d = new Date(t);
              const id = `${panelId}-${t}`;
              return (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <Checkbox id={id} checked={picked.has(t)} onCheckedChange={(v) => toggle(t, v === true)} />
                  <label htmlFor={id} className="cursor-pointer">
                    Dag {index + 1} · {cap(WEEKDAYS[d.getUTCDay()].slice(0, 3))}. {d.getUTCDate()}. {MONTHS_SHORT[d.getUTCMonth()]}
                  </label>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              disabled={picked.size === 0}
              onClick={() => { onApply([...picked]); close(); }}
            >
              Sæt på {picked.size} {picked.size === 1 ? 'nat' : 'nætter'}
            </button>
            <button type="button" className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={close}>
              Annuller
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

/** One day of the trip as its own card: the date, the day's stops in time order, and where you sleep. */
export function DayCard({
  t, index, total, items, base, lat, lng, daysOff, otherNights, onBase, onApplyBase, onAdd, renderRow,
}: {
  t: number; index: number; total: number; items: PlanItem[]; base: string; lat?: number; lng?: number; daysOff: readonly DayOff[];
  otherNights: readonly { t: number; index: number }[];
  onBase: (v: Place) => void; onApplyBase: (times: number[]) => void; onAdd: (type: PlanType, fly?: boolean) => void; renderRow: (it: PlanItem) => React.ReactNode;
}) {
  const ds = toISO(t);
  const d = new Date(t);
  const load = dayLoad(items);
  const tags: string[] = [];
  if (index === 0) tags.push('Afrejse');
  const last = index === total - 1 && total > 1;
  if (last) tags.push('Hjemrejse');
  const hn = holidayName(t, daysOff);
  if (hn) tags.push(hn);
  const wd = WEEKDAYS[d.getUTCDay()].slice(0, 3);
  const n = items.length;
  return (
    <li id={`pday-${ds}`} className="scroll-mt-20 rounded-card bg-card p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 pb-2">
        <h3 className="text-[15px] font-semibold">Dag {index + 1}</h3>
        <p className="text-sm text-muted-foreground">{cap(wd)}. {d.getUTCDate()}. {MONTHS_SHORT[d.getUTCMonth()]}</p>
        {tags.map((x) => <span key={x} className="rounded-full bg-caution-tint px-2 py-0.5 text-[11px] font-medium text-caution">{x}</span>)}
        <span className={cn('ml-auto rounded-full px-2.5 py-0.5 text-xs', load.key === 'busy' ? 'bg-caution-tint text-caution' : 'bg-muted text-muted-foreground')}>
          {n ? `${n} ${n === 1 ? 'plan' : 'planer'}` : load.label}
        </span>
      </div>
      <DropList id={ds} items={items} empty="Slip planen her" gap="gap-0">{renderRow}</DropList>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
        {last ? (
          <p className="flex h-10 flex-1 items-center gap-2.5 px-1 text-sm text-muted-foreground">
            <IconChip tone="bg-muted text-muted-foreground"><HouseIcon /></IconChip>Hjem i dag
          </p>
        ) : (
          <div className="flex h-10 min-w-0 flex-1 basis-56 items-center gap-2.5 rounded-xl border border-transparent pr-2 pl-1 text-sm transition-colors focus-within:border-ring hover:bg-cat-overnatning-tint/50">
            <IconChip tone="bg-cat-overnatning-tint text-cat-overnatning-ink"><BedDoubleIcon /></IconChip>
            <PlaceInput value={base} lat={lat} lng={lng} label={`Hvor sover I natten efter dag ${index + 1}?`} onChange={onBase} />
          </div>
        )}
        <AddPlan onAdd={onAdd} label="Tilføj plan" types={['oplevelse', 'mad', 'transport', 'andet']} />
        {!last && <NightPicker nights={otherNights} stay={base} onApply={onApplyBase} />}
      </div>
    </li>
  );
}
