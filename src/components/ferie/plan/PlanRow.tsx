import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLinkIcon, GripVerticalIcon, NavigationIcon } from 'lucide-react';
import { fmtKm } from '../lib/geo';
import { kr } from '../lib/kasse';
import { PLAN_STATUS, fmtMins, safeUrl, typeInfo } from '../lib/plan';
import type { PlanItem } from '../lib/types';
import { cn } from '../lib/utils';
import { IconChip } from '../page';
import { FlightLine, STATUS_STYLE } from './FlightCard';
import { ItemIcon, typeTone } from './icons';

/**
 * One plan. On a day it is a stop on the timeline: time in the plan's colour, its icon on a
 * dashed line that joins the day's stops, and the distance from the previous stop. In the idea
 * bank it is a small lifted card. Tap to edit; tap the status to move it on.
 */
export function PlanRow({
  item, distKm, legKm, onEdit, onCycle,
}: {
  item: PlanItem; distKm?: number; legKm?: number; onEdit: (it: PlanItem) => void; onCycle: (it: PlanItem) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const ti = typeInfo(item.type);
  const tone = typeTone(item.type);
  const onDay = item.day !== null;
  const f = item.flight;
  const sub = f
    ? [[f.airline, f.no].filter(Boolean).join(' '), fmtMins(f.mins), item.note].filter(Boolean).join(' · ')
    : [item.place, distKm !== undefined && legKm === undefined && `${fmtKm(distKm)} fra overnatning`, item.note].filter(Boolean).join(' · ');
  const status = PLAN_STATUS.find((s) => s.value === item.status)!;
  const line = 'w-0 border-l-[1.5px] border-dashed border-input';
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group/row relative flex items-stretch gap-1 rounded-xl pr-1.5 transition-colors',
        onDay ? 'hover:bg-accent/60' : 'bg-card shadow-card',
        isDragging && 'z-20 bg-card shadow-lift',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Flyt ${item.title || ti.label}`}
        className="flex w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={() => onEdit(item)} className="flex min-w-0 flex-1 items-stretch gap-2.5 text-left">
        {onDay && (
          <span className={cn('w-10 shrink-0 pt-[13px] text-xs font-semibold tabular-nums', item.time ? tone.ink : 'text-muted-foreground')}>
            {item.time || '–'}
          </span>
        )}
        <span className="flex w-8 shrink-0 flex-col items-center">
          {onDay ? <i className={cn(line, 'h-1.5 group-[:first-child]/row:invisible')} aria-hidden /> : <i className="h-2" aria-hidden />}
          <IconChip tone={tone.chip}><ItemIcon item={item} /></IconChip>
          {onDay ? <i className={cn(line, 'min-h-1.5 flex-1 group-[:last-child]/row:invisible')} aria-hidden /> : <i className="h-2" aria-hidden />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center py-2">
          {legKm !== undefined && (
            <span className="mb-0.5 flex items-center gap-1 text-[11px] leading-4 text-cat-transport-ink">
              <NavigationIcon className="size-3" aria-hidden />{fmtKm(legKm)}<span className="sr-only sm:not-sr-only"> fra forrige stop</span>
            </span>
          )}
          {f ? (
            <>
              <span className="sr-only">{item.title}</span>
              <FlightLine f={f} />
            </>
          ) : (
            <span className="block truncate text-sm font-medium">{item.title || ti.label}</span>
          )}
          {(sub || f) && (
            <span className="block truncate text-xs text-muted-foreground">
              {f && (f.dep || f.arr) && <span className="sm:hidden">{f.dep}–{f.arr}{f.arrPlus ? '+1' : ''}{sub ? ' · ' : ''}</span>}
              {sub}
            </span>
          )}
        </span>
        {(item.price ?? 0) > 0 && <span className="hidden shrink-0 self-center text-xs tabular-nums text-muted-foreground sm:block">{kr(item.price!)}</span>}
      </button>
      {item.link && (
        <a href={safeUrl(item.link)} target="_blank" rel="noopener noreferrer" aria-label={`Åbn link til ${item.title}`} className="flex size-8 shrink-0 items-center justify-center self-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
          <ExternalLinkIcon className="size-3.5" aria-hidden />
        </a>
      )}
      <button
        type="button"
        onClick={() => onCycle(item)}
        aria-label={`Status: ${status.label}. Tryk for at skifte`}
        className={cn('h-6 shrink-0 self-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium transition-colors', STATUS_STYLE[item.status])}
      >
        {status.label}
      </button>
    </li>
  );
}
