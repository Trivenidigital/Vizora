import { render, screen, waitFor } from '@testing-library/react';
import LayoutEditorPage from '../page';

const mockPush = jest.fn();
const mockGetResolvedLayout = jest.fn();
const mockGet = jest.fn();
const mockGetContent = jest.fn();
const mockGetPlaylists = jest.fn();
const mockUpdateLayout = jest.fn();

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    use: jest.fn(() => ({ id: 'layout-1' })),
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getResolvedLayout: (...args: any[]) => mockGetResolvedLayout(...args),
    get: (...args: any[]) => mockGet(...args),
    getContent: (...args: any[]) => mockGetContent(...args),
    getPlaylists: (...args: any[]) => mockGetPlaylists(...args),
    updateLayout: (...args: any[]) => mockUpdateLayout(...args),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    ToastContainer: () => null,
  }),
}));

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() { return <div data-testid="spinner">Loading...</div>; };
});

function renderPage() {
  return render(
    <LayoutEditorPage params={Promise.resolve({ id: 'layout-1' })} />,
  );
}

describe('LayoutEditorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetResolvedLayout.mockResolvedValue({
      id: 'layout-1',
      name: 'Lobby Split',
      description: 'Front lobby screen',
      type: 'layout',
      metadata: {
        layoutType: 'split-horizontal',
        zones: [
          { id: 'left', name: 'Left', gridArea: '1 / 1 / 2 / 2' },
          { id: 'right', name: 'Right', gridArea: '1 / 2 / 2 / 3' },
        ],
      },
    });
    mockGetContent.mockResolvedValue({ data: [] });
    mockGetPlaylists.mockResolvedValue({ data: [] });
  });

  it('opens resolved layouts whose zone metadata is nested under metadata', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lobby Split')).toBeInTheDocument();
    });

    expect(screen.getByText('Split Horizontal Layout -- Front lobby screen')).toBeInTheDocument();
    expect(screen.getAllByText('Left').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Right').length).toBeGreaterThan(0);
    expect(mockGetResolvedLayout).toHaveBeenCalledWith('layout-1');
  });
});
