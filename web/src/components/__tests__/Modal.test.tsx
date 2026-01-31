import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../Modal';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<Modal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the title correctly', () => {
    render(<Modal {...defaultProps} title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <Modal {...defaultProps}>
        <p>Custom child content</p>
      </Modal>
    );
    expect(screen.getByText('Custom child content')).toBeInTheDocument();
  });

  describe('closing the modal', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByLabelText('Close modal'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      // Click the backdrop
      const backdrop = screen.getByRole('dialog').querySelector('[aria-hidden="true"]');
      if (backdrop) {
        fireEvent.click(backdrop);
      }
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('sizes', () => {
    it('applies medium size by default', () => {
      render(<Modal {...defaultProps} />);
      const modalContent = screen.getByRole('dialog').querySelector('.max-w-lg');
      expect(modalContent).toBeInTheDocument();
    });

    it('applies small size', () => {
      render(<Modal {...defaultProps} size="sm" />);
      const modalContent = screen.getByRole('dialog').querySelector('.max-w-md');
      expect(modalContent).toBeInTheDocument();
    });

    it('applies large size', () => {
      render(<Modal {...defaultProps} size="lg" />);
      const modalContent = screen.getByRole('dialog').querySelector('.max-w-2xl');
      expect(modalContent).toBeInTheDocument();
    });

    it('applies extra large size', () => {
      render(<Modal {...defaultProps} size="xl" />);
      const modalContent = screen.getByRole('dialog').querySelector('.max-w-4xl');
      expect(modalContent).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="dialog"', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal="true"', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(<Modal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(screen.getByText('Test Modal')).toHaveAttribute('id', 'modal-title');
    });

    it('close button has aria-label', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });
  });

  describe('body scroll lock', () => {
    it('sets body overflow to hidden when open', () => {
      render(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('resets body overflow when closed', () => {
      const { rerender } = render(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<Modal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('unset');
    });

    it('cleans up body overflow on unmount', () => {
      const { unmount } = render(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');

      unmount();
      expect(document.body.style.overflow).toBe('unset');
    });
  });
});
