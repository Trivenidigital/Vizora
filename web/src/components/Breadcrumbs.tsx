'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Breadcrumbs() {
  const pathname = usePathname();

  // Generate breadcrumb segments
  const segments = pathname.split('/').filter(Boolean);

  // Map segments to readable names
  const getLabel = (segment: string, index: number) => {
    const labels: Record<string, string> = {
      'dashboard': 'Dashboard',
      'devices': 'Devices',
      'content': 'Content',
      'playlists': 'Playlists',
      'schedules': 'Schedules',
      'analytics': 'Analytics',
      'settings': 'Settings',
      'pair': 'Pair Device',
    };
    return labels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  // Build paths
  const breadcrumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const label = getLabel(segment, index);
    const isLast = index === segments.length - 1;

    return {
      label,
      path,
      isLast,
    };
  });

  // Don't show on root dashboard
  if (pathname === '/dashboard') {
    return null;
  }

  return (
    <nav className="flex mb-6 text-sm" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        <li className="inline-flex items-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-[var(--foreground-secondary)] hover:text-[#00E5A0] transition"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Dashboard
          </Link>
        </li>
        {breadcrumbs.slice(1).map((crumb, index) => (
          <li key={crumb.path}>
            <div className="flex items-center">
              <svg
                className="w-6 h-6 text-[var(--foreground-tertiary)]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {crumb.isLast ? (
                <span className="ml-1 text-[var(--foreground)] font-medium md:ml-2">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.path}
                  className="ml-1 text-[var(--foreground-secondary)] hover:text-[#00E5A0] transition md:ml-2"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
