import { render, screen, fireEvent } from '@testing-library/react';
import DaySelector from '../DaySelector';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

describe('DaySelector', () => {
  const defaultProps = {
    selected: [] as string[],
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 7 day buttons', () => {
    render(<DaySelector {...defaultProps} />);
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });

  it('renders quick select buttons', () => {
    render(<DaySelector {...defaultProps} />);
    expect(screen.getByText('All Days')).toBeInTheDocument();
    expect(screen.getByText('Weekdays')).toBeInTheDocument();
    expect(screen.getByText('Weekends')).toBeInTheDocument();
  });

  it('toggles a single day when clicked', () => {
    const onChange = jest.fn();
    render(<DaySelector {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByText('Mon'));
    expect(onChange).toHaveBeenCalledWith(['Monday']);
  });

  it('deselects a day when already selected', () => {
    const onChange = jest.fn();
    render(<DaySelector {...defaultProps} selected={['Monday']} onChange={onChange} />);
    fireEvent.click(screen.getByText('Mon'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('selects all weekdays when Weekdays button is clicked', () => {
    const onChange = jest.fn();
    render(<DaySelector {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByText('Weekdays'));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
    );
  });

  it('selects all 7 days when All Days is clicked', () => {
    const onChange = jest.fn();
    render(<DaySelector {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByText('All Days'));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    );
  });

  it('shows selected count text', () => {
    render(<DaySelector {...defaultProps} selected={['Monday', 'Tuesday']} />);
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/days selected/)).toBeInTheDocument();
  });

  it('shows validation message when no days selected', () => {
    render(<DaySelector {...defaultProps} selected={[]} />);
    expect(screen.getByText('Please select at least one day')).toBeInTheDocument();
  });
});
