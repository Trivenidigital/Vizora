import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Index from '@/app/page';

/**
 * The image path for the hero's world slots with a controlled manifest.
 *
 * This file mocks the table with three predictable assets and pins the two
 * things that must hold independently of the production artwork: the slot draws
 * an <img> with its intrinsic size reserved, and the place buttons keep
 * working, because they are live HTML sitting ON TOP of either mode.
 */

jest.mock('@/components/landing/worldAssets', () => ({
  __esModule: true,
  WORLD_ASSETS: {
    cafe: { src: '/landing/worlds/cafe.png', width: 1600, height: 1200 },
    hotel: { src: '/landing/worlds/hotel.png', width: 1600, height: 1200 },
    retail: { src: '/landing/worlds/retail.png', width: 1600, height: 1200, matte: 'ivory' },
  },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, sizes, width, height, loading, priority }: Record<string, unknown>) => (
    <img
      src={String(src)}
      alt={String(alt)}
      data-sizes={String(sizes)}
      data-loading={loading ? String(loading) : undefined}
      data-priority={priority ? 'true' : undefined}
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

describe('hero world slots — image mode', () => {
  it('draws each place as an image instead of the CSS vignette', async () => {
    const { container } = await renderPage();

    const slots = Array.from(container.querySelectorAll('.lw-slot'));
    expect(slots.map((s) => s.getAttribute('data-place'))).toEqual(['cafe', 'hotel', 'retail']);

    // Exactly one renderer per place: the CSS scene must skip every place that
    // an image is covering, or the two would draw the same vignette twice.
    expect(container.querySelectorAll('.lw-hero-stage .lws-v')).toHaveLength(0);
  });

  it('reserves the slot so switching modes cannot shift the layout', async () => {
    const { container } = await renderPage();

    for (const slot of Array.from(container.querySelectorAll('.lw-slot'))) {
      const img = slot.querySelector('img')!;
      // Intrinsic size travels with the image, so the box is reserved at 4:3
      // before it loads.
      expect(img.getAttribute('width')).toBe('1600');
      expect(img.getAttribute('height')).toBe('1200');
      expect(Number(img.getAttribute('width')) / Number(img.getAttribute('height'))).toBeCloseTo(4 / 3);
      // Decorative: the pin label button beside it carries the semantics.
      expect(img).toHaveAttribute('alt', '');
      expect(slot).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('loads the hero images eagerly and the thumbnails lazily', async () => {
    const { container } = await renderPage();

    for (const slot of Array.from(container.querySelectorAll('.lw-slot'))) {
      expect(slot.querySelector('img')).toHaveAttribute('data-priority', 'true');
    }
    for (const thumb of Array.from(container.querySelectorAll('#locations .lwl-thumb'))) {
      expect(thumb.querySelector('img')).toHaveAttribute('data-loading', 'lazy');
    }
  });

  it('flags only the asset that asked for the ivory matte', async () => {
    const { container } = await renderPage();

    const matted = Array.from(container.querySelectorAll('.lw-slot'))
      .filter((s) => s.getAttribute('data-matte') === 'ivory')
      .map((s) => s.getAttribute('data-place'));
    expect(matted).toEqual(['retail']);
  });

  it('starts every pin on open ground just below its render, never on it', async () => {
    const { container } = await renderPage();

    // Measured opaque bottoms of the delivered set, % of image height. A slot is
    // 4:3 of a 46%-wide column on a 1000x500 stage, i.e. 69% of stage height.
    const BOTTOM: Record<string, number> = { cafe: 95.0, hotel: 97.7, retail: 97.7 };
    const NAME: Record<string, RegExp> = { cafe: /Café/, hotel: /Hotel/, retail: /Retail/ };
    const group = within(screen.getByRole('group', { name: 'Explore a place' }));
    for (const slot of Array.from(container.querySelectorAll<HTMLElement>('.lw-slot'))) {
      const place = slot.getAttribute('data-place')!;
      const btn = group.getByRole('button', { name: NAME[place] }) as HTMLElement;
      const renderBottom =
        parseFloat(slot.style.getPropertyValue('--y')) + 69 * (BOTTOM[place] / 100);
      const gap = parseFloat(btn.style.getPropertyValue('--y')) - renderBottom;
      expect(gap).toBeGreaterThan(1.5);
      expect(gap).toBeLessThan(4);
    }
  });

  it('asks for the widths the slots actually render at', async () => {
    const { container } = await renderPage();

    const sizes = (place: string) =>
      container.querySelector(`.lw-slot[data-place="${place}"] img`)!.getAttribute('data-sizes');
    expect(sizes('cafe')).toBe(
      '(min-width:1200px) 32vw, (min-width:800px) 350px, (min-width:641px) 44vw, 52vw',
    );
    expect(sizes('hotel')).toBe(
      '(min-width:1200px) 32vw, (min-width:800px) 350px, (min-width:641px) 44vw, 62vw',
    );
  });

  it('keeps the place buttons live on top of the images', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();

    const group = screen.getByRole('group', { name: 'Explore a place' });
    await user.click(within(group).getByRole('button', { name: /Hotel/ }));

    expect(window.location.hash).toBe('#places');
    const places = container.querySelector('#places')!;
    expect(
      within(places as HTMLElement).getByRole('button', { name: /Horizon Hotel/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
