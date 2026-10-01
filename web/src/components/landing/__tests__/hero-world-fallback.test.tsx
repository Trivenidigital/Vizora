import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Index from '@/app/page';

/**
 * The CSS-3D fallback, with NO render delivered for any place.
 *
 * The photoreal renders are committed and the manifest is filled, so the page
 * never exercises this path by default any more — which is exactly how a
 * fallback rots. It is still the rendering for any place whose asset is removed
 * or fails review, so it is pinned here against an all-null manifest.
 * (Module-scoped: the hero reads the manifest at import, so each manifest state
 * needs its own file.)
 */

jest.mock('@/components/landing/worldAssets', () => ({
  __esModule: true,
  WORLD_ASSETS: { cafe: null, hotel: null, retail: null },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, sizes, width, height }: Record<string, unknown>) => (
    <img
      src={String(src)}
      alt={String(alt)}
      data-sizes={String(sizes)}
      width={Number(width)}
      height={Number(height)}
    />
  ),
}));

Element.prototype.scrollIntoView = jest.fn();
jest.setTimeout(15000);

const renderPage = async () => {
  const utils = render(<Index />);
  await screen.findByRole('heading', { level: 1 });
  return utils;
};

beforeEach(() => {
  window.location.hash = '';
  (Element.prototype.scrollIntoView as jest.Mock).mockClear();
  global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
});

/** The marker's position, as the percentages the hero wrote onto the button. */
const pinOf = (name: RegExp) => {
  const group = within(screen.getByRole('group', { name: 'Explore a place' }));
  const btn = group.getByRole('button', { name }) as HTMLElement;
  return {
    x: parseFloat(btn.style.getPropertyValue('--x')),
    y: parseFloat(btn.style.getPropertyValue('--y')),
  };
};

describe('hero world slots — all-CSS fallback', () => {
  it('draws all three vignettes in CSS and no image slot', async () => {
    const { container } = await renderPage();

    expect(container.querySelectorAll('.lw-hero-stage img')).toHaveLength(0);
    expect(container.querySelectorAll('.lw-slot')).toHaveLength(0);
    expect(container.querySelectorAll('.lw-hero-stage .lws-v')).toHaveLength(3);
  });

  it('keeps the mobile thread, which only the pure CSS cluster has room for', async () => {
    const { container } = await renderPage();

    expect(container.querySelector('.lw-thread-m')).not.toBeNull();
    expect(container.querySelector('.lw-thread-d')).not.toBeNull();
  });

  it('anchors the pins to the CSS plinths, not to image geometry', async () => {
    await renderPage();

    expect(pinOf(/Café/)).toEqual({ x: 28.2, y: 69.2 });
    expect(pinOf(/Hotel/)).toEqual({ x: 53.2, y: 59.2 });
    expect(pinOf(/Retail/)).toEqual({ x: 79.2, y: 68.2 });
  });

  it('shows the CSS minis in the locations strip', async () => {
    const { container } = await renderPage();

    expect(container.querySelectorAll('#locations .lwl-thumb img')).toHaveLength(0);
    expect(container.querySelectorAll('#locations .lwm-fit')).toHaveLength(3);
  });

  it('keeps the place buttons live', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();

    await user.click(
      within(screen.getByRole('group', { name: 'Explore a place' })).getByRole('button', {
        name: /Retail/,
      }),
    );
    expect(window.location.hash).toBe('#places');
    expect(
      within(container.querySelector('#places') as HTMLElement).getByRole('button', {
        name: /Noble & Co\./,
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
