import './globals.css';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { CustomizationProvider } from '@/components/providers/CustomizationProvider';
import CommandPaletteWrapper from '@/components/CommandPaletteWrapper';
import ErrorBoundary from '@/components/ErrorBoundary';

import type { Viewport } from 'next';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata = {
  title: 'Vizora - Digital Signage Platform',
  description: 'Modern cloud-based digital signage management',
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
    <html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className={`${spaceGrotesk.className} min-h-screen bg-[var(--background)] text-[var(--foreground)]`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-[#00E5A0] focus:text-[#061A21]">
          Skip to main content
        </a>
        <ErrorBoundary>
          <ThemeProvider>
            <CustomizationProvider>
              <CommandPaletteWrapper />
              {children}
            </CustomizationProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
