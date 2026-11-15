import { getClient } from '../auth';
import { importErrorMessage, type ImportedRecipe } from './import';
import { shrinkImage } from './repo';

export class ImportError extends Error {}

type Body = { kind: 'text'; text: string; sourceUrl?: string } | { kind: 'images'; images: { mediaType: 'image/jpeg'; data: string }[]; sourceUrl?: string };

async function call(body: Body): Promise<ImportedRecipe> {
  const c = await getClient();
  const { data, error } = await c.functions.invoke('recipe-import', { body });
  if (error) {
    let code: string | undefined;
    try {
      code = ((await (error as { context?: Response }).context?.json()) as { error?: string } | undefined)?.error;
    } catch {
      /* no readable body: a network failure or a crashed function */
    }
    throw new ImportError(importErrorMessage(code));
  }
  return data as ImportedRecipe;
}

export const importFromText = (text: string, sourceUrl?: string) => call({ kind: 'text', text, ...(sourceUrl ? { sourceUrl } : {}) });

/** Screenshots are shrunk to 1600 px JPEG first (about 300 KB each), so a phone's full-size screenshot never reaches the function. */
export async function importFromImages(files: File[], sourceUrl?: string) {
  const images = await Promise.all(
    files.map(async (f) => {
      const blob = await shrinkImage(f);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { mediaType: 'image/jpeg' as const, data: btoa(binary) };
    }),
  );
  return call({ kind: 'images', images, ...(sourceUrl ? { sourceUrl } : {}) });
}
