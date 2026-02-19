import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../ThemeToggle';

const mockSetMode = jest.fn();

jest.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'dark',
    isDark: true,
    setMode: mockSetMode,
  }),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders light and dark theme buttons', () => {
    render(<ThemeToggle />);
    expect(screen.getByLabelText('Switch to Light theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Switch to Dark theme')).toBeInTheDocument();
  });

  it('calls setMode when light button is clicked', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Switch to Light theme'));
    expect(mockSetMode).toHaveBeenCalledWith('light');
  });

  it('calls setMode when dark button is clicked', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Switch to Dark theme'));
    expect(mockSetMode).toHaveBeenCalledWith('dark');
  });

  it('renders sun and moon icons', () => {
    render(<ThemeToggle />);
    expect(screen.getByTestId('icon-sun')).toBeInTheDocument();
    expect(screen.getByTestId('icon-moon')).toBeInTheDocument();
  });
});
