import './globals.css';
import { Sora, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { CustomizationProvider } from '@/components/providers/CustomizationProvider';
import CommandPaletteWrapper from '@/components/CommandPaletteWrapper';
import ErrorBoundary from '@/components/ErrorBoundary';

import type { Viewport } from 'next';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  title: 'Vizora — AI-Powered Digital Signage Platform',
  description: 'AI-driven digital signage that runs itself. Generate content, optimize schedules, predict device issues, and manage thousands of screens autonomously.',
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
    <html lang="en" suppressHydrationWarning className={`${sora.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className={`${dmSans.className} min-h-screen bg-[var(--background)] text-[var(--foreground)]`}>
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
