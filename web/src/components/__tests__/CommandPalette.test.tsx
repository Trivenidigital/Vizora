import { render, screen, fireEvent } from '@testing-library/react';
import CommandPalette, { Command } from '../CommandPalette';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const mockCommands: Command[] = [
  {
    id: 'nav-dashboard',
    title: 'Go to Dashboard',
    description: 'View dashboard overview',
    category: 'navigation',
    onExecute: jest.fn(),
    keywords: ['home'],
  },
  {
    id: 'nav-devices',
    title: 'Go to Devices',
    description: 'Manage devices',
    category: 'navigation',
    onExecute: jest.fn(),
  },
  {
    id: 'action-upload',
    title: 'Upload Content',
    category: 'action',
    onExecute: jest.fn(),
  },
];

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders keyboard shortcut hint when closed', () => {
    render(<CommandPalette commands={mockCommands} />);
    // The hint shows the shortcut key
    expect(document.body.textContent).toContain('K');
  });

  it('shows command list when open', () => {
    render(<CommandPalette commands={mockCommands} open={true} />);
    expect(screen.getByPlaceholderText('Search commands...')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Go to Devices')).toBeInTheDocument();
  });

  it('filters commands by search query', () => {
    render(<CommandPalette commands={mockCommands} open={true} />);
    const input = screen.getByPlaceholderText('Search commands...');
    fireEvent.change(input, { target: { value: 'Dashboard' } });
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Upload Content')).not.toBeInTheDocument();
  });

  it('shows "No commands found" when search has no matches', () => {
    render(<CommandPalette commands={mockCommands} open={true} />);
    const input = screen.getByPlaceholderText('Search commands...');
    fireEvent.change(input, { target: { value: 'zzzzzzz' } });
    expect(screen.getByText('No commands found')).toBeInTheDocument();
  });

  it('executes command when clicked', () => {
    const onExecute = jest.fn();
    const commands = [
      { ...mockCommands[0], onExecute },
    ];
    render(<CommandPalette commands={commands} open={true} />);
    fireEvent.click(screen.getByText('Go to Dashboard'));
    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it('filters by keywords', () => {
    render(<CommandPalette commands={mockCommands} open={true} />);
    const input = screen.getByPlaceholderText('Search commands...');
    fireEvent.change(input, { target: { value: 'home' } });
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  it('clears the query on Escape (uncontrolled), so reopening shows every command', () => {
    render(<CommandPalette commands={mockCommands} />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    fireEvent.change(screen.getByPlaceholderText('Search commands...'), { target: { value: 'Upload' } });
    expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Search commands...')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText('Search commands...')).toHaveValue('');
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  it('exposes the list as a labelled listbox driven by a combobox input', () => {
    render(<CommandPalette commands={mockCommands} open={true} />);
    const input = screen.getByRole('combobox', { name: 'Search commands' });
    const listbox = screen.getByRole('listbox', { name: 'Commands' });

    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('aria-expanded', 'true');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(screen.getByRole('group', { name: 'navigation' })).toBeInTheDocument();
  });

  it('moves aria-selected and aria-activedescendant with the arrow keys', () => {
    render(<CommandPalette commands={mockCommands} open={true} />);
    const input = screen.getByRole('combobox', { name: 'Search commands' });

    fireEvent.keyDown(window, { key: 'ArrowDown' });

    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
  });

  it('drops the listbox reference when nothing matches', () => {
    render(<CommandPalette commands={mockCommands} open={true} />);
    const input = screen.getByRole('combobox', { name: 'Search commands' });
    fireEvent.change(input, { target: { value: 'zzzzzzz' } });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});
