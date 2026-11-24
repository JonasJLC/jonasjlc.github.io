import { barHeight, type Trend } from '../lib/health/view';
import { Card } from '../ui/card';

/**
 * Seven bars for the last seven days (plain HTML, no chart library). Today is the solid bar; a missing day is a short
 * dashed stub, never a zero bar. The chart is hidden from screen readers, which get a list with the same numbers.
 */
export function TrendBars({ title, trend, suffix = '' }: { title: string; trend: Trend; suffix?: string }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="sp-title-group">{title}</h3>
        <p className="sp-small text-sp-muted">Snit {trend.average}{suffix}</p>
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 gap-2">
        {trend.entries.map((e) => (
          <div key={e.date} className="flex flex-col items-center gap-1.5">
            <div className="flex h-20 w-full items-end justify-center">
              {e.value === null ? (
                <span className="h-2 w-full max-w-6 rounded-sp-pill border border-dashed border-sp-dash" />
              ) : (
                <span
                  className={'w-full max-w-6 rounded-sp-pill ' + (e.isToday ? 'bg-sp-primary' : 'bg-sp-primary-tint')}
                  style={{ height: `${Math.max(barHeight(e.value), 6)}%` }}
                />
              )}
            </div>
            <span className={'sp-small ' + (e.isToday ? 'font-semibold text-sp-ink' : 'text-sp-muted')}>{e.letter}</span>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {trend.entries.map((e) => (
          <li key={e.date}>
            {e.label}: {e.value === null ? 'ingen data' : `${e.value}${suffix}`}
          </li>
        ))}
      </ul>
    </Card>
  );
}
