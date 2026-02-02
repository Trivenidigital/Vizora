import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from '../EmptyState';

// Mock the Icon component
jest.mock('@/theme/icons', () => ({
  Icon: ({ name, size, className }: { name: string; size: string; className?: string }) => (
    <span data-testid={`icon-${name}`} data-size={size} className={className}>
      {name}
    </span>
  ),
}));

describe('EmptyState', () => {
  const defaultProps = {
    icon: 'info' as const,
    title: 'No items found',
    description: 'There are no items to display.',
  };

  it('renders title correctly', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description correctly', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('There are no items to display.')).toBeInTheDocument();
  });

  it('renders icon correctly', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByTestId('icon-info')).toBeInTheDocument();
  });

  describe('action button', () => {
    it('does not render action button when not provided', () => {
      render(<EmptyState {...defaultProps} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders action button when provided', () => {
      const action = {
        label: 'Add Item',
        onClick: jest.fn(),
      };
      render(<EmptyState {...defaultProps} action={action} />);
      expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
    });

    it('calls onClick when action button is clicked', () => {
      const action = {
        label: 'Add Item',
        onClick: jest.fn(),
      };
      render(<EmptyState {...defaultProps} action={action} />);

      fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
      expect(action.onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('variants', () => {
    it('renders default variant by default', () => {
      render(<EmptyState {...defaultProps} />);
      // Default variant has gradient background - the title's container div has the gradient
      const container = screen.getByText('No items found').closest('div.bg-gradient-to-br');
      expect(container).toBeInTheDocument();
    });

    it('renders minimal variant', () => {
      render(<EmptyState {...defaultProps} variant="minimal" />);
      // Minimal variant does not have gradient background
      const container = screen.getByText('No items found').closest('div');
      expect(container?.className).not.toContain('bg-gradient-to-br');
    });

    it('minimal variant shows action button correctly', () => {
      const action = {
        label: 'Create',
        onClick: jest.fn(),
      };
      render(<EmptyState {...defaultProps} variant="minimal" action={action} />);
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    });
  });
});
