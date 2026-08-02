import { render, screen, fireEvent, act } from '@testing-library/react';
import { CookieConsent, hasConsentFor } from '../CookieConsent';

/**
 * The consent CONTRACT, not the styling.
 *
 * The writer stores the raw choice (`'all'` / `'essential'`) under
 * `vizora_cookie_consent`; the reader gates every non-essential cookie on
 * `consent === 'all'`. Those two agree by convention across two functions and
 * nothing enforced it — change the written token and every non-essential
 * cookie silently switches off with a fully green suite.
 *
 * These tests pin the storage key, the exact stored values, the read
 * semantics, and the show/hide rule. They are deliberately behavioural: the
 * theming (`body:has(.mkt) .consent-bar`) is CSS and is not asserted here.
 */
jest.mock('next/navigation', () => ({ usePathname: () => '/' }));

const KEY = 'vizora_cookie_consent';

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

/** The bar reveals itself 1000ms after mount; advance past that. */
function renderAndReveal() {
  render(<CookieConsent />);
  act(() => {
    jest.advanceTimersByTime(1200);
  });
}

describe('CookieConsent storage contract', () => {
  it('writes exactly "all" when Accept All is chosen', () => {
    renderAndReveal();
    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    expect(localStorage.getItem(KEY)).toBe('all');
  });

  it('writes exactly "essential" when Essential Only is chosen', () => {
    renderAndReveal();
    fireEvent.click(screen.getByRole('button', { name: /essential only/i }));
    expect(localStorage.getItem(KEY)).toBe('essential');
  });

  it('hasConsentFor("all") agrees with what the buttons write', () => {
    renderAndReveal();
    expect(hasConsentFor('all')).toBe(false); // nothing stored yet
    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    expect(hasConsentFor('all')).toBe(true);
  });

  it('"essential" does NOT grant non-essential consent', () => {
    renderAndReveal();
    fireEvent.click(screen.getByRole('button', { name: /essential only/i }));
    expect(hasConsentFor('all')).toBe(false);
    expect(hasConsentFor('essential')).toBe(true);
  });

  it('essential is always allowed, even with nothing stored', () => {
    expect(hasConsentFor('essential')).toBe(true);
  });

  it('an unrecognised stored value does not grant consent (fails closed)', () => {
    localStorage.setItem(KEY, 'yes');
    expect(hasConsentFor('all')).toBe(false);
  });
});

describe('CookieConsent visibility', () => {
  it('is hidden — and out of the tab order — once consent exists', () => {
    localStorage.setItem(KEY, 'all');
    renderAndReveal();
    const bar = document.querySelector('.consent-bar');
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    // `invisible` is what removes the buttons from the tab order; without it
    // the bar merely slides off-screen and stays focusable.
    expect(bar?.className).toContain('invisible');
  });

  it('is shown when no consent has been recorded', () => {
    renderAndReveal();
    const bar = document.querySelector('.consent-bar');
    expect(bar).toHaveAttribute('aria-hidden', 'false');
    expect(bar?.className).toContain('visible');
  });

  it('hides itself immediately after a choice is made', () => {
    renderAndReveal();
    const bar = document.querySelector('.consent-bar');
    expect(bar).toHaveAttribute('aria-hidden', 'false');
    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    expect(document.querySelector('.consent-bar')).toHaveAttribute('aria-hidden', 'true');
  });
});
