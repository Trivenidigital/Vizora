import React from 'react';
import { render } from '@testing-library/react-native';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders "Online" label for status="online"', () => {
    const { getByText } = render(<StatusBadge status="online" />);
    const label = getByText('Online');
    expect(label).toBeTruthy();
    // The color style should use colors.online (#22C55E)
    expect(label.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#22C55E' })]),
    );
  });

  it('renders "Offline" label for status="offline"', () => {
    const { getByText } = render(<StatusBadge status="offline" />);
    const label = getByText('Offline');
    expect(label).toBeTruthy();
    // The color style should use colors.offline (#EF4444)
    expect(label.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#EF4444' })]),
    );
  });

  it('renders "Pairing" label for status="pairing"', () => {
    const { getByText } = render(<StatusBadge status="pairing" />);
    const label = getByText('Pairing');
    expect(label).toBeTruthy();
    // The color style should use colors.pairing (#F59E0B)
    expect(label.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#F59E0B' })]),
    );
  });
});
