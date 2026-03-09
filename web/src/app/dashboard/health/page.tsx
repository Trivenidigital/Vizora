import type { Metadata } from 'next';
import HealthMonitoringClient from './page-client';

export const metadata: Metadata = {
  title: 'System Health',
};

export default async function HealthMonitoringPage() {
 // Health page auto-refreshes every 10s and uses real-time alerts
 return <HealthMonitoringClient />;
}
