import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { StatusBadge } from '../components/StatusBadge';

/*
 * The admin org list passes Organization.subscriptionStatus straight in. These
 * pin that every status the backend stores gets its own tone rather than the
 * inactive fallback. Tone is asserted by comparing against a reference status,
 * not by restating class names.
 */
function classOf(status: string): string {
  const { unmount } = render(<StatusBadge status={status} />);
  const cls = screen.getByText(status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())).className;
  unmount();
  return cls;
}

describe('admin StatusBadge', () => {
  it('renders a stored trial status with the same tone as trialing', () => {
    expect(classOf('trial')).toBe(classOf('trialing'));
    expect(classOf('trial')).not.toBe(classOf('inactive'));
  });

  it('renders publish_locked in the past_due dunning tone, not the inactive fallback', () => {
    expect(classOf('publish_locked')).toBe(classOf('past_due'));
    expect(classOf('publish_locked')).not.toBe(classOf('inactive'));
  });

  it('control: an unknown status does fall back to the inactive tone', () => {
    expect(classOf('no_such_status')).toBe(classOf('inactive'));
  });
});
