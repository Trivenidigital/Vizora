'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function ContentError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError section="Content Library" {...props} />;
}
