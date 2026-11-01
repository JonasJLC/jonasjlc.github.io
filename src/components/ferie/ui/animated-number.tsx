import { animate } from 'motion';
import { useEffect, useRef, useState } from 'react';
import { fmtN } from '../lib/dates';
import { prefersReducedMotion } from '../lib/use-media-query';

/** Counts smoothly to its value (skipped with reduced motion). */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion() || Math.abs(from.current - value) < 1e-9) {
      from.current = value;
      setShown(value);
      return;
    }
    const c = animate(from.current, value, {
      duration: 0.7,
      ease: [0.22, 0.8, 0.24, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => c.stop();
  }, [value]);
  return <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtN(shown)}</span>;
}
