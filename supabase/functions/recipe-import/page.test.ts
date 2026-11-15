// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { isoMinutes, pageText, readableText, recipeFromJsonLd } from './page.ts';

const ld = (data: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body>menu</body></html>`;

Deno.test('ISO durations become minutes', () => {
  assert.equal(isoMinutes('PT45M'), 45);
  assert.equal(isoMinutes('PT1H30M'), 90);
  assert.equal(isoMinutes('P1DT2H'), 1560);
  assert.equal(isoMinutes('PT0M'), null);
  assert.equal(isoMinutes('en time'), null);
  assert.equal(isoMinutes(undefined), null);
});

Deno.test('a schema.org Recipe is found at the top, in a @graph and in an array, and written out as text', () => {
  const recipe = {
    '@type': ['Recipe', 'Thing'], name: 'Boller &amp; brød', description: 'Luftige', recipeYield: ['12', '12 boller'], totalTime: 'PT1H15M', keywords: 'bagværk, hurtig',
    recipeIngredient: ['500 g mel', '3 dl <b>mælk</b>'],
    recipeInstructions: [{ '@type': 'HowToStep', text: 'Ælt dejen.' }, { '@type': 'HowToSection', name: 'Bag', itemListElement: [{ '@type': 'HowToStep', text: 'Bag i 20 min.' }] }, 'Server.'],
  };
  for (const data of [recipe, { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }, recipe] }, [{ '@type': 'Organization' }, recipe]]) {
    const text = recipeFromJsonLd(ld(data)) ?? '';
    assert.match(text, /^Title: Boller & brød/);
    assert.match(text, /Servings: 12 \/ 12 boller/);
    assert.match(text, /Total time \(minutes\): 75/);
    assert.match(text, /- 3 dl mælk/);
    assert.match(text, /1\. Ælt dejen\.\n2\. Bag i 20 min\.\n3\. Server\./);
  }
});

Deno.test('broken or recipe-less JSON-LD is skipped, then the page text is used', () => {
  assert.equal(recipeFromJsonLd('<script type="application/ld+json">{ikke json</script>'), null);
  assert.equal(recipeFromJsonLd(ld({ '@type': 'Article', name: 'x' })), null);
  assert.equal(recipeFromJsonLd(ld({ '@type': 'Recipe', name: 'Tom' })), null);
  const page = pageText(`<html><body><nav>Menu</nav><main><h1>Frikadeller</h1><p>${'Rør farsen. '.repeat(30)}</p></main><footer>Cookies</footer></body></html>`);
  assert.equal(page.structured, false);
  assert.match(page.text, /^Frikadeller/);
  assert.equal(/Menu|Cookies/.test(page.text), false);
});

Deno.test('readable text drops scripts and styles, keeps line breaks, and is capped', () => {
  const text = readableText('<body><style>p{color:red}</style><script>alert(1)</script><p>Første&nbsp;linje</p><ul><li>Mel</li><li>Smør</li></ul>' + '<p>x</p>'.repeat(30000) + '</body>');
  assert.match(text, /^Første linje\nMel\nSmør\n/);
  assert.equal(text.includes('alert'), false);
  assert.equal(text.includes('color'), false);
  assert.equal(text.length <= 20000, true);
});
