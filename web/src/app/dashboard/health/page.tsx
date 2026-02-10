import HealthMonitoringClient from './page-client';

export default async function HealthMonitoringPage() {
 // Health page auto-refreshes every 10s and uses real-time alerts
 return <HealthMonitoringClient />;
}
