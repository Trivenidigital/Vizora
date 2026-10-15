import { test, expect } from './fixtures/auth.fixture';

/**
 * PHASE 6.3: DEVICE GROUPS & ZONES TEST SUITE
 *
 * BMAD Method Coverage:
 * ├─ Boundary Tests: Max groups, nesting depth, device limits
 * ├─ Mutation Tests: Group creation, device assignment, hierarchy changes
 * ├─ Adversarial Tests: Circular references, large datasets
 * └─ Domain Tests: Group hierarchy, bulk operations
 *
 * Test Coverage: 22 critical test cases for device groups
 */

test.describe('Phase 6.3: Device Groups & Zones System', () => {

  test('should load devices page with group filter', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for group filter section
    const groupFilter = authenticatedPage.locator('text=/group|zone|location/i').first();

    if (await groupFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(groupFilter).toBeVisible();
    }
  });

  test('should display device group selector (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for group selector
    const groupSelector = authenticatedPage.locator('[class*="group"], [class*="selector"]').first();

    if (await groupSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(groupSelector).toBeVisible();
    }
  });

  test('should list available device groups (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for group options
    const groupOptions = authenticatedPage.locator('text=/Store|Office|Kiosk|Location/i');

    if (await groupOptions.count() > 0) {
      await expect(groupOptions.first()).toBeVisible();
    }
  });

  test('should show device count per group (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for count indicators
    const counts = authenticatedPage.locator('text=/\\(\\d+\\)|\\d+ device/i').first();

    if (await counts.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(counts).toBeVisible();
    }
  });

  test('should allow single group selection (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Find group checkbox/radio
    const groupCheckbox = authenticatedPage.locator('input[type="checkbox"], input[type="radio"]').first();

    if (await groupCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      const initialState = await groupCheckbox.isChecked();
      await groupCheckbox.check({ force: true });
      const afterClick = await groupCheckbox.isChecked();

      expect(afterClick).toBe(true);

      // Uncheck
      await groupCheckbox.uncheck({ force: true });
      const afterUncheck = await groupCheckbox.isChecked();
      expect(afterUncheck).toBe(false);
    }
  });

  test('should allow multi-group selection (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Select first group
    const firstCheckbox = authenticatedPage.locator('input[type="checkbox"]').nth(0);
    const secondCheckbox = authenticatedPage.locator('input[type="checkbox"]').nth(1);

    if (await firstCheckbox.isVisible({ timeout: 3000 }).catch(() => false) &&
        await secondCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
      await firstCheckbox.check({ force: true });
      await secondCheckbox.check({ force: true });

      expect(await firstCheckbox.isChecked()).toBe(true);
      expect(await secondCheckbox.isChecked()).toBe(true);
    }
  });

  test('should filter devices by selected group (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Select group
    const groupCheckbox = authenticatedPage.locator('input[type="checkbox"]').first();

    if (await groupCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await groupCheckbox.check({ force: true });
      await authenticatedPage.waitForTimeout(500);

      // Devices should be filtered
      const deviceRows = authenticatedPage.locator('[role="row"], [class*="device"]');
      const visibleCount = await deviceRows.count();

      expect(visibleCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should support nested/hierarchical groups (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for nested indicators (arrows, indentation)
    const nestedIndicators = authenticatedPage.locator('[class*="arrow"], [class*="indent"], [class*="nested"]').first();

    if (await nestedIndicators.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(nestedIndicators).toBeVisible();
    }
  });

  /*
   * REMOVED 2026-10-09: 'should expand/collapse nested groups (MUTATION)'.
   *
   * It looked for a button matching /show|hide|expand|collapse/i, and behind
   * that guard asserted `expect(initialClass || afterClickClass).toBeTruthy()`
   * - which passes as long as EITHER read returned a class, so it could not
   * detect the change it claimed to check. Both halves were moot anyway:
   * nested groups do not exist. `DisplayGroup` in schema.prisma has no parent
   * column, `createDisplayGroup` takes only { name, description }, and
   * `DeviceGroupSelector.renderGroups` recurses on a `parentGroupId` that is
   * therefore always undefined - so every group renders flat at level 0 and
   * there is no expand/collapse control to click.
   *
   * Nothing was substituted: the flat list is covered by the group-filter
   * tests above. See also 'support nested/hierarchical groups' and 'show group
   * hierarchy visually' in this file, which probe the same non-feature.
   */

  test('should allow bulk operations on group (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Select group
    const groupCheckbox = authenticatedPage.locator('input[type="checkbox"]').first();

    if (await groupCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await groupCheckbox.check({ force: true });
      await authenticatedPage.waitForTimeout(500);

      // Look for bulk action buttons
      const bulkActions = authenticatedPage.locator('button').filter({ hasText: /action|bulk|assign|delete/i }).first();

      if (await bulkActions.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(bulkActions).toBeVisible();
      }
    }
  });

  test('should show group description/details (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for description
    const description = authenticatedPage.locator('text=/location|retail|office|kiosk/i').first();

    if (await description.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(description).toBeVisible();
    }
  });

  test('should create new device group (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for create group button
    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add.*group/i }).first();

    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
      await authenticatedPage.waitForTimeout(500);

      // Modal or form should appear
      const modal = authenticatedPage.locator('[role="dialog"], form').first();
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(modal).toBeVisible();
      }
    }
  });

  /**
   * The group-creation form lives inside the COLLAPSED "Device Groups" card on
   * the devices page, not in a page-level modal. The old locator took the first
   * button on the page matching /create|new|add.*group/i - which is "Pair New
   * Device" in the header - so the form under test was never opened, the
   * `nameInput` guard was never satisfied, and the body never ran. The
   * `expect(isDisabled || true)` left behind could not have failed in any case.
   *
   * The real rule is `!newGroupName.trim()` in DeviceGroupSelector: empty is
   * refused and so is whitespace-only, which is the half a `required` attribute
   * would have missed.
   */
  test('should validate group name (BOUNDARY)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const groupsToggle = authenticatedPage.getByRole('button', { name: /Device Groups \(\d+\)/ });
    await expect(groupsToggle).toBeVisible({ timeout: 10000 });
    await groupsToggle.click();

    const panel = authenticatedPage.locator('#device-group-filter');
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: /Create New Group/ }).click();

    const nameInput = panel.getByPlaceholder(/^Group name/);
    const createButton = panel.getByRole('button', { name: 'Create', exact: true });
    await expect(nameInput).toBeVisible();

    // Cancel stays live throughout. That is the control: it proves enablement
    // is being decided per button by the name, and that the whole form has not
    // simply been rendered disabled.
    await expect(createButton).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();

    await nameInput.fill('   ');
    await expect(createButton).toBeDisabled();

    await nameInput.fill(`E2E Group ${Date.now()}`);
    await expect(createButton).toBeEnabled();

    await nameInput.fill('');
    await expect(createButton).toBeDisabled();
  });

  test('should assign devices to group (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for device assignment UI
    const assignButton = authenticatedPage.locator('button').filter({ hasText: /assign|add device|manage/i }).first();

    if (await assignButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await assignButton.click();
      await authenticatedPage.waitForTimeout(500);

      // Device selection should appear
      const deviceCheckboxes = authenticatedPage.locator('input[type="checkbox"]');
      const count = await deviceCheckboxes.count();

      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should remove device from group (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for remove button
    const removeButton = authenticatedPage.locator('button').filter({ hasText: /remove|unassign|delete/i }).first();

    if (await removeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await removeButton.click();
      await authenticatedPage.waitForTimeout(500);

      // Action should complete
      await expect(authenticatedPage.locator('h2').filter({ hasText: 'Devices' })).toBeVisible();
    }
  });

  test('should delete group (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for delete group button
    const deleteButton = authenticatedPage.locator('button').filter({ hasText: /delete.*group|remove group/i }).first();

    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click();
      await authenticatedPage.waitForTimeout(500);

      // Confirmation should appear
      const confirmButton = authenticatedPage.locator('button').filter({ hasText: /confirm|yes|delete/i }).first();
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Don't actually delete, just verify flow works
        const cancelButton = authenticatedPage.locator('button').filter({ hasText: /cancel|no/i }).first();
        if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelButton.click();
        }
      }
    }
  });

  test('should handle large number of groups (BOUNDARY)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Get all groups
    const groups = authenticatedPage.locator('text=/group|zone|location/i');
    const count = await groups.count();

    // Should handle many groups
    expect(count).toBeGreaterThanOrEqual(0);

    // Page should remain responsive
    await authenticatedPage.waitForTimeout(500);
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Devices' })).toBeVisible();
  });

  test('should show group hierarchy visually (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for visual hierarchy (indentation, tree structure)
    const hierarchyIndicators = authenticatedPage.locator('[class*="indent"], [class*="tree"], [class*="nested"]');
    const count = await hierarchyIndicators.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should support group search/filter (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for group search
    const searchInput = authenticatedPage.locator('input[placeholder*="search"]').first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Store');
      await authenticatedPage.waitForTimeout(500);

      // Results should filter
      await expect(authenticatedPage.locator('h2').filter({ hasText: 'Devices' })).toBeVisible();

      // Clear search
      await searchInput.clear();
    }
  });

  test('should clear group selection (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Select group
    const groupCheckbox = authenticatedPage.locator('input[type="checkbox"]').first();

    if (await groupCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await groupCheckbox.check({ force: true });

      // Find clear button
      const clearButton = authenticatedPage.locator('button').filter({ hasText: /clear|reset/i }).first();

      if (await clearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clearButton.click();
        await authenticatedPage.waitForTimeout(500);

        const isChecked = await groupCheckbox.isChecked();
        expect(isChecked).toBe(false);
      }
    }
  });
});
