'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function DashboardError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError section="Dashboard" {...props} />;
}
