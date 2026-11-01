import { ToggleGroup, ToggleGroupItem } from "@/components/ferie/ui/toggle-group"
import { cn } from "@/components/ferie/lib/utils"

export interface Option<T extends string> {
  value: T
  label: string
  color?: string
}

/** Single-select option set that never becomes empty: a quiet track with a white active pill. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T
  onValueChange: (v: T) => void
  options: Option<T>[]
  label: string
  className?: string
}) {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={value}
      aria-label={label}
      onValueChange={(v) => v && onValueChange(v as T)}
      className={cn("w-full gap-1 rounded-full bg-muted p-1", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-9 min-w-0 flex-1 gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground md:h-[30px]"
        >
          {o.color ? <i className="size-2 shrink-0 rounded-full" style={{ background: o.color }} /> : null}
          <span className="truncate">{o.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
