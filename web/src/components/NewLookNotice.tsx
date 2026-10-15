'use client';

import { useEffect, useState } from 'react';

/**
 * One-time "Vizora has a new look" dismissal.
 *
 * Decision D2 in `docs/plans/2026-09-17-full-web-little-worlds-redesign.md` §3:
 * existing users with no saved preference get light, with a one-time notice —
 * silent flips are the thing to avoid.
 *
 * It is a PLAIN DISMISSAL, not a theme offer, and that follows from D1 rather
 * than being a separate choice: dark was removed, so there is nothing to switch
 * to. Offering "switch back to dark" would be a button that cannot work. The
 * original recommendation in the plan said "New look — switch to dark"; that
 * wording predates the decision to drop dark and would be a broken promise.
 *
 * Shown once per browser, then never again — the only state is the dismissal
 * flag below.
 *
 * It deliberately does NOT try to exclude brand-new accounts, because it
 * cannot: the old default was dark with nothing persisted, so "no `theme-mode`
 * key" describes a first-time visitor and a long-standing user who never opened
 * the toggle identically — and the second of those is exactly who this notice is
 * for. Distinguishing them needs a server-side signal (account age), which is
 * not worth a migration for one dismissible card. A new user sees one extra
 * card once; an existing user is not silently re-themed. That trade is the
 * right way round.
 *
 * Mounted in the dashboard layout only, so it never reaches the public
 * marketing or legal pages, where "your data and settings are unchanged" would
 * be addressed to someone who has neither.
 *
 * ── IN THE PAGE FLOW, AND THAT IS THE WHOLE POINT (B20) ──────────────────────
 *
 * This was a fixed card pinned to the bottom-right corner, above every other
 * layer, and it swallowed clicks meant for whatever sat beneath it. Three
 * end-to-end specs caught it — delete a display, create URL content, assign a
 * playlist to a display — each timing out for 30s with Playwright reporting that
 * the notice's subtree "intercepts pointer events". Pre-redesign `main` had zero
 * occurrences. Every existing customer would have hit it once, on their first
 * login after deploy, with the bottom-right of every dashboard page dead until
 * they dismissed it.
 *
 * (The old z-index is described rather than quoted on purpose: Tailwind scans
 * comments, and this component was the only consumer of that arbitrary value, so
 * naming it would keep a dead rule in the bundle. Trap T4.)
 *
 * The previous fix moved the card from `bottom-4` to `bottom-24` because it was
 * covering the support FAB and the Cmd-K hint. That treated the symptom. The
 * cause is that a cosmetic announcement was in the overlay layer at all, and
 * there is no fixed position on a dashboard that is safe: the corners hold the
 * support FAB and the command hint, the top holds the header and the billing
 * banners, and every inner region is content a user clicks.
 *
 * So it is no longer positioned. It renders in the flow at the top of `<main>`,
 * takes layout space like any other block, and pushes the page down instead of
 * covering it. An in-flow element cannot intercept a click meant for something
 * else — not as a property it is careful about, but as one it cannot violate.
 * `pointer-events-none` would NOT have been enough on its own: the card needs to
 * receive its own dismiss click, so the interactive panel would have kept
 * blocking its own footprint, which is exactly where the button is. That is the
 * difference between this and the Cmd-K hint two corners over, which IS a fixed
 * overlay and IS safe — it carries `pointer-events-none` and has nothing to
 * click, so it can afford to. A dismissible card cannot.
 *
 * Do not give this component `fixed`, `absolute` or a `z-` class again.
 * `NewLookNotice.test.tsx` fails if any of them comes back.
 *
 * ── SEMANTICS: role unchanged, deliberately ─────────────────────────────────
 *
 * Still `role="status"`. The role was never the defect, and ARIA's definition
 * fits the new shape as well as the old one — "advisory information for the user
 * but not important enough to justify an alert" — since "transient" is a
 * convention around `status`, not a requirement of it. It is inserted after
 * mount, so the polite live region still does the one job D2 asks for: the user
 * is TOLD, once.
 *
 * The title is a styled `<p>`, NOT an `<h2>`. It was briefly an `<h2>`, on the
 * reasoning that persistent content should stay reachable from the heading
 * outline after the announcement has passed — sound in general, wrong here,
 * because this component is mounted in the dashboard LAYOUT. That put a second
 * `<h2>` above the `<h2>` page title of EVERY dashboard page ("Dashboard
 * Overview" and the rest), so each page advertised two headings at the same
 * level and the outline stopped saying which one was the page. The live region
 * is what carries the announcement — `role="status"` + `aria-live="polite"` is
 * announced with no heading at all — so dropping the heading costs this notice
 * nothing and gives every page its single unambiguous title back.
 */
const SEEN_KEY = 'vizora_new_look_seen';

export function NewLookNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) === '1') return;
      setVisible(true);
    } catch {
      /* private mode: skip rather than nag on every page load */
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-new-look-notice
      className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="min-w-0">
        {/*
          A <p>, not an <h2>: this component is mounted in the dashboard layout, so a
          heading here would sit above every page's own <h2> title and leave two
          same-level headings per page. The role="status" live region already
          announces the notice without one.
        */}
        <p className="text-sm font-semibold text-[var(--foreground)]">Vizora has a new look</p>
        <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
          We&apos;ve refreshed the interface with a lighter, calmer design. Your data and settings
          are unchanged.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="eh-btn-neon mt-3 shrink-0 rounded-lg px-3 py-1.5 text-sm sm:mt-0"
      >
        Got it
      </button>
    </div>
  );
}

export default NewLookNotice;
