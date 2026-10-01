import { render, screen, fireEvent } from '@testing-library/react';

import { Switch } from '../Switch';

/*
 * These assertions name colours on purpose. The whole point of the component is
 * that one treatment is shared, and the failure it exists to prevent is a copy
 * drifting back to a pale `--border` track where neither the knob nor the
 * control itself clears 3:1. A test that only checked `aria-checked` would have
 * stayed green through exactly that regression.
 */
describe('Switch', () => {
  const onChange = jest.fn();

  beforeEach(() => onChange.mockClear());

  it('exposes switch semantics and the checked state', () => {
    const { rerender } = render(<Switch checked onChange={onChange} aria-label="Loop" />);
    const control = screen.getByRole('switch', { name: 'Loop' });
    expect(control).toHaveAttribute('aria-checked', 'true');

    rerender(<Switch checked={false} onChange={onChange} aria-label="Loop" />);
    expect(screen.getByRole('switch', { name: 'Loop' })).toHaveAttribute('aria-checked', 'false');
  });

  it('paints the forest track when ON, with a white knob (11.17:1 / 10.79:1)', () => {
    render(<Switch checked onChange={onChange} aria-label="Loop" />);
    const control = screen.getByRole('switch');
    expect(control.className).toContain('bg-[var(--primary)]');
    expect(control.firstElementChild?.className).toContain('bg-white');
  });

  it('paints the mid-neutral track when OFF, keeping the white knob (3.50:1 / 3.38:1)', () => {
    render(<Switch checked={false} onChange={onChange} aria-label="Loop" />);
    const control = screen.getByRole('switch');
    expect(control.className).toContain('bg-[var(--gray-500)]');
    // The pale track is what made the control vanish against the card.
    expect(control.className).not.toContain('bg-[var(--border)]');
    expect(control.firstElementChild?.className).toContain('bg-white');
  });

  it('moves the knob rather than relying on colour for state', () => {
    const { rerender } = render(<Switch checked onChange={onChange} aria-label="Loop" />);
    expect(screen.getByRole('switch').firstElementChild?.className).toContain('translate-x-6');

    rerender(<Switch checked={false} onChange={onChange} aria-label="Loop" />);
    expect(screen.getByRole('switch').firstElementChild?.className).toContain('translate-x-1');
  });

  it('carries a keyboard-only focus ring at full ink strength', () => {
    render(<Switch checked onChange={onChange} aria-label="Loop" />);
    const control = screen.getByRole('switch');
    expect(control.className).toContain('focus-visible:ring-[var(--primary-ink)]');
    // --accent-ring is forest at 15% alpha, 1.30:1 on --surface — too weak to be the indicator.
    expect(control.className).not.toContain('accent-ring');
  });

  it('supports the small size without changing the treatment', () => {
    render(<Switch checked={false} onChange={onChange} size="sm" aria-label="Loop" />);
    const control = screen.getByRole('switch');
    expect(control.className).toContain('h-5 w-9');
    expect(control.className).toContain('bg-[var(--gray-500)]');
    expect(control.firstElementChild?.className).toContain('translate-x-0.5');
  });

  it('fires onChange on click and not when disabled', () => {
    const { rerender } = render(<Switch checked={false} onChange={onChange} aria-label="Loop" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(<Switch checked={false} onChange={onChange} disabled aria-label="Loop" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
