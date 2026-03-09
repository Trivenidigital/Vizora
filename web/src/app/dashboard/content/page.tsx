import type { Metadata } from 'next';
import ContentClient from './page-client';

export const metadata: Metadata = {
  title: 'Content',
};

export default async function ContentPage() {
 // Content page loads data client-side due to complex folder/filter state
 // The server component provides the shell for streaming
 return <ContentClient />;
}
