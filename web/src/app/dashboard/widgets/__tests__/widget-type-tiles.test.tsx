import { render, waitFor } from '@testing-library/react';

import WidgetsPage from '../page';

/**
 * Every widget type the backend serves must get its OWN tile and its OWN icon.
 *
 * This exists because it did not. `getColorForType` and `getIconForType` were two
 * maps keyed on the same strings, and both fell through for the same four types:
 * the Widget Gallery rendered six cards of which Social Instagram, Social Twitter,
 * Social Facebook and Generic-Api all shared one gradient and one icon. The
 * failure was visible in a screenshot and invisible to every test.
 *
 * ── Where the six types come from, and why they are hardcoded here ──────────
 * `GET /content/widgets/types` -> `ContentService.getWidgetTypes()`, which iterates
 * `DataSourceRegistryService.getAll()` and returns each provider's `readonly type`.
 * The six providers are registered in `middleware/src/modules/content/content.module.ts`
 * and their type strings live in `middleware/src/modules/content/widget-data-sources/`:
 *
 *   weather.data-source.ts      readonly type = 'weather'
 *   rss.data-source.ts          readonly type = 'rss'
 *   social.data-source.ts       readonly type = 'social_instagram'
 *   social.data-source.ts       readonly type = 'social_twitter'
 *   social.data-source.ts       readonly type = 'social_facebook'
 *   generic-api.data-source.ts  readonly type = 'generic-api'
 *
 * They are duplicated here rather than imported because `web` does not depend on
 * `middleware`. If a seventh provider is registered, this list must grow with it —
 * that is the whole obligation, and it is cheaper than the bug.
 *
 * NOTE THE UNDERSCORES. The live social types are `social_instagram`, not
 * `social-instagram`; the hyphenated spelling appears nowhere in the repo and a
 * grep for it reads as proof the types do not exist. The rendered CARD TITLE is
 * what misleads — the page derives it with `type.replace(/_/g, ' ')`, so
 * `social_instagram` shows as "Social Instagram". The visible name is not the key.
 */
const SERVED_WIDGET_TYPES = [
  'weather',
  'rss',
  'social_instagram',
  'social_twitter',
  'social_facebook',
  'generic-api',
] as const;

/** A type the map deliberately does not know, to prove the fallback is reachable. */
const UNKNOWN_WIDGET_TYPE = 'not-a-real-widget-type';

const mockGetWidgetTypes = jest.fn();
const mockGet = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getWidgetTypes: (...args: any[]) => mockGetWidgetTypes(...args),
    get: (...args: any[]) => mockGet(...args),
    createWidget: jest.fn(),
    updateWidget: jest.fn(),
    refreshWidget: jest.fn(),
    deleteWidget: jest.fn(),
  },
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    ToastContainer: () => null,
  }),
}));

// Renders the icon NAME as text, so a tile's glyph is readable from the DOM.
jest.mock('@/theme/icons', () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>
      {name}
    </span>
  ),
}));

jest.mock('@/components/LoadingSpinner', () => {
  return function MockSpinner() {
    return <div data-testid="spinner">Loading...</div>;
  };
});

jest.mock('@/components/EmptyState', () => {
  return function MockEmpty({ title }: any) {
    return <div data-testid="empty-state">{title || 'No items'}</div>;
  };
});

jest.mock('@/components/Modal', () => {
  return function MockModal({ isOpen, children, title }: any) {
    return isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null;
  };
});

const asApiType = (type: string) => ({
  type,
  configSchema: { location: { type: 'string', label: 'Location' } },
  sampleData: {},
  defaultTemplate: '',
});

/** The gallery's 128px colour band, one per widget type card. */
type Tile = { tile: string; icon: string; ink: string };

const readGalleryTiles = (container: HTMLElement): Map<string, Tile> => {
  const byLabel = new Map<string, Tile>();
  container.querySelectorAll<HTMLElement>('div.h-32').forEach((band) => {
    const glyph = band.querySelector<HTMLElement>('[data-testid^="icon-"]');
    const card = band.parentElement as HTMLElement;
    const heading = card.querySelector('h4');
    byLabel.set(heading?.textContent ?? '(no heading)', {
      tile: band.className,
      icon: glyph?.textContent ?? '(no glyph)',
      ink: glyph?.className ?? '',
    });
  });
  return byLabel;
};

const renderGallery = async (types: string[]) => {
  mockGetWidgetTypes.mockResolvedValue(types.map(asApiType));
  mockGet.mockResolvedValue({ data: [] });
  const { container } = render(<WidgetsPage />);
  await waitFor(() => {
    expect(container.querySelectorAll('div.h-32').length).toBe(types.length);
  });
  return readGalleryTiles(container);
};

describe('widget type tiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gives every served widget type its own tile colour', async () => {
    const tiles = await renderGallery([...SERVED_WIDGET_TYPES]);
    const colours = [...tiles.values()].map((t) => t.tile);

    expect(colours).toHaveLength(SERVED_WIDGET_TYPES.length);
    expect(new Set(colours).size).toBe(SERVED_WIDGET_TYPES.length);
  });

  it('gives every served widget type its own icon', async () => {
    const tiles = await renderGallery([...SERVED_WIDGET_TYPES]);
    const icons = [...tiles.values()].map((t) => t.icon);

    expect(icons).toHaveLength(SERVED_WIDGET_TYPES.length);
    expect(new Set(icons).size).toBe(SERVED_WIDGET_TYPES.length);
  });

  it('paints every served widget type with a categorical hue, never the fallback', async () => {
    const tiles = await renderGallery([...SERVED_WIDGET_TYPES]);

    for (const [label, tile] of tiles) {
      expect(tile.tile).toContain('bg-[var(--cat-');
      expect(`${label} -> ${tile.icon}`).not.toContain('-> help');
    }
  });

  /*
   * THE CONTROL. Without this the three assertions above would also pass if the
   * fallback branch were unreachable, or if it still painted a hue — which is
   * exactly the shape of the bug (an unknown type wearing the brand gradient and
   * reading as a first-class category).
   */
  it('paints an unrecognised type with a neutral fallback, not a hue', async () => {
    const tiles = await renderGallery([UNKNOWN_WIDGET_TYPE]);
    const [tile] = [...tiles.values()];

    expect(tile.icon).toBe('help');
    expect(tile.tile).toContain('bg-[var(--background-tertiary)]');
    expect(tile.tile).not.toContain('--cat-');
    expect(tile.tile).not.toContain('gradient');
    expect(tile.tile).not.toContain('--primary');
  });

  /*
   * The fallback tile is LIGHT and the hue tiles are DARK, so the glyph ink cannot
   * be hardcoded at the call site — it has to travel with the tile. This pins that.
   */
  it('inks the glyph for the tile it sits on', async () => {
    const hues = await renderGallery([...SERVED_WIDGET_TYPES]);
    for (const tile of hues.values()) {
      expect(tile.ink).toContain('text-white');
    }

    const unknown = await renderGallery([UNKNOWN_WIDGET_TYPE]);
    const [fallback] = [...unknown.values()];
    expect(fallback.ink).toContain('text-[var(--foreground-tertiary)]');
    expect(fallback.ink).not.toContain('text-white');
  });
});
