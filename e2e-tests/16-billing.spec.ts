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

      // Check for price displays ($0, $29, $99)
      await expect(authenticatedPage.locator('text=/\\$0|free/i').first()).toBeVisible({ timeout: 10000 });
      await expect(authenticatedPage.locator('text=/\\$29|\\$99/i').first()).toBeVisible({ timeout: 5000 });
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

      // New accounts should show empty state or no invoices message
      const emptyState = authenticatedPage.locator('text=/no invoices|no transactions|empty/i').first();
      const hasEmptyState = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);

      // Either empty state or invoice table should be present
      if (!hasEmptyState) {
        const invoiceTable = authenticatedPage.locator('table, [role="table"]');
        await expect(invoiceTable).toBeVisible({ timeout: 5000 });
      }
    });

    test('should have invoice table structure', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/billing/history');
      await authenticatedPage.waitForLoadState('networkidle');

      // Check for table headers if table exists
      const table = authenticatedPage.locator('table, [role="table"]');
      const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTable) {
        await expect(authenticatedPage.locator('th, [role="columnheader"]').filter({ hasText: /date|amount|status/i }).first()).toBeVisible();
      }
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
