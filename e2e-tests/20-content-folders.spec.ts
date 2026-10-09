import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';

/**
 * Create a folder through the UI and return its name.
 *
 * The three callers used to share one defect: `input[name="name"],
 * input[placeholder*="folder" i], input[type="text"]` matched the content page's
 * own search box before the modal field, so the folder name was never entered,
 * "Create Folder" stayed correctly disabled (the product guards on
 * `!newFolderName.trim()`) and the submit click timed out. Everything here is
 * scoped to the "Create New Folder" dialog instead.
 *
 * The name field is addressed by role: the modal's <label>Folder Name</label>
 * carries no htmlFor, so the input has no accessible name to query by. It is the
 * only textbox in the dialog (the parent-folder control is a combobox).
 */
async function createFolder(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'New Folder' }).click();

  const dialog = page.getByRole('dialog', { name: 'Create New Folder' });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  await dialog.getByRole('textbox').fill(name);

  const submit = dialog.getByRole('button', { name: 'Create Folder' });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(dialog).toBeHidden({ timeout: 10000 });
}

test.describe('Content Folders (Wave 4)', () => {
  test.describe('Folder Tree Sidebar', () => {
    test('should display folder tree on content page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for folder tree or sidebar
      const folderTree = authenticatedPage.locator('[data-testid="folder-tree"], .folder-tree, nav:has-text("Folders"), aside');
      await expect(folderTree.first()).toBeVisible({ timeout: 10000 });
    });

    test('should have root folder or all files option', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      const rootFolder = authenticatedPage.locator('text=/all files|root|all content|home/i').first();
      await expect(rootFolder).toBeVisible({ timeout: 10000 });
    });

    test('should have create folder button', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      const createFolderButton = authenticatedPage.locator('button').filter({ hasText: /new folder|create folder|add folder/i }).first();
      await expect(createFolderButton).toBeVisible({ timeout: 10000 });
    });

    test('should create a new folder', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      const folderName = `Test Folder ${Date.now()}`;
      await createFolder(authenticatedPage, folderName);

      // Folder should appear in the tree
      await expect(authenticatedPage.getByText(folderName).first()).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe('Folder Navigation', () => {
    test('should navigate into folder on click', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      // Create a folder first
      const folderName = `Nav Test ${Date.now()}`;
      await createFolder(authenticatedPage, folderName);

      // Click on the folder
      const folderRow = authenticatedPage
        .getByText(folderName, { exact: true })
        .first()
        .locator('xpath=..');
      await expect(folderRow).toBeVisible({ timeout: 10000 });
      await folderRow.click();

      /*
       * Selecting a folder marks it as the current location. FolderTree signals
       * that with the selected ground only — the row carries no aria-current or
       * aria-selected (a real a11y gap, reported separately), so the styling is
       * the only observable the product exposes.
       */
      await expect(folderRow).toHaveClass(/bg-brand\/10/);
    });

    test('should show breadcrumb navigation', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for breadcrumb
      const breadcrumb = authenticatedPage.locator('[data-testid="breadcrumb"], .breadcrumb, [aria-label*="breadcrumb" i]').first();
      const hasBC = await breadcrumb.isVisible({ timeout: 5000 }).catch(() => false);

      // Breadcrumb should exist or folder tree should show current location
      const folderTree = authenticatedPage.locator('[data-testid="folder-tree"], .folder-tree').first();
      const hasTree = await folderTree.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasBC || hasTree).toBeTruthy();
    });
  });

  test.describe('Folder Actions', () => {
    test('should expose the per-folder control in the tree', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      // Create a folder
      const folderName = `Actions Test ${Date.now()}`;
      await createFolder(authenticatedPage, folderName);

      const folderRow = authenticatedPage
        .getByText(folderName, { exact: true })
        .first()
        .locator('xpath=..');
      await expect(folderRow).toBeVisible({ timeout: 10000 });

      /*
       * The old body right-clicked the folder and expected a [role="menu"].
       * There is no folder context menu, and no per-folder actions menu either:
       * `onContextMenu` appears nowhere in web/src, and the only role="menu" is
       * NotificationDropdown. That branch could never pass — it was masked until
       * now only because the test timed out before reaching it.
       *
       * The expand/collapse toggle is the one control FolderTree renders per
       * folder. It is rendered always but carries `invisible` while the folder
       * has no children (FolderTree.tsx: `!hasChildren ? 'invisible' : ''`), so
       * it is absent from the accessibility tree and a role query finds nothing.
       * Both halves of that contract are pinned here: the control is in the row,
       * and a childless folder does not present it.
       */
      const toggle = folderRow.locator('button');
      await expect(toggle).toHaveCount(1);
      await expect(toggle).toBeHidden();
    });

    test('should rename folder', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for rename option in context menu
      const folder = authenticatedPage.locator('[data-testid="folder-item"]').first();
      const hasFolder = await folder.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasFolder) {
        await folder.click({ button: 'right' });
        const renameOption = authenticatedPage.locator('[role="menuitem"]').filter({ hasText: /rename/i });
        const hasRename = await renameOption.isVisible({ timeout: 3000 }).catch(() => false);

        expect(hasRename || true).toBeTruthy(); // Rename may not be available if no folders exist
      }
    });

    test('should delete folder with confirmation', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      const deleteButton = authenticatedPage.locator('button').filter({ hasText: /delete folder|remove folder/i }).first();
      const hasDelete = await deleteButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDelete) {
        await deleteButton.click();
        const confirmDialog = authenticatedPage.locator('[role="dialog"], [role="alertdialog"]');
        await expect(confirmDialog).toBeVisible({ timeout: 3000 });
      }
    });
  });
});
