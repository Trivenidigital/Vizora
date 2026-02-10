import { render, screen } from '@testing-library/react';
import Breadcrumbs from '../Breadcrumbs';

const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

describe('Breadcrumbs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null on root dashboard path', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    const { container } = render(<Breadcrumbs />);
    expect(container.innerHTML).toBe('');
  });

  it('renders breadcrumb navigation for nested path', () => {
    mockUsePathname.mockReturnValue('/dashboard/devices');
    render(<Breadcrumbs />);
    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
    expect(screen.getByText('Devices')).toBeInTheDocument();
  });

  it('renders Dashboard link at start', () => {
    mockUsePathname.mockReturnValue('/dashboard/content');
    render(<Breadcrumbs />);
    const dashboardLinks = screen.getAllByText('Dashboard');
    expect(dashboardLinks.length).toBeGreaterThan(0);
  });

  it('renders last segment as text (not link)', () => {
    mockUsePathname.mockReturnValue('/dashboard/schedules');
    render(<Breadcrumbs />);
    const schedules = screen.getByText('Schedules');
    // Last breadcrumb should be a span, not an anchor
    expect(schedules.tagName).toBe('SPAN');
  });

  it('capitalizes unknown segments', () => {
    mockUsePathname.mockReturnValue('/dashboard/unknown-page');
    render(<Breadcrumbs />);
    expect(screen.getByText('Unknown-page')).toBeInTheDocument();
  });

  it('maps known segment names correctly', () => {
    mockUsePathname.mockReturnValue('/dashboard/analytics');
    render(<Breadcrumbs />);
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });
});
