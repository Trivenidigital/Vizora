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
    
    // Check for metrics cards
    await expect(authenticatedPage.locator('text=Total Impressions')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=Avg. Play Time')).toBeVisible();
    await expect(authenticatedPage.locator('text=Uptime')).toBeVisible();
  });

  test('should show metrics values', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check for metric values (from mock data)
    await expect(authenticatedPage.locator('text=12,543')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=4.2m')).toBeVisible();
    await expect(authenticatedPage.locator('text=98.5%')).toBeVisible();
  });

  test('should show growth indicators', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check for growth/comparison text
    await expect(authenticatedPage.locator('text=/from last week/i')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=/per device per day/i')).toBeVisible();
    await expect(authenticatedPage.locator('text=/above target/i')).toBeVisible();
  });

  test('should show coming soon message', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check for coming soon section
    await expect(authenticatedPage.locator('text=Analytics Dashboard Coming Soon')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=/detailed analytics and reporting/i')).toBeVisible();
  });

  test('should display analytics icon', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check for chart emoji/icon (use first() to avoid strict mode violation)
    await expect(authenticatedPage.locator('text=📊').first()).toBeVisible({ timeout: 10000 });
  });
});
