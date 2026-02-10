import { renderHook } from '@testing-library/react';

// Since useTheme just re-exports from ThemeProvider, test the re-export
jest.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'dark',
    isDark: true,
    setMode: jest.fn(),
  }),
}));

describe('useTheme', () => {
  it('re-exports useTheme from ThemeProvider', () => {
    // Dynamic import to get the mocked version
    const { useTheme } = require('../useTheme');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(typeof result.current.setMode).toBe('function');
  });
});
