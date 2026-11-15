import { getClient } from '../auth';
import { suggestErrorMessage, type SuggestRequest } from './model';

export class SuggestError extends Error {}
export type Suggestion = { id: string; kind: 'recipe' | 'idea'; reason: string };

export async function requestSuggestion(body: SuggestRequest): Promise<Suggestion> {
  const c = await getClient();
  const { data, error } = await c.functions.invoke('meal-suggest', { body });
  if (error) {
    let code: string | undefined;
    try {
      code = ((await (error as { context?: Response }).context?.json()) as { error?: string } | undefined)?.error;
    } catch {
      /* no readable body: a network failure or a crashed function */
    }
    throw new SuggestError(suggestErrorMessage(code));
  }
  return data as Suggestion;
}
