import { ChevronDownIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from './lib/utils';

const PREFIX = 'ferie-fold-';
const read = (key: string) => { try { return localStorage.getItem(PREFIX + key) === '1'; } catch { return false; } };

/** Whether a container is folded. The choice is remembered per container in this browser. */
export function useFold(key: string) {
  const [folded, setFolded] = useState(() => read(key));
  const toggle = () => {
    const next = !folded;
    setFolded(next);
    try { localStorage.setItem(PREFIX + key, next ? '1' : '0'); } catch { /* ignore */ }
  };
  return { folded, toggle };
}

/** The title of a container as a button. Place it inside the container's heading. */
export function FoldButton({
  folded, onToggle, controls, hint, children,
}: { folded: boolean; onToggle: () => void; controls: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-expanded={!folded}
      aria-controls={controls}
      onClick={onToggle}
      className="-mx-2 flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-left transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span>{children}</span>
      <ChevronDownIcon className={cn('size-4 shrink-0 text-muted-foreground transition-transform', folded && '-rotate-90')} aria-hidden />
      {folded && hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </button>
  );
}

/**
 * Everything in a container below its title. `contents` keeps the children in the parent's
 * layout (gaps, grid) while open, so folding changes nothing else about the container.
 */
export function FoldBody({ id, folded, children }: { id: string; folded: boolean; children: ReactNode }) {
  return <div id={id} className={folded ? 'hidden' : 'contents'}>{children}</div>;
}
