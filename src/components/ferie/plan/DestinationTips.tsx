import { FoldBody, FoldButton, useFold } from '../fold';
import { ExternalLinkIcon, GlobeIcon } from 'lucide-react';
import { useState } from 'react';
import { askTips, cachedTips, TOPIC_LABEL, type TipTopic, type Tips } from '../lib/tips';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const ORDER: TipTopic[] = ['indrejse', 'sundhed', 'regler'];

/**
 * Practical things to know about the destination (entry and visa, health, local rules), summed up
 * from Udenrigsministeriets rejsevejledning. Fetched only when asked for; the rest of the plan
 * works the same if it can't be reached.
 */
export function DestinationTips({ tripName }: { tripName: string }) {
  const [dest, setDest] = useState(tripName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Tips | null>(() => (tripName.trim() ? cachedTips(tripName) : null));

  const fetchTips = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const d = dest.trim();
    if (d.length < 2 || busy) return;
    setBusy(true);
    setError('');
    try {
      setResult(await askTips(d));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Tipsene kunne ikke hentes lige nu.');
    } finally {
      setBusy(false);
    }
  };

  const fold = useFold('tips');
  const tips = result?.type === 'tips' ? result : null;
  return (
    <section aria-labelledby="tips-h" className="rounded-panel bg-panel p-5">
      <div className={`flex items-center gap-2 ${fold.folded ? '' : 'mb-3'}`}>
        <GlobeIcon className="size-4 text-muted-foreground" aria-hidden />
        <h2 id="tips-h" className="text-[15px] leading-6 font-semibold">
          <FoldButton folded={fold.folded} onToggle={fold.toggle} controls="tips-body">Praktiske forhold</FoldButton>
        </h2>
      </div>
      <FoldBody id="tips-body" folded={fold.folded}>
      <form onSubmit={fetchTips} className="flex flex-wrap gap-2">
        <Input
          aria-label="Land eller destination"
          className="min-w-0 flex-1 basis-48"
          value={dest}
          maxLength={80}
          placeholder="Land eller by, fx Japan"
          onChange={(e) => setDest(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={busy || dest.trim().length < 2}>{busy ? 'Henter …' : tips ? 'Opdatér' : 'Hent tips'}</Button>
      </form>
      <div aria-live="polite">
        {error && <p className="mt-3 text-sm text-warn">{error}</p>}
        {result?.type === 'unavailable' && (
          <p className="mt-3 text-sm text-muted-foreground">
            {result.reason === 'unknown_place'
              ? 'Jeg kunne ikke genkende et land i det. Prøv fx landets navn.'
              : `Jeg kunne ikke finde en rejsevejledning for ${result.country ?? 'det sted'}.`}
            {result.sourceUrl && <> Se <a className="underline underline-offset-4" href={result.sourceUrl} target="_blank" rel="noopener noreferrer">udenrigsministeriet.dk</a>.</>}
          </p>
        )}
        {tips && (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm font-medium">{tips.country}</p>
            {ORDER.map((t) => {
              const items = tips.tips.filter((x) => x.topic === t);
              return items.length ? (
                <div key={t}>
                  <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{TOPIC_LABEL[t]}</h3>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{items.map((x) => <li key={x.text}>{x.text}</li>)}</ul>
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>
      {tips && (
        <p className="mt-4 border-t border-rule pt-3 text-xs text-muted-foreground">
          Kilde:{' '}
          <a className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4" href={tips.sourceUrl} target="_blank" rel="noopener noreferrer">
            Udenrigsministeriets rejsevejledning<ExternalLinkIcon className="size-3" aria-hidden />
          </a>
          {tips.updated && <>, opdateret {tips.updated}</>}. Tipsene er en kort AI-opsummering og erstatter ikke de officielle kilder. Tjek altid visum, vaccinationer og regler hos Udenrigsministeriet og landets ambassade, før I rejser.
        </p>
      )}
      </FoldBody>
    </section>
  );
}
