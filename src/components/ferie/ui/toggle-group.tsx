import { ToggleGroup as TG } from 'radix-ui';
import { cn } from '../lib/utils';

export interface Option<T extends string> {
  value: T;
  label: string;
  color?: string;
}

/** Single-select segmented control (never lets the value become empty). */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (v: T) => void;
  options: Option<T>[];
  label: string;
  className?: string;
}) {
  return (
    <TG.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(v) => v && onValueChange(v as T)}
      className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-xl border bg-muted p-1', className)}
    >
      {options.map((o) => (
        <TG.Item
          key={o.value}
          value={o.value}
          className="flex h-9 min-w-0 items-center justify-center gap-1.5 truncate rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {o.color ? <i className="size-2.5 shrink-0 rounded-full" style={{ background: o.color }} /> : null}
          <span className="truncate">{o.label}</span>
        </TG.Item>
      ))}
    </TG.Root>
  );
}
