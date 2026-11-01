import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { Drawer } from 'vaul';
import { useMediaQuery } from '../lib/use-media-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** Centered dialog on desktop, bottom drawer on phones. */
export function ResponsiveSheet({ open, onOpenChange, title, description, children }: Props) {
  const desktop = useMediaQuery('(min-width: 768px)');
  if (desktop) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_.15s_ease-out]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl data-[state=open]:animate-[pop-in_.18s_ease-out]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-display text-2xl font-bold tracking-tight">{title}</Dialog.Title>
                <Dialog.Description className={description ? 'mt-1 text-sm text-muted-foreground' : 'sr-only'}>
                  {description ?? title}
                </Dialog.Description>
              </div>
              <Dialog.Close className="-m-2 rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Luk">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[92dvh] flex-col rounded-t-3xl border bg-card outline-none">
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-border" aria-hidden />
          <div className="overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
            <Drawer.Title className="font-display text-2xl font-bold tracking-tight">{title}</Drawer.Title>
            <Drawer.Description className={description ? 'mb-4 mt-1 text-sm text-muted-foreground' : 'sr-only'}>
              {description ?? title}
            </Drawer.Description>
            <div className="mt-4">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
