import { render, screen, within } from '@testing-library/react';

import Index from '@/app/page';

/**
 * Mixed mode: the hotel as a delivered render, cafe and retail still in CSS.
 *
 * This is the state during any staged rollout, or if one render fails review.
 * Each place must be drawn by exactly ONE renderer, and each pin must follow the
 * renderer actually in use for its own place.
 */

jest.mock('@/components/landing/worldAssets', () => ({
  __esModule: true,
  WORLD_ASSETS: {
    cafe: null,
    hotel: { src: '/landing/worlds/hotel.png', width: 1600, height: 1200 },
    retail: null,
  },
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
  global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
});

const pinOf = (name: RegExp) => {
  const group = within(screen.getByRole('group', { name: 'Explore a place' }));
  const btn = group.getByRole('button', { name }) as HTMLElement;
  return {
    x: parseFloat(btn.style.getPropertyValue('--x')),
    y: parseFloat(btn.style.getPropertyValue('--y')),
  };
};

describe('hero world slots — mixed mode', () => {
  it('draws the hotel as an image and the other two in CSS, never both', async () => {
    const { container } = await renderPage();

    const slots = Array.from(container.querySelectorAll('.lw-slot'));
    expect(slots.map((s) => s.getAttribute('data-place'))).toEqual(['hotel']);
    const css = Array.from(container.querySelectorAll('.lw-hero-stage .lws-v')).map((v) =>
      v.getAttribute('data-v'),
    );
    expect(css.sort()).toEqual(['cafe', 'retail']);
  });

  it('puts each pin on the renderer in use for its own place', async () => {
    await renderPage();

    // CSS places keep their CSS pins...
    expect(pinOf(/Café/)).toEqual({ x: 28.2, y: 69.2 });
    expect(pinOf(/Retail/)).toEqual({ x: 79.2, y: 68.2 });
    // ...the image place's pin is derived from its slot, not its CSS one.
    const hotel = pinOf(/Hotel/);
    expect(hotel).not.toEqual({ x: 53.2, y: 59.2 });
    expect(hotel.x).toBeCloseTo(54.5, 5);
  });

  it('drops the mobile thread once any place is a render', async () => {
    const { container } = await renderPage();

    expect(container.querySelector('.lw-thread-m')).toBeNull();
  });
});
