import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Widgets',
};

export default function WidgetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
