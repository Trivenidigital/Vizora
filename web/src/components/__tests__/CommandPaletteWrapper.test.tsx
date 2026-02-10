import { render, fireEvent, act } from '@testing-library/react';
import CommandPaletteWrapper from '../CommandPaletteWrapper';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
}));

// Mock CommandPalette component to capture props
const mockCommandPalette = jest.fn();
jest.mock('../CommandPalette', () => {
  const MockCommandPalette = (props: any) => {
    mockCommandPalette(props);
    return props.open ? <div data-testid="command-palette">Command Palette Open</div> : null;
  };
  MockCommandPalette.getDefaultCommands = (router: any) => [
    { id: 'test', title: 'Test Command', category: 'navigation', onExecute: jest.fn() },
  ];
  return {
    __esModule: true,
    default: MockCommandPalette,
    getDefaultCommands: MockCommandPalette.getDefaultCommands,
  };
});

describe('CommandPaletteWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CommandPaletteWrapper />);
    // It should render CommandPalette (but closed initially)
    expect(mockCommandPalette).toHaveBeenCalled();
  });

  it('passes open=false to CommandPalette initially', () => {
    render(<CommandPaletteWrapper />);
    expect(mockCommandPalette).toHaveBeenCalledWith(
      expect.objectContaining({ open: false })
    );
  });

  it('passes commands array to CommandPalette', () => {
    render(<CommandPaletteWrapper />);
    expect(mockCommandPalette).toHaveBeenCalledWith(
      expect.objectContaining({
        commands: expect.arrayContaining([
          expect.objectContaining({ id: 'test', title: 'Test Command' }),
        ]),
      })
    );
  });

  it('opens command palette on Ctrl+K', () => {
    const { queryByTestId } = render(<CommandPaletteWrapper />);

    // Initially closed
    expect(queryByTestId('command-palette')).not.toBeInTheDocument();

    // Trigger Ctrl+K
    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });

    // Should now be open
    expect(queryByTestId('command-palette')).toBeInTheDocument();
  });

  it('opens command palette on Meta+K (macOS)', () => {
    const { queryByTestId } = render(<CommandPaletteWrapper />);

    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true });
    });

    expect(queryByTestId('command-palette')).toBeInTheDocument();
  });

  it('toggles command palette on repeated Ctrl+K', () => {
    const { queryByTestId } = render(<CommandPaletteWrapper />);

    // Open
    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });
    expect(queryByTestId('command-palette')).toBeInTheDocument();

    // Close
    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });
    expect(queryByTestId('command-palette')).not.toBeInTheDocument();
  });

  it('does not open on K without modifier keys', () => {
    const { queryByTestId } = render(<CommandPaletteWrapper />);

    act(() => {
      fireEvent.keyDown(window, { key: 'k' });
    });

    expect(queryByTestId('command-palette')).not.toBeInTheDocument();
  });

  it('passes onOpenChange callback to CommandPalette', () => {
    render(<CommandPaletteWrapper />);
    expect(mockCommandPalette).toHaveBeenCalledWith(
      expect.objectContaining({
        onOpenChange: expect.any(Function),
      })
    );
  });

  it('cleans up keyboard listener on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = render(<CommandPaletteWrapper />);
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
