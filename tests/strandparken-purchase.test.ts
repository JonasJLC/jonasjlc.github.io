import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ingredients } from '../src/components/strandparken/lib/shopping/ingredients-dk.ts';
import { canonicalName } from '../src/components/strandparken/lib/shopping/model.ts';
import {
  ingredientFor, purchaseFor, purchaseText, recipeRounded, toBase, unitLabel, unitOptions, type Part,
} from '../src/components/strandparken/lib/shopping/purchase.ts';

const key = (name: string) => ingredientFor(name)?.key ?? null;
const ing = (k: string) => {
  const found = ingredients.find((i) => i.key === k);
  assert.ok(found, `no entry ${k}`);
  return found;
};
const buy = (k: string | null, parts: Part[], pref?: string) => {
  const p = purchaseFor(k ? ing(k) : null, parts, pref);
  return p.pantry ? 'pantry' : `${p.approx ? 'ca. ' : ''}${p.amount ?? ''} ${p.unit ?? ''}`.trim();
};
const part = (amount: number | null, unit: string | null = null): Part => ({ amount, unit });

// ---- Task 1: name lookup

test('names and variants find their ingredient', () => {
  for (const n of ['Lime', 'limes', 'lime, økologisk']) assert.equal(key(n), 'lime', n);
  for (const n of ['store tomater', 'Tomater (modne)', 'tomat']) assert.equal(key(n), 'tomat', n);
  for (const n of ['hakkede tomater', 'flåede tomater']) assert.equal(key(n), 'tomater-daase', n);
  assert.equal(key('cherrytomater'), 'cherrytomat');
  assert.equal(key('rødløg'), 'rødløg');
  assert.equal(key('hvidløg'), 'hvidløg');
  assert.equal(key('forårsløg'), 'forårsløg');
  assert.equal(key('tun i vand'), 'tun');
  assert.equal(key('creme fraiche 18%'), 'creme-fraiche');
  assert.equal(key('kyllingebryst'), 'kyllingebryst');
  assert.equal(key('kylling'), 'kylling');
  assert.equal(key('drage-frugt'), null);
});

test('compounds and leading words fall back to the key word', () => {
  assert.equal(key('finthakket løg'), 'løg');
  assert.equal(key('rød peberfrugt'), 'peberfrugt');
  assert.equal(key('letmælk'), 'mælk');
  assert.equal(key('perleløg'), 'løg');
  assert.equal(key('kokosmælk'), 'kokosmælk');
  assert.equal(key('røget paprika'), 'paprika');
  assert.equal(key('Løg, hakket'), 'løg');
  assert.equal(key('2 fed hvidløg'.slice(2)), 'hvidløg');
  assert.equal(key('halloumi'), null);
  assert.equal(key('tahin'), null);
});

// ---- Task 2: the table

test('the table covers at least 100 ingredients with unique keys and aliases', () => {
  assert.ok(ingredients.length >= 100, `only ${ingredients.length}`);
  assert.equal(new Set(ingredients.map((i) => i.key)).size, ingredients.length);
  const owner = new Map<string, string>();
  for (const i of ingredients) for (const a of i.aliases) {
    assert.ok(!owner.has(a), `${a} belongs to ${owner.get(a)} and ${i.key}`);
    owner.set(a, i.key);
  }
});

test('every entry has what its rule needs, and every alias resolves to its own entry', () => {
  for (const i of ingredients) {
    if (i.rule === 'package') assert.ok(i.pack, `${i.key} needs pack`);
    if (i.rule === 'weight' || i.rule === 'count') assert.ok(i.pieceGrams, `${i.key} needs pieceGrams`);
    if (i.pantryBelow !== undefined) assert.ok(i.pack, `${i.key} needs pack for pantryBelow`);
    for (const a of i.aliases) {
      assert.equal(a, canonicalName(a), `${a} is not canonical`);
      assert.equal(ingredientFor(a)?.key, i.key, `${a}`);
    }
  }
});

// ---- Task 3: base measure

test('amounts convert to the ingredient base measure', () => {
  assert.equal(toBase(ing('tun'), 1.5, 'spsk')?.value, 22.5);
  assert.equal(toBase(ing('tun'), 1.5, 'spsk')?.measure, 'g');
  assert.deepEqual(toBase(ing('lime'), 1.5, null), { value: 1.5, measure: 'stk', approx: false });
  assert.deepEqual(toBase(ing('kartofler'), 3, 'stk'), { value: 360, measure: 'g', approx: false });
  assert.deepEqual(toBase(ing('creme-fraiche'), 2.5, 'dl'), { value: 250, measure: 'ml', approx: false });
  assert.ok(Math.abs(toBase(ing('hvidløg'), 3, 'fed')!.value - 0.3) < 1e-9);
  assert.equal(toBase(ing('løg'), 300, 'g')?.value, 3);
  assert.equal(toBase(ing('tun'), 1, 'håndfuld'), null);
  assert.equal(toBase(ing('tun'), null, 'g'), null);
  assert.equal(toBase(ing('tortillas'), 200, 'g'), null); // no piece weight
});

test('a volume for a weighed item without a density is marked approximate', () => {
  assert.deepEqual(toBase(ing('hakket-oksekød'), 1, 'dl'), { value: 100, measure: 'g', approx: true });
});

// ---- Task 4: purchase quantity

test('the source document examples', () => {
  assert.equal(buy('lime', [part(1.5)]), '2 stk');
  assert.equal(buy('tun', [part(1.5, 'spsk')]), '1 dåse');
  assert.equal(buy('tortillas', [part(8)]), '1 pakke');
  assert.equal(buy('creme-fraiche', [part(1, 'dl')]), '1 bæger');
  assert.equal(buy('passata', [part(4, 'dl')]), '1 karton');
  assert.equal(buy('kartofler', [part(650, 'g')]), '700 g');
});

test('one row per rule', () => {
  assert.equal(buy('løg', [part(300, 'g')]), '3 stk');
  assert.equal(buy('creme-fraiche', [part(2.5, 'dl')]), '2 bæger');
  assert.equal(buy('gulerødder', [part(4)]), '400 g');
  assert.equal(buy('spidskommen', [part(1, 'tsk')]), 'pantry');
  assert.equal(buy('hvidløg', [part(3, 'fed')]), '1 stk');
  assert.equal(buy('tomat', [part(2), part(200, 'g')]), '1 bakke');
});

test('amounts are summed before rounding', () => {
  assert.equal(buy('lime', [part(0.5), part(0.5), part(0.5)]), '2 stk');
  assert.equal(buy('hakket-oksekød', [part(250, 'g'), part(300, 'g')]), '2 bakke');
});

test('loose weight shows kg from 1000 g', () => {
  assert.deepEqual(purchaseFor(ing('kartofler'), [part(1000, 'g')]), { amount: 1, unit: 'kg', pantry: false, approx: false });
  assert.deepEqual(purchaseFor(ing('kartofler'), [part(1050, 'g')]), { amount: 1.1, unit: 'kg', pantry: false, approx: false });
  assert.equal(buy('kartofler', [part(1, 'kg')]), '1 kg');
});

test('pantry items, with an amount threshold for baking basics', () => {
  assert.deepEqual(purchaseFor(ing('salt'), [part(1, 'tsk')]), { amount: null, unit: null, pantry: true, approx: false });
  assert.equal(buy('sukker', [part(1, 'tsk')]), 'pantry');
  assert.equal(buy('sukker', [part(500, 'g')]), '1 pose');
  assert.equal(buy('mel', [part(5, 'dl')]), '1 pose'); // 300 g
  assert.equal(buy('smør', [part(2, 'spsk')]), 'pantry');
  assert.equal(buy('smør', [part(300, 'g')]), '2 pakke');
});

test('unknown ingredients: whole pieces for counts, else the recipe amount rounded up', () => {
  assert.equal(buy(null, [part(1.5, 'stk')]), '2 stk');
  assert.equal(buy(null, [part(1.5), part(1)]), '3 stk');
  assert.equal(buy(null, [part(1.5, 'spsk')]), '2 spsk');
  assert.equal(buy(null, [part(125, 'g')]), '130 g');
  assert.equal(buy(null, [part(1.5, 'dl')]), '2 dl');
  assert.equal(buy(null, [part(1.2, 'l')]), '1.5 l');
  assert.equal(buy(null, [part(null)]), '');
});

test('unconvertible amounts give one package or one piece, marked approximate', () => {
  assert.equal(buy('persille', [part(1, 'håndfuld')]), 'ca. 1 bundt (30 gram)');
  assert.equal(buy('persille', [part(null)]), 'ca. 1 bundt (30 gram)');
  assert.equal(buy('avocado', [part(null)]), 'ca. 1 stk');
  assert.equal(buy('tomat', [part(2), part(1, 'håndfuld')]), 'ca. 1 bakke');
});

test('a remembered unit wins over the default', () => {
  assert.equal(buy('tomat', [part(400, 'g')], 'stk'), '4 stk');
  assert.equal(buy('tomat', [part(400, 'g')], 'bakke'), '1 bakke');
  assert.equal(buy('tomat', [part(400, 'g')], 'g'), '400 g');
  assert.equal(buy('tomat', [part(400, 'g')], 'kg'), '0.4 kg');
  assert.equal(buy('lime', [part(1.5), part(0.25)], 'recipe'), '2 stk');
  assert.equal(buy('tomat', [part(2), part(150, 'g')], 'recipe'), '350 g');
  assert.equal(buy('mælk', [part(3, 'dl')], 'ml'), '300 ml');
  assert.equal(buy('tortillas', [part(8)], 'g'), '1 pakke'); // cannot weigh tortillas: default
  assert.equal(buy('tomat', [part(400, 'g')], 'pose'), '1 bakke'); // not this ingredient's package
});

test('unit options per ingredient', () => {
  assert.deepEqual(unitOptions(ing('tomat')), ['bakke', 'stk', 'g', 'recipe']);
  assert.deepEqual(unitOptions(ing('lime')), ['stk', 'g', 'recipe']);
  assert.deepEqual(unitOptions(ing('creme-fraiche')), ['bæger', 'ml', 'recipe']);
  assert.deepEqual(unitOptions(ing('tortillas')), ['pakke', 'stk', 'recipe']);
  assert.deepEqual(unitOptions(ing('salt')), []);
  assert.deepEqual(unitOptions(null), []);
});

test('package units take the Danish plural after a number above one', () => {
  assert.equal(unitLabel(2, 'dåse'), 'dåser');
  assert.equal(unitLabel(1, 'dåse'), 'dåse');
  assert.equal(unitLabel(2, 'bæger'), 'bægre');
  assert.equal(unitLabel(3, 'stk'), 'stk');
  assert.equal(recipeRounded([part(1, 'kg'), part(250, 'g')]).amount, 1.25);
});

test('purchase text for the list', () => {
  assert.equal(purchaseText(purchaseFor(ing('tun'), [part(3, 'dåse')])), '3 dåser (555 gram)');
  assert.equal(purchaseText(purchaseFor(ing('hakket-svinekød'), [part(1000, 'g')])), '2 bakker (1000 gram)');
  assert.equal(purchaseText(purchaseFor(ing('lime'), [part(1)])), '1 stk');
  assert.equal(purchaseText(purchaseFor(ing('kartofler'), [part(1150, 'g')])), '1,2 kg');
  assert.equal(purchaseText(purchaseFor(ing('persille'), [part(null)])), 'ca. 1 bundt (30 gram)');
  assert.equal(purchaseText(purchaseFor(ing('salt'), [part(1, 'tsk')])), '');
});
