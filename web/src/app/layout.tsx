import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { CustomizationProvider } from '@/components/providers/CustomizationProvider';
import { DeviceStatusProvider } from '@/lib/context/DeviceStatusContext';

export const metadata = {
  title: 'Vizora - Digital Signage Platform',
  description: 'Modern cloud-based digital signage management',
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#3B82F6',
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-blue-600 focus:text-white">
          Skip to main content
        </a>
        <ThemeProvider>
          <CustomizationProvider>
            <DeviceStatusProvider>
              <main id="main-content">
                {children}
              </main>
            </DeviceStatusProvider>
          </CustomizationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
