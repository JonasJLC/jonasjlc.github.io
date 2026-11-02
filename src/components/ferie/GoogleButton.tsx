import { useEffect, useRef, useState } from 'react';
import { signInWithGoogleIdToken } from './lib/remote';

/** The slice of Google Identity Services (accounts.google.com/gsi/client) this button uses. */
interface GoogleId {
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
function loadGsi(): Promise<GoogleId> {
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
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

/**
 * Google's own "Fortsæt med Google" button. Its popup names this site rather than the
 * Supabase project domain. Calls `onUnavailable` if the script can't load, so the caller
 * can show the redirect-based button instead.
 */
export function GoogleButton({
  clientId, onError, onUnavailable,
}: {
  clientId: string; onError: (message: string | null) => void; onUnavailable: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let gsi: GoogleId;
      try { gsi = await loadGsi(); } catch { if (!cancelled) onUnavailable(); return; }
      const nonce = await makeNonce();
      const el = slot.current;
      if (cancelled || !el) return;
      gsi.initialize({
        client_id: clientId,
        nonce: nonce.hashed,
        ux_mode: 'popup',
        auto_select: false,
        itp_support: true,
        callback: async ({ credential }) => {
          if (!credential) { onError('Google sendte ikke noget login. Prøv igen.'); return; }
          setBusy(true);
          onError(null);
          const err = await signInWithGoogleIdToken(credential, nonce.raw);
          // If the token is refused, keep people unblocked: switch to the redirect button.
          if (err) { onError(err); setBusy(false); onUnavailable(); }
        },
      });
      el.replaceChildren();
      gsi.renderButton(el, {
        type: 'standard',
        theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'center',
        width: Math.min(400, Math.max(200, Math.round(el.clientWidth))),
        locale: 'da',
      });
    })();
    return () => { cancelled = true; };
  }, [clientId, onError, onUnavailable]);

  return (
    <>
      <div ref={slot} className="flex min-h-11 w-full justify-center" hidden={busy} />
      {busy && <p role="status" className="text-center text-sm text-muted-foreground">Logger ind …</p>}
    </>
  );
}
