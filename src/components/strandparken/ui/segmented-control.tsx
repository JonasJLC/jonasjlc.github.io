import { Tabs } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

type Option = { value: string; label: string };

type SegmentedControlProps = Omit<ComponentProps<typeof Tabs.Root>, 'dir'> & {
  /** Names the group for screen readers, e.g. "Visning". */
  'aria-label': string;
  options: readonly Option[];
};

/**
 * Two or three segments (UI spec §5.9), built on Radix Tabs so it is a real tablist with arrow-key navigation.
 * Put a `SegmentedPanel` per option inside it so each tab points at its panel.
 */
export function SegmentedControl({ options, 'aria-label': label, className, children, ...props }: SegmentedControlProps) {
  return (
    <Tabs.Root data-slot="segmented-control" className={className} {...props}>
      <Tabs.List aria-label={label} className="flex w-full gap-1 rounded-sp-pill bg-sp-track p-1">
        {options.map((o) => (
          <Tabs.Trigger
            key={o.value}
            value={o.value}
            className={cn(
              'sp-button-sm min-h-sp-target flex-1 rounded-sp-pill px-2 text-center',
              'text-sp-muted data-[state=active]:bg-sp-surface data-[state=active]:text-sp-ink data-[state=active]:shadow-sp-seg',
            )}
          >
            {o.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
}

export function SegmentedPanel({ className, ...props }: ComponentProps<typeof Tabs.Content>) {
  return <Tabs.Content className={cn(className)} {...props} />;
}
