import { Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { dinnerCategoryId } from '../lib/ideas/model';
import type { Idea } from '../lib/ideas/model';
import { addDays, todayIso } from '../lib/madplan/dates';
import { dishOf, type PlanEntry } from '../lib/madplan/model';
import { loadEntries, type Dish } from '../lib/madplan/repo';
import type { Profile } from '../lib/profile/model';
import type { Recipe } from '../lib/recipes/model';
import { requestSuggestion, SuggestError, type Suggestion } from '../lib/suggest/client';
import { buildCandidates, emptyMessage, HISTORY_DAYS, suggestErrorMessage, type Built } from '../lib/suggest/model';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Icon } from '../ui/icon';

type Props = {
  recipes: Recipe[];
  categories: { id: string; name: string }[];
  ideas: Idea[];
  weekEntries: PlanEntry[];
  profiles: Profile[];
  dislikes: { word: string }[];
  busy: boolean;
  onPick: (dish: Dish, title: string) => void;
};

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'empty'; message: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; dish: Dish; title: string; reason: string; kind: 'recipe' | 'idea'; flagged: string[] };

/** "Foreslå ret" for one empty day (design §5.3.5): code builds the candidates, the model picks one and says why. */
export function SuggestBlock({ recipes, categories, ideas, weekEntries, profiles, dislikes, busy, onPick }: Props) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const seen = useRef(new Set<string>());
  const history = useRef<PlanEntry[] | null>(null);

  const ask = async () => {
    setState({ status: 'loading' });
    try {
      const today = todayIso();
      history.current ??= await loadEntries(addDays(today, -HISTORY_DAYS), addDays(today, -1));
      const built: Built = buildCandidates({
        recipes, ideas, dinnerCategoryId: dinnerCategoryId(categories), week: weekEntries, history: history.current, today,
        dislikes, profiles, skip: seen.current, titleOf: (e) => dishOf(e, recipes, ideas).title,
      });
      if (built.status === 'empty') {
        // After at least one suggestion, running out means "that was everything": start over next time.
        const wasUsed = seen.current.size > 0;
        seen.current = new Set();
        setState({ status: 'empty', message: wasUsed && built.why === 'all-used' ? 'Det var alle forslag. Tryk igen for at starte forfra, eller vælg selv.' : emptyMessage(built.why) });
        return;
      }
      const answer: Suggestion = await requestSuggestion(built.request);
      const item = built.items.get(answer.id);
      if (!item) throw new SuggestError(suggestErrorMessage(undefined)); // never show a dish that was not a candidate
      seen.current.add(answer.id);
      const cand = built.request.candidates.find((c) => c.id === answer.id)!;
      setState({
        status: 'ready',
        title: cand.title,
        dish: item.kind === 'recipe' ? { recipeId: item.recipe.id } : { ideaId: item.idea.id },
        kind: item.kind,
        reason: answer.reason,
        flagged: cand.dislikeHits,
      });
    } catch (e) {
      setState({ status: 'error', message: e instanceof SuggestError ? e.message : suggestErrorMessage(undefined) });
    }
  };

  if (state.status === 'ready') {
    return (
      <Card className="flex flex-col gap-2" aria-live="polite">
        <p className="sp-caption text-sp-muted">Forslag</p>
        <p className="sp-title-group">{state.title}</p>
        <p className="sp-body">{state.reason}</p>
        {state.kind === 'idea' && <p className="sp-caption text-sp-muted">Idé – tjek ingredienser</p>}
        {state.flagged.length > 0 && <p className="sp-caption text-sp-danger">Nævner {state.flagged.join(', ')}, men der var ikke andet tilbage.</p>}
        <div className="flex flex-wrap gap-2">
          <Button inCard disabled={busy} onClick={() => onPick(state.dish, state.title)}>Brug den</Button>
          <Button variant="outline" disabled={busy} onClick={() => void ask()}>Nyt forslag</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <Button variant="outline" disabled={busy || state.status === 'loading'} onClick={() => void ask()}>
        <Icon icon={Sparkles} />{state.status === 'loading' ? 'Finder et forslag…' : 'Foreslå ret'}
      </Button>
      {(state.status === 'empty' || state.status === 'error') && (
        <p role={state.status === 'error' ? 'alert' : 'status'} className="sp-body text-sp-muted">{state.message}</p>
      )}
    </div>
  );
}
