import { render, screen, fireEvent, act } from '@testing-library/react';
import PlaylistPreview from '../PlaylistPreview';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

const mockItems = [
  {
    id: 'item-1',
    contentId: 'c1',
    duration: 10,
    order: 0,
    content: { id: 'c1', title: 'Slide 1', type: 'image', thumbnailUrl: 'https://example.com/thumb1.jpg' },
  },
  {
    id: 'item-2',
    contentId: 'c2',
    duration: 15,
    order: 1,
    content: { id: 'c2', title: 'Slide 2', type: 'video' },
  },
];

describe('PlaylistPreview', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders empty state when no items', () => {
    render(<PlaylistPreview items={[]} />);
    expect(screen.getByText('No items to preview')).toBeInTheDocument();
  });

  it('renders first item by default', () => {
    render(<PlaylistPreview items={mockItems} autoPlay={false} />);
    expect(screen.getByText('Slide 1')).toBeInTheDocument();
  });

  it('shows item position counter', () => {
    render(<PlaylistPreview items={mockItems} autoPlay={false} />);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('navigates to next item when Next is clicked', () => {
    render(<PlaylistPreview items={mockItems} autoPlay={false} />);
    fireEvent.click(screen.getByTitle('Next'));
    expect(screen.getAllByText('Slide 2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('navigates to previous item when Previous is clicked', () => {
    render(<PlaylistPreview items={mockItems} autoPlay={false} />);
    fireEvent.click(screen.getByTitle('Next'));
    fireEvent.click(screen.getByTitle('Previous'));
    expect(screen.getByText('Slide 1')).toBeInTheDocument();
  });

  it('shows time remaining', () => {
    render(<PlaylistPreview items={mockItems} autoPlay={false} />);
    expect(screen.getByText('10s remaining')).toBeInTheDocument();
  });

  it('renders close button when onClose is provided', () => {
    const onClose = jest.fn();
    render(<PlaylistPreview items={mockItems} autoPlay={false} onClose={onClose} />);
    const closeBtn = document.querySelector('.absolute.top-2.right-2');
    expect(closeBtn).toBeInTheDocument();
  });

  it('renders image when thumbnailUrl is provided', () => {
    render(<PlaylistPreview items={mockItems} autoPlay={false} />);
    const img = screen.getByAltText('Slide 1');
    expect(img).toBeInTheDocument();
  });
});
