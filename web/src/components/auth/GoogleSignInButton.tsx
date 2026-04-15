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

export default function GoogleSignInButton({ onSuccess, text = 'signin_with' }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  // Read client ID only on the client (after hydration), not during SSR.
  // Turbopack inlines NEXT_PUBLIC_* into the client bundle at build time,
  // but process.env is empty during SSR when PM2 doesn't provide the var.
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null;
    setClientId(id);
  }, []);

  // Stabilize callback ref to avoid re-initialization on every render
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const stableCallback = useCallback((response: { credential: string }) => {
    onSuccessRef.current(response.credential);
  }, []);

  useEffect(() => {
    if (!clientId) return;

    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
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
  }, [clientId, stableCallback, text]);

  // During SSR and before hydration, render an empty placeholder.
  // The button renders after the client effect reads the env var.
  if (!clientId) return null;

  return (
    <div className="flex justify-center">
      <div ref={buttonRef} />
    </div>
  );
}
