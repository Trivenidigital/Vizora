import { readFileSync } from 'node:fs';
import path from 'node:path';

import { render, screen, fireEvent } from '@testing-library/react';

import { NewLookNotice } from '../NewLookNotice';

const SEEN_KEY = 'vizora_new_look_seen';

/**
 * The regression this file exists for is NOT "the notice disappeared".
 *
 * It is "the notice covered something". As a fixed, top-of-the-stack overlay it
 * swallowed clicks meant for the page, and three end-to-end specs timed out on
 * it — delete a display, create URL content, assign a playlist — while
 * pre-redesign `main` had zero occurrences. A test that only asserted the text
 * renders would have stayed green through all of that, which is why the
 * positioning assertions below are the point of the file and the copy
 * assertions are the incidental part.
 */
describe('NewLookNotice', () => {
  beforeEach(() => localStorage.clear());

  it('shows once for a browser that has not seen it', () => {
    render(<NewLookNotice />);
    expect(screen.getByRole('heading', { name: 'Vizora has a new look' })).toBeInTheDocument();
  });

  it('does not render at all once the flag is set', () => {
    localStorage.setItem(SEEN_KEY, '1');
    render(<NewLookNotice />);
    expect(screen.queryByText('Vizora has a new look')).not.toBeInTheDocument();
  });

  it('dismisses and records the dismissal, so it never returns', () => {
    const { unmount } = render(<NewLookNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText('Vizora has a new look')).not.toBeInTheDocument();
    expect(localStorage.getItem(SEEN_KEY)).toBe('1');

    unmount();
    render(<NewLookNotice />);
    expect(screen.queryByText('Vizora has a new look')).not.toBeInTheDocument();
  });

  it('IS NOT POSITIONED, so it cannot cover a control', () => {
    render(<NewLookNotice />);
    const notice = document.querySelector('[data-new-look-notice]');
    expect(notice).not.toBeNull();
    const cls = notice!.className;
    // The exact shape of the bug: a positioned element in the overlay layer.
    expect(cls).not.toMatch(/\bfixed\b/);
    expect(cls).not.toMatch(/\babsolute\b/);
    expect(cls).not.toMatch(/\bsticky\b/);
    expect(cls).not.toMatch(/\bz-/);
    // And it still has to be a real block in the flow rather than nothing.
    expect(cls).toMatch(/\bmb-6\b/);
  });

  it('keeps its live-region semantics, which were never the defect', () => {
    render(<NewLookNotice />);
    const notice = document.querySelector('[data-new-look-notice]')!;
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
  });

  it('survives a browser that throws on localStorage, without nagging', () => {
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('private mode');
      });
    expect(() => render(<NewLookNotice />)).not.toThrow();
    // Skipped rather than shown on every load: it could not be dismissed either.
    expect(screen.queryByText('Vizora has a new look')).not.toBeInTheDocument();
    getItem.mockRestore();
  });

  /*
   * A source scan, because the render assertions above can only see the classes
   * the component chose — not where the dashboard shell decided to put it. The
   * previous bug was half component and half mount point, and moving it back
   * beside the support FAB would not fail any rendering test.
   */
  it('is mounted inside <main>, not beside the overlay widgets', () => {
    const layout = readFileSync(
      path.join(__dirname, '..', '..', 'app', 'dashboard', 'layout.tsx'),
      'utf8',
    );
    const mount = layout.indexOf('<NewLookNotice />');
    const mainOpen = layout.indexOf('<main id="main-content"');
    const mainClose = layout.indexOf('</main>');
    expect(mount).toBeGreaterThan(-1);
    expect(mainOpen).toBeGreaterThan(-1);
    expect(mount).toBeGreaterThan(mainOpen);
    expect(mount).toBeLessThan(mainClose);
  });
});
