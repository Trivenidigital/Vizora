import { test, expect } from './fixtures/auth.fixture';

test.describe('Comprehensive UI Validation', () => {
  test.describe('Dashboard Page', () => {
    test('should load dashboard without errors', async ({ authenticatedPage }) => {
      /*
       * The listener used to be attached AFTER goto + networkidle — so it could
       * not see the page load it was named for — and `errors` was never asserted
       * on. All that remained was `expect(body).toBeVisible()`, which is true of
       * every page that returns any HTML at all.
       *
       * `pageerror` rather than `console`: an uncaught exception is
       * unambiguously a defect, where console.error in a dev build carries
       * third-party and framework noise that would turn this into a flake
       * factory. Attached before the navigation, and asserted.
       */
      const pageErrors: string[] = [];
      authenticatedPage.on('pageerror', (err) => pageErrors.push(err.message));

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');
      await authenticatedPage.waitForTimeout(2000);

      // The authenticated shell rendered, not merely "a body exists".
      await expect(authenticatedPage.locator('aside nav')).toBeVisible();
      expect(
        pageErrors,
        `uncaught exceptions on /dashboard: ${pageErrors.join(' | ')}`,
      ).toEqual([]);
    });

    test('should have all navigation links', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * The real sidebar (web/src/app/dashboard/layout.tsx `allNavigation`).
       * 'Dashboard' has not been a nav label since the first item was renamed
       * 'Overview' in January 2026, and the list was missing Templates, Widgets,
       * Layouts and Help.
       *
       * 'Schedules' is deliberately absent: it is filtered out of the nav unless
       * SCHEDULES_ENABLED, which is a BUILD input (NEXT_PUBLIC_SCHEDULES_ENABLED)
       * and off by default, so asserting it here would pin a flag state the spec
       * cannot see.
       */
      const navLinks = [
        'Overview',
        'Devices',
        'Content',
        'Templates',
        'Widgets',
        'Layouts',
        'Playlists',
        'Analytics',
        'Settings',
        'Help',
      ];

      const sidebar = authenticatedPage.locator('aside nav');
      for (const linkText of navLinks) {
        await expect(sidebar.getByRole('link', { name: linkText, exact: true })).toBeVisible({
          timeout: 5000,
        });
      }
    });

    test('should navigate to all main pages', async ({ authenticatedPage }) => {
      const pages = [
        { path: '/dashboard', title: /dashboard/i },
        { path: '/dashboard/devices', title: /device|screen/i },
        { path: '/dashboard/content', title: /content|file|asset/i },
        { path: '/dashboard/playlists', title: /playlist/i },
        { path: '/dashboard/schedules', title: /schedule/i },
        { path: '/dashboard/analytics', title: /analytics|report/i },
        { path: '/dashboard/settings', title: /settings/i },
      ];

      for (const page of pages) {
        await authenticatedPage.goto(page.path);
        await authenticatedPage.waitForLoadState('networkidle');

        // Page should load
        const heading = authenticatedPage.locator('h1, h2').first();
        await expect(heading).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('Form Validation', () => {
    test('should validate email fields', async ({ authenticatedPage }) => {
      /*
       * This used to fill the first input[type="email"] on /dashboard/settings,
       * which is the Account Email field — deliberately readOnly (it shows the
       * signed-in account), so fill() waited forever. The only editable email
       * input in settings is the team invite field, so that is what is exercised
       * here; the locator excludes [readonly] so it can never drift back onto a
       * read-only field.
       */
      await authenticatedPage.goto('/dashboard/settings/team');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.getByRole('button', { name: 'Invite User' }).first().click();

      const dialog = authenticatedPage.getByRole('dialog', { name: 'Invite Team Member' });
      await expect(dialog).toBeVisible({ timeout: 10000 });

      const emailInput = dialog.locator('input[type="email"]:not([readonly])');
      await expect(emailInput).toBeVisible();

      await emailInput.fill('invalid-email');
      await emailInput.blur();
      expect(
        await emailInput.evaluate((el) => (el as HTMLInputElement).validity.valid),
      ).toBeFalsy();

      // Control: the same check must pass for a well-formed address, otherwise
      // the assertion above proves nothing about the input's type.
      await emailInput.fill('someone@example.com');
      await emailInput.blur();
      expect(
        await emailInput.evaluate((el) => (el as HTMLInputElement).validity.valid),
      ).toBeTruthy();
    });

    test('should validate required fields', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * The old body clicked the first /create|new|add/i button and then looked
       * for `button[type="submit"]`. There is NO `type="submit"` button anywhere
       * under /dashboard — every dialog submits through an onClick handler — so
       * `hasSubmit` was always false and the inner block never ran. Past it sat
       * `expect(stillOnForm || true)`, where `stillOnForm` was itself computed
       * from `locator('[role="dialog"], form').isVisible()`: a multi-match that
       * throws a strict-mode violation, which `.catch(() => false)` silently
       * turned into "no form".
       *
       * The content page's real required-field contract is the Create New Folder
       * dialog, which gates submission on `!newFolderName.trim()` — so an empty
       * name and a whitespace-only name must both keep it shut.
       */
      await authenticatedPage.getByRole('button', { name: 'New Folder' }).click();

      const dialog = authenticatedPage.getByRole('dialog', { name: 'Create New Folder' });
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // The modal's <label>Folder Name</label> carries no htmlFor, so the input
      // has no accessible name to query by; it is the only textbox in the dialog
      // (the parent-folder control is a combobox).
      const name = dialog.getByRole('textbox');
      const submit = dialog.getByRole('button', { name: 'Create Folder' });

      await expect(submit).toBeDisabled();

      await name.fill('   ');
      await expect(submit).toBeDisabled();

      // CONTROL: the same locator reports ENABLED for a real name. Without it,
      // the two assertions above would be satisfied by a button that is simply
      // always disabled.
      await name.fill(`Required Field Test ${Date.now()}`);
      await expect(submit).toBeEnabled();
    });

    test('the default-duration field declares no minimum (pinned gap)', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      const duration = authenticatedPage.locator('input[type="number"]').first();
      await expect(duration).toBeVisible({ timeout: 10000 });

      /*
       * "Default Content Duration (seconds)" carries no min, no max and no step,
       * so a negative duration is accepted and shipped to the API. The old body
       * read `min`, found null, and skipped its only assertion — reporting green
       * on a validation gap. Pinned here and reported; nothing under web/src is
       * changed in this pass.
       */
      expect(await duration.getAttribute('min'), 'no min is declared').toBeNull();

      await duration.fill('-5');
      await duration.blur();
      await expect(duration).toHaveValue('-5');
      expect(
        await duration.evaluate((el) => (el as HTMLInputElement).validity.valid),
        '-5 seconds is accepted because no min is declared',
      ).toBeTruthy();

      /*
       * REACH CONTROL: adding a min to this very element makes the identical
       * check report INVALID. Without it, `validity.valid === true` would be
       * indistinguishable from "constraint validation was never evaluated here"
       * — the same shape of non-evidence as the assertion this replaces.
       */
      expect(
        await duration.evaluate((el) => {
          const input = el as HTMLInputElement;
          input.min = '1';
          const validWithMin = input.validity.valid;
          input.removeAttribute('min');
          return validWithMin;
        }),
        'the control proves a declared min WOULD be enforced',
      ).toBeFalsy();
    });
  });

  test.describe('Button States', () => {
    test('should disable submit buttons while loading', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * The old body clicked save, waited 100ms, then asserted
       * `isLoading || isDisabled || true`. Whether a 100ms sample catches the
       * in-flight state is a race against a local API, and the `|| true` made
       * losing that race indistinguishable from the button never disabling at
       * all. (`isLoading` was also looking for ANY `svg` inside the button,
       * which the idle button already contains on most of this page.)
       *
       * The request is held open instead, so the in-flight state is observed
       * deterministically and released on purpose.
       */
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });

      await authenticatedPage.route(
        (url) => url.pathname.startsWith('/api/v1/organizations/'),
        async (route) => {
          if (route.request().method() !== 'PATCH') {
            await route.fallback();
            return;
          }
          await held;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: {} }),
          });
        },
      );

      const save = authenticatedPage.getByRole('button', { name: 'Save Changes' });
      await expect(save).toBeEnabled({ timeout: 10000 });
      await save.click();

      // In flight: disabled, and saying so rather than looking idle. The label
      // flips, so the idle name must stop matching anything.
      await expect(
        authenticatedPage.getByRole('button', { name: 'Saving...' }),
      ).toBeDisabled({ timeout: 10000 });
      await expect(save).toHaveCount(0);

      release();

      // CONTROL: it comes back. A button that latched disabled forever would
      // satisfy the assertion above just as well.
      await expect(save).toBeEnabled({ timeout: 15000 });
    });

    test('should have proper button focus styles', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * Two things were wrong with the old body. It used `el.focus()`, which is
       * programmatic focus and is not guaranteed to match `:focus-visible` —
       * the pseudo-class globals.css actually styles — and it closed on
       * `expect(hasFocusRing || true)`, so an app with no focus ring at all
       * passed.
       *
       * A real Tab keypress is used instead, and the focused element's computed
       * style is compared against its own blurred style. That comparison is its
       * own control: if focus styling were deleted the two reads would be
       * identical, and the test goes red.
       */
      await authenticatedPage.keyboard.press('Tab');

      const focused = authenticatedPage.locator(':focus');
      await expect(focused).toHaveCount(1);

      const { whenFocused, whenBlurred, focusVisible } = await focused.evaluate((el) => {
        const read = () => {
          const s = getComputedStyle(el);
          return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} | ${s.boxShadow}`;
        };
        const visible = el.matches(':focus-visible');
        const focusedStyle = read();
        (el as HTMLElement).blur();
        return { whenFocused: focusedStyle, whenBlurred: read(), focusVisible: visible };
      });

      expect(focusVisible, 'a keyboard Tab must put the element in :focus-visible').toBeTruthy();
      expect(
        whenFocused,
        `focus ring is indistinguishable from the resting style: ${whenFocused}`,
      ).not.toBe(whenBlurred);
    });
  });

  test.describe('Modal Behavior', () => {
    test('should trap focus inside modals', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/playlists');
      await authenticatedPage.waitForLoadState('networkidle');

      // Two controls read "Create Playlist" on an empty library — the header
      // button and the empty state's action. The header one is first in the DOM.
      await authenticatedPage.getByRole('button', { name: 'Create Playlist' }).first().click();

      const dialog = authenticatedPage.getByRole('dialog', { name: 'Create New Playlist' });
      await expect(dialog).toBeVisible({ timeout: 10000 });

      /*
       * `aria-modal="true"` tells a screen reader the rest of the page is
       * inert, so a dialog that does not actually hold focus is worse than one
       * that never made the claim — which is exactly what useDialog's docblock
       * says. The old body tabbed three times and then asserted
       * `expect(isInsideModal || true)`, i.e. nothing.
       */
      const close = dialog.getByRole('button', { name: 'Close modal' });
      await expect(close).toBeFocused();

      // Shift+Tab off the FIRST focusable element must wrap to the last one
      // inside the dialog rather than escape to the page behind it.
      await authenticatedPage.keyboard.press('Shift+Tab');
      await expect(dialog.locator(':focus')).toHaveCount(1);
      // CONTROL: focus really moved, so "still inside" is not just "never left
      // the element it started on".
      await expect(close).not.toBeFocused();

      // Tabbing forward past the end wraps too, so focus never leaves.
      for (let i = 0; i < 6; i++) {
        await authenticatedPage.keyboard.press('Tab');
        await expect(dialog.locator(':focus')).toHaveCount(1);
      }
    });

    test('should close modals with close button', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      // Try to open any modal
      const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add/i }).first();
      const hasCreate = await createButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasCreate) {
        await createButton.click();

        const modal = authenticatedPage.locator('[role="dialog"]').first();
        const isModalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);

        if (isModalVisible) {
          // Click close button
          const closeButton = authenticatedPage.locator('button[aria-label*="close" i], button:has-text("Cancel"), button:has-text("×")').first();
          await closeButton.click();

          await authenticatedPage.waitForTimeout(500);
          const stillVisible = await modal.isVisible().catch(() => false);
          expect(stillVisible).toBeFalsy();
        }
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ authenticatedPage }) => {
      await authenticatedPage.setViewportSize({ width: 375, height: 667 });
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * The sidebar toggle has NO accessible name — no aria-label, no text, no
       * aria-expanded and no aria-controls, just an unlabelled inline svg
       * (reported separately, not fixed here) — so
       * `button[aria-label*="menu" i], [data-testid="mobile-menu"]` never
       * matched it and `hasHamburger` was always false. `expect(hasHamburger ||
       * true)` then passed on a dashboard with no mobile navigation at all.
       *
       * It is reached structurally, as the header's first button. The LAST
       * assertion in this test is the control for that choice: a `lg:hidden`
       * control has to disappear at desktop width, so having grabbed some other
       * button fails there.
       */
      const toggle = authenticatedPage.locator('header button').first();
      await expect(toggle).toBeVisible();

      /*
       * The mobile overlay is rendered only while the sidebar is open, which
       * makes it the one unambiguous observable here: the <aside> itself is
       * translated off-canvas rather than hidden, so it keeps a box and reads as
       * "visible" in both states.
       */
      const overlay = authenticatedPage.locator('div.fixed.inset-0.top-16');
      await expect(overlay).toHaveCount(0);

      await toggle.click();
      await expect(overlay).toHaveCount(1);
      await expect(
        authenticatedPage.locator('aside nav').getByRole('link', { name: 'Devices', exact: true }),
      ).toBeVisible();

      // Clicked to the RIGHT of the open sidebar: the panel is 224px wide on a
      // 375px viewport and sits above the overlay, so the overlay's own centre
      // is covered by it and would never be the hit target.
      await overlay.click({ position: { x: 340, y: 200 } });
      await expect(overlay).toHaveCount(0);

      await authenticatedPage.setViewportSize({ width: 1280, height: 800 });
      await expect(toggle).toBeHidden();
    });

    test('should work on tablet viewport', async ({ authenticatedPage }) => {
      await authenticatedPage.setViewportSize({ width: 768, height: 1024 });
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage.locator('body')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should show error state for failed API calls', async ({ authenticatedPage }) => {
      /*
       * The old route glob ended in "/api/displays". The API lives under
       * `/api/v1`, and the browser calls `/api/v1/displays` through the Next
       * rewrite, so the glob matched nothing, the page loaded normally, and the
       * test asserted `expect(hasError || true)` — green whether or not the
       * product has any error state at all.
       */
      await authenticatedPage.route(
        (url) => url.pathname === '/api/v1/displays',
        (route) =>
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: 'Server error' }),
          }),
      );

      await authenticatedPage.goto('/dashboard/devices');

      /*
       * DashboardSectionError's generic branch. The wait is long on purpose:
       * loadDevices runs through `retry` (3 attempts, 1s initial backoff) before
       * it sets devicesLoadError, so the error state is not expected instantly.
       *
       * Addressed by heading/button rather than by role=alert: toasts are also
       * role="alert" and this page raises one per failed attempt.
       */
      await expect(
        authenticatedPage.getByRole('heading', { name: 'Devices Error' }),
      ).toBeVisible({ timeout: 30000 });
      await expect(
        authenticatedPage.getByText('Something went wrong loading this section. Please try again.'),
      ).toBeVisible();
      await expect(authenticatedPage.getByRole('button', { name: 'Try Again' })).toBeVisible();

      // ...and it replaces the fleet table rather than sitting beside a table
      // that silently shows nothing.
      await expect(authenticatedPage.locator('table.eh-datatable')).toHaveCount(0);
    });

    test('should handle 404 pages gracefully', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/nonexistent-page');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * `locator('text=/404|not found|page not found/i')` matched several nodes
       * on the (correct) 404 page, so isVisible() threw a strict-mode violation
       * that the `.catch(() => false)` turned into "no 404 found" — the test
       * failed against a working page. Role queries resolve to one element each.
       */
      await expect(
        authenticatedPage.getByRole('heading', { name: '404', exact: true }),
      ).toBeVisible({ timeout: 5000 });
      await expect(
        authenticatedPage.getByRole('heading', { name: 'Page Not Found', exact: true }),
      ).toBeVisible();
      await expect(
        authenticatedPage.getByText(/does not exist or has been moved/i),
      ).toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading indicators', async ({ authenticatedPage }) => {
      /*
       * The old body built two locators, used neither, and closed on
       * `expect(true).toBeTruthy()` with the comment "Either loading indicators
       * appeared or page loaded fast". Against a local stack the page loads fast
       * every time, so nothing was ever observed.
       *
       * The fleet request is held open instead, which makes the loading state
       * deterministic rather than a race with the API.
       */
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });

      await authenticatedPage.route(
        (url) => url.pathname === '/api/v1/displays',
        async (route) => {
          await held;
          await route.fallback();
        },
      );

      await authenticatedPage.goto('/dashboard/devices');

      // The skeleton announces itself rather than only looking busy. `.first()`
      // because the route-level loading.tsx fallback carries the same markers.
      const busy = authenticatedPage.locator('[aria-busy="true"]');
      await expect(busy.first()).toBeVisible({ timeout: 15000 });
      await expect(
        authenticatedPage.getByText('Loading devices').first(),
      ).toBeAttached();
      await expect(authenticatedPage.locator('.eh-skeleton').first()).toBeVisible();

      release();

      // CONTROL: the indicator is tied to the request, not permanent. Without
      // this, a page stuck in a loading state forever would also pass.
      await expect(busy).toHaveCount(0, { timeout: 20000 });
    });
  });
});
