import type { Metadata } from 'next';
import AnalyticsClient from './page-client';

export const metadata: Metadata = {
  title: 'Analytics',
};

export default async function AnalyticsPage() {
 // Analytics page uses custom hooks for data fetching with date range state
 return <AnalyticsClient />;
}
