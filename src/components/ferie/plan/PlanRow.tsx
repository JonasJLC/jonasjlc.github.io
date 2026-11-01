import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLinkIcon, GripVerticalIcon } from 'lucide-react';
import { kr } from '../lib/kasse';
import { PLAN_STATUS, safeUrl, typeInfo } from '../lib/plan';
import type { PlanItem } from '../lib/types';
import { cn } from '../lib/utils';
import { TypeIcon } from './icons';

const STATUS_STYLE: Record<PlanItem['status'], string> = {
  idea: 'bg-muted text-muted-foreground',
  tobook: 'bg-caution-tint text-caution',
  booked: 'bg-ok-tint text-ok-ink',
};

/** One plan: time, kind, title and place, price, link, and its status (tap to move it on). */
export function PlanRow({
  item, onEdit, onCycle,
}: {
  item: PlanItem; onEdit: (it: PlanItem) => void; onCycle: (it: PlanItem) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const ti = typeInfo(item.type);
  const sub = [item.place, item.note].filter(Boolean).join(' · ');
  const status = PLAN_STATUS.find((s) => s.value === item.status)!;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('flex items-center gap-1 rounded-xl border bg-card pr-1.5', isDragging && 'relative z-20 shadow-[0_12px_32px_rgba(0,0,0,.16)]')}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Flyt ${item.title || ti.label}`}
        className="flex h-12 w-7 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={() => onEdit(item)} className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left">
        {item.day !== null && <span className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">{item.time || '–'}</span>}
        <TypeIcon type={item.type} className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{item.title || ti.label}</span>
          {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
        </span>
        {(item.price ?? 0) > 0 && <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">{kr(item.price!)}</span>}
      </button>
      {item.link && (
        <a href={safeUrl(item.link)} target="_blank" rel="noopener noreferrer" aria-label={`Åbn link til ${item.title}`} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
          <ExternalLinkIcon className="size-3.5" aria-hidden />
        </a>
      )}
      <button
        type="button"
        onClick={() => onCycle(item)}
        aria-label={`Status: ${status.label}. Tryk for at skifte`}
        className={cn('h-6 shrink-0 whitespace-nowrap rounded-full px-2.5 text-xs font-medium transition-colors', STATUS_STYLE[item.status])}
      >
        {status.label}
      </button>
    </li>
  );
}
