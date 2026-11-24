import { cn } from '../lib/utils';

type ProgressBarProps = {
  value: number;
  max: number;
  /** Names the bar for screen readers ("Købt"); read together with `valueText` when given. */
  label: string;
  /** What a screen reader says for the value, e.g. "3 af 7". Defaults to "<value> af <max>". */
  valueText?: string;
  className?: string;
};

/**
 * A thin track with a primary fill (UI spec §5): 4 px, pill ends, `role="progressbar"`. Shared by the shopping list
 * (idea 14) and the health and habit views (ideas 12 and 15). Purely presentational; hide it yourself when `max` is 0.
 */
export function ProgressBar({ value, max, label, valueText, className }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), Math.max(max, 0));
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText ?? `${clamped} af ${max}`}
      data-slot="progress-bar"
      className={cn('h-1 w-full overflow-hidden rounded-sp-pill bg-sp-track', className)}
    >
      <div className="h-full rounded-sp-pill bg-sp-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}
