import React from 'react';
import { render } from '@testing-library/react-native';
import { ConnectionStatus } from '../ConnectionStatus';

describe('ConnectionStatus', () => {
  it('renders with teal color when isConnected=true', () => {
    const { toJSON } = render(<ConnectionStatus isConnected={true} />);
    const tree = toJSON();
    // The root View should have backgroundColor set to colors.teal (#00E5A0)
    expect(tree).not.toBeNull();
    const style = (tree as { props: { style: Record<string, unknown> } }).props
      .style;
    const flatStyle = Object.assign(
      {},
      ...(Array.isArray(style) ? style : [style]),
    );
    expect(flatStyle.backgroundColor).toBe('#00E5A0');
  });

  it('renders with offline color when isConnected=false', () => {
    const { toJSON } = render(<ConnectionStatus isConnected={false} />);
    const tree = toJSON();
    expect(tree).not.toBeNull();
    const style = (tree as { props: { style: Record<string, unknown> } }).props
      .style;
    const flatStyle = Object.assign(
      {},
      ...(Array.isArray(style) ? style : [style]),
    );
    expect(flatStyle.backgroundColor).toBe('#EF4444');
  });
});
