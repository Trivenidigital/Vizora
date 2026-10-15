import { test, expect } from './fixtures/auth.fixture';

test.describe('Billing & Subscriptions (Wave 7)', () => {
  test.describe('Billing Overview Page', () => {
    test('should display billing page with current plan', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing');
      await authenticatedPage.waitForLoadState('networkidle');

      // Check page title
      await expect(authenticatedPage.locator('h2, h1').filter({ hasText: /billing/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show current subscription status', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing');
      await authenticatedPage.waitForLoadState('networkidle');

      // Should show plan name (Free, Basic, Pro, or Enterprise)
      const planBadge = authenticatedPage.locator('text=/free|basic|pro|enterprise/i').first();
      await expect(planBadge).toBeVisible({ timeout: 10000 });
    });

    test('should display quota usage bar', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for quota/usage section
      const quotaSection = authenticatedPage.locator('text=/screens|quota|usage/i').first();
      await expect(quotaSection).toBeVisible({ timeout: 10000 });
    });

    test('should have upgrade button for free plan', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for upgrade action
      const upgradeButton = authenticatedPage.locator('button, a').filter({ hasText: /upgrade|view plans/i }).first();
      await expect(upgradeButton).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to plans page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing');
      await authenticatedPage.waitForLoadState('networkidle');

      // Click view plans or upgrade
      const plansLink = authenticatedPage.locator('a, button').filter({ hasText: /view plans|upgrade|change plan/i }).first();
      await plansLink.click();

      // Should navigate to plans page
      await expect(authenticatedPage).toHaveURL(/plans/, { timeout: 10000 });
    });
  });

  test.describe('Plans Comparison Page', () => {
    test('should display all plan tiers', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing/plans');
      await authenticatedPage.waitForLoadState('networkidle');

      // Check for plan cards
      await expect(authenticatedPage.locator('text=/free/i').first()).toBeVisible({ timeout: 10000 });
      await expect(authenticatedPage.locator('text=/basic/i').first()).toBeVisible({ timeout: 5000 });
      await expect(authenticatedPage.locator('text=/pro/i').first()).toBeVisible({ timeout: 5000 });
    });

    test('should show pricing for each plan', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing/plans');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * $29 / $99 were never this product's prices. Amounts and currency are
       * server-side (PLAN_TIERS, per the org's country) and plan-card.tsx renders
       * them through Intl.NumberFormat — en-US or en-IN — plus a /month or /year
       * suffix. So assert the SHAPE every card must render, not an amount:
       *   a formatted currency amount with its interval, or the two labels that
       *   legitimately carry no number ("Free" at price 0, "Custom" for enterprise).
       * An empty or missing price block still fails.
       */
      const planCards = authenticatedPage.locator('div[class*="lg:grid-cols-4"] > div');
      await expect(planCards.first()).toBeVisible({ timeout: 10000 });

      const cardCount = await planCards.count();
      expect(cardCount).toBeGreaterThan(0);

      for (let i = 0; i < cardCount; i++) {
        const card = planCards.nth(i);
        // Plan name, then the price block that directly follows it.
        await expect(card.getByRole('heading', { level: 3 })).toBeVisible({ timeout: 10000 });
        await expect(card.locator('h3 + div')).toHaveText(
          /^(Free|Custom|\D{1,4}\s?[\d,]+(\.\d{2})?\s*\/\s*(month|year))$/,
        );
      }
    });

    test('should show screen limits for each plan', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing/plans');
      await authenticatedPage.waitForLoadState('networkidle');

      // Check for screen counts
      await expect(authenticatedPage.locator('text=/5 screens|25 screens|100 screens|unlimited/i').first()).toBeVisible({ timeout: 10000 });
    });

    test('should have select/subscribe buttons', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing/plans');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for action buttons on plan cards
      const selectButtons = authenticatedPage.locator('button').filter({ hasText: /select|subscribe|current|upgrade/i });
      await expect(selectButtons.first()).toBeVisible({ timeout: 10000 });
    });

    test('should highlight current plan', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing/plans');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for "Current Plan" indicator
      const currentIndicator = authenticatedPage.locator('text=/current plan|selected/i').first();
      await expect(currentIndicator).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Invoice History Page', () => {
    test('should display invoice history page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing/history');
      await authenticatedPage.waitForLoadState('networkidle');

      // Check page title
      await expect(authenticatedPage.locator('h2, h1').filter({ hasText: /invoice|history|billing/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show empty state for new accounts', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing/history');
      await authenticatedPage.waitForLoadState('networkidle');

      // The fixture registers a brand-new org, which has no invoices: the
      // empty state is certain, so it is asserted rather than branched on.
      await expect(authenticatedPage.getByText('No invoices yet')).toBeVisible({ timeout: 10000 });
      await expect(authenticatedPage.locator('table')).toHaveCount(0);
    });

    /**
     * Invoices are written only by a payment provider's webhook, which a
     * browser spec cannot drive, so the list response is fulfilled with one
     * fixture invoice. What is under test is the page's rendering of it.
     */
    test('should have invoice table structure', async ({ authenticatedPage }) => {
      await authenticatedPage.route('**/api/v1/billing/invoices*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'inv_e2e_1',
                amount: 4900,
                currency: 'usd',
                status: 'paid',
                description: null,
                createdAt: '2026-09-01T12:00:00.000Z',
                pdfUrl: null,
              },
            ],
          }),
        }),
      );

      await authenticatedPage.goto('/dashboard/settings/billing/history');
      await authenticatedPage.waitForLoadState('networkidle');

      const table = authenticatedPage.locator('table');
      await expect(table).toBeVisible({ timeout: 10000 });
      await expect(table.locator('th')).toHaveText(['Date', 'Description', 'Amount', 'Status', /.*/]);

      const row = table.locator('tbody tr');
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('Sep 1, 2026');
      await expect(row).toContainText('Subscription payment'); // null description
      await expect(row).toContainText('$49.00');
      await expect(row).toContainText('N/A'); // no PDF
      await expect(authenticatedPage.getByText('No invoices yet')).toHaveCount(0);
    });
  });

  test.describe('Settings Navigation', () => {
    test('should have billing link in settings page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for billing navigation
      const billingLink = authenticatedPage.locator('a').filter({ hasText: /billing/i }).first();
      await expect(billingLink).toBeVisible({ timeout: 10000 });
    });

    test('should navigate from settings to billing', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      // Click billing link
      await authenticatedPage.click('a:has-text("Billing")');

      // Should navigate to billing page
      await expect(authenticatedPage).toHaveURL(/billing/, { timeout: 10000 });
    });
  });
});
