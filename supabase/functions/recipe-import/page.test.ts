// Run: deno test --node-modules-dir=none --no-lock --allow-env supabase/functions
import assert from 'node:assert/strict';
import { isoMinutes, pageText, pickImage, readableText, recipeFromJsonLd } from './page.ts';

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

// pickImage ---------------------------------------------------------------------------------------------------
const PAGE = 'https://www.example.dk/opskrifter/kylling?x=1';
const withMeta = (...tags: string[]) => `<html><head>${tags.join('')}</head><body></body></html>`;
const recipeWith = (image: unknown) => ld({ '@type': 'Recipe', name: 'X', image });

Deno.test('pickImage reads a JSON-LD image given as a string, an array of strings and an ImageObject', () => {
  assert.equal(pickImage(recipeWith('https://cdn.example.dk/a.jpg'), PAGE), 'https://cdn.example.dk/a.jpg');
  assert.equal(pickImage(recipeWith(['https://cdn.example.dk/a.jpg', 'https://cdn.example.dk/b.jpg']), PAGE), 'https://cdn.example.dk/a.jpg');
  assert.equal(pickImage(recipeWith({ '@type': 'ImageObject', url: 'https://cdn.example.dk/o.jpg', width: 800, height: 600 }), PAGE), 'https://cdn.example.dk/o.jpg');
  assert.equal(pickImage(recipeWith({ '@type': 'ImageObject', contentUrl: 'https://cdn.example.dk/c.jpg' }), PAGE), 'https://cdn.example.dk/c.jpg');
});

Deno.test('pickImage prefers the largest ImageObject, and the first when none has a size', () => {
  const sized = [
    { '@type': 'ImageObject', url: 'https://cdn.example.dk/small.jpg', width: 400, height: 300 },
    { '@type': 'ImageObject', url: 'https://cdn.example.dk/big.jpg', width: '1600', height: '1200' },
    { '@type': 'ImageObject', url: 'https://cdn.example.dk/mid.jpg', width: 800, height: 800 },
  ];
  assert.equal(pickImage(recipeWith(sized), PAGE), 'https://cdn.example.dk/big.jpg');
  const unsized = [{ url: 'https://cdn.example.dk/first.jpg' }, { url: 'https://cdn.example.dk/second.jpg' }];
  assert.equal(pickImage(recipeWith(unsized), PAGE), 'https://cdn.example.dk/first.jpg');
});

Deno.test('pickImage finds the Recipe image inside @graph, also through an @id reference', () => {
  const graph = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'ImageObject', '@id': '#hero', url: 'https://cdn.example.dk/hero.jpg', width: 1000, height: 700 },
    { '@type': 'Recipe', name: 'X', image: { '@id': '#hero' } },
  ] };
  assert.equal(pickImage(ld(graph), PAGE), 'https://cdn.example.dk/hero.jpg');
  const inline = { '@graph': [{ '@type': 'WebSite' }, { '@type': 'Recipe', image: ['https://cdn.example.dk/g.jpg'] }] };
  assert.equal(pickImage(ld(inline), PAGE), 'https://cdn.example.dk/g.jpg');
});

Deno.test('pickImage falls back to og:image, then twitter:image, in either attribute order', () => {
  assert.equal(pickImage(withMeta('<meta property="og:image" content="https://cdn.example.dk/og.jpg">'), PAGE), 'https://cdn.example.dk/og.jpg');
  assert.equal(pickImage(withMeta('<meta content="https://cdn.example.dk/og2.jpg" property="og:image" />'), PAGE), 'https://cdn.example.dk/og2.jpg');
  assert.equal(pickImage(withMeta('<meta name="twitter:image" content="https://cdn.example.dk/tw.jpg">'), PAGE), 'https://cdn.example.dk/tw.jpg');
  assert.equal(pickImage(withMeta('<meta name="twitter:image" content="https://cdn.example.dk/tw.jpg"><meta property="og:image" content="https://cdn.example.dk/og.jpg">'), PAGE), 'https://cdn.example.dk/og.jpg');
  // JSON-LD wins over meta tags; a Recipe without an image falls through to og:image.
  const both = ld({ '@type': 'Recipe', image: 'https://cdn.example.dk/ld.jpg' }).replace('</head>', '<meta property="og:image" content="https://cdn.example.dk/og.jpg"></head>');
  assert.equal(pickImage(both, PAGE), 'https://cdn.example.dk/ld.jpg');
  const noImage = ld({ '@type': 'Recipe', name: 'X' }).replace('</head>', '<meta property="og:image" content="https://cdn.example.dk/og.jpg"></head>');
  assert.equal(pickImage(noImage, PAGE), 'https://cdn.example.dk/og.jpg');
});

Deno.test('pickImage resolves relative and protocol-relative addresses against the page', () => {
  assert.equal(pickImage(recipeWith('/img/a.jpg'), PAGE), 'https://www.example.dk/img/a.jpg');
  assert.equal(pickImage(recipeWith('a.jpg'), PAGE), 'https://www.example.dk/opskrifter/a.jpg');
  assert.equal(pickImage(withMeta('<meta property="og:image" content="//cdn.example.dk/p.jpg">'), PAGE), 'https://cdn.example.dk/p.jpg');
});

Deno.test('pickImage keeps only https: http is upgraded on the page\'s own host, other schemes and long addresses are dropped', () => {
  assert.equal(pickImage(recipeWith('http://www.example.dk/a.jpg'), PAGE), 'https://www.example.dk/a.jpg');
  assert.equal(pickImage(recipeWith('http://other.example/a.jpg'), PAGE), null);
  assert.equal(pickImage(recipeWith('data:image/png;base64,AAAA'), PAGE), null);
  assert.equal(pickImage(recipeWith('javascript:alert(1)'), PAGE), null);
  assert.equal(pickImage(recipeWith('https://cdn.example.dk/' + 'a'.repeat(2000)), PAGE), null);
  // An unusable first choice does not hide a usable later one.
  assert.equal(pickImage(recipeWith('data:image/png;base64,AAAA') .replace('</head>', '<meta property="og:image" content="https://cdn.example.dk/og.jpg"></head>'), PAGE), 'https://cdn.example.dk/og.jpg');
});

Deno.test('pickImage decodes HTML entities in a meta content attribute, and returns null when there is nothing', () => {
  assert.equal(pickImage(withMeta("<meta property='og:image' content='https://cdn.example.dk/a.jpg?w=1&amp;h=2'>"), PAGE), 'https://cdn.example.dk/a.jpg?w=1&h=2');
  assert.equal(pickImage('<html><body>ingenting</body></html>', PAGE), null);
  assert.equal(pickImage('<script type="application/ld+json">{ikke json</script>', PAGE), null);
  assert.equal(pickImage(withMeta('<meta property="og:image" content="">'), PAGE), null);
  assert.equal(pickImage(withMeta('<meta property="og:image" content="https://cdn.example.dk/a.jpg">'), 'ikke et link'), null);
});
