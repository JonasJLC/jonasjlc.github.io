import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Icon } from './icon';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

/**
 * Bottom sheet (UI spec §5.12): ground colour, 30 px top corners, never taller than 85 % of the screen, over a scrim.
 * Radix Dialog supplies the focus trap, Escape and focus return to the opener.
 */
export function SheetContent({ className, children, ...props }: ComponentProps<typeof Dialog.Content>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-sp-scrim data-[state=closed]:animate-sp-scrim-out data-[state=open]:animate-sp-scrim-in" />
      <Dialog.Content
        data-slot="sheet"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-sp-column flex-col overflow-y-auto',
          'rounded-t-sp-sheet bg-sp-bg px-sp-page-x pt-5.5 pb-sp-sheet',
          'data-[state=closed]:animate-sp-sheet-out data-[state=open]:animate-sp-sheet-in',
          className,
        )}
        {...props}
      >
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

/** Title in the card serif, an optional small line under it (the Radix description), and the 44 px close button. */
export function SheetHeader({ title, eyebrow, className }: { title: string; eyebrow?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-sp-gap flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <Dialog.Title className="sp-title-card">{title}</Dialog.Title>
        {eyebrow && <Dialog.Description className="sp-small mt-1 text-sp-muted">{eyebrow}</Dialog.Description>}
      </div>
      <Dialog.Close
        aria-label="Luk"
        className="inline-flex size-sp-target shrink-0 items-center justify-center rounded-full bg-sp-surface text-sp-ink active:bg-sp-track"
      >
        <Icon icon={X} />
      </Dialog.Close>
    </div>
  );
}
