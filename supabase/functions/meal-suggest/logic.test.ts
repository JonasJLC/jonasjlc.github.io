// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { HttpError } from '../_shared/http.ts';
import { fakeCaller, fakeModel, fakeUsage } from '../_shared/fakes.ts';
import { Input, suggestMeal } from './logic.ts';

Deno.env.delete('SP_AI_MODEL');
const limits = { monthlyCapDkk: 50, dailyCallsPerPerson: 60, usdToDkk: 7 };

const cand = (id: string, over: Record<string, unknown> = {}) => ({
  id, kind: 'recipe', title: `Ret ${id}`, tags: [], ingredients: ['løg'], cooked: 0, savedRecently: false, dislikeHits: [], ...over,
});
const input = (over: Record<string, unknown> = {}) =>
  Input.parse({ candidates: [cand('r1'), cand('i1', { kind: 'idea', ingredients: [] })], week: ['Pasta'], dislikes: ['koriander'], preferences: ['Gerne fisk'], ...over });
const fail = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : 'other'; }
};

Deno.test('returns the chosen candidate with a cleaned one-line reason; household data goes in as untrusted data', async () => {
  const client = fakeModel([{ text: JSON.stringify({ id: 'i1', reason: '  Let   og grøn.  ' }) }]);
  const out = await suggestMeal(fakeCaller(), input(), { client, limits });
  assert.deepEqual(out, { id: 'i1', kind: 'idea', reason: 'Let og grøn.' });
  const sent = client.sent[0] as { messages: { content: string }[]; output_config: unknown };
  assert.match(sent.messages[0].content, /^<untrusted source="household data">/);
  assert.equal('tools' in sent, false);
});

Deno.test('an id that is not a candidate never comes back: the schema refuses it and the call fails', async () => {
  const usage = fakeUsage();
  const client = fakeModel([{ text: JSON.stringify({ id: 'x9', reason: 'Noget helt andet.' }) }]);
  assert.equal(await fail(suggestMeal(fakeCaller(usage), input(), { client, limits })), '502 invalid_output');
  assert.equal(usage.rows.every((r) => !r.ok), true);
});

Deno.test('a long reason is cut to 160 characters', async () => {
  const client = fakeModel([{ text: JSON.stringify({ id: 'r1', reason: 'a'.repeat(400) }) }]);
  const out = await suggestMeal(fakeCaller(), input(), { client, limits });
  assert.equal(out.reason.length, 160);
});

Deno.test('input limits: no candidates, too many candidates and a missing field are rejected', () => {
  assert.equal(Input.safeParse({ candidates: [], week: [], dislikes: [], preferences: [] }).success, false);
  assert.equal(Input.safeParse({ candidates: Array.from({ length: 61 }, (_, i) => cand(`r${i}`)), week: [], dislikes: [], preferences: [] }).success, false);
  assert.equal(Input.safeParse({ candidates: [cand('r1')], week: [], dislikes: [] }).success, false);
});
