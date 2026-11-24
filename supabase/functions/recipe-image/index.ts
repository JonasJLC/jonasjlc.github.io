import { handler } from '../_shared/guard.ts';
import { Input, fetchRecipeImage } from './logic.ts';

Deno.serve(handler({ fn: 'recipe-image', schema: Input, run: ({ caller, input }) => fetchRecipeImage(caller, input) }));
