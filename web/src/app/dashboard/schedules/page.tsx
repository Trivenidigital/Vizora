import type { Metadata } from 'next';
import SchedulesClient from './page-client';

export const metadata: Metadata = {
  title: 'Schedules',
};

export default async function SchedulesPage() {
 // Schedules page loads data client-side due to real-time execution monitoring
 return <SchedulesClient />;
}
