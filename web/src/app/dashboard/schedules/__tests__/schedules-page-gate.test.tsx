import { render, screen } from '@testing-library/react';

// Interim C-7 hide: the schedules page gates its CRUD UI behind SCHEDULES_ENABLED.
let mockEnabled = false;
jest.mock('@/lib/feature-flags', () => ({
  get SCHEDULES_ENABLED() {
    return mockEnabled;
  },
}));
jest.mock('../page-client', () => ({
  __esModule: true,
  default: () => <div data-testid="schedules-client">client</div>,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import SchedulesPage from '../page';

describe('SchedulesPage gate (interim C-7 mitigation)', () => {
  it('renders the "temporarily unavailable" notice when scheduling is DISABLED (default) — not the CRUD UI', async () => {
    mockEnabled = false;
    render(await SchedulesPage());
    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    // The dead-path CRUD UI must NOT reach a direct-URL visitor.
    expect(screen.queryByTestId('schedules-client')).toBeNull();
    expect(screen.getByText('Go to Devices').closest('a')).toHaveAttribute('href', '/dashboard/devices');
  });

  it('renders the schedules client when explicitly ENABLED', async () => {
    mockEnabled = true;
    render(await SchedulesPage());
    expect(screen.getByTestId('schedules-client')).toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/i)).toBeNull();
  });
});
