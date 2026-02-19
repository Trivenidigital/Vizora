import { render, screen, fireEvent } from '@testing-library/react';
import ContentTagger, { ContentTag } from '../ContentTagger';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

const mockTags: ContentTag[] = [
  { id: 't1', name: 'Holiday', color: 'blue' },
  { id: 't2', name: 'Promotion', color: 'red' },
  { id: 't3', name: 'Seasonal', color: 'green' },
];

describe('ContentTagger', () => {
  const defaultProps = {
    tags: mockTags,
    selectedTags: [] as string[],
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all tags', () => {
    render(<ContentTagger {...defaultProps} />);
    expect(screen.getByText('Holiday')).toBeInTheDocument();
    expect(screen.getByText('Promotion')).toBeInTheDocument();
    expect(screen.getByText('Seasonal')).toBeInTheDocument();
  });

  it('toggles tag selection', () => {
    const onChange = jest.fn();
    render(<ContentTagger {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByText('Holiday'));
    expect(onChange).toHaveBeenCalledWith(['t1']);
  });

  it('deselects a tag when already selected', () => {
    const onChange = jest.fn();
    render(<ContentTagger {...defaultProps} selectedTags={['t1']} onChange={onChange} />);
    fireEvent.click(screen.getByText('Holiday'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows selected count', () => {
    render(<ContentTagger {...defaultProps} selectedTags={['t1', 't2']} />);
    expect(screen.getByText('2 tags selected')).toBeInTheDocument();
  });

  it('shows Add Tag button when onCreateTag is provided', () => {
    render(<ContentTagger {...defaultProps} onCreateTag={jest.fn()} />);
    expect(screen.getByText('+ Add Tag')).toBeInTheDocument();
  });

  it('opens create form and creates a tag', () => {
    const onCreateTag = jest.fn();
    render(<ContentTagger {...defaultProps} onCreateTag={onCreateTag} />);
    fireEvent.click(screen.getByText('+ Add Tag'));
    const nameInput = screen.getByPlaceholderText(/Tag name/);
    fireEvent.change(nameInput, { target: { value: 'New Tag' } });
    fireEvent.click(screen.getByText('Create'));
    expect(onCreateTag).toHaveBeenCalledWith('New Tag', 'blue');
  });

  it('cancels create form', () => {
    render(<ContentTagger {...defaultProps} onCreateTag={jest.fn()} />);
    fireEvent.click(screen.getByText('+ Add Tag'));
    expect(screen.getByPlaceholderText(/Tag name/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText(/Tag name/)).not.toBeInTheDocument();
  });
});
