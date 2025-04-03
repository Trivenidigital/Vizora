import { test, expect, helpers, mockApiResponses, mockSocketEvents } from './setup';

test.describe('Display Analytics', () => {
  test.beforeEach(async ({ page, authContext }) => {
    await helpers.login(page, authContext.user.email, 'TestP@ss1');
  });

  test('should show analytics dashboard', async ({ page }) => {
    // Navigate to analytics page
    await page.click('a[href="/analytics"]');
    await page.waitForURL('/analytics');

    // Verify dashboard components
    await expect(page.locator('div[data-testid="analytics-dashboard"]')).toBeVisible();
    await expect(page.locator('text=Overview')).toBeVisible();
    await expect(page.locator('text=Performance')).toBeVisible();
    await expect(page.locator('text=Content Engagement')).toBeVisible();
  });

  test('should display performance metrics', async ({ page }) => {
    // Navigate to analytics page
    await page.click('a[href="/analytics"]');
    await page.waitForURL('/analytics');

    // Select performance tab
    await page.click('button:has-text("Performance")');

    // Verify performance metrics
    await expect(page.locator('div[data-testid="performance-metrics"]')).toBeVisible();
    await expect(page.locator('text=CPU Usage')).toBeVisible();
    await expect(page.locator('text=Memory Usage')).toBeVisible();
    await expect(page.locator('text=Network Latency')).toBeVisible();
  });

  test('should show content engagement metrics', async ({ page }) => {
    // Navigate to analytics page
    await page.click('a[href="/analytics"]');
    await page.waitForURL('/analytics');

    // Select engagement tab
    await page.click('button:has-text("Engagement")');

    // Verify engagement metrics
    await expect(page.locator('div[data-testid="engagement-metrics"]')).toBeVisible();
    await expect(page.locator('text=View Duration')).toBeVisible();
    await expect(page.locator('text=Interaction Rate')).toBeVisible();
    await expect(page.locator('text=Content Completion')).toBeVisible();
  });

  test('should handle date range selection', async ({ page }) => {
    // Navigate to analytics page
    await page.click('a[href="/analytics"]');
    await page.waitForURL('/analytics');

    // Select date range
    await page.click('button:has-text("Date Range")');
    await page.selectOption('select[name="dateRange"]', 'Last 30 days');
    await page.click('button:has-text("Apply")');

    // Verify date range update
    await expect(page.locator('text=Last 30 days')).toBeVisible();
  });

  test('should show display comparison', async ({ page }) => {
    // Navigate to analytics page
    await page.click('a[href="/analytics"]');
    await page.waitForURL('/analytics');

    // Select comparison tab
    await page.click('button:has-text("Comparison")');

    // Select displays to compare
    await page.selectOption('select[name="display1"]', 'Display 1');
    await page.selectOption('select[name="display2"]', 'Display 2');
    await page.click('button:has-text("Compare")');

    // Verify comparison results
    await expect(page.locator('div[data-testid="comparison-results"]')).toBeVisible();
    await expect(page.locator('text=Performance Comparison')).toBeVisible();
    await expect(page.locator('text=Engagement Comparison')).toBeVisible();
  });

  test('should export analytics data', async ({ page }) => {
    // Navigate to analytics page
    await page.click('a[href="/analytics"]');
    await page.waitForURL('/analytics');

    // Click export button
    await page.click('button:has-text("Export")');

    // Select export format
    await page.selectOption('select[name="exportFormat"]', 'CSV');
    await page.click('button:has-text("Download")');

    // Verify download started
    await expect(page.locator('text=Downloading analytics data')).toBeVisible();
  });

  test('should show trend analysis', async ({ page }) => {
    // Navigate to analytics page
    await page.click('a[href="/analytics"]');
    await page.waitForURL('/analytics');

    // Select trends tab
    await page.click('button:has-text("Trends")');

    // Select trend type
    await page.selectOption('select[name="trendType"]', 'Performance');
    await page.click('button:has-text("Analyze")');

    // Verify trend analysis
    await expect(page.locator('div[data-testid="trend-analysis"]')).toBeVisible();
    await expect(page.locator('text=Performance Trends')).toBeVisible();
    await expect(page.locator('text=Growth Rate')).toBeVisible();
  });

  test('should handle custom reports', async ({ page }) => {
    // Navigate to analytics page
    await page.click('a[href="/analytics"]');
    await page.waitForURL('/analytics');

    // Click create report button
    await page.click('button:has-text("Create Report")');

    // Fill report details
    await page.fill('input[name="reportName"]', 'Custom Report');
    await page.selectOption('select[name="metrics"]', 'Performance,Engagement');
    await page.click('button:has-text("Save")');

    // Verify report creation
    await expect(page.locator('text=Report created successfully')).toBeVisible();
    await expect(page.locator('text=Custom Report')).toBeVisible();
  });
}); 