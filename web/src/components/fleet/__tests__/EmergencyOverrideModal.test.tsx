import { render, screen } from '@testing-library/react';
import EmergencyOverrideModal from '../EmergencyOverrideModal';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getContent: jest.fn().mockResolvedValue({ data: [] }),
    getDisplays: jest.fn().mockResolvedValue({ data: [] }),
    getDisplayGroups: jest.fn().mockResolvedValue({ data: [] }),
    sendFleetCommand: jest.fn(),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    ToastContainer: () => null,
  }),
}));

describe('EmergencyOverrideModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    organizationId: 'org-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when isOpen=true', () => {
    render(<EmergencyOverrideModal {...defaultProps} />);
    expect(screen.getByText('Emergency Content Override')).toBeInTheDocument();
  });

  it('does not render when isOpen=false', () => {
    render(<EmergencyOverrideModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Emergency Content Override')).not.toBeInTheDocument();
  });

  it('defaults duration to 1h (60 minutes)', () => {
    render(<EmergencyOverrideModal {...defaultProps} />);
    // The 1h pill should have the selected styling (bg-[var(--primary)])
    const oneHourPill = screen.getByText('1h');
    expect(oneHourPill).toBeInTheDocument();
    expect(oneHourPill.className).toContain('bg-[var(--primary)]');
  });

  it('submit button is disabled when no content selected', () => {
    render(<EmergencyOverrideModal {...defaultProps} />);
    const submitButton = screen.getByText('Push Emergency Content');
    expect(submitButton).toBeDisabled();
  });

  it('shows warning text', () => {
    render(<EmergencyOverrideModal {...defaultProps} />);
    expect(screen.getByText('This will immediately interrupt current content on targeted devices')).toBeInTheDocument();
  });

  it('shows all duration options', () => {
    render(<EmergencyOverrideModal {...defaultProps} />);
    expect(screen.getByText('15m')).toBeInTheDocument();
    expect(screen.getByText('30m')).toBeInTheDocument();
    expect(screen.getByText('1h')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
    expect(screen.getByText('4h')).toBeInTheDocument();
  });
});
