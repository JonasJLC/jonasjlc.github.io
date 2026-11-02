import { useDndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BedDoubleIcon, HouseIcon } from 'lucide-react';
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

/** One day of the trip as its own card: the date, the day's stops in time order, and where you sleep. */
export function DayCard({
  t, index, total, items, base, lat, lng, daysOff, stay, onBase, onNights, onAdd, renderRow,
}: {
  t: number; index: number; total: number; items: PlanItem[]; base: string; lat?: number; lng?: number; daysOff: readonly DayOff[];
  /** Set on the first night at a place: how many nights in a row, and how many the next stay leaves room for. */
  stay?: { nights: number; max: number };
  onBase: (v: Place) => void; onNights: (n: number) => void; onAdd: (type: PlanType, fly?: boolean) => void; renderRow: (it: PlanItem) => React.ReactNode;
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
            {stay && stay.max > 1 && (
              <select
                aria-label={`Antal nætter på dette sted fra dag ${index + 1}`}
                className="h-8 shrink-0 rounded-lg bg-muted px-2 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={stay.nights}
                onChange={(e) => onNights(Number(e.target.value))}
              >
                {Array.from({ length: stay.max }, (_, k) => k + 1).map((k) => (
                  <option key={k} value={k}>{k} {k === 1 ? 'nat' : 'nætter'}</option>
                ))}
              </select>
            )}
          </div>
        )}
        <AddPlan onAdd={onAdd} label="Tilføj plan" types={['oplevelse', 'mad', 'transport', 'andet']} />
      </div>
    </li>
  );
}
