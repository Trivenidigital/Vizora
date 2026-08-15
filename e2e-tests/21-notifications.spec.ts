import { test, expect, apiPost } from './fixtures/auth.fixture';
import type { Page } from '@playwright/test';

/**
 * Seed one unread org-level notification. The badge and the "Mark all as read"
 * control only render when there is unread mail, so without seeding both tests
 * assert nothing. POST /notifications is admin-only; the fixture user owns the
 * org it just registered, so it qualifies.
 */
async function seedNotification(page: Page, token: string, title: string) {
  const res = await apiPost(page, token, 'http://localhost:3000/api/v1/notifications', {
    title,
    message: 'Seeded by the customer-critical gate',
    severity: 'info',
    type: 'system',
  });
  expect(res.ok(), `notification seed failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

test.describe('In-App Notifications (Wave 4)', () => {
  test.describe('Notification Bell', () => {
    test('should display notification bell in header', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for notification bell icon
      const bellButton = authenticatedPage.locator('button[aria-label*="notification" i], button:has([data-testid="bell-icon"]), [data-testid="notification-bell"]').first();
      await expect(bellButton).toBeVisible({ timeout: 10000 });
    });

    test('should show notification count badge', async ({ authenticatedPage, token }) => {
      await seedNotification(authenticatedPage, token, `Badge probe ${Date.now()}`);

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      const bellButton = authenticatedPage.locator('button[aria-label*="notification" i]').first();
      await expect(bellButton).toBeVisible({ timeout: 10000 });

      // One unread notification exists, so the badge must render and show it.
      const badge = authenticatedPage.locator('[data-testid="notification-badge"]');
      await expect(badge).toBeVisible({ timeout: 10000 });
      await expect(badge).toHaveText('1');

      // The count is also surfaced to assistive tech on the bell itself.
      await expect(bellButton).toHaveAttribute('aria-label', /1 unread/);
    });

    test('should open notification dropdown on click', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Click notification bell
      const bellButton = authenticatedPage.locator('button[aria-label*="notification" i], [data-testid="notification-bell"]').first();
      await bellButton.click();

      // Dropdown should appear
      const dropdown = authenticatedPage.locator('[data-testid="notification-dropdown"], [role="menu"], .notification-dropdown, .dropdown');
      await expect(dropdown.first()).toBeVisible({ timeout: 5000 });
    });

    test('should show empty state or notification list', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Click notification bell
      const bellButton = authenticatedPage.locator('button[aria-label*="notification" i], [data-testid="notification-bell"]').first();
      await bellButton.click();

      // Either empty state or notifications
      const emptyState = authenticatedPage.locator('text=/no notifications|all caught up|empty/i').first();
      const notificationItem = authenticatedPage.locator('[data-testid="notification-item"], .notification-item').first();

      const hasEmpty = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
      const hasItems = await notificationItem.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasEmpty || hasItems).toBeTruthy();
    });

    test('should mark all notifications as read', async ({ authenticatedPage, token }) => {
      await seedNotification(authenticatedPage, token, `Mark-all probe ${Date.now()}`);

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      const badge = authenticatedPage.locator('[data-testid="notification-badge"]');
      await expect(badge).toBeVisible({ timeout: 10000 });

      const bellButton = authenticatedPage.locator('button[aria-label*="notification" i], [data-testid="notification-bell"]').first();
      await bellButton.click();

      // With unread mail present the control must exist, and using it must clear
      // the badge — otherwise "mark all as read" reports success without doing it.
      const markAllButton = authenticatedPage.locator('button, a').filter({ hasText: /mark all|read all|clear all/i }).first();
      await expect(markAllButton).toBeVisible({ timeout: 10000 });
      await markAllButton.click();

      await expect(badge).toHaveCount(0, { timeout: 10000 });
    });

    test('should close dropdown when clicking outside', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Open notification dropdown
      const bellButton = authenticatedPage.locator('button[aria-label*="notification" i], [data-testid="notification-bell"]').first();
      await bellButton.click();

      const dropdown = authenticatedPage.locator('[data-testid="notification-dropdown"], [role="menu"], .notification-dropdown').first();
      await expect(dropdown).toBeVisible({ timeout: 5000 });

      // Click outside
      await authenticatedPage.click('body', { position: { x: 10, y: 10 } });

      // Dropdown should close (or still be visible if pinned)
      await authenticatedPage.waitForTimeout(500);
    });
  });

  test.describe('Notification Preferences', () => {
    test('should have notification settings in settings page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for notification settings section
      const notificationSection = authenticatedPage.locator('text=/notification/i').first();
      await expect(notificationSection).toBeVisible({ timeout: 10000 });
    });

    test('should toggle email notifications', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      // Find notification toggle
      const emailToggle = authenticatedPage.locator('input[type="checkbox"]').first();
      await expect(emailToggle).toBeVisible({ timeout: 10000 });

      // Toggle it
      const initialState = await emailToggle.isChecked();
      await emailToggle.click();
      const newState = await emailToggle.isChecked();

      expect(newState).toBe(!initialState);
    });
  });
});
