'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function TemplatesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError section="Templates" {...props} />;
}
