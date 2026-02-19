import { render, screen, fireEvent } from '@testing-library/react';
import DeviceGroupSelector, { DeviceGroup } from '../DeviceGroupSelector';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

const mockGroups: DeviceGroup[] = [
  { id: 'g1', name: 'Lobby Screens', description: 'Lobby displays', deviceIds: ['d1', 'd2'] },
  { id: 'g2', name: 'Conference Rooms', description: 'Meeting room displays', deviceIds: ['d3'] },
];

describe('DeviceGroupSelector', () => {
  const defaultProps = {
    groups: mockGroups,
    selectedGroupIds: [] as string[],
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders group names', () => {
    render(<DeviceGroupSelector {...defaultProps} />);
    expect(screen.getByText('Lobby Screens')).toBeInTheDocument();
    expect(screen.getByText('Conference Rooms')).toBeInTheDocument();
  });

  it('shows device count per group', () => {
    render(<DeviceGroupSelector {...defaultProps} />);
    expect(screen.getByText('2 devices')).toBeInTheDocument();
    expect(screen.getByText('1 device')).toBeInTheDocument();
  });

  it('toggles group selection', () => {
    const onChange = jest.fn();
    render(<DeviceGroupSelector {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByText('Lobby Screens'));
    expect(onChange).toHaveBeenCalledWith(['g1']);
  });

  it('deselects a group when already selected', () => {
    const onChange = jest.fn();
    render(<DeviceGroupSelector {...defaultProps} selectedGroupIds={['g1']} onChange={onChange} />);
    fireEvent.click(screen.getByText('Lobby Screens'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows empty state when no groups', () => {
    render(<DeviceGroupSelector {...defaultProps} groups={[]} />);
    expect(screen.getByText('No device groups yet')).toBeInTheDocument();
  });

  it('shows selected count', () => {
    render(<DeviceGroupSelector {...defaultProps} selectedGroupIds={['g1', 'g2']} />);
    expect(screen.getByText('2 groups selected')).toBeInTheDocument();
  });

  it('shows create group button when showCreate is true', () => {
    render(<DeviceGroupSelector {...defaultProps} showCreate onCreateGroup={jest.fn()} />);
    expect(screen.getByText('+ Create New Group')).toBeInTheDocument();
  });

  it('opens create form and calls onCreateGroup', () => {
    const onCreateGroup = jest.fn();
    render(<DeviceGroupSelector {...defaultProps} showCreate onCreateGroup={onCreateGroup} />);
    fireEvent.click(screen.getByText('+ Create New Group'));
    const nameInput = screen.getByPlaceholderText(/Group name/);
    fireEvent.change(nameInput, { target: { value: 'New Group' } });
    fireEvent.click(screen.getByText('Create'));
    expect(onCreateGroup).toHaveBeenCalledWith('New Group', '');
  });
});
