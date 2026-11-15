import { handler } from '../_shared/guard.ts';
import { Input, importRecipe } from './logic.ts';

Deno.serve(handler({ fn: 'recipe-import', schema: Input, run: ({ caller, input }) => importRecipe(caller, input) }));
