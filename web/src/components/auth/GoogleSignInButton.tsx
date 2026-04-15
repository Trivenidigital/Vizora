'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              width?: string | number;
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

/**
 * Read the client ID at module scope. Turbopack replaces
 * process.env.NEXT_PUBLIC_* with the literal string value in the
 * client JS bundle at build time. On the server (SSR), this will
 * be undefined — that's fine, we only use it in useEffect.
 */
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton({ onSuccess, text = 'signin_with' }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Stabilize callback ref to avoid re-initialization on every render
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const stableCallback = useCallback((response: { credential: string }) => {
    onSuccessRef.current(response.credential);
  }, []);

  // Mark as mounted (client-side only) to trigger GSI loading
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load GSI script once mounted and client ID is available
  useEffect(() => {
    if (!mounted || !GOOGLE_CLIENT_ID) return;

    // Avoid loading the script twice
    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) {
      // Script already loaded (e.g. navigated back to login)
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: stableCallback,
      });
      if (buttonRef.current) {
        window.google?.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 280,
          text,
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: stableCallback,
      });
      if (buttonRef.current) {
        window.google?.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 280,
          text,
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [mounted, stableCallback, text]);

  // Always render the container div to avoid SSR/client hydration
  // mismatch. The Google button renders into buttonRef via GSI.
  // Before mount or without client ID, the div is empty (0-height).
  return (
    <div className="flex justify-center" style={{ minHeight: mounted && GOOGLE_CLIENT_ID ? 44 : 0 }}>
      <div ref={buttonRef} />
    </div>
  );
}
