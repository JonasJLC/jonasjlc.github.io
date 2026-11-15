// Shared HTTP helpers for the Strandparken edge functions: CORS, JSON responses and typed errors.

const ALLOWED_ORIGINS = new Set(['https://jonasjlc.github.io', 'http://localhost:4321']);

export function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://jonasjlc.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** An error the caller may see: a status and a short machine code, never page text, prompts or user data. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, public detail?: unknown) {
    super(code);
    this.name = 'HttpError';
  }
}
