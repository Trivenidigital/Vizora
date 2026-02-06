import { test, expect } from './fixtures/auth.fixture';

test.describe('API Key Management (Wave 6)', () => {
  test.describe('API Keys Settings Page', () => {
    test('should display API keys page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage.locator('h2, h1').filter({ hasText: /api key/i })).toBeVisible({ timeout: 10000 });
    });

    test('should have create API key button', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|generate/i }).first();
      await expect(createButton).toBeVisible({ timeout: 10000 });
    });

    test('should show empty state or key list', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      const emptyState = authenticatedPage.locator('text=/no api keys|create your first|get started/i').first();
      const keyList = authenticatedPage.locator('table, [role="table"], [data-testid="api-key-list"]');

      const hasEmptyState = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
      const hasList = await keyList.isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasEmptyState || hasList).toBeTruthy();
    });

    test('should open create key modal', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      // Click create button
      await authenticatedPage.click('button:has-text("Create"), button:has-text("New"), button:has-text("Generate")');

      // Modal should open
      const modal = authenticatedPage.locator('[role="dialog"], .modal, [data-testid="create-key-modal"]');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test('should have name input in create modal', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.click('button:has-text("Create"), button:has-text("New"), button:has-text("Generate")');

      // Name input should be present
      const nameInput = authenticatedPage.locator('input[name="name"], input[placeholder*="name" i]').first();
      await expect(nameInput).toBeVisible({ timeout: 5000 });
    });

    test('should have scopes selection in create modal', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.click('button:has-text("Create"), button:has-text("New"), button:has-text("Generate")');

      // Scopes selection should be present
      const scopesSection = authenticatedPage.locator('text=/scopes|permissions|access/i').first();
      const checkboxes = authenticatedPage.locator('input[type="checkbox"]');

      const hasScopes = await scopesSection.isVisible({ timeout: 5000 }).catch(() => false);
      const hasCheckboxes = await checkboxes.first().isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasScopes || hasCheckboxes).toBeTruthy();
    });

    test('should create API key and show it once', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      // Click create button
      await authenticatedPage.click('button:has-text("Create"), button:has-text("New"), button:has-text("Generate")');

      // Fill name
      const nameInput = authenticatedPage.locator('input[name="name"], input[placeholder*="name" i]').first();
      await nameInput.fill(`Test Key ${Date.now()}`);

      // Submit
      await authenticatedPage.click('button[type="submit"], button:has-text("Create"), button:has-text("Generate")');

      // Should show the key (only shown once)
      const keyDisplay = authenticatedPage.locator('text=/vz_|sk_|copy|your api key/i').first();
      const copyButton = authenticatedPage.locator('button').filter({ hasText: /copy/i }).first();

      const hasKeyDisplay = await keyDisplay.isVisible({ timeout: 10000 }).catch(() => false);
      const hasCopyButton = await copyButton.isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasKeyDisplay || hasCopyButton).toBeTruthy();
    });
  });

  test.describe('API Key Actions', () => {
    test('should have revoke button for existing keys', async ({ authenticatedPage }) => {
      // First create a key
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.click('button:has-text("Create"), button:has-text("New"), button:has-text("Generate")');
      const nameInput = authenticatedPage.locator('input[name="name"], input[placeholder*="name" i]').first();
      await nameInput.fill(`Revoke Test ${Date.now()}`);
      await authenticatedPage.click('button[type="submit"], button:has-text("Create"), button:has-text("Generate")');

      // Close modal if still open
      await authenticatedPage.keyboard.press('Escape');
      await authenticatedPage.waitForTimeout(500);

      // Look for revoke button
      const revokeButton = authenticatedPage.locator('button').filter({ hasText: /revoke|delete|remove/i }).first();
      const hasRevoke = await revokeButton.isVisible({ timeout: 5000 }).catch(() => false);

      // Either has revoke button or the key list needs refresh
      if (!hasRevoke) {
        await authenticatedPage.reload();
        await authenticatedPage.waitForLoadState('networkidle');
      }

      const revokeButtonAfterRefresh = authenticatedPage.locator('button').filter({ hasText: /revoke|delete|remove/i }).first();
      await expect(revokeButtonAfterRefresh).toBeVisible({ timeout: 5000 });
    });

    test('should confirm before revoking key', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for revoke button
      const revokeButton = authenticatedPage.locator('button').filter({ hasText: /revoke|delete|remove/i }).first();
      const hasRevoke = await revokeButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasRevoke) {
        await revokeButton.click();

        // Should show confirmation
        const confirmDialog = authenticatedPage.locator('[role="dialog"], [role="alertdialog"], .modal');
        const confirmText = authenticatedPage.locator('text=/are you sure|confirm|cannot be undone/i');

        const hasDialog = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);
        const hasConfirmText = await confirmText.isVisible({ timeout: 3000 }).catch(() => false);

        expect(hasDialog || hasConfirmText).toBeTruthy();
      }
    });
  });

  test.describe('Settings Navigation', () => {
    test('should have API keys link in settings', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      const apiKeysLink = authenticatedPage.locator('a').filter({ hasText: /api key/i }).first();
      await expect(apiKeysLink).toBeVisible({ timeout: 10000 });
    });

    test('should navigate from settings to API keys', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.click('a:has-text("API Key")');

      await expect(authenticatedPage).toHaveURL(/api-keys/, { timeout: 10000 });
    });
  });
});
