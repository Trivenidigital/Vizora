import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';

import Index from '@/app/page';

/**
 * Behavioural invariants for the marketing homepage.
 *
 * `marketing-sections.test.tsx` pins what must NOT be published; this file pins
 * what the page must DO — that every in-page link is a real anchor pointing at
 * something that exists, that the disclosure widgets report their own state,
 * and that the claims audit stays applied.
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
 * Render and wait for the geo-pricing fetch to land. The currency group only
 * exists once it has, so awaiting it both settles the pending state update and
 * leaves every test looking at the same, fully-resolved page.
 */
const renderPage = async () => {
  const utils = render(<Index />);
  await screen.findByRole('group', { name: 'Currency' });
  return utils;
};

describe('homepage composition', () => {
  it('mounts the sections the page is meant to ship, and none of the trimmed ones', async () => {
    const { container } = await renderPage();

    const how = container.querySelector('#how')!;
    expect(how).toBeInTheDocument();
    expect(within(how as HTMLElement).getByRole('heading', { name: /Four layers/i })).toBeInTheDocument();

    for (const id of ['features', 'solutions', 'pricing', 'faq']) {
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    }

    expect(container.querySelector('img[src="/product/dashboard-fleet.png"]')).toBeInTheDocument();

    // The demo SECTION was deliberately trimmed. (The testimonials block is
    // pinned unmounted by marketing-sections.test.tsx; not repeated here.)
    expect(screen.queryByText(/See Vizora In Action/i)).not.toBeInTheDocument();
  });

  it('every in-page anchor resolves, and the header still offers both account links', async () => {
    const { container } = await renderPage();

    const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
    expect(anchors.length).toBeGreaterThan(0);

    const dangling = anchors
      .map((a) => a.getAttribute('href')!.slice(1))
      .filter((id) => !container.querySelector(`#${id}`));
    expect(dangling).toEqual([]);

    const header = container.querySelector('nav')!;
    expect(header.querySelector('a[href="/register"]')).toBeInTheDocument();
    expect(header.querySelector('a[href="/login"]')).toBeInTheDocument();

    expect(container.querySelector('a[href="mailto:sales@vizora.cloud"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="mailto:support@vizora.cloud"]')).toBeInTheDocument();
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

describe('geo-aware pricing', () => {
  it('renders the fetched region and keeps the currency and cycle toggles in sync', async () => {
    const user = userEvent.setup();
    render(<Index />);

    expect(await screen.findByText('₹599')).toBeInTheDocument();

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
    expect(await screen.findByRole('group', { name: 'Currency' })).toBeInTheDocument();
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

    await user.click(within(menu as HTMLElement).getByRole('link', { name: 'Features' }));
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
});

describe('product tour dialog', () => {
  it('requests the video only once asked, and returns focus to the chip', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();

    // The asset is 48 MB — it must not be in the tree before the chip is pressed.
    expect(container.querySelector('video')).not.toBeInTheDocument();

    const chip = screen.getByRole('button', { name: /product tour/i });
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
  it('names every section and exposes the page landmarks', async () => {
    const { container } = await renderPage();

    expect(container.querySelector('main#main-content')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

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
    // Each of these fails when its fix is reverted (checked by mutation). The
    // badge label and sub-label render as separate nodes, so the SSO badge is
    // matched on the label alone rather than on "SSO Supported".
    for (const claim of ['50,000', '2,500', 'since 2024', 'SOC 2', '256-bit', 'SSOSupported']) {
      expect(container.textContent).not.toContain(claim);
    }
  });

  it('scopes the reduced-motion reveal override to .mkt', () => {
    const css = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'app', 'globals.css'),
      'utf8',
    );
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.mkt \.eh-reveal/);
    expect(css).toMatch(/\.mkt \.eh-reveal \{[^}]*transition: none !important/);
  });
});
