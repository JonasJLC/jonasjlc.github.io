import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLinkIcon, GripVerticalIcon } from 'lucide-react';
import { kr } from '../lib/kasse';
import { PLAN_STATUS, safeUrl } from '../lib/plan';
import type { PlanItem } from '../lib/types';
import { cn } from '../lib/utils';
import { typeInfo } from '../lib/plan';
import { TypeIcon } from './icons';

const STATUS_STYLE: Record<PlanItem['status'], string> = {
  idea: 'border-dashed text-muted-foreground',
  tobook: 'border-holiday text-holiday',
  booked: 'border-ok bg-ok/10 text-ok',
};

export function PlanRow({
  item, onEdit, onCycle,
}: {
  item: PlanItem; onEdit: (it: PlanItem) => void; onCycle: (it: PlanItem) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const ti = typeInfo(item.type);
  const sub = [item.place, item.note].filter(Boolean).join(' – ');
  const status = PLAN_STATUS.find((s) => s.value === item.status)!;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('flex items-center gap-1 rounded-xl border bg-card', isDragging && 'relative z-20 shadow-xl')}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Flyt ${item.title || ti.label}`}
        className="flex h-12 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={() => onEdit(item)} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
        {item.time && <span className="w-10 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{item.time}</span>}
        <TypeIcon type={item.type} className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <b className="block truncate text-sm">{item.title || ti.label}</b>
          {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
          {(item.price ?? 0) > 0 && <span className="block text-xs font-semibold tabular-nums">{kr(item.price!)}</span>}
        </span>
      </button>
      {item.link && (
        <a href={safeUrl(item.link)} target="_blank" rel="noopener noreferrer" aria-label={`Åbn link til ${item.title}`} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
          <ExternalLinkIcon className="size-4" aria-hidden />
        </a>
      )}
      <button
        type="button"
        onClick={() => onCycle(item)}
        aria-label={`Status: ${status.label}. Tryk for at skifte`}
        className={cn('mr-1.5 shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold', STATUS_STYLE[item.status])}
      >
        {status.label}
      </button>
    </li>
  );
}
