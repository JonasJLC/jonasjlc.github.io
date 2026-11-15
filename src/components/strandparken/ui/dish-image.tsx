import { Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { Icon } from './icon';

/** Round sizes: 52 in day rows, 56 in the week strip, 64 in pickers (UI spec §5.4). */
const roundSizes = { 52: 'size-13', 56: 'size-14', 64: 'size-16' } as const;
type RoundSize = keyof typeof roundSizes;

type DishImageProps = {
  src?: string | null;
  /** The dish name: its first letter is the fallback. The name itself is always shown next to the picture, so the image is decorative. */
  name: string;
  className?: string;
} & ({ shape: 'round'; size: RoundSize } | { shape: 'cover'; size?: never });

/**
 * One component for every dish picture. `cover` fills the box its parent gives it and crops from the centre;
 * `round` is a circle. Without a photo, or when it fails to load, a `--sp-track` tile with the dish's first letter
 * appears instead, never a broken or empty image.
 */
export function DishImage({ src, name, shape, size, className }: DishImageProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = !!src && failed !== src;
  const letter = name.trim().charAt(0).toLocaleUpperCase('da');
  return (
    <span
      data-slot="dish-image"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-sp-track',
        shape === 'round' ? cn('rounded-full', roundSizes[size]) : 'size-full',
        className,
      )}
    >
      {showPhoto ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} className="size-full object-cover object-center" />
      ) : (
        <span aria-hidden="true" className={cn('text-sp-primary', shape === 'round' ? 'sp-title-section' : 'sp-stat-lg')}>
          {letter}
        </span>
      )}
    </span>
  );
}

/** An empty slot (nothing planned): a dashed circle with a plus. Decorative, it sits inside a labelled button. */
export function DishSlot({ size, className }: { size: RoundSize; className?: string }) {
  return (
    <span
      data-slot="dish-slot"
      aria-hidden="true"
      className={cn('sp-border-strong inline-flex shrink-0 items-center justify-center rounded-full border-dashed border-sp-dash text-sp-primary', roundSizes[size], className)}
    >
      <Icon icon={Plus} />
    </span>
  );
}
