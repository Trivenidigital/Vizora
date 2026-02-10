import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '../ConfirmDialog';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Delete Item',
    message: 'Are you sure you want to delete this item?',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = jest.fn();
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm and onClose when Confirm button is clicked', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} onClose={onClose} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders custom button text', () => {
    render(
      <ConfirmDialog {...defaultProps} confirmText="Yes, Delete" cancelText="No, Keep" />
    );
    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('No, Keep')).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />);
    // The backdrop is the first fixed overlay div
    const backdrop = document.querySelector('.bg-black');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('renders danger icon by default', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByTestId('icon-error')).toBeInTheDocument();
  });

  it('renders warning icon for warning type', () => {
    render(<ConfirmDialog {...defaultProps} type="warning" />);
    expect(screen.getByTestId('icon-warning')).toBeInTheDocument();
  });
});
