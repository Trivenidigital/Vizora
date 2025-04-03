import { test, expect, helpers, mockApiResponses, mockSocketEvents } from './setup';

test.describe('Display Monitoring', () => {
  test.beforeEach(async ({ page, authContext }) => {
    await helpers.login(page, authContext.user.email, 'TestP@ss1');
  });

  test('should show display status', async ({ page }) => {
    // Navigate to monitoring page
    await page.click('a[href="/monitoring"]');
    await page.waitForURL('/monitoring');

    // Select display
    await page.selectOption('select[name="display"]', 'Test Display');

    // Verify status indicators
    await expect(page.locator('div[data-testid="status-indicator"]')).toBeVisible();
    await expect(page.locator('text=Online')).toBeVisible();
    await expect(page.locator('text=Last Updated')).toBeVisible();
  });

  test('should show display metrics', async ({ page }) => {
    // Navigate to monitoring page
    await page.click('a[href="/monitoring"]');
    await page.waitForURL('/monitoring');

    // Select display
    await page.selectOption('select[name="display"]', 'Test Display');

    // Verify metrics
    await expect(page.locator('div[data-testid="metrics-container"]')).toBeVisible();
    await expect(page.locator('text=CPU Usage')).toBeVisible();
    await expect(page.locator('text=Memory Usage')).toBeVisible();
    await expect(page.locator('text=Network Status')).toBeVisible();
  });

  test('should handle display alerts', async ({ page }) => {
    // Navigate to monitoring page
    await page.click('a[href="/monitoring"]');
    await page.waitForURL('/monitoring');

    // Select display
    await page.selectOption('select[name="display"]', 'Test Display');

    // Simulate alert
    await page.click('button:has-text("Simulate Alert")');

    // Verify alert notification
    await expect(page.locator('div[data-testid="alert-notification"]')).toBeVisible();
    await expect(page.locator('text=High CPU Usage')).toBeVisible();
  });

  test('should show display logs', async ({ page }) => {
    // Navigate to monitoring page
    await page.click('a[href="/monitoring"]');
    await page.waitForURL('/monitoring');

    // Select display
    await page.selectOption('select[name="display"]', 'Test Display');

    // Click logs tab
    await page.click('button:has-text("Logs")');

    // Verify logs
    await expect(page.locator('div[data-testid="logs-container"]')).toBeVisible();
    await expect(page.locator('text=System Logs')).toBeVisible();
    await expect(page.locator('text=Application Logs')).toBeVisible();
  });

  test('should handle display maintenance', async ({ page }) => {
    // Navigate to monitoring page
    await page.click('a[href="/monitoring"]');
    await page.waitForURL('/monitoring');

    // Select display
    await page.selectOption('select[name="display"]', 'Test Display');

    // Click maintenance button
    await page.click('button:has-text("Maintenance")');

    // Fill maintenance form
    await page.fill('input[name="reason"]', 'System Update');
    await page.fill('textarea[name="description"]', 'Performing system maintenance');
    await page.click('button:has-text("Start Maintenance")');

    // Verify maintenance mode
    await expect(page.locator('text=Maintenance Mode Active')).toBeVisible();
  });

  test('should show display health check', async ({ page }) => {
    // Navigate to monitoring page
    await page.click('a[href="/monitoring"]');
    await page.waitForURL('/monitoring');

    // Select display
    await page.selectOption('select[name="display"]', 'Test Display');

    // Click health check button
    await page.click('button:has-text("Health Check")');

    // Verify health check results
    await expect(page.locator('div[data-testid="health-check-results"]')).toBeVisible();
    await expect(page.locator('text=System Health')).toBeVisible();
    await expect(page.locator('text=Content Health')).toBeVisible();
    await expect(page.locator('text=Network Health')).toBeVisible();
  });

  test('should handle display updates', async ({ page }) => {
    // Navigate to monitoring page
    await page.click('a[href="/monitoring"]');
    await page.waitForURL('/monitoring');

    // Select display
    await page.selectOption('select[name="display"]', 'Test Display');

    // Click update button
    await page.click('button:has-text("Update")');

    // Select update type
    await page.selectOption('select[name="updateType"]', 'System');
    await page.click('button:has-text("Start Update")');

    // Verify update progress
    await expect(page.locator('div[data-testid="update-progress"]')).toBeVisible();
    await expect(page.locator('text=Update in Progress')).toBeVisible();
  });

  test('should show display analytics', async ({ page }) => {
    // Navigate to monitoring page
    await page.click('a[href="/monitoring"]');
    await page.waitForURL('/monitoring');

    // Select display
    await page.selectOption('select[name="display"]', 'Test Display');

    // Click analytics tab
    await page.click('button:has-text("Analytics")');

    // Verify analytics
    await expect(page.locator('div[data-testid="analytics-container"]')).toBeVisible();
    await expect(page.locator('text=Uptime')).toBeVisible();
    await expect(page.locator('text=Content Views')).toBeVisible();
    await expect(page.locator('text=Error Rate')).toBeVisible();
  });
}); 