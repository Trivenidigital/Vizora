import type { Metadata } from 'next';
import Link from 'next/link';
import SchedulesClient from './page-client';
import { SCHEDULES_ENABLED } from '@/lib/feature-flags';

export const metadata: Metadata = {
  title: 'Schedules',
};

export default async function SchedulesPage() {
  // Interim C-7 mitigation: schedule-only content reaches devices by no path today,
  // so the CRUD UI is gated (not just hidden from nav) — direct-URL access lands
  // here, not on a form that assigns content that will never render.
  if (!SCHEDULES_ENABLED) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-3">
          Scheduling is temporarily unavailable
        </h1>
        <p className="text-[var(--foreground-secondary)] mb-8">
          Time-based scheduling is being upgraded and is disabled for now. In the meantime,
          assign content directly to a device from <strong>Devices</strong> or{' '}
          <strong>Playlists</strong> — that content plays immediately and reliably.
        </p>
        <Link
          href="/dashboard/devices"
          className="inline-block px-4 py-2 bg-[#00E5A0] text-[#061A21] text-sm font-semibold rounded-md hover:bg-[#00CC8E] transition-colors"
        >
          Go to Devices
        </Link>
      </div>
    );
  }
  // Schedules page loads data client-side due to real-time execution monitoring
  return <SchedulesClient />;
}
