import { ToggleGroup, ToggleGroupItem } from "@/components/ferie/ui/toggle-group"

export interface Option<T extends string> {
  value: T
  label: string
  color?: string
}

/** Single-select option set that never becomes empty. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
}: {
  value: T
  onValueChange: (v: T) => void
  options: Option<T>[]
  label: string
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={1}
      value={value}
      aria-label={label}
      onValueChange={(v) => v && onValueChange(v as T)}
      className="w-full"
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="h-10 min-w-0 flex-1 gap-1.5 px-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          {o.color ? <i className="size-2.5 shrink-0 rounded-full" style={{ background: o.color }} /> : null}
          <span className="truncate">{o.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
