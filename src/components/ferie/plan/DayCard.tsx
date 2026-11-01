import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { PlusIcon } from 'lucide-react';
import { MONTHS, WEEKDAYS, toISO } from '../lib/dates';
import { holidayName } from '../lib/holidays';
import { PLAN_TYPES, dayLoad, sortPlan } from '../lib/plan';
import type { PlanItem, PlanType } from '../lib/types';
import { cn } from '../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Input } from '../ui/input';

export function DropList({ id, items, children, empty }: { id: string; items: PlanItem[]; children: (it: PlanItem) => React.ReactNode; empty: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `list:${id}` });
  const sorted = [...items].sort(sortPlan);
  return (
    <SortableContext items={sorted.map((x) => x.id)} strategy={verticalListSortingStrategy}>
      <ul ref={setNodeRef} className={cn('flex min-h-14 flex-col gap-1.5 rounded-xl', isOver && 'bg-accent/60 ring-2 ring-ring/30')}>
        {sorted.map((it) => children(it))}
        {sorted.length === 0 && <li className="flex min-h-14 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">{empty}</li>}
      </ul>
    </SortableContext>
  );
}

const LOAD_STYLE = { free: 'secondary', calm: 'secondary', mid: 'default', busy: 'destructive' } as const;

export function DayCard({
  t, index, total, items, base, extraOff, onBase, onAdd, renderRow,
}: {
  t: number; index: number; total: number; items: PlanItem[]; base: string; extraOff: boolean;
  onBase: (v: string) => void; onAdd: (type: PlanType) => void; renderRow: (it: PlanItem) => React.ReactNode;
}) {
  const ds = toISO(t);
  const d = new Date(t);
  const load = dayLoad(items);
  const tags: string[] = [];
  if (index === 0) tags.push('Afrejse');
  const last = index === total - 1 && total > 1;
  if (last) tags.push('Hjemrejse');
  const hn = holidayName(t, extraOff);
  if (hn) tags.push(hn);
  const wd = WEEKDAYS[d.getUTCDay()];
  return (
    <Card id={`pday-${ds}`} className="scroll-mt-4 gap-3 py-4">
      <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="flex size-12 flex-col items-center justify-center rounded-xl bg-muted font-display leading-none">
          <small className="text-[10px] font-medium text-muted-foreground">Dag</small>
          <b className="text-xl">{index + 1}</b>
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold">
            {wd.charAt(0).toUpperCase() + wd.slice(1)} {d.getUTCDate()}. {MONTHS[d.getUTCMonth()]}
          </h3>
          {tags.length > 0 && <span className="text-xs font-semibold text-holiday">{tags.join(', ')}</span>}
        </div>
        <Badge variant={LOAD_STYLE[load.key]}>{load.label}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {last ? (
          <p className="text-sm text-muted-foreground">Hjem i dag</p>
        ) : (
          <Input aria-label={`Hvor sover I natten efter dag ${index + 1}?`} placeholder="Hvor sover I?" value={base} maxLength={60} onChange={(e) => onBase(e.target.value)} />
        )}
        <DropList id={ds} items={items} empty="Træk en plan hertil">{renderRow}</DropList>
      </CardContent>
      <CardFooter className="flex-wrap gap-1.5">
        {PLAN_TYPES.filter((x) => x.value !== 'overnatning').map((x) => (
          <Button key={x.value} variant="outline" size="sm" onClick={() => onAdd(x.value)}>
            <PlusIcon data-icon="inline-start" />{x.label}
          </Button>
        ))}
      </CardFooter>
    </Card>
  );
}
