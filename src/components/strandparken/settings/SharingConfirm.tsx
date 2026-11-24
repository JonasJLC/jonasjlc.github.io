import { useState } from 'react';
import { METRICS, metricLabels, type Metric } from '../lib/health/model';
import { Button } from '../ui/button';
import { Card, CardRow } from '../ui/card';
import { Switch } from '../ui/switch';

/**
 * The consent step before anything is shared (roadmap Q6, Oura agreement §5(a)): per metric, what the other person may see.
 * Nothing is shared until this is saved. It also says how to take it back.
 */
export function SharingConfirm({
  otherName,
  initial,
  busy,
  submitLabel = 'Gem og del',
  onSubmit,
  onCancel,
}: {
  otherName: string;
  initial: Record<Metric, boolean>;
  busy: boolean;
  submitLabel?: string;
  onSubmit: (values: Record<Metric, boolean>) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  return (
    <section aria-labelledby="sharing-confirm-title" className="flex flex-col gap-sp-gap">
      <div className="flex flex-col gap-1">
        <h3 id="sharing-confirm-title" className="sp-title-group">Hvad må {otherName} se?</h3>
        <p className="sp-small text-sp-muted">
          Kun det, du slår til, bliver vist for {otherName}. Du kan altid slå det fra igen her, eller afbryde forbindelsen.
        </p>
      </div>
      <Card className="py-1">
        {METRICS.map((m) => (
          <CardRow key={m}>
            <Switch label={metricLabels[m]} checked={values[m]} disabled={busy} onCheckedChange={(on) => setValues({ ...values, [m]: on })} />
          </CardRow>
        ))}
      </Card>
      <div className="flex flex-col gap-2">
        <Button type="button" disabled={busy} onClick={() => onSubmit(values)}>{submitLabel}</Button>
        {onCancel && <Button type="button" variant="quiet" disabled={busy} onClick={onCancel}>Tilbage</Button>}
      </div>
    </section>
  );
}
