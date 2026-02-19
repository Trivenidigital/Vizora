import { render, screen, fireEvent } from '@testing-library/react';
import TimePicker from '../TimePicker';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

describe('TimePicker', () => {
  const defaultProps = {
    value: '09:00',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the selected time displayed', () => {
    render(<TimePicker {...defaultProps} />);
    expect(screen.getByText('09:00')).toBeInTheDocument();
  });

  it('opens dropdown when button is clicked', () => {
    render(<TimePicker {...defaultProps} />);
    fireEvent.click(screen.getByText('09:00'));
    expect(screen.getByText('Common Times')).toBeInTheDocument();
  });

  it('shows preset time options', () => {
    render(<TimePicker {...defaultProps} />);
    fireEvent.click(screen.getByText('09:00'));
    expect(screen.getByText(/Start of Business/)).toBeInTheDocument();
    expect(screen.getByText(/Lunch Time/)).toBeInTheDocument();
    expect(screen.getByText(/End of Business/)).toBeInTheDocument();
  });

  it('calls onChange when a preset is selected', () => {
    const onChange = jest.fn();
    render(<TimePicker {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByText('09:00'));
    fireEvent.click(screen.getByText(/Lunch Time/));
    expect(onChange).toHaveBeenCalledWith('12:00');
  });

  it('closes dropdown after selection', () => {
    render(<TimePicker {...defaultProps} />);
    fireEvent.click(screen.getByText('09:00'));
    fireEvent.click(screen.getByText(/Midnight/));
    expect(screen.queryByText('Common Times')).not.toBeInTheDocument();
  });

  it('displays time in 12h format when configured', () => {
    render(<TimePicker {...defaultProps} showFormat="12h" />);
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
  });
});
