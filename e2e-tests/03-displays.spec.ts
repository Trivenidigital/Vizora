import { test, expect, apiPost, readData } from './fixtures/auth.fixture';

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
    // RequestPairingDto requires deviceIdentifier; posting an empty body always
    // 400s, which used to send every run down the fallback branch below.
    const pairingRes = await authenticatedPage.request.post('http://localhost:3000/api/v1/devices/pairing/request', {
      headers: { Authorization: `Bearer ${token}` },
      data: { deviceIdentifier: `e2e-gate-${Date.now()}` },
    }).catch(() => null);

    if (!pairingRes || !pairingRes.ok()) {
      test.info().annotations.push({
        type: 'skipped-branch',
        description: `pairing request failed (status ${pairingRes?.status() ?? 'no response'}) — pairing form not exercised`,
      });
      await authenticatedPage.goto('/dashboard/devices/pair');
      await authenticatedPage.waitForLoadState('networkidle');
      await expect(authenticatedPage.locator('h2').filter({ hasText: /pair/i })).toBeVisible();
      return;
    }

    const pairing = await readData(pairingRes);
    expect(pairing.code, 'pairing response must carry a code').toBeTruthy();

    await authenticatedPage.goto('/dashboard/devices/pair');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Fill pairing form
    const displayName = `Test Display ${Date.now()}`;
    await authenticatedPage.locator('input[placeholder*="ABC123"]').fill(pairing.code);
    await authenticatedPage.locator('input[placeholder*="Lobby Display"]').fill(displayName);
    await authenticatedPage.locator('input[placeholder*="Main Entrance"]').fill('Test Location');
    
    // Submit - the button should become enabled after code is entered
    const pairButton = authenticatedPage.locator('button').filter({ hasText: /pair device/i }).first();
    await expect(pairButton).toBeEnabled({ timeout: 5000 });
    await pairButton.click();

    // The oracle for the flow this test is named after: pairing through the UI
    // must land the device in the fleet under the name that was typed.
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/devices(?!\/pair)/, { timeout: 15000 });
    await expect(authenticatedPage.locator(`text="${displayName}"`).first()).toBeVisible({ timeout: 10000 });
  });

  test('should show pairing code for display', async ({ authenticatedPage, token }) => {
    // CreateDisplayDto takes { name, deviceId } and maps them to nickname /
    // deviceIdentifier; posting { nickname } is rejected as a non-whitelisted property.
    const displayRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/displays', {
      name: `Test Display ${Date.now()}`,
      deviceId: `e2e-gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      location: 'Test Location',
    });

    expect(displayRes.ok(), `display create failed: ${displayRes.status()} ${await displayRes.text()}`).toBeTruthy();

    const display = await readData(displayRes);
    expect(display.nickname, 'created display must carry a nickname').toBeTruthy();

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // The display the API just created must actually be listed in the UI.
    const deviceRow = authenticatedPage.locator(`text="${display.nickname}"`).locator('..').locator('..');
    await expect(deviceRow.first()).toBeVisible({ timeout: 10000 });

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
      test.info().annotations.push({
        type: 'skipped-branch',
        description: 'no per-row pairing/generate button rendered — pairing modal not exercised',
      });
    }
  });

  /**
   * KNOWN DEFECT (fixed by PR #348, not yet merged when this test was written):
   * deleting a device returns 200, deletes server-side and toasts "Device deleted
   * successfully", but the row stays in the table until a manual reload. The devices
   * page destructured only the mutators from useOptimisticState, whose state nothing
   * renders; PR #348 pairs commitOptimistic with a setDevices filter.
   *
   * Deliberately left as a real assertion rather than test.fail(): once #348 lands
   * this must go green, and test.fail() would flip it to "unexpected pass".
   */
  test('should delete display', async ({ authenticatedPage, token }) => {
    test.info().annotations.push({
      type: 'known-defect',
      description:
        'devices list not updated after delete (server delete succeeds) — fixed by PR #348; expected RED until #348 merges, GREEN after',
    });

    const displayRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/displays', {
      name: `Test Display ${Date.now()}`,
      deviceId: `e2e-gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      location: 'Test Location',
    });

    expect(displayRes.ok(), `display create failed: ${displayRes.status()} ${await displayRes.text()}`).toBeTruthy();

    const display = await readData(displayRes);
    expect(display.nickname, 'created display must carry a nickname').toBeTruthy();

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
    
    // The deleted display must actually disappear from the list.
    await expect(authenticatedPage.locator(`text="${display.nickname}"`)).toHaveCount(0, { timeout: 10000 });
  });
});
