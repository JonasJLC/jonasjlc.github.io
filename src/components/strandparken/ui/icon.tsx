import type { LucideIcon, LucideProps } from 'lucide-react';

type IconProps = Omit<LucideProps, 'ref'> & { icon: LucideIcon };

/** Lucide glyph with the Strandparken defaults (UI spec §5.14): 22 px, stroke 1.8, currentColor, hidden from screen readers. */
export function Icon({ icon: Glyph, size = 22, strokeWidth = 1.8, ...props }: IconProps) {
  return <Glyph size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...props} />;
}
