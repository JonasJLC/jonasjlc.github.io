// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { LABEL_DEFS, firstName, issueBody, labelsFor, plain, type Row } from './logic.ts';

const ferieRow: Row = {
  id: '00000000-0000-0000-0000-000000000001',
  app: 'ferie',
  title: 'Pr. rejse',
  summary: 'Jeg vil se, hvor meget vi har brugt pr. rejse.',
  details: { why: 'Så vi kan planlægge næste tur.', area: 'rejsekassen', acceptance: ['Man kan vælge en rejse', ' ', 'Summen vises'] },
  created_by_name: 'Jonas Christiansen',
  github_issue_number: null,
};

Deno.test('a ferie row produces exactly the issue text it always did', () => {
  assert.equal(
    issueBody(ferieRow),
    [
      'Forslag til Ferieplan fra Jonas, indsamlet via Forslag-chatten i appen.',
      '',
      '## Ønske',
      'Jeg vil se, hvor meget vi har brugt pr. rejse.',
      '',
      '## Hvorfor',
      'Så vi kan planlægge næste tur.',
      '',
      '## Område',
      'Rejsekassen',
      '',
      '## Sådan ser man, at det virker',
      '- Man kan vælge en rejse',
      '- Summen vises',
      '',
      '---',
      '_Oprettet automatisk. Bygges fra GitHub efter triage; appens Forslag-liste linker hertil._',
    ].join('\n'),
  );
});

Deno.test('a row without app is a ferie row', () => {
  const { app: _app, ...rest } = ferieRow;
  assert.equal(issueBody(rest as Row), issueBody(ferieRow));
  assert.deepEqual(labelsFor(undefined), ['forslag']);
});

Deno.test('labels per app', () => {
  assert.deepEqual(labelsFor('ferie'), ['forslag']);
  assert.deepEqual(labelsFor('strandparken'), ['forslag', 'strandparken']);
  assert.deepEqual(labelsFor('something-else'), ['forslag']);
  // every label an issue can carry is created first
  for (const l of labelsFor('strandparken')) assert.ok(LABEL_DEFS.some((d) => d.name === l), l);
  assert.equal(LABEL_DEFS.find((d) => d.name === 'strandparken')!.description, 'Wish from the Strandparken Forslag chat');
  assert.equal(LABEL_DEFS.find((d) => d.name === 'forslag')!.description, 'Wish from the Ferieplan Forslag chat');
  assert.notEqual(LABEL_DEFS[0].color, LABEL_DEFS[1].color);
});

Deno.test('a strandparken row says Strandparken, uses its area labels and names only the first name', () => {
  const body = issueBody({
    ...ferieRow, app: 'strandparken', created_by_name: 'Camilla Hansen',
    details: { area: 'lister', acceptance: [] },
  });
  assert.ok(body.startsWith('Forslag til Strandparken fra Camilla, indsamlet via Forslag i appen.\n'));
  assert.ok(body.includes('## Område\nIndkøb'));
  assert.ok(!body.includes('Ferieplan'));
  assert.ok(!body.includes('Hansen'));
  assert.ok(!body.includes('## Hvorfor'));
});

Deno.test('an area from the other app is left out', () => {
  assert.ok(!issueBody({ ...ferieRow, app: 'strandparken', details: { area: 'rejsekassen' } }).includes('## Område'));
  assert.ok(!issueBody({ ...ferieRow, app: 'ferie', details: { area: 'madplan' } }).includes('## Område'));
});

Deno.test('firstName never returns an email address', () => {
  assert.equal(firstName('Jonas Christiansen'), 'Jonas');
  assert.equal(firstName('  Camilla  '), 'Camilla');
  assert.equal(firstName('jonas@example.com'), '');
  assert.equal(firstName('Jonas jonas@example.com'), '');
  assert.equal(firstName(''), '');
  const body = issueBody({ ...ferieRow, app: 'strandparken', created_by_name: 'cam@example.com' });
  assert.ok(body.startsWith('Forslag til Strandparken, indsamlet via Forslag i appen.'));
  assert.ok(!body.includes('cam@'));
});

Deno.test('plain defuses @ mentions and strips carriage returns', () => {
  assert.ok(!/@[a-z]/i.test(plain('hej @jonasjlc og @team')));
  assert.equal(plain(' a\r\nb '), 'a\nb');
  assert.equal(plain('@x').length, 3); // @, zero-width space, x
  assert.ok(!/@[a-z]/i.test(issueBody({ ...ferieRow, summary: 'ping @nogen' })));
});
