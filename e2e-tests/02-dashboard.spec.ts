import { test, expect } from './fixtures/auth.fixture';

test.describe('Dashboard', () => {
  test('should display dashboard with navigation', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Check main dashboard heading (specific selector to avoid strict mode violation)
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Dashboard Overview' })).toBeVisible();
    
    // Check navigation items (using actual nav item names from layout)
    const navItems = ['Overview', 'Devices', 'Content', 'Playlists'];
    for (const item of navItems) {
      await expect(authenticatedPage.locator(`text="${item}"`).first()).toBeVisible();
    }
    
    // Visual regression
    // await expect(authenticatedPage).toHaveScreenshot('dashboard-main.png', { maxDiffPixels: 100 });
  });

  test('should display statistics cards', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Wait for dashboard to load
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check for stat cards by looking for specific text
    await expect(authenticatedPage.locator('text=Total Devices')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=Content Items')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=Playlists').first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to displays page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Wait for page to be ready
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Click devices card (which navigates to /dashboard/devices)
    await authenticatedPage.click('text=Total Devices');
    
    // Should be on devices page
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/devices/);
    await expect(authenticatedPage.locator('h2').filter({ hasText: /devices/i })).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to content page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Wait for page to be ready
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Click content card (which navigates to /dashboard/content)
    await authenticatedPage.click('text=Content Items');
    
    // Should be on content page
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/content/);
    await expect(authenticatedPage.locator('h2').filter({ hasText: /content/i })).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to playlists page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    
    // Wait for page to be ready
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Find and click the playlists card
    await authenticatedPage.locator('p.text-sm:has-text("Playlists")').locator('..').locator('..').click();
    
    // Should be on playlists page
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/playlists/);
    await expect(authenticatedPage.locator('h2').filter({ hasText: /playlists/i })).toBeVisible({ timeout: 10000 });
  });
});
