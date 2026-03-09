import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Layouts',
};

export default function LayoutsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
