import type { Metadata } from 'next';
import HealthMonitoringClient from './page-client';

export const metadata: Metadata = {
  title: 'System Health',
};

export default async function HealthMonitoringPage() {
 // Health page auto-refreshes on HEALTH_REFRESH_INTERVAL_MS (defined in
 // page-client.tsx) and uses real-time alerts. The interval is deliberately not
 // restated here: this comment claimed "every 10s" against a 30s interval until
 // 2026-10-09.
 return <HealthMonitoringClient />;
}
