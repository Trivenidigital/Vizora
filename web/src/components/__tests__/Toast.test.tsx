import { render, screen, fireEvent, act } from '@testing-library/react';
import Toast from '../Toast';

// Mock the Icon component
jest.mock('@/theme/icons', () => ({
  Icon: ({ name, size, className }: { name: string; size: string; className?: string }) => (
    <span data-testid={`icon-${name}`} data-size={size} className={className}>
      {name}
    </span>
  ),
}));

describe('Toast', () => {
  const defaultProps = {
    message: 'Test message',
    type: 'success' as const,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Wrap pending timer cleanup in act to avoid act() warnings
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders message correctly', () => {
    render(<Toast {...defaultProps} />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('has role="alert"', () => {
      render(<Toast {...defaultProps} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has aria-live="assertive"', () => {
      render(<Toast {...defaultProps} />);
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    });

    it('has aria-atomic="true"', () => {
      render(<Toast {...defaultProps} />);
      expect(screen.getByRole('alert')).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('toast types', () => {
    it('renders success toast with correct icon', () => {
      render(<Toast {...defaultProps} type="success" />);
      expect(screen.getByTestId('icon-success')).toBeInTheDocument();
    });

    it('renders error toast with correct icon', () => {
      render(<Toast {...defaultProps} type="error" />);
      expect(screen.getByTestId('icon-delete')).toBeInTheDocument();
    });

    it('renders info toast with correct icon', () => {
      render(<Toast {...defaultProps} type="info" />);
      expect(screen.getByTestId('icon-info')).toBeInTheDocument();
    });

    it('renders warning toast with correct icon', () => {
      render(<Toast {...defaultProps} type="warning" />);
      expect(screen.getByTestId('icon-warning')).toBeInTheDocument();
    });

    it('applies success color class', () => {
      render(<Toast {...defaultProps} type="success" />);
      expect(screen.getByRole('alert').className).toContain('bg-success-500');
    });

    it('applies error color class', () => {
      render(<Toast {...defaultProps} type="error" />);
      expect(screen.getByRole('alert').className).toContain('bg-error-500');
    });
  });

  describe('closing behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(<Toast {...defaultProps} onClose={onClose} />);

      act(() => {
        fireEvent.click(screen.getByRole('button'));
      });

      // Wait for the animation delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('auto-closes after default duration (5000ms)', () => {
      const onClose = jest.fn();
      render(<Toast {...defaultProps} onClose={onClose} />);

      // Advance past the duration
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Wait for the animation delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('auto-closes after custom duration', () => {
      const onClose = jest.fn();
      render(<Toast {...defaultProps} onClose={onClose} duration={2000} />);

      // Should not have closed yet
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(onClose).not.toHaveBeenCalled();

      // Advance past the duration
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Wait for the animation delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('animation', () => {
    it('starts with visible animation class', () => {
      render(<Toast {...defaultProps} />);
      expect(screen.getByRole('alert').className).toContain('translate-x-0');
      expect(screen.getByRole('alert').className).toContain('opacity-100');
    });

    it('transitions to hidden state before closing', () => {
      const onClose = jest.fn();
      render(<Toast {...defaultProps} onClose={onClose} />);

      // Click close button
      act(() => {
        fireEvent.click(screen.getByRole('button'));
      });

      // Should have hidden animation classes immediately
      expect(screen.getByRole('alert').className).toContain('translate-x-full');
      expect(screen.getByRole('alert').className).toContain('opacity-0');
    });
  });
});
