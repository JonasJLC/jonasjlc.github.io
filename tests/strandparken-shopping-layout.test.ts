import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capitalise, rowLabel, styleFor, toneClasses } from '../src/components/strandparken/lib/shopping/category-style.ts';
import { groupLines, mergeRows, settle, type GroceryCategory, type ShoppingRow } from '../src/components/strandparken/lib/shopping/model.ts';

const d31 = [
  'Frugt & grønt', 'Brød & bagværk', 'Kød & fisk', 'Pålæg & køl', 'Mejeri & æg', 'Frost', 'Kolonial', 'Konserves & glas',
  'Krydderier, olie & bagning', 'Drikkevarer', 'Snacks & slik', 'Husholdning & pleje', 'Andet',
];
const cats = ['Frugt & grønt', 'Mejeri & æg', 'Andet'].map((name, position) => ({ id: `c${position}`, name, position })) as GroceryCategory[];

let n = 0;
const stored = (w: Partial<ShoppingRow> & Pick<ShoppingRow, 'name'>): ShoppingRow =>
  ({ id: `r${n++}`, canonical_name: null, amount: null, unit: null, grocery_category_id: null, status: 'active', source: 'manual', plan_entry_id: null, recipe_id: null, ...w }) as ShoppingRow;

test('category styles: the D31 anchors and loose spelling', () => {
  assert.deepEqual(styleFor('Frugt & grønt'), { tone: 'sage', icon: 'apple' });
  assert.deepEqual(styleFor('Frugt og grønt'), styleFor('Frugt & grønt'));
  assert.deepEqual(styleFor('  frugt   &  GRØNT '), styleFor('Frugt & grønt'));
  assert.equal(styleFor('Kolonial').tone, 'honey');
  assert.equal(styleFor('Mejeri & æg').tone, 'sky');
  assert.deepEqual(styleFor('Tjek at I har'), { tone: 'neutral', icon: 'list-checks' });
});

test('an unknown or renamed category gets the neutral basket', () => {
  for (const name of ['Bageri', 'Frugt', '', null, undefined]) assert.deepEqual(styleFor(name), { tone: 'neutral', icon: 'shopping-basket' });
});

test('every D31 category has a style with full Tailwind classes', () => {
  for (const name of d31) {
    const style = styleFor(name);
    assert.ok(name === 'Andet' || style.tone !== 'neutral', name);
    assert.match(toneClasses[style.tone], /^bg-sp-\S+ text-sp-\S+$/);
  }
});

test('capitalise changes only the first letter', () => {
  assert.equal(capitalise('avocado, modne'), 'Avocado, modne');
  assert.equal(capitalise('æg'), 'Æg');
  assert.equal(capitalise('Mælk'), 'Mælk');
  assert.equal(capitalise(''), '');
});

test('row label spells out the amount and the day', () => {
  assert.equal(rowLabel('lime', '2 stk', 'Tor'), 'Lime, 2 stk, til torsdag');
  assert.equal(rowLabel('Mælk', '', null), 'Mælk');
  assert.equal(rowLabel('Æg', '1 bakke', 'I dag'), 'Æg, 1 bakke, til i dag');
  assert.equal(rowLabel('Løg', '', '27/11'), 'Løg, til 27/11');
});

const week = () => mergeRows([
  stored({ name: 'Agurk', grocery_category_id: 'c0' }),
  stored({ name: 'Lime', amount: 2, grocery_category_id: 'c0', status: 'checked', source: 'plan' }),
  stored({ name: 'Mælk', grocery_category_id: 'c1', status: 'checked' }),
  stored({ name: 'Salt', amount: 1, unit: 'tsk', source: 'plan', status: 'checked' }),
]);
const keyOf = (lines: ReturnType<typeof week>, name: string) => lines.find((l) => l.name === name)!.key;

test('settle: ticked lines are bought, a just-ticked line stays open, pantry lines never move', () => {
  const lines = week();
  const plain = settle(lines);
  assert.deepEqual(plain.open.map((l) => l.name).sort(), ['Agurk', 'Salt']);
  assert.deepEqual(plain.bought.map((l) => l.name).sort(), ['Lime', 'Mælk']);
  assert.deepEqual(plain.settling, []);

  const waiting = settle(lines, new Set([keyOf(lines, 'Lime')]));
  assert.deepEqual(waiting.open.map((l) => l.name).sort(), ['Agurk', 'Lime', 'Salt']);
  assert.deepEqual(waiting.settling.map((l) => l.name), ['Lime']);
  assert.deepEqual(waiting.bought.map((l) => l.name), ['Mælk']);
});

test('settle: unticking a settling line cancels the move', () => {
  const lines = week().map((l) => (l.name === 'Lime' ? { ...l, checked: false } : l));
  const out = settle(lines, new Set([keyOf(lines, 'Lime')]));
  assert.ok(out.open.some((l) => l.name === 'Lime'));
  assert.deepEqual(out.settling, []);
  assert.ok(!out.bought.some((l) => l.name === 'Lime'));
});

test('groupLines with doneSeparately: groups hold open lines, Købt holds the rest', () => {
  const lines = week();
  const { groups, bought } = groupLines(lines, cats, { doneSeparately: true, settling: new Set([keyOf(lines, 'Lime')]) });
  assert.deepEqual(groups.map((g) => g.name), ['Frugt & grønt', 'Tjek at I har']);
  // The settling line keeps its place in name order, shown ticked.
  assert.deepEqual(groups[0].open.map((l) => [l.name, l.checked]), [['Agurk', false], ['Lime', true]]);
  assert.deepEqual(groups[0].done, []);
  assert.deepEqual(groups[1].done.map((l) => l.name), ['Salt']);
  assert.deepEqual(bought.map((l) => l.name), ['Mælk']);
});

test('groupLines keeps its old shape without options', () => {
  const groups = groupLines(week(), cats);
  assert.ok(Array.isArray(groups));
  assert.deepEqual(groups[0].done.map((l) => l.name), ['Lime']);
});
