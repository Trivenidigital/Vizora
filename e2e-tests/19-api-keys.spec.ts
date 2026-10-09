import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';

/**
 * Open the create dialog and return it, scoped by its accessible name.
 *
 * A bare `[role="dialog"], .modal` resolves to three elements on this page — the
 * real modal, the always-mounted cookie-consent bar and a dev overlay — which is
 * a strict-mode violation rather than a product fault. The modal is rendered by
 * components/Modal.tsx, which labels it with its title, so the role query picks
 * out exactly one. Scoping the field lookups to it also keeps them off the
 * page's other inputs.
 */
async function openCreateKeyDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Create API Key' }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Create API Key' });
  await expect(dialog).toBeVisible({ timeout: 5000 });
  return dialog;
}

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

      const dialog = await openCreateKeyDialog(authenticatedPage);

      // The dialog is the create form, not just any overlay.
      await expect(dialog.getByLabel(/key name/i)).toBeVisible();
    });

    test('should have name input in create modal', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      const dialog = await openCreateKeyDialog(authenticatedPage);

      // The field is `#api-key-name` with an associated <label>Key Name</label>.
      const nameInput = dialog.getByLabel(/key name/i);
      await expect(nameInput).toBeVisible({ timeout: 5000 });
      await expect(nameInput).toHaveAttribute('id', 'api-key-name');
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

      const keyName = `Test Key ${Date.now()}`;
      const dialog = await openCreateKeyDialog(authenticatedPage);

      await dialog.getByLabel(/key name/i).fill(keyName);

      const submit = dialog.getByRole('button', { name: 'Create Key' });
      await expect(submit).toBeEnabled();
      await submit.click();

      // The dialog closes and the plaintext key is surfaced once, with a copy
      // control, in the "New API Key Created" banner.
      await expect(dialog).toBeHidden({ timeout: 10000 });

      const banner = authenticatedPage
        .getByRole('heading', { name: new RegExp(`New API Key Created: ${keyName}`) })
        .locator('xpath=..');
      await expect(banner).toBeVisible({ timeout: 10000 });
      // `code` and the copy control are scoped to the banner: the page has other
      // <code> blocks (the key-prefix column and the usage docs).
      await expect(banner.locator('code')).toHaveText(/^vz_live_\S{16,}$/);
      await expect(banner.getByRole('button', { name: /copy/i })).toBeVisible();
    });
  });

  test.describe('API Key Actions', () => {
    test('should have revoke button for existing keys', async ({ authenticatedPage }) => {
      // First create a key
      await authenticatedPage.goto('/dashboard/settings/api-keys');
      await authenticatedPage.waitForLoadState('networkidle');

      const dialog = await openCreateKeyDialog(authenticatedPage);
      await dialog.getByLabel(/key name/i).fill(`Revoke Test ${Date.now()}`);
      await dialog.getByRole('button', { name: 'Create Key' }).click();

      // The product closes the dialog itself on success and reloads the list.
      await expect(dialog).toBeHidden({ timeout: 10000 });

      const revokeButton = authenticatedPage
        .getByRole('button', { name: /revoke/i })
        .first();
      await expect(revokeButton).toBeVisible({ timeout: 10000 });
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
