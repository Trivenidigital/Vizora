'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function SchedulesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError section="Schedules" {...props} />;
}
