'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function PlaylistsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError section="Playlists" {...props} />;
}
