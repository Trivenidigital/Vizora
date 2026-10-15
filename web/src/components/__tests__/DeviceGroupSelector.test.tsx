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

  it('renders every group as a flat list, in order, with no nesting indentation', () => {
    render(<DeviceGroupSelector {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].closest('label')).toHaveTextContent('Lobby Screens');
    expect(checkboxes[1].closest('label')).toHaveTextContent('Conference Rooms');
    for (const checkbox of checkboxes) {
      expect(checkbox.closest('label')!.className).not.toMatch(/ml-/);
    }
  });

  it('never hides a group behind a parent id (DisplayGroup has no hierarchy)', () => {
    // The old recursion only rendered groups whose parentGroupId matched an
    // ancestor, so a stray parent id made a group silently disappear.
    const strayParent = { ...mockGroups[1], parentGroupId: 'missing-parent' } as unknown as DeviceGroup;
    render(<DeviceGroupSelector {...defaultProps} groups={[mockGroups[0], strayParent]} />);
    expect(screen.getByText('Conference Rooms')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });
});
