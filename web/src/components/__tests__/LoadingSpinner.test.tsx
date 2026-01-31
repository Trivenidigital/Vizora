import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders correctly', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('has role="status"', () => {
      render(<LoadingSpinner />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has aria-live="polite"', () => {
      render(<LoadingSpinner />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('has accessible label', () => {
      render(<LoadingSpinner />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
    });

    it('has aria-hidden on visual element', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status').querySelector('[aria-hidden="true"]');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('applies medium size by default', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status').querySelector('.w-8');
      expect(spinner).toBeInTheDocument();
    });

    it('applies small size', () => {
      render(<LoadingSpinner size="sm" />);
      const spinner = screen.getByRole('status').querySelector('.w-4');
      expect(spinner).toBeInTheDocument();
    });

    it('applies large size', () => {
      render(<LoadingSpinner size="lg" />);
      const spinner = screen.getByRole('status').querySelector('.w-12');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('has animation class', () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole('status').querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
