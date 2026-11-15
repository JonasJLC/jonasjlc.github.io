// From a web page's HTML to the text the model reads (design §4.4, "schema.org first"). A page that carries a schema.org
// Recipe (JSON-LD) is cut down to just that recipe; any other page falls back to its readable text.

export const MAX_PAGE_TEXT = 20_000;

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '½', frac14: '¼', frac34: '¾', deg: '°' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    }
    return entities[e.toLowerCase()] ?? m;
  });
}

const plain = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Minutes in an ISO 8601 duration such as PT1H30M, or null. */
export function isoMinutes(d: unknown): number | null {
  if (typeof d !== 'string') return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i.exec(d.trim());
  if (!m) return null;
  const minutes = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return minutes > 0 ? minutes : null;
}

function* nodes(v: unknown, depth = 0): Generator<Record<string, unknown>> {
  if (depth > 6 || v === null || typeof v !== 'object') return;
  if (Array.isArray(v)) {
    for (const x of v) yield* nodes(x, depth + 1);
    return;
  }
  const o = v as Record<string, unknown>;
  yield o;
  if (o['@graph']) yield* nodes(o['@graph'], depth + 1);
}

const isRecipe = (o: Record<string, unknown>) => {
  const t = o['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
};

function textOf(v: unknown): string[] {
  if (typeof v === 'string') return [plain(v)].filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(textOf);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o.itemListElement) return textOf(o.itemListElement); // HowToSection
    return textOf(o.text ?? o.name);
  }
  return [];
}

/** A schema.org Recipe from the page's JSON-LD blocks, written out as plain text, or null. */
export function recipeFromJsonLd(html: string): string | null {
  const blocks = html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, raw] of blocks) {
    let data: unknown;
    try { data = JSON.parse(raw.trim()); } catch { continue; }
    for (const node of nodes(data)) {
      if (!isRecipe(node)) continue;
      const ingredients = textOf(node.recipeIngredient);
      const steps = textOf(node.recipeInstructions);
      if (ingredients.length + steps.length === 0) continue;
      const yieldText = textOf(node.recipeYield).join(' / ');
      const minutes = isoMinutes(node.totalTime) ?? ((isoMinutes(node.prepTime) ?? 0) + (isoMinutes(node.cookTime) ?? 0) || null);
      const lines = [
        `Title: ${textOf(node.name).join(' ')}`,
        textOf(node.description)[0] ? `Description: ${textOf(node.description)[0]}` : '',
        yieldText ? `Servings: ${yieldText}` : '',
        minutes ? `Total time (minutes): ${minutes}` : '',
        textOf(node.keywords).length ? `Keywords: ${textOf(node.keywords).join(', ')}` : '',
        'Ingredients:',
        ...ingredients.map((i) => `- ${i}`),
        'Instructions:',
        ...steps.map((s, n) => `${n + 1}. ${s}`),
      ];
      return lines.filter(Boolean).join('\n').slice(0, MAX_PAGE_TEXT);
    }
  }
  return null;
}

/** The readable text of a page: scripts, styles and page furniture removed, the article or main part preferred. */
export function readableText(html: string): string {
  let h = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|iframe|form|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');
  const part = /<article\b[\s\S]*?<\/article>/i.exec(h) ?? /<main\b[\s\S]*?<\/main>/i.exec(h);
  if (part && plain(part[0]).length > 200) h = part[0];
  const text = decodeEntities(h.replace(/<\/(p|div|li|h[1-6]|tr|ul|ol|section|br)>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return text.slice(0, MAX_PAGE_TEXT);
}

/** What the model reads for a page: the schema.org recipe when there is one, otherwise the page text. */
export function pageText(html: string): { text: string; structured: boolean } {
  const recipe = recipeFromJsonLd(html);
  return recipe ? { text: recipe, structured: true } : { text: readableText(html), structured: false };
}
