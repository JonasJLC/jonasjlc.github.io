import { useDndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BedDoubleIcon, MapPinIcon } from 'lucide-react';
import { MONTHS_SHORT, WEEKDAYS, toISO } from '../lib/dates';
import { holidayName } from '../lib/holidays';
import { dayLoad, sortPlan } from '../lib/plan';
import type { DayOff, PlanItem, PlanType } from '../lib/types';
import { cn } from '../lib/utils';
import { AddPlan } from './AddPlan';

/** A sortable drop target. Its empty slot only shows while something is being dragged. */
export function DropList({ id, items, children, empty, always = false }: {
  id: string; items: PlanItem[]; children: (it: PlanItem) => React.ReactNode; empty: string; always?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `list:${id}` });
  const { active } = useDndContext();
  const sorted = [...items].sort(sortPlan);
  const showEmpty = sorted.length === 0 && (always || active !== null);
  return (
    <SortableContext items={sorted.map((x) => x.id)} strategy={verticalListSortingStrategy}>
      <ul ref={setNodeRef} className={cn('flex min-h-2 flex-col gap-1.5 rounded-xl transition-colors', isOver && 'bg-data-tint')}>
        {sorted.map((it) => children(it))}
        {showEmpty && <li className="flex h-11 items-center justify-center rounded-xl border border-dashed border-input text-xs text-muted-foreground">{empty}</li>}
      </ul>
    </SortableContext>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One day of the trip: the date, where you sleep, and the day's plans in time order. */
export function DayCard({
  t, index, total, items, base, daysOff, onBase, onAdd, renderRow,
}: {
  t: number; index: number; total: number; items: PlanItem[]; base: string; daysOff: readonly DayOff[];
  onBase: (v: string) => void; onAdd: (type: PlanType) => void; renderRow: (it: PlanItem) => React.ReactNode;
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
  return (
    <li id={`pday-${ds}`} className="grid scroll-mt-20 gap-x-6 gap-y-2 border-t border-rule py-4 first:border-t-0 first:pt-1 sm:grid-cols-[120px_minmax(0,1fr)]">
      <div className="flex items-baseline gap-2 sm:flex-col sm:gap-0.5">
        <h3 className="text-sm font-semibold">Dag {index + 1}</h3>
        <p className="text-sm text-muted-foreground">{cap(wd)}. {d.getUTCDate()}. {MONTHS_SHORT[d.getUTCMonth()]}</p>
        {tags.length > 0 && <p className="text-xs text-caution">{tags.join(' · ')}</p>}
        <p className={cn('ml-auto text-xs sm:ml-0', load.key === 'busy' ? 'text-caution' : 'text-muted-foreground')}>{load.label}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {last ? (
          <p className="flex h-9 items-center gap-2 text-sm text-muted-foreground"><BedDoubleIcon className="size-3.5" aria-hidden />Hjem i dag</p>
        ) : (
          <div className="-mx-2 flex h-9 items-center gap-1 rounded-lg border border-transparent px-2 text-sm transition-colors focus-within:border-ring focus-within:bg-card hover:border-input">
            <BedDoubleIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <label className="h-full min-w-0 flex-1">
              <span className="sr-only">Hvor sover I natten efter dag {index + 1}?</span>
              <input
                className="h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
                placeholder="Hvor sover I?"
                value={base}
                maxLength={60}
                onChange={(e) => onBase(e.target.value)}
              />
            </label>
            {base.trim() && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(base.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Søg efter ${base.trim()} i Google Maps (åbner i ny fane)`}
                title="Åbn i Google Maps"
              >
                <MapPinIcon className="size-4" aria-hidden />
              </a>
            )}
          </div>
        )}
        <DropList id={ds} items={items} empty="Slip planen her">{renderRow}</DropList>
        <AddPlan onAdd={onAdd} label="Tilføj plan" types={['oplevelse', 'mad', 'transport', 'andet']} />
      </div>
    </li>
  );
}
