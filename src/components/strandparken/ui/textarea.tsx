import { forwardRef, type ComponentProps } from 'react';
import { cn } from '../lib/utils';

/** Multi-line input: white on the ground, 16 px text so iOS does not zoom on focus. Pair it with a real `<label>`. */
export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn('sp-input sp-body min-h-24 w-full resize-y rounded-sp-row bg-sp-surface px-4 py-3 text-sp-ink placeholder:text-sp-muted', className)}
      {...props}
    />
  );
});
