'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function DevicesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError section="Devices" {...props} />;
}
