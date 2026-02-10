import { render, screen, fireEvent } from '@testing-library/react';
import SearchFilter from '../SearchFilter';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

describe('SearchFilter', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default placeholder', () => {
    render(<SearchFilter {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<SearchFilter {...defaultProps} placeholder="Find items..." />);
    expect(screen.getByPlaceholderText('Find items...')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<SearchFilter {...defaultProps} value="test query" />);
    expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = jest.fn();
    render(<SearchFilter {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'hello' },
    });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('shows clear button when value is not empty', () => {
    render(<SearchFilter {...defaultProps} value="something" />);
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('hides clear button when value is empty', () => {
    render(<SearchFilter {...defaultProps} value="" />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('clears value when clear button is clicked', () => {
    const onChange = jest.fn();
    render(<SearchFilter {...defaultProps} value="test" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('applies custom className', () => {
    const { container } = render(
      <SearchFilter {...defaultProps} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
