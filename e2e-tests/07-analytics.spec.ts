import { test, expect } from './fixtures/auth.fixture';

test.describe('Analytics Dashboard', () => {
  test('should show analytics page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    // Check page loaded
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Analytics' })).toBeVisible({ timeout: 10000 });

    // Check subtitle
    await expect(authenticatedPage.locator('text=/performance metrics and insights/i')).toBeVisible();
  });

  test('should display key metrics cards', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    // Check for metrics cards (updated to match current UI)
    await expect(authenticatedPage.locator('text=Total Devices')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=Content Served')).toBeVisible();
    await expect(authenticatedPage.locator('text=System Uptime')).toBeVisible();
  });

  test('should show metrics values', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    // Check for metric values (updated to match current UI)
    await expect(authenticatedPage.locator('text=366')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=12.5K')).toBeVisible();
    await expect(authenticatedPage.locator('text=98.5%')).toBeVisible();
  });

  test('should show growth indicators', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    // Check for growth/comparison text (use first() to avoid strict mode violation)
    await expect(authenticatedPage.locator('text=/from last month/i').first()).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=/above target/i').first()).toBeVisible();
  });

  test('should display date range buttons', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    // Check for date range buttons
    await expect(authenticatedPage.locator('button').filter({ hasText: 'week' })).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('button').filter({ hasText: 'month' })).toBeVisible();
    await expect(authenticatedPage.locator('button').filter({ hasText: 'year' })).toBeVisible();
  });

  test('should display chart sections', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    // Check for chart sections
    await expect(authenticatedPage.locator('text=Device Uptime Timeline')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=Content Performance')).toBeVisible();
  });
});
