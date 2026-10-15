import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  // An older editor build persisted corrupted zones; the page must still open
  // and save such a layout rather than round-trip the corruption.
  describe('stored zones that are malformed', () => {
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockUpdateLayout.mockResolvedValue({});
    });
    afterEach(() => warn.mockRestore());

    const withZones = (zones: unknown[]) =>
      mockGetResolvedLayout.mockResolvedValue({
        id: 'layout-1',
        name: 'Lobby Split',
        type: 'layout',
        metadata: { layoutType: 'split-horizontal', zones },
      });

    const savedZones = async () => {
      await waitFor(() => expect(screen.getByText('Lobby Split')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Save Layout'));
      await waitFor(() => expect(mockUpdateLayout).toHaveBeenCalledTimes(1));
      return mockUpdateLayout.mock.calls[0][1].zones as Array<{ id: unknown; gridArea: unknown }>;
    };

    it.each([
      ['the [[],[]] shape prod persisted', [[], []]],
      ['a zone missing gridArea', [{ id: 'left', name: 'Left', gridArea: '1 / 1 / 2 / 2' }, { id: 'right', name: 'Right' }]],
      ['a zone with a non-string id', [{ id: 7, name: 'Left', gridArea: '1 / 1 / 2 / 2' }]],
      ['a null zone', [null]],
    ])('falls back to the default zones for %s, warns, and saves well-formed zones', async (_label, zones) => {
      withZones(zones);
      renderPage();

      const saved = await savedZones();

      expect(saved.map((z) => [z.id, z.gridArea])).toEqual([
        ['zone-a', '1 / 1 / 2 / 2'],
        ['zone-b', '1 / 2 / 2 / 3'],
      ]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('malformed zones'), zones);
    });

    it('keeps well-formed stored zones (and their ids) without warning', async () => {
      renderPage();

      const saved = await savedZones();

      expect(saved.map((z) => z.id)).toEqual(['left', 'right']);
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
