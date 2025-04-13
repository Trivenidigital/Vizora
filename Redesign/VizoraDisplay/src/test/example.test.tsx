import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VizoraSocketClient } from '@vizora/common/sockets';
import { DisplayStatus } from '@vizora/common/types';

describe('Example Test', () => {
  it('should render without crashing', () => {
    render(<div>Test Component</div>);
    expect(screen.getByText('Test Component')).toBeInTheDocument();
  });

  it('should import shared types and sockets', () => {
    // This test verifies that we can import from @vizora/common
    const status: DisplayStatus = {
      id: 'test',
      name: 'Test Display',
      status: 'online',
      lastSeen: new Date().toISOString(),
    };
    expect(status).toBeDefined();
  });
}); 