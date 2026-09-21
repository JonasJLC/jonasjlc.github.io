import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { initialState, isValidSavedState, findNickname, otherNicknames, matchesAnswer } from '../src/scripts/gave-logic.mjs';

// Read the actual editable content so every configured nickname is covered.
const source = ts.transpileModule(readFileSync(new URL('../src/content/gift.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { gift } = await import('data:text/javascript,' + encodeURIComponent(source));

test('accepts all twelve nicknames with varied casing and surrounding whitespace', () => {
  assert.equal(gift.nicknames.length, 12);
  for (const name of gift.nicknames) {
    for (const variant of [name, name.toLowerCase(), name.toUpperCase(), name[0].toUpperCase() + name.slice(1).toLowerCase(), '  ' + name + '  ']) {
      assert.equal(findNickname(variant, gift.nicknames), name);
      const alternatives = otherNicknames(variant, gift.nicknames);
      assert.equal(alternatives.length, 11);
      assert.ok(!alternatives.includes(name));
    }
  }
});

test('rejects incorrect, empty and non-string nickname inputs', () => {
  for (const value of ['', '   ', 'Muss', 'Mu ssi', 'Mussi!', null, {}]) {
    assert.equal(findNickname(value, gift.nicknames), '');
  }
});

test('destination accepts case, whitespace and punctuation variants only for the full name', () => {
  for (const answer of ['Great Northern', ' GREAT NORTHERN ', 'greatnorthern', 'Great-Northern!']) {
    assert.ok(matchesAnswer(answer, gift.riddle.answers));
  }
  for (const answer of ['', 'Great', 'North', 'Kerteminde', null]) {
    assert.equal(matchesAnswer(answer, gift.riddle.answers), false);
  }
});

test('restores valid progress and rejects old, corrupt or incomplete saved state', () => {
  assert.ok(isValidSavedState(initialState, gift.nicknames));
  for (const scene of ['welcome', 'riddle', 'gift']) {
    assert.ok(isValidSavedState({ ...initialState, nickname: 'Mussi', scene, hint: 2 }, gift.nicknames));
  }
  for (const saved of [null, {}, { ...initialState, version: 1 }, { ...initialState, scene: 'unknown' },
    { ...initialState, scene: 'gift' }, { ...initialState, hint: 1 }, { ...initialState, nickname: 'invalid', scene: 'welcome' },
    { ...initialState, nickname: 'Mussi', scene: 'riddle', hint: 3 },
    { ...initialState, nickname: 'Mussi', scene: 'riddle', hint: 0.5 }]) {
    assert.equal(isValidSavedState(saved, gift.nicknames), false);
  }
});
