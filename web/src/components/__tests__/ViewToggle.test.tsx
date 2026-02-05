import { render, screen, fireEvent } from '@testing-library/react';
import { ViewToggle, getInitialView } from '../ViewToggle';

describe('ViewToggle', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
    localStorage.clear();
  });

  it('renders grid and list buttons', () => {
    render(<ViewToggle view="grid" onChange={mockOnChange} />);

    const gridButton = screen.getByLabelText('Grid view');
    const listButton = screen.getByLabelText('List view');

    expect(gridButton).toBeInTheDocument();
    expect(listButton).toBeInTheDocument();
  });

  it('highlights the active view', () => {
    const { rerender } = render(<ViewToggle view="grid" onChange={mockOnChange} />);

    const gridButton = screen.getByLabelText('Grid view');
    const listButton = screen.getByLabelText('List view');

    // Grid should be active
    expect(gridButton).toHaveClass('bg-blue-600', 'text-white');
    expect(listButton).toHaveClass('text-gray-700');

    // Switch to list view
    rerender(<ViewToggle view="list" onChange={mockOnChange} />);

    // List should be active
    expect(listButton).toHaveClass('bg-blue-600', 'text-white');
    expect(gridButton).toHaveClass('text-gray-700');
  });

  it('calls onChange when clicking grid button', () => {
    render(<ViewToggle view="list" onChange={mockOnChange} />);

    const gridButton = screen.getByLabelText('Grid view');
    fireEvent.click(gridButton);

    expect(mockOnChange).toHaveBeenCalledWith('grid');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange when clicking list button', () => {
    render(<ViewToggle view="grid" onChange={mockOnChange} />);

    const listButton = screen.getByLabelText('List view');
    fireEvent.click(listButton);

    expect(mockOnChange).toHaveBeenCalledWith('list');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('persists to localStorage', () => {
    const { rerender } = render(<ViewToggle view="grid" onChange={mockOnChange} storageKey="test-view" />);

    // Initial value should be saved
    expect(localStorage.getItem('test-view')).toBe('grid');

    // Change to list view
    rerender(<ViewToggle view="list" onChange={mockOnChange} storageKey="test-view" />);

    // Should update localStorage
    expect(localStorage.getItem('test-view')).toBe('list');
  });

  it('uses default storage key if not provided', () => {
    render(<ViewToggle view="grid" onChange={mockOnChange} />);

    expect(localStorage.getItem('vizora-content-view')).toBe('grid');
  });

  it('handles localStorage errors gracefully', () => {
    // Mock localStorage.setItem to throw an error
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = jest.fn(() => {
      throw new Error('localStorage is full');
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Should not crash
    render(<ViewToggle view="grid" onChange={mockOnChange} />);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to save view preference:',
      expect.any(Error)
    );

    // Restore
    Storage.prototype.setItem = originalSetItem;
    consoleSpy.mockRestore();
  });
});

describe('getInitialView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads initial value from localStorage', () => {
    localStorage.setItem('test-view', 'list');

    const view = getInitialView('test-view');

    expect(view).toBe('list');
  });

  it('returns grid as default when localStorage is empty', () => {
    const view = getInitialView('test-view');

    expect(view).toBe('grid');
  });

  it('returns grid for invalid values', () => {
    localStorage.setItem('test-view', 'invalid');

    const view = getInitialView('test-view');

    expect(view).toBe('grid');
  });

  it('handles localStorage errors gracefully', () => {
    // Mock localStorage.getItem to throw an error
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = jest.fn(() => {
      throw new Error('localStorage is disabled');
    });

    // Should return default without crashing
    const view = getInitialView('test-view');

    expect(view).toBe('grid');

    // Restore
    Storage.prototype.getItem = originalGetItem;
  });

  it('returns grid in SSR context', () => {
    // Simulate SSR by deleting window
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    const view = getInitialView('test-view');

    expect(view).toBe('grid');

    // Restore
    global.window = originalWindow;
  });
});
