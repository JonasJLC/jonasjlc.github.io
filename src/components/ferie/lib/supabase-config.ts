/**
 * Public client configuration. The publishable key is designed to ship in the browser:
 * row-level security (see supabase/migrations) is what protects the data, not the key.
 * Never put a service_role / secret key here.
 *
 * Build with PUBLIC_SUPABASE_URL= (empty) to run without sync and without the sign-in gate,
 * e.g. for local UI testing.
 */
export const SUPABASE_URL: string = import.meta.env.PUBLIC_SUPABASE_URL ?? 'https://kmytekaexgfqhwxapwbw.supabase.co';
export const SUPABASE_KEY: string =
  import.meta.env.PUBLIC_SUPABASE_KEY ?? 'sb_publishable_1TGEialjtKpDThRKj4LrMA_Duj7cpOh';
