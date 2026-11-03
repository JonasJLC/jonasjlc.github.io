import { FoldBody, FoldButton, useFold } from '../fold';
import { CircleAlertIcon } from 'lucide-react';
import { Button } from '../ui/button';
import type { Verdict as V, VerdictAction } from './verdict';

/** The advice on the monthly deposit. Its headline is the screen's finding in the title row. */
export function VerdictCard({ verdict, onApply }: { verdict: V; onApply: (a: VerdictAction) => void }) {
  const fold = useFold('verdict');
  return (
    <section aria-labelledby="verdict-h" className="rounded-panel bg-panel p-5" role={verdict.bad ? 'alert' : undefined}>
      <h2 id="verdict-h" className="flex items-center gap-2 text-[15px] leading-6 font-semibold">
        {verdict.bad && <CircleAlertIcon className="size-4 text-warn" aria-hidden />}
        <FoldButton folded={fold.folded} onToggle={fold.toggle} controls="verdict-body">Anbefaling</FoldButton>
      </h2>
      <FoldBody id="verdict-body" folded={fold.folded}>
      <p className="mt-1 max-w-[80ch] text-sm leading-6">{verdict.text}</p>
      {verdict.options.length > 0 && (
        <div className="mt-4 grid gap-4 border-t border-rule pt-4 md:grid-cols-2 md:gap-0 md:divide-x md:divide-rule">
          {verdict.options.map((o) => (
            <div key={o.title} className="flex flex-col items-start gap-1 md:px-5 md:first:pl-0 md:last:pr-0">
              <h3 className="text-sm font-semibold">{o.title}</h3>
              <p className="text-sm text-muted-foreground">{o.text}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => onApply(o.action)}>{o.action.label}</Button>
            </div>
          ))}
        </div>
      )}
      {verdict.action && (
        <Button className="mt-4" size="sm" variant="outline" onClick={() => onApply(verdict.action!)}>{verdict.action.label}</Button>
      )}
      </FoldBody>
    </section>
  );
}
