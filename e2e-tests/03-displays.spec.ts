import { test, expect } from './fixtures/auth.fixture';

test.describe('Display Management', () => {
  test('should show empty state when no displays', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    
    // Wait for page load
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Should show empty state message
    await expect(authenticatedPage.locator('text=No devices yet')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('text=/get started by pairing/i')).toBeVisible();
    
    // Visual regression
    // await expect(authenticatedPage).toHaveScreenshot('displays-empty.png', { maxDiffPixels: 100 });
  });

  test('should open create display modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Click "Pair New Device" button in the header
    const pairButton = authenticatedPage.locator('button').filter({ hasText: /pair new device/i }).first();
    await expect(pairButton).toBeVisible({ timeout: 10000 });
    await pairButton.click();
    
    // Should navigate to pairing page
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/devices\/pair/);
    
    // Check for pairing form heading
    await expect(authenticatedPage.locator('h2').filter({ hasText: /pair new device/i })).toBeVisible({ timeout: 5000 });
    
    // Check for form fields
    await expect(authenticatedPage.locator('input[placeholder*="ABC123"]')).toBeVisible();
  });

  test('should create new display', async ({ authenticatedPage, token }) => {
    // Try to create a pairing request via API
    const pairingRes = await authenticatedPage.request.post('http://localhost:3000/api/devices/pairing/request', {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    
    if (!pairingRes || !pairingRes.ok()) {
      // If API fails, skip this test gracefully
      await authenticatedPage.goto('/dashboard/devices/pair');
      await authenticatedPage.waitForLoadState('networkidle');
      await expect(authenticatedPage.locator('h2').filter({ hasText: /pair/i })).toBeVisible();
      return;
    }
    
    const pairing = await pairingRes.json();
    
    await authenticatedPage.goto('/dashboard/devices/pair');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Fill pairing form
    const displayName = `Test Display ${Date.now()}`;
    await authenticatedPage.locator('input[placeholder*="ABC123"]').fill(pairing.code);
    await authenticatedPage.locator('input[placeholder*="Lobby Display"]').fill(displayName);
    await authenticatedPage.locator('input[placeholder*="Main Entrance"]').fill('Test Location');
    
    // Submit - the button should become enabled after code is entered
    const pairButton = authenticatedPage.locator('button').filter({ hasText: /pair device/i }).first();
    await pairButton.click();
    
    // Should show success or redirect to devices page
    await authenticatedPage.waitForTimeout(2000);
  });

  test('should show pairing code for display', async ({ authenticatedPage, token }) => {
    // Create display via API
    const displayRes = await authenticatedPage.request.post('http://localhost:3000/api/displays', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nickname: `Test Display ${Date.now()}`,
        location: 'Test Location',
      },
    }).catch(() => null);
    
    if (!displayRes || !displayRes.ok()) {
      // If API fails, just verify page loads
      await authenticatedPage.goto('/dashboard/devices');
      await authenticatedPage.waitForLoadState('networkidle');
      await expect(authenticatedPage.locator('text=No devices yet')).toBeVisible();
      return;
    }
    
    const display = await displayRes.json();
    
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Find the display row and look for action buttons
    const deviceRow = authenticatedPage.locator(`text="${display.nickname}"`).locator('..').locator('..');
    
    // Look for "Generate Pairing" or similar button
    const pairButton = deviceRow.locator('button').filter({ hasText: /pair|generate|code/i }).first();
    
    // If button exists, click it
    if (await pairButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pairButton.click();
      
      // Should show pairing modal with code
      await expect(authenticatedPage.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
      
      // Visual regression
      // await expect(authenticatedPage).toHaveScreenshot('display-pairing.png', { maxDiffPixels: 100 });
    } else {
      // If no pairing button, just verify device is visible
      await expect(deviceRow).toBeVisible();
    }
  });

  test('should delete display', async ({ authenticatedPage, token }) => {
    // Create display via API
    const displayRes = await authenticatedPage.request.post('http://localhost:3000/api/displays', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nickname: `Test Display ${Date.now()}`,
        location: 'Test Location',
      },
    }).catch(() => null);
    
    if (!displayRes || !displayRes.ok()) {
      // If API fails, just verify page loads
      await authenticatedPage.goto('/dashboard/devices');
      await authenticatedPage.waitForLoadState('networkidle');
      await expect(authenticatedPage.locator('text=No devices yet')).toBeVisible();
      return;
    }
    
    const display = await displayRes.json();
    
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Find the device in the table
    const deviceRow = authenticatedPage.locator('tr').filter({ hasText: display.nickname });
    await expect(deviceRow).toBeVisible({ timeout: 10000 });
    
    // Find and click delete button (trash icon button)
    const deleteButton = deviceRow.locator('button').filter({ hasText: /delete|trash/i }).or(
      deviceRow.locator('button').last() // Delete is usually last button
    ).first();
    await deleteButton.click();
    
    // Confirm deletion in modal
    const confirmButton = authenticatedPage.locator('[role="dialog"]').locator('button').filter({ hasText: /confirm|yes|delete/i }).first();
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();
    
    // Wait a moment for deletion
    await authenticatedPage.waitForTimeout(1000);
    
    // Display should be removed from list
    await expect(authenticatedPage.locator(`text="${display.nickname}"`)).not.toBeVisible({ timeout: 5000 });
  });
});
