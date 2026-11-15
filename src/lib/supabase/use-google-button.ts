import { useEffect, useRef, useState } from 'react';
import { loadGsi, makeNonce, type GoogleId } from './google-gsi';

/**
 * Renders Google's own "Fortsæt med Google" button into `slot`, so Google's popup names this site rather than
 * the Supabase project domain. Calls `onUnavailable` if the script can't load or the token is refused, so the
 * caller can show the redirect-based button instead.
 */
export function useGoogleButton({
  clientId, signIn, onError, onUnavailable,
}: {
  clientId: string;
  signIn: (token: string, rawNonce: string) => Promise<string | null>;
  onError: (message: string | null) => void;
  onUnavailable: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  // The latest callbacks without restarting the button when a parent re-renders.
  const live = useRef({ signIn, onError, onUnavailable });
  live.current = { signIn, onError, onUnavailable };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let gsi: GoogleId;
      try { gsi = await loadGsi(); } catch { if (!cancelled) live.current.onUnavailable(); return; }
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
          if (!credential) { live.current.onError('Google sendte ikke noget login. Prøv igen.'); return; }
          setBusy(true);
          live.current.onError(null);
          const err = await live.current.signIn(credential, nonce.raw);
          // If the token is refused, keep people unblocked: switch to the redirect button.
          if (err) { live.current.onError(err); setBusy(false); live.current.onUnavailable(); }
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
  }, [clientId]);

  return { slot, busy };
}
