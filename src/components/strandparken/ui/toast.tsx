import type { CSSProperties } from 'react';
import { Toaster as Sonner, toast } from 'sonner';

/** Dark pill above the bottom bar, one at a time, 4 seconds (UI spec §5.13). Mount once, in the app shell. */
export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      visibleToasts={1}
      duration={4000}
      offset="var(--sp-toast-offset)"
      mobileOffset="var(--sp-toast-offset)"
      containerAriaLabel="Beskeder"
      style={{ '--width': 'var(--sp-toast-width)' } as CSSProperties}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'sp-small flex w-full items-center gap-3 rounded-sp-pill bg-sp-ink py-2 pr-2 pl-5 text-sp-on-primary',
          title: 'min-w-0 flex-1',
          actionButton: 'sp-button-sm inline-flex min-h-sp-target shrink-0 items-center rounded-sp-pill px-4 text-sp-on-primary active:bg-sp-primary-pressed',
        },
      }}
    />
  );
}

/** Confirm a change in place. Pass `onUndo` for destructive actions to get a `Fortryd` button. A new toast replaces the one showing. */
export function notify(message: string, options: { onUndo?: () => void } = {}) {
  toast.dismiss();
  return toast(message, {
    action: options.onUndo ? { label: 'Fortryd', onClick: () => options.onUndo?.() } : undefined,
  });
}
