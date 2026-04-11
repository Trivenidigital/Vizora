'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function AnalyticsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError section="Analytics" {...props} />;
}
