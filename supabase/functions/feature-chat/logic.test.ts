// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MAX_CHARS, MAX_MESSAGES, areasFor, parseApp, shapeReply, systemFor, toolsFor, validMessages } from './logic.ts';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const u = (content: string) => ({ role: 'user', content });
const a = (content: string) => ({ role: 'assistant', content });

Deno.test('validMessages accepts alternating turns that start and end with the user', () => {
  assert.equal(validMessages([u('hej')]), true);
  assert.equal(validMessages([u('hej'), a('hvad?'), u('mere')]), true);
});

Deno.test('validMessages rejects the shapes it rejected before', () => {
  assert.equal(validMessages([]), false);
  assert.equal(validMessages('hej'), false);
  assert.equal(validMessages(null), false);
  assert.equal(validMessages([a('først')]), false); // must start with the user
  assert.equal(validMessages([u('hej'), a('hvad?')]), false); // must end with the user
  assert.equal(validMessages([u('hej'), u('igen')]), false); // must alternate
  assert.equal(validMessages([u('   ')]), false); // no blanks
  assert.equal(validMessages([{ role: 'user', content: 5 }]), false);
  assert.equal(validMessages([u('x'.repeat(MAX_CHARS + 1))]), false);
  assert.equal(validMessages([u('x'.repeat(MAX_CHARS))]), true);
  const long = Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => (i % 2 === 0 ? u('x') : a('x')));
  assert.equal(validMessages(long), false);
  assert.equal(validMessages(long.slice(0, MAX_MESSAGES - 1)), true); // 11 messages: ends with the user
});

Deno.test('parseApp defaults to ferie so a cached /ferie/ page keeps working', () => {
  assert.equal(parseApp(undefined), 'ferie');
  assert.equal(parseApp('ferie'), 'ferie');
  assert.equal(parseApp('strandparken'), 'strandparken');
  assert.equal(parseApp('other'), null);
  assert.equal(parseApp(null), null);
  assert.equal(parseApp(5), null);
  assert.equal(parseApp(''), null);
});

Deno.test('the ferie prompt and tools are byte-identical to the deployed ones', () => {
  assert.equal(sha(systemFor('ferie')), 'db54d3df87adcaa41c377de34a9166490b67feef06295834e7dbed9e0fee650c');
  assert.equal(sha(JSON.stringify(toolsFor('ferie'))), 'db7b2907fab63406664e474bd79ddea58a64721579ec3960edfa3e624a7ad828');
});

Deno.test('the strandparken tools carry the strandparken area enum', () => {
  const submit = toolsFor('strandparken').find((t) => t.name === 'submit_request')!;
  const area = (submit.input_schema.properties as unknown as Record<string, { enum?: string[] }>).area;
  assert.deepEqual(area.enum, ['hjem', 'madplan', 'lister', 'sundhed', 'opskrifter', 'indstillinger', 'andet']);
  assert.deepEqual(areasFor('ferie'), ['feriedage', 'rejsekassen', 'rejseplan', 'indstillinger', 'andet']);
  assert.deepEqual(toolsFor('strandparken').map((t) => t.name), ['ask_followup', 'submit_request']);
});

Deno.test('the strandparken prompt names the tabs and keeps health details out', () => {
  const p = systemFor('strandparken');
  for (const tab of ['Hjem', 'Madplan', 'Lister', 'Sundhed', 'Opskrifter', 'Indstillinger']) assert.ok(p.includes(tab), tab);
  assert.ok(p.includes('Strandparken'));
  assert.ok(p.includes('Camilla og Jonas'));
  assert.ok(p.includes('helbredsoplysninger'));
  assert.ok(!p.includes('Ferieplan'));
});

Deno.test('shapeReply clips fields and keeps at most four acceptance points', () => {
  const r = shapeReply('strandparken', {
    name: 'submit_request',
    input: {
      title: ` ${'t'.repeat(200)} `, summary: 's'.repeat(2000), why: 'w'.repeat(900), area: 'madplan', message: 'm'.repeat(500),
      acceptance: ['a', 'b', 'c', 'd', 'e', ' ', 'x'.repeat(300)],
    },
  });
  assert.equal(r?.type, 'request');
  if (r?.type !== 'request') return;
  assert.equal(r.request.title.length, 120);
  assert.equal(r.request.summary.length, 1000);
  assert.equal(r.request.why.length, 500);
  assert.equal(r.message.length, 300);
  assert.equal(r.request.area, 'madplan');
  assert.deepEqual(r.request.acceptance, ['a', 'b', 'c', 'd']);
});

Deno.test('shapeReply maps an unknown or foreign area to andet', () => {
  const base = { title: 'Titel', summary: 'Beskrivelse', acceptance: [], message: 'ok' };
  const area = (app: 'ferie' | 'strandparken', v: unknown) => {
    const r = shapeReply(app, { name: 'submit_request', input: { ...base, area: v } });
    return r?.type === 'request' ? r.request.area : null;
  };
  assert.equal(area('strandparken', 'rejsekassen'), 'andet');
  assert.equal(area('ferie', 'madplan'), 'andet');
  assert.equal(area('ferie', 'rejsekassen'), 'rejsekassen');
  assert.equal(area('strandparken', undefined), 'andet');
});

Deno.test('shapeReply returns a question, or null when the model output is unusable', () => {
  assert.deepEqual(shapeReply('ferie', { name: 'ask_followup', input: { question: ' Hvor i appen? ' } }), { type: 'question', text: 'Hvor i appen?' });
  assert.equal(shapeReply('ferie', { name: 'ask_followup', input: { question: '  ' } }), null);
  assert.equal(shapeReply('ferie', { name: 'submit_request', input: { title: 'ab', summary: 'langt nok' } }), null);
  assert.equal(shapeReply('ferie', { name: 'submit_request', input: { title: 'Titel', summary: 'x' } }), null);
  assert.equal(shapeReply('ferie', { name: 'submit_request' }), null);
});
