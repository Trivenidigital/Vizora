/// <reference types="jest" />
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DisplaySearch } from '../DisplaySearch';
import { DisplayType, DisplayStatus } from '../../types/display';

describe('DisplaySearch', () => {
  const defaultProps = {
    searchQuery: '',
    selectedTypes: [] as DisplayType[],
    selectedStatuses: [] as DisplayStatus[],
    onSearchChange: jest.fn(),
    onTypesChange: jest.fn(),
    onStatusesChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input with correct value', () => {
    render(<DisplaySearch {...defaultProps} searchQuery="test" />);
    const input = screen.getByPlaceholderText('Search displays...');
    expect(input).toHaveValue('test');
  });

  it('calls onSearchChange when search input changes', () => {
    render(<DisplaySearch {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search displays...');
    fireEvent.change(input, { target: { value: 'new search' } });
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('new search');
  });

  it('renders type filter with selected types', () => {
    render(
      <DisplaySearch {...defaultProps} selectedTypes={['LED', 'LCD']} />
    );
    expect(screen.getByTestId('type-chip-led')).toBeInTheDocument();
    expect(screen.getByTestId('type-chip-lcd')).toBeInTheDocument();
  });

  it('renders status filter with selected statuses', () => {
    render(
      <DisplaySearch
        {...defaultProps}
        selectedStatuses={['online', 'offline']}
      />
    );
    expect(screen.getByTestId('status-chip-online')).toBeInTheDocument();
    expect(screen.getByTestId('status-chip-offline')).toBeInTheDocument();
  });

  it('calls onTypesChange when type is selected', () => {
    render(<DisplaySearch {...defaultProps} />);
    const input = screen.getByPlaceholderText('Filter by type');
    fireEvent.mouseDown(input);
    fireEvent.click(screen.getByText('LED'));
    expect(defaultProps.onTypesChange).toHaveBeenCalledWith(['LED']);
  });

  it('calls onStatusesChange when status is selected', () => {
    render(<DisplaySearch {...defaultProps} />);
    const input = screen.getByPlaceholderText('Filter by status');
    fireEvent.mouseDown(input);
    fireEvent.click(screen.getByText('online'));
    expect(defaultProps.onStatusesChange).toHaveBeenCalledWith(['online']);
  });
});