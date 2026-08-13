import { render, fireEvent, screen } from '@testing-library/react';
import CommandPaletteWrapper from '../CommandPaletteWrapper';

/**
 * Integration test: the REAL CommandPalette inside its real wrapper.
 *
 * The existing CommandPaletteWrapper test mocks CommandPalette away, which is
 * why the dismiss bug survived: the palette declared `onOpenChange` and never
 * called it, so under its controlled parent every close path wrote to state
 * nothing read. Escape, the backdrop and running a command all left the
 * palette on screen, covering the page it had just navigated to.
 *
 * These tests drive the pair together, so they fail if either half regresses.
 */

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

const openPalette = () => fireEvent.keyDown(window, { key: 'k', metaKey: true });
const paletteInput = () => screen.queryByPlaceholderText('Search commands...');

describe('CommandPalette dismissal (controlled by CommandPaletteWrapper)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens on Cmd+K', () => {
    render(<CommandPaletteWrapper />);
    expect(paletteInput()).not.toBeInTheDocument();

    openPalette();

    expect(paletteInput()).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<CommandPaletteWrapper />);
    openPalette();
    expect(paletteInput()).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(paletteInput()).not.toBeInTheDocument();
  });

  it('closes when the backdrop is clicked', () => {
    const { container } = render(<CommandPaletteWrapper />);
    openPalette();

    const backdrop = container.querySelector('.bg-black\\/50');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);

    expect(paletteInput()).not.toBeInTheDocument();
  });

  it('closes after running a command, rather than covering the destination', () => {
    render(<CommandPaletteWrapper />);
    openPalette();

    const commands = screen.getAllByRole('button');
    expect(commands.length).toBeGreaterThan(0);
    fireEvent.click(commands[0]);

    expect(paletteInput()).not.toBeInTheDocument();
  });

  it('still toggles closed on a second Cmd+K', () => {
    /*
     * Guards the trap in fixing this: the wrapper owns ⌘K, and the palette used
     * to register a duplicate handler. Routing that duplicate through
     * onOpenChange would make both fire per keypress — the palette setting the
     * parent to !open and the wrapper's functional `prev => !prev` flipping it
     * straight back — so the palette would never open at all.
     */
    render(<CommandPaletteWrapper />);
    openPalette();
    expect(paletteInput()).toBeInTheDocument();

    openPalette();

    expect(paletteInput()).not.toBeInTheDocument();
  });
});
