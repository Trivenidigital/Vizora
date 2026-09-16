import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Index from '@/app/page';

/**
 * Behavioural invariants for the "Little Worlds" marketing homepage.
 *
 * `marketing-sections.test.tsx` pins what must NOT be published and what the
 * shared token scopes must keep; this file pins what the page must DO — that
 * every in-page link is a real anchor pointing at something that exists, that
 * the three interactive surfaces (place explorer, pricing, product tour)
 * report their own state, and that the claims audit stays applied.
 */

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

// jsdom implements neither of these; the page calls both on every anchor click.
Element.prototype.scrollIntoView = jest.fn();

// Every test here renders the entire homepage, several of them twice over a
// user interaction. Jest's 5s default is the same order of magnitude as one
// cold render of it, which makes the default a coin toss rather than a bound.
jest.setTimeout(15000);

const IN_PRICING = {
  region: 'IN',
  currency: 'INR',
  symbol: '₹',
  basic: { monthly: 399, annual: 317 },
  pro: { monthly: 599, annual: 483 },
  locale: 'en-IN',
};

const mockGeoPricing = () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => IN_PRICING,
  }) as unknown as typeof fetch;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGeoPricing();
});

/**
 * The whole page is one render — nav, the CSS-3D diorama, four content
 * sections, pricing and the footer — so on a cold worker in a full-suite run it
 * can outlast the 1s default `findBy` window. The wait is generous for that
 * reason only; a genuine regression still fails, just later.
 */
const WAIT = { timeout: 5000 };

/**
 * Render and wait for the geo-pricing fetch to land. The currency group only
 * exists once it has, so awaiting it both settles the pending state update and
 * leaves every test looking at the same, fully-resolved page.
 */
const renderPage = async () => {
  const utils = render(<Index />);
  await screen.findByRole('group', { name: 'Currency' }, WAIT);
  return utils;
};

describe('homepage composition', () => {
  it('mounts every narrated section under the page landmarks', async () => {
    const { container } = await renderPage();

    for (const id of ['places', 'how-it-works', 'product', 'pricing', 'faq', 'start']) {
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    }

    expect(container.querySelector('main#main-content')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('states the promise once, in a single h1', async () => {
    await renderPage();

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toContain('Your world.');
    expect(headings[0].textContent).toContain('Perfectly in sync.');
  });

  it('every in-page anchor resolves, and the account routes stay reachable', async () => {
    const { container } = await renderPage();

    const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
    expect(anchors.length).toBeGreaterThan(0);

    const dangling = anchors
      .map((a) => a.getAttribute('href')!.slice(1))
      .filter((id) => !container.querySelector(`#${id}`));
    expect(dangling).toEqual([]);

    const header = container.querySelector('nav')!;
    expect(header.querySelector('a[href="/login"]')).toBeInTheDocument();
    expect(header.querySelector('a[href="/register"]')).toBeInTheDocument();

    expect(container.querySelector('a[href="mailto:support@vizora.cloud"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="mailto:sales@vizora.cloud"]')).toBeInTheDocument();

    const footer = screen.getByRole('contentinfo');
    for (const href of ['/privacy', '/terms', '/refund', '/sla', '/dashboard']) {
      expect(footer.querySelector(`a[href="${href}"]`)).toBeInTheDocument();
    }
  });

  it('clicking an in-page anchor scrolls its target and puts the section in the URL', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();

    const pricing = container.querySelector('#pricing')!;
    const link = container.querySelector<HTMLAnchorElement>('nav a[href="#pricing"]')!;

    await user.click(link);

    expect(pricing.scrollIntoView).toHaveBeenCalled();
    expect(window.location.hash).toBe('#pricing');
  });

  it('leaves a modified click (open in new tab) to the native link', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();
    const link = container.querySelector<HTMLAnchorElement>('nav a[href="#faq"]')!;

    await user.keyboard('{Control>}');
    await user.click(link);
    await user.keyboard('{/Control}');

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('hero place explorer', () => {
  it('offers the three places the page narrates', async () => {
    await renderPage();

    const group = screen.getByRole('group', { name: 'Explore a place' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent?.trim())).toEqual([
      'Caféexplore',
      'Hotelexplore',
      'Retailexplore',
    ]);
  });

  it('hands the chosen place to the Places section and jumps to it', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();

    const group = screen.getByRole('group', { name: 'Explore a place' });
    await user.click(within(group).getByRole('button', { name: /Retail/ }));

    expect(window.location.hash).toBe('#places');

    const places = container.querySelector('#places')!;
    expect(within(places as HTMLElement).getByRole('button', { name: /Noble & Co\./ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('places explorer', () => {
  const placesSection = (container: HTMLElement) =>
    within(container.querySelector('#places') as HTMLElement);

  it('resets to the first screen of a newly picked location and previews it', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();
    const places = placesSection(container);

    await user.click(places.getByRole('button', { name: /Horizon Hotel/ }));

    expect(places.getByRole('button', { name: /Horizon Hotel/ })).toHaveAttribute('aria-pressed', 'true');
    expect(places.getByRole('button', { name: /Riverside Café/ })).toHaveAttribute('aria-pressed', 'false');
    expect(places.getByRole('button', { name: /Lobby welcome/ })).toHaveAttribute('aria-pressed', 'true');

    expect(container.querySelector('.lwp-preview')!.textContent).toContain('Welcome');
  });

  it('previews the screen that was picked, with its schedule', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();
    const places = placesSection(container);

    await user.click(places.getByRole('button', { name: /Horizon Hotel/ }));
    await user.click(places.getByRole('button', { name: /Events board/ }));

    expect(places.getByRole('button', { name: /Events board/ })).toHaveAttribute('aria-pressed', 'true');
    expect(places.getByRole('button', { name: /Lobby welcome/ })).toHaveAttribute('aria-pressed', 'false');

    const preview = container.querySelector('.lwp-preview')!;
    expect(preview.textContent).toContain('Today’s events');

    const rows = Array.from(preview.querySelectorAll('.lwp-sched-row')).map((r) => r.textContent);
    expect(rows).toEqual(['08:00Today’s events', '20:00Tomorrow preview']);
  });

  it('resets the screen even when the place changes from the HERO, across a colliding id', async () => {
    // "window" is a screen id in BOTH retail and café. A hero-driven place
    // change arrives as a prop (never through the in-panel pick handler), so
    // without the render-time reset the stale retail selection would resolve
    // against café's own "window" screen instead of its first one.
    const user = userEvent.setup();
    const { container } = await renderPage();
    const places = placesSection(container);

    await user.click(places.getByRole('button', { name: /Noble & Co\./ }));
    await user.click(places.getByRole('button', { name: /Window portrait/ }));
    expect(places.getByRole('button', { name: /Window portrait/ })).toHaveAttribute('aria-pressed', 'true');

    const heroGroup = screen.getByRole('group', { name: 'Explore a place' });
    await user.click(within(heroGroup).getByRole('button', { name: /Café/ }));

    expect(places.getByRole('button', { name: /Menu board/ })).toHaveAttribute('aria-pressed', 'true');
    expect(places.getByRole('button', { name: /Window board/ })).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('.lwp-preview')!.textContent).toContain('Morning Menu');
  });

  it('labels the workspace as synthetic, so it cannot read as customer telemetry', async () => {
    await renderPage();
    expect(
      screen.getByText(/Illustrative workspace — synthetic example data/i),
    ).toBeInTheDocument();
  });
});

describe('geo-aware pricing', () => {
  it('renders the fetched region and keeps the currency and cycle toggles in sync', async () => {
    const user = userEvent.setup();
    render(<Index />);

    expect(await screen.findByText('₹599', undefined, WAIT)).toBeInTheDocument();

    const monthly = screen.getByRole('button', { name: /^Monthly$/ });
    const annual = screen.getByRole('button', { name: /Annual/ });
    expect(monthly).toHaveAttribute('aria-pressed', 'true');
    expect(annual).toHaveAttribute('aria-pressed', 'false');

    await user.click(annual);
    expect(screen.getByText('₹483')).toBeInTheDocument();
    expect(monthly).toHaveAttribute('aria-pressed', 'false');
    expect(annual).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'USD' }));
    expect(screen.getByText('$7')).toBeInTheDocument();

    await user.click(monthly);
    expect(screen.getByText('$8')).toBeInTheDocument();
  });

  it('falls back to US pricing when the geo lookup fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    render(<Index />);

    // The currency group only renders once `pricing` is populated, so awaiting
    // it proves the catch branch ran rather than that the render-time default
    // happens to print the same number.
    expect(await screen.findByRole('group', { name: 'Currency' }, WAIT)).toBeInTheDocument();
    expect(screen.getByText('$8')).toBeInTheDocument();
  });
});

describe('mobile menu', () => {
  it('reports its state, closes on selection and closes on Escape', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();

    const burger = screen.getByRole('button', { name: 'Open menu' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    expect(burger).toHaveAttribute('aria-controls', 'mobile-menu');
    expect(container.querySelector('#mobile-menu')).not.toBeInTheDocument();

    await user.click(burger);
    const menu = container.querySelector('#mobile-menu');
    expect(menu).toBeInTheDocument();
    expect(burger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close menu' })).toBe(burger);

    await user.click(within(menu as HTMLElement).getByRole('link', { name: 'Places' }));
    expect(container.querySelector('#mobile-menu')).not.toBeInTheDocument();

    await user.click(burger);
    expect(container.querySelector('#mobile-menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(container.querySelector('#mobile-menu')).not.toBeInTheDocument();
  });
});

describe('FAQ accordion', () => {
  it('pairs aria-expanded on the question with the answer it controls', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();

    const faq = container.querySelector('#faq')!;
    const question = within(faq as HTMLElement).getAllByRole('button')[0];
    const answer = container.querySelector(`#${CSS.escape(question.getAttribute('aria-controls')!)}`)!;

    expect(question).toHaveAttribute('aria-expanded', 'false');
    expect(answer).toHaveAttribute('aria-hidden', 'true');

    await user.click(question);
    expect(question).toHaveAttribute('aria-expanded', 'true');
    expect(answer).toHaveAttribute('aria-hidden', 'false');
  });

  it('answers the offline question honestly — cached playback, not a promise of uptime', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();

    const faq = container.querySelector('#faq')!;
    const question = within(faq as HTMLElement).getByRole('button', { name: /loses its connection/i });
    await user.click(question);

    const answer = container.querySelector(`#${CSS.escape(question.getAttribute('aria-controls')!)}`)!;
    expect(answer.textContent).toContain('keeps playing');
  });
});

describe('product tour dialog', () => {
  it('requests the video only once asked, and returns focus to the chip', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();

    // The asset is 48 MB — it must not be in the tree before the chip is pressed.
    expect(container.querySelector('video')).not.toBeInTheDocument();

    const product = container.querySelector('#product')!;
    const chip = within(product as HTMLElement).getByRole('button', { name: /Watch the tour/ });
    await user.click(chip);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(container.querySelector('source[src="/videos/vizora-demo.mp4"]')).toBeInTheDocument();

    // The player itself must be a tab stop inside the trap, or its native
    // controls can never be reached by keyboard.
    await user.tab();
    expect(document.activeElement).toBe(container.querySelector('video'));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(chip);
  });
});

describe('landmarks', () => {
  it('names every section on the page', async () => {
    const { container } = await renderPage();

    const unnamed = Array.from(container.querySelectorAll('section')).filter((section) => {
      if (section.getAttribute('aria-label')?.trim()) return false;
      const labelledBy = section.getAttribute('aria-labelledby');
      if (!labelledBy) return true;
      return !container.querySelector(`#${labelledBy}`)?.textContent?.trim();
    });
    expect(unnamed.map((s) => s.className)).toEqual([]);
  });
});

describe('claims audit stays applied', () => {
  it('renders none of the statements the product cannot support', async () => {
    const { container } = await renderPage();
    // Every string here is live somewhere it could leak back from: the counts,
    // the certification and the encryption badge all still render on the auth
    // screens, and the last two are the placeholder captions the diorama work
    // used while the scene was being built. The SSO badge label and its
    // sub-label rendered as separate nodes, hence the concatenated form.
    for (const claim of [
      '50,000',
      '2,500',
      'since 2024',
      'SOC 2',
      '256-bit',
      'SSOSupported',
      'AI-powered',
      'Sarah Chen',
      '4.9/5',
      'Blender render',
      'diorama render',
    ]) {
      expect(container.textContent).not.toContain(claim);
    }
  });
});
