import { test, expect, helpers, mockApiResponses, mockSocketEvents } from './setup';

test.describe('Display Pairing Flow', () => {
  test.beforeEach(async ({ page, authContext }) => {
    await helpers.login(page, authContext.user.email, 'TestP@ss1');
  });

  test('should successfully pair a new display', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Click add display button
    await page.click('button:has-text("Add Display")');
    await page.waitForURL('/displays/add');

    // Fill in display details
    await page.fill('input[name="name"]', 'Test Display');
    await page.fill('input[name="location"]', 'Test Location');
    await page.click('button:has-text("Generate QR Code")');

    // Wait for QR code to be generated
    await page.waitForSelector('img[alt="Display QR Code"]');

    // Verify QR code is displayed
    const qrCode = await page.locator('img[alt="Display QR Code"]');
    expect(await qrCode.isVisible()).toBe(true);

    // Simulate display scanning QR code
    await page.click('button:has-text("Simulate Display Scan")');

    // Wait for pairing success message
    await page.waitForSelector('text=Display paired successfully');

    // Verify display appears in list
    await page.waitForURL('/displays');
    await expect(page.locator('text=Test Display')).toBeVisible();
  });

  test('should handle pairing timeout', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Click add display button
    await page.click('button:has-text("Add Display")');
    await page.waitForURL('/displays/add');

    // Fill in display details
    await page.fill('input[name="name"]', 'Timeout Display');
    await page.fill('input[name="location"]', 'Test Location');
    await page.click('button:has-text("Generate QR Code")');

    // Wait for QR code to be generated
    await page.waitForSelector('img[alt="Display QR Code"]');

    // Wait for pairing timeout (30 seconds)
    await page.waitForTimeout(30000);

    // Verify timeout message
    await expect(page.locator('text=Pairing timed out')).toBeVisible();

    // Verify retry button is available
    await expect(page.locator('button:has-text("Retry Pairing")')).toBeVisible();
  });

  test('should handle invalid QR code', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Click add display button
    await page.click('button:has-text("Add Display")');
    await page.waitForURL('/displays/add');

    // Fill in display details
    await page.fill('input[name="name"]', 'Invalid Display');
    await page.fill('input[name="location"]', 'Test Location');
    await page.click('button:has-text("Generate QR Code")');

    // Wait for QR code to be generated
    await page.waitForSelector('img[alt="Display QR Code"]');

    // Simulate invalid QR code scan
    await page.click('button:has-text("Simulate Invalid Scan")');

    // Verify error message
    await expect(page.locator('text=Invalid QR code')).toBeVisible();

    // Verify retry button is available
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
  });

  test('should handle display disconnection during pairing', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Click add display button
    await page.click('button:has-text("Add Display")');
    await page.waitForURL('/displays/add');

    // Fill in display details
    await page.fill('input[name="name"]', 'Disconnected Display');
    await page.fill('input[name="location"]', 'Test Location');
    await page.click('button:has-text("Generate QR Code")');

    // Wait for QR code to be generated
    await page.waitForSelector('img[alt="Display QR Code"]');

    // Start pairing process
    await page.click('button:has-text("Start Pairing")');

    // Simulate display disconnection
    await page.click('button:has-text("Simulate Disconnection")');

    // Verify disconnection message
    await expect(page.locator('text=Display disconnected')).toBeVisible();

    // Verify retry button is available
    await expect(page.locator('button:has-text("Retry Connection")')).toBeVisible();
  });

  test('should handle multiple displays', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Add first display
    await helpers.createDisplay(page, 'Display 1', 'Location 1');
    await page.waitForSelector('img[alt="Display QR Code"]');
    await page.click('button:has-text("Simulate Display Scan")');
    await page.waitForURL('/displays');

    // Add second display
    await helpers.createDisplay(page, 'Display 2', 'Location 2');
    await page.waitForSelector('img[alt="Display QR Code"]');
    await page.click('button:has-text("Simulate Display Scan")');
    await page.waitForURL('/displays');

    // Verify both displays are listed
    await expect(page.locator('text=Display 1')).toBeVisible();
    await expect(page.locator('text=Display 2')).toBeVisible();
  });
}); 