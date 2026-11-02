import type { Bridge } from '../lib/bridges';
import { fmtRange } from '../lib/dates';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Every suggested stretch in the coming years, so the good ones can be found without paging
 * through each year. Uses the same list as the calendar marks and the pop-up.
 */
export function BridgeList({ bridges, year, onUse }: { bridges: Bridge[]; year: number; onUse: (from: number, to: number) => void }) {
  if (!bridges.length) return null;
  return (
    <section aria-labelledby="bridge-h" className="mt-4 rounded-panel bg-panel p-5">
      <h2 id="bridge-h" className="text-[15px] leading-6 font-semibold">Forslag til ferieperioder</h2>
      <p className="mb-3 text-sm text-muted-foreground">Mange fridage i træk for få feriedage. Markeret med lilla i kalenderen.</p>
      <ul className="flex flex-col gap-1.5">
        {bridges.map((b) => (
          <li key={b.from}>
            <button
              type="button"
              onClick={() => onUse(b.from, b.to)}
              className="flex w-full items-center gap-3 rounded-lg bg-bridge-tint px-3 py-2 text-left text-sm hover:brightness-95"
            >
              <i aria-hidden className="h-4 w-1 shrink-0 rounded-full bg-bridge" />
              <span className="min-w-0">
                <span className="font-medium">{fmtRange(b.from, b.to, year)}</span>
                <span className="block text-xs text-muted-foreground">
                  {b.total} fridage for {plural(b.cost, 'feriedag', 'feriedage')} · {b.holidays.join(', ')}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
