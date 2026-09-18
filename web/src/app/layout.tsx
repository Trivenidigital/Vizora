import './globals.css';
import { Sora, DM_Sans, JetBrains_Mono, Fraunces } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { CustomizationProvider } from '@/components/providers/CustomizationProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import { CookieConsent } from '@/components/CookieConsent';

import type { Viewport } from 'next';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
/**
 * Editorial display serif (Little Worlds). Loaded here rather than on the
 * homepage wrapper so `--lw-serif` — which is just `var(--font-fraunces)` with
 * a fallback stack — resolves anywhere in the app. Until now it resolved only
 * inside `<div className="mkt lw …">`, so any surface outside the landing page
 * that reached for the serif silently got Georgia.
 *
 * `axes` is not optional: without declaring them, next/font serves a wght-only
 * instance and the `font-variation-settings: 'opsz' 60, 'SOFT' 40` in
 * globals.css is inert.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'opsz'],
});

export const metadata = {
  title: {
    default: 'Vizora — Digital signage for the places you run',
    template: '%s | Vizora',
  },
  description:
    'Create and schedule content, organize playlists, and manage every signage screen across your locations — cafés, hotels, retail and more — from one dashboard.',
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#00E5A0',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sora.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}>
      <body className={`${dmSans.className} min-h-screen bg-[var(--background)] text-[var(--foreground)]`}>
        {/* z-[60]: the marketing nav is `fixed z-50` and later in the DOM, so at
            equal z-index it painted over the focused skip link (measured with
            elementFromPoint). Nothing else in the app sits above 60. */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[60] focus:p-4 focus:bg-[var(--primary)] focus:text-[var(--lw-on-forest)]">
          Skip to main content
        </a>
        <ErrorBoundary>
          <ThemeProvider>
            {/*
              The command palette is NOT mounted here.

              It used to be, which put its ⌘K hint — `fixed bottom-4 right-4` —
              on every public page including the homepage. That was app chrome
              leaking onto a marketing surface: every command it offers is a
              `/dashboard/*` navigation, so there has never been anything to
              command on a public route. It now mounts in the two authenticated
              shells (`dashboard/layout.tsx`, `admin/layout.tsx`) instead.

              Mounting it here also made the hint unrestylable: the homepage is
              under design review and must stay pixel-identical, so any change
              to the chip moved a surface it had no business being on.
            */}
            <CustomizationProvider>{children}</CustomizationProvider>
          </ThemeProvider>
        </ErrorBoundary>
        <CookieConsent />
      </body>
    </html>
  );
}
