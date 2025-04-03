import { test, expect, helpers, mockApiResponses, mockSocketEvents } from './setup';

test.describe('Display Settings', () => {
  test.beforeEach(async ({ page, authContext }) => {
    await helpers.login(page, authContext.user.email, 'TestP@ss1');
  });

  test('should update display settings', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Select display
    await page.click('text=Test Display');
    await page.waitForURL('/displays/*/settings');

    // Update display settings
    await page.fill('input[name="name"]', 'Updated Display');
    await page.fill('input[name="location"]', 'Updated Location');
    await page.selectOption('select[name="resolution"]', '1920x1080');
    await page.click('button:has-text("Save")');

    // Verify settings update
    await expect(page.locator('text=Settings updated successfully')).toBeVisible();
    await expect(page.locator('text=Updated Display')).toBeVisible();
    await expect(page.locator('text=Updated Location')).toBeVisible();
  });

  test('should configure display schedule', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Select display
    await page.click('text=Test Display');
    await page.waitForURL('/displays/*/settings');

    // Click schedule tab
    await page.click('button:has-text("Schedule")');

    // Configure schedule
    await page.fill('input[name="startTime"]', '09:00');
    await page.fill('input[name="endTime"]', '17:00');
    await page.check('input[name="weekdays"]');
    await page.click('button:has-text("Save Schedule")');

    // Verify schedule update
    await expect(page.locator('text=Schedule updated successfully')).toBeVisible();
    await expect(page.locator('text=09:00 - 17:00')).toBeVisible();
  });

  test('should configure display brightness', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Select display
    await page.click('text=Test Display');
    await page.waitForURL('/displays/*/settings');

    // Click brightness tab
    await page.click('button:has-text("Brightness")');

    // Configure brightness
    await page.fill('input[name="dayBrightness"]', '80');
    await page.fill('input[name="nightBrightness"]', '40');
    await page.click('button:has-text("Save Brightness")');

    // Verify brightness update
    await expect(page.locator('text=Brightness updated successfully')).toBeVisible();
    await expect(page.locator('text=Day: 80%')).toBeVisible();
    await expect(page.locator('text=Night: 40%')).toBeVisible();
  });

  test('should configure display network', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Select display
    await page.click('text=Test Display');
    await page.waitForURL('/displays/*/settings');

    // Click network tab
    await page.click('button:has-text("Network")');

    // Configure network
    await page.fill('input[name="ipAddress"]', '192.168.1.100');
    await page.fill('input[name="subnetMask"]', '255.255.255.0');
    await page.fill('input[name="gateway"]', '192.168.1.1');
    await page.click('button:has-text("Save Network")');

    // Verify network update
    await expect(page.locator('text=Network settings updated successfully')).toBeVisible();
    await expect(page.locator('text=192.168.1.100')).toBeVisible();
  });

  test('should configure display content settings', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Select display
    await page.click('text=Test Display');
    await page.waitForURL('/displays/*/settings');

    // Click content tab
    await page.click('button:has-text("Content")');

    // Configure content settings
    await page.selectOption('select[name="contentRotation"]', '30');
    await page.selectOption('select[name="transitionEffect"]', 'fade');
    await page.check('input[name="randomize"]');
    await page.click('button:has-text("Save Content Settings")');

    // Verify content settings update
    await expect(page.locator('text=Content settings updated successfully')).toBeVisible();
    await expect(page.locator('text=30 seconds')).toBeVisible();
    await expect(page.locator('text=Fade')).toBeVisible();
  });

  test('should configure display maintenance', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Select display
    await page.click('text=Test Display');
    await page.waitForURL('/displays/*/settings');

    // Click maintenance tab
    await page.click('button:has-text("Maintenance")');

    // Configure maintenance
    await page.fill('input[name="maintenanceWindow"]', '02:00-04:00');
    await page.check('input[name="autoUpdate"]');
    await page.click('button:has-text("Save Maintenance")');

    // Verify maintenance update
    await expect(page.locator('text=Maintenance settings updated successfully')).toBeVisible();
    await expect(page.locator('text=02:00-04:00')).toBeVisible();
  });

  test('should handle display backup', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Select display
    await page.click('text=Test Display');
    await page.waitForURL('/displays/*/settings');

    // Click backup tab
    await page.click('button:has-text("Backup")');

    // Configure backup
    await page.check('input[name="autoBackup"]');
    await page.selectOption('select[name="backupFrequency"]', 'daily');
    await page.click('button:has-text("Save Backup")');

    // Verify backup update
    await expect(page.locator('text=Backup settings updated successfully')).toBeVisible();
    await expect(page.locator('text=Daily')).toBeVisible();
  });

  test('should handle display reset', async ({ page }) => {
    // Navigate to displays page
    await page.click('a[href="/displays"]');
    await page.waitForURL('/displays');

    // Select display
    await page.click('text=Test Display');
    await page.waitForURL('/displays/*/settings');

    // Click reset tab
    await page.click('button:has-text("Reset")');

    // Confirm reset
    await page.fill('input[name="confirmReset"]', 'RESET');
    await page.click('button:has-text("Reset Display")');

    // Verify reset confirmation
    await expect(page.locator('text=Display reset initiated')).toBeVisible();
  });
}); 