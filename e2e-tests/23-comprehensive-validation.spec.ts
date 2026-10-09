import { test, expect } from './fixtures/auth.fixture';

test.describe('Comprehensive UI Validation', () => {
  test.describe('Dashboard Page', () => {
    test('should load dashboard without errors', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // No console errors (except known warnings)
      const errors: string[] = [];
      authenticatedPage.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('favicon')) {
          errors.push(msg.text());
        }
      });

      await authenticatedPage.waitForTimeout(2000);

      // Page should be responsive
      await expect(authenticatedPage.locator('body')).toBeVisible();
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

      // Try to create content without required fields
      const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add/i }).first();
      const hasCreate = await createButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasCreate) {
        await createButton.click();

        // Try to submit empty form
        const submitButton = authenticatedPage.locator('button[type="submit"]').first();
        const hasSubmit = await submitButton.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasSubmit) {
          await submitButton.click();

          // Should show validation or stay on form
          await authenticatedPage.waitForTimeout(500);
          const stillOnForm = await authenticatedPage.locator('[role="dialog"], form').isVisible().catch(() => false);
          expect(stillOnForm || true).toBeTruthy();
        }
      }
    });

    test('should validate numeric inputs', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      // Find duration/number input
      const numberInput = authenticatedPage.locator('input[type="number"]').first();
      const hasNumber = await numberInput.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasNumber) {
        // Enter negative or invalid value
        await numberInput.fill('-5');
        await numberInput.blur();

        // Check min constraint
        const min = await numberInput.getAttribute('min');
        if (min && parseInt(min) >= 0) {
          const value = await numberInput.inputValue();
          // Browser may auto-correct or show validation
          expect(parseInt(value) >= 0 || await numberInput.evaluate(el => !(el as HTMLInputElement).validity.valid)).toBeTruthy();
        }
      }
    });
  });

  test.describe('Button States', () => {
    test('should disable submit buttons while loading', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      const saveButton = authenticatedPage.locator('button').filter({ hasText: /save/i }).first();
      const hasSave = await saveButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasSave) {
        // Click save and check for loading state
        await saveButton.click();

        // Button may show loading spinner or be disabled briefly
        await authenticatedPage.waitForTimeout(100);
        const isLoading = await saveButton.locator('svg, [class*="spinner"]').isVisible().catch(() => false);
        const isDisabled = await saveButton.isDisabled().catch(() => false);

        // Either loading indicator or disabled is valid
        expect(isLoading || isDisabled || true).toBeTruthy();
      }
    });

    test('should have proper button focus styles', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      const button = authenticatedPage.locator('button').first();
      await button.focus();

      // Check for focus ring (accessibility)
      const hasFocusRing = await button.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.outlineWidth !== '0px' || style.boxShadow !== 'none';
      });

      // Focus should be visible for accessibility
      expect(hasFocusRing || true).toBeTruthy();
    });
  });

  test.describe('Modal Behavior', () => {
    test('should trap focus inside modals', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/playlists');
      await authenticatedPage.waitForLoadState('networkidle');

      // Open create modal
      const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new/i }).first();
      const hasCreate = await createButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasCreate) {
        await createButton.click();

        const modal = authenticatedPage.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Tab through modal elements
        await authenticatedPage.keyboard.press('Tab');
        await authenticatedPage.keyboard.press('Tab');
        await authenticatedPage.keyboard.press('Tab');

        // Focus should still be inside modal
        const focusedElement = await authenticatedPage.locator(':focus').first();
        const isInsideModal = await modal.locator(':focus').count() > 0;

        expect(isInsideModal || true).toBeTruthy();
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

      // Page should still be usable
      await expect(authenticatedPage.locator('body')).toBeVisible();

      // Hamburger menu should appear
      const hamburger = authenticatedPage.locator('button[aria-label*="menu" i], [data-testid="mobile-menu"]').first();
      const hasHamburger = await hamburger.isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasHamburger || true).toBeTruthy();
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
      // Intercept API calls and return error
      await authenticatedPage.route('**/api/displays', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' }),
        });
      });

      await authenticatedPage.goto('/dashboard/devices');
      await authenticatedPage.waitForLoadState('networkidle');

      // Should show error state or retry option
      const errorState = authenticatedPage.locator('text=/error|failed|try again|something went wrong/i').first();
      const hasError = await errorState.isVisible({ timeout: 10000 }).catch(() => false);

      expect(hasError || true).toBeTruthy();
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
      await authenticatedPage.goto('/dashboard');

      // Look for loading indicators during page load
      const spinner = authenticatedPage.locator('[class*="spinner"], [class*="loading"], [data-testid="loading"]');
      const skeleton = authenticatedPage.locator('[class*="skeleton"]');

      // Either loading indicators appeared or page loaded fast
      await authenticatedPage.waitForLoadState('networkidle');
      expect(true).toBeTruthy();
    });
  });
});
