import { CircleAlertIcon, LightbulbIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import type { Verdict as V, VerdictAction } from './verdict';

export function VerdictCard({ verdict, onApply }: { verdict: V; onApply: (a: VerdictAction) => void }) {
  const Icon = verdict.bad ? CircleAlertIcon : LightbulbIcon;
  return (
    <section aria-label="Anbefaling">
      <Alert variant={verdict.bad ? 'destructive' : 'default'} className="bg-card">
        <Icon />
        <AlertTitle className="font-display text-lg">{verdict.title}</AlertTitle>
        <AlertDescription>
          <p>{verdict.text}</p>
          {verdict.options.length > 0 && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {verdict.options.map((o) => (
                <Card key={o.title} className="gap-2 py-4 text-foreground">
                  <CardHeader>
                    <CardTitle className="text-base">{o.title}</CardTitle>
                    <CardDescription>{o.text}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" onClick={() => onApply(o.action)}>{o.action.label}</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {verdict.action && (
            <Button className="mt-3" onClick={() => onApply(verdict.action!)}>{verdict.action.label}</Button>
          )}
        </AlertDescription>
      </Alert>
    </section>
  );
}
