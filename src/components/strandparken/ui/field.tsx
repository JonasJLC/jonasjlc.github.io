import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Icon } from './icon';

type FieldProps = Omit<ComponentProps<'input'>, 'aria-label'> & {
  /** Visually hidden label text: the placeholder is not a label. */
  label: string;
  /** An optional round primary button beside the field, e.g. add item. Its label is Danish and required. */
  action?: { label: string; icon: LucideIcon; onClick: () => void };
};

/** White 50 px pill input with a real `<label>` and an optional round action (UI spec §5.8). 16 px text stops iOS zooming on focus. */
export function Field({ label, action, className, ...props }: FieldProps) {
  return (
    <div data-slot="field" className={cn('flex items-center gap-2', className)}>
      <label className="min-w-0 flex-1">
        <span className="sr-only">{label}</span>
        <input className="sp-input h-12.5 w-full rounded-sp-pill bg-sp-surface px-5 text-sp-ink placeholder:text-sp-muted" {...props} />
      </label>
      {action && (
        <Button variant="icon" tone="add" size="field" aria-label={action.label} onClick={action.onClick}>
          <Icon icon={action.icon} />
        </Button>
      )}
    </div>
  );
}
