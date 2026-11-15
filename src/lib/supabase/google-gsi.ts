/** The slice of Google Identity Services (accounts.google.com/gsi/client) this button uses. */
export interface GoogleId {
  initialize(config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    nonce?: string;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill';
      logo_alignment?: 'left' | 'center';
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise: Promise<GoogleId> | null = null;

/** Loads Google's script once; rejects if it is blocked or slow, so the caller can fall back. */
export function loadGsi(): Promise<GoogleId> {
  gsiPromise ??= new Promise<GoogleId>((resolve, reject) => {
    const ready = () => window.google?.accounts?.id;
    if (ready()) { resolve(ready()!); return; }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    const timer = window.setTimeout(() => reject(new Error('timeout')), 8000);
    script.onload = () => {
      window.clearTimeout(timer);
      const id = ready();
      if (id) resolve(id); else reject(new Error('missing'));
    };
    script.onerror = () => { window.clearTimeout(timer); reject(new Error('blocked')); };
    document.head.appendChild(script);
  }).catch((e) => { gsiPromise = null; throw e; });
  return gsiPromise;
}

/** A fresh nonce pair: Google gets the SHA-256 hex hash, Supabase gets the raw value to compare. */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

