import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
