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

/**
 * Google OAuth web client ID (public by design). When set, sign-in uses Google's own button,
 * so Google's dialog names this site instead of the Supabase project domain. When empty,
 * sign-in falls back to the Supabase redirect flow.
 */
export const GOOGLE_CLIENT_ID: string =
  import.meta.env.PUBLIC_GOOGLE_CLIENT_ID ?? '596784295680-5lpud72ff6ad4ncqj9lffvps0rol28u3.apps.googleusercontent.com';
