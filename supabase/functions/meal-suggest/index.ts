import { handler } from '../_shared/guard.ts';
import { Input, suggestMeal } from './logic.ts';

Deno.serve(handler({ fn: 'meal-suggest', schema: Input, run: ({ caller, input }) => suggestMeal(caller, input) }));
