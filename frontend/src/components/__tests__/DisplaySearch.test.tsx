/// <reference types="jest" />
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisplaySearch } from '../DisplaySearch';
import { DisplayType, DisplayStatus } from '../../types/display';
import '@testing-library/jest-dom';

interface RenderComponentProps {
  searchQuery?: string;
  selectedTypes?: DisplayType[];
  selectedStatuses?: DisplayStatus[];
}

const renderComponent = (props: RenderComponentProps = {}) => {
  const mockProps = {
    searchQuery: props.searchQuery || '',
    selectedTypes: props.selectedTypes || [],
    selectedStatuses: props.selectedStatuses || [],
    onSearchChange: jest.fn(),
    onTypesChange: jest.fn(),
    onStatusesChange: jest.fn(),
  };

  return {
    ...render(<DisplaySearch {...mockProps} />),
    mockProps,
  };
};

// Increase the timeout for async tests
jest.setTimeout(10000);

describe('DisplaySearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input', () => {
    renderComponent();
    expect(screen.getByPlaceholderText('Search displays...')).toBeInTheDocument();
  });

  it('calls onSearchChange when search input changes', () => {
    const { mockProps } = renderComponent();
    const searchInput = screen.getByPlaceholderText('Search displays...');
    
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(mockProps.onSearchChange).toHaveBeenCalledWith('test');
  });

  it('clears search input when clear button is clicked', () => {
    const { mockProps } = renderComponent({ searchQuery: 'test' });
    const clearButton = screen.getByTestId('ClearIcon').closest('button');
    expect(clearButton).toBeTruthy();
    
    if (clearButton) {
      fireEvent.click(clearButton);
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('');
    }
  });

  it('renders type filter', () => {
    renderComponent();
    expect(screen.getByPlaceholderText('Filter by type')).toBeInTheDocument();
  });

  it('shows type options when type filter is clicked', async () => {
    renderComponent();
    const typeInput = screen.getByPlaceholderText('Filter by type');
    await userEvent.click(typeInput);
    
    // Wait for the listbox to be rendered
    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeInTheDocument();
    
    // Check that all options are rendered
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(4); // LED, LCD, Projector, Digital Signage
    expect(options[0]).toHaveTextContent('LED');
    expect(options[1]).toHaveTextContent('LCD');
    expect(options[2]).toHaveTextContent('Projector');
    expect(options[3]).toHaveTextContent('Digital Signage');
  });

  it('calls onTypesChange when type is selected', async () => {
    const { mockProps } = renderComponent();
    const typeInput = screen.getByPlaceholderText('Filter by type');
    await userEvent.click(typeInput);
    
    const option = screen.getByText('LED');
    await userEvent.click(option);
    
    expect(mockProps.onTypesChange).toHaveBeenCalledWith(['LED']);
  });

  it('renders status filter', () => {
    renderComponent();
    expect(screen.getByPlaceholderText('Filter by status')).toBeInTheDocument();
  });

  it('shows status options when status filter is clicked', async () => {
    renderComponent();
    const statusInput = screen.getByPlaceholderText('Filter by status');
    await userEvent.click(statusInput);
    
    // Wait for the listbox to be rendered
    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeInTheDocument();
    
    // Check that all options are rendered
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(3); // online, offline, maintenance
    expect(options[0]).toHaveTextContent('online');
    expect(options[1]).toHaveTextContent('offline');
    expect(options[2]).toHaveTextContent('maintenance');
  });

  it('calls onStatusesChange when status is selected', async () => {
    const { mockProps } = renderComponent();
    const statusInput = screen.getByPlaceholderText('Filter by status');
    await userEvent.click(statusInput);
    
    const option = screen.getByText('online');
    await userEvent.click(option);
    
    expect(mockProps.onStatusesChange).toHaveBeenCalledWith(['online']);
  });

  it('shows selected filters as chips', () => {
    const selectedTypes: DisplayType[] = ['LED'];
    const selectedStatuses: DisplayStatus[] = ['online'];
    
    const { container } = renderComponent({
      selectedTypes,
      selectedStatuses,
    });

    // Find all chips by their data-testid
    const typeChips = screen.getAllByTestId('type-chip');
    const statusChips = screen.getAllByTestId('status-chip');

    expect(typeChips).toHaveLength(1);
    expect(statusChips).toHaveLength(1);

    expect(typeChips[0]).toHaveTextContent('LED');
    expect(statusChips[0]).toHaveTextContent('online');
  });

  it('removes type filter when chip is clicked', () => {
    const selectedTypes: DisplayType[] = ['LED'];
    const { mockProps } = renderComponent({
      selectedTypes,
    });

    // Find the LED chip by data-testid
    const typeChips = screen.getAllByTestId('type-chip');
    expect(typeChips).toHaveLength(1);

    // Find and click the delete button within the chip
    const deleteButton = within(typeChips[0]).getByRole('button');
    fireEvent.click(deleteButton);

    expect(mockProps.onTypesChange).toHaveBeenCalledWith([]);
  });

  it('removes status filter when chip is clicked', () => {
    const selectedStatuses: DisplayStatus[] = ['online'];
    const { mockProps } = renderComponent({
      selectedStatuses,
    });

    // Find the online chip by data-testid
    const statusChips = screen.getAllByTestId('status-chip');
    expect(statusChips).toHaveLength(1);

    // Find and click the delete button within the chip
    const deleteButton = within(statusChips[0]).getByRole('button');
    fireEvent.click(deleteButton);

    expect(mockProps.onStatusesChange).toHaveBeenCalledWith([]);
  });
}); 