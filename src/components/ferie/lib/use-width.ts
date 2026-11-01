import { useEffect, useRef, useState } from 'react';

/** Tracks the rendered width of an element (for hand-rolled SVG charts). */
export function useWidth<T extends HTMLElement>(min = 300) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.max(min, Math.round(el.clientWidth)));
    const ro = new ResizeObserver(set);
    ro.observe(el);
    set();
    return () => ro.disconnect();
  }, [min]);
  return [ref, w] as const;
}
