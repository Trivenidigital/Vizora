import { render, screen } from '@testing-library/react';
import { FieldError } from '../FieldError';

describe('FieldError', () => {
  it('renders nothing when no error is provided', () => {
    const { container } = render(<FieldError />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when error is undefined', () => {
    const { container } = render(<FieldError error={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when error is empty string', () => {
    const { container } = render(<FieldError error="" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders error message when error is provided', () => {
    render(<FieldError error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('renders with role="alert" for accessibility', () => {
    render(<FieldError error="Invalid input" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid input');
  });

  it('has appropriate styling classes', () => {
    render(<FieldError error="Error message" />);
    const element = screen.getByRole('alert');
    expect(element.tagName).toBe('P');
    expect(element.className).toContain('text-sm');
    expect(element.className).toContain('text-red-600');
  });
});
