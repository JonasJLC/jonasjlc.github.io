/** Ferieplan's mark: a sun half-set on the horizon, with its reflection on the water. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <path d="M6.5 15.5a7.5 7.5 0 0 1 15 0z" fill="var(--data)" />
      <path d="M3 15.5h22M8.5 19.5h11M11.5 23h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" fill="none" />
    </svg>
  );
}
