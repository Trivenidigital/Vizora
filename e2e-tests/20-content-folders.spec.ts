import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { apiGet, moveContentToFolder, seedContent, seedFolder, signInAsNewMember } from './fixtures/seed';

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

/**
 * The folder sidebar.
 *
 * FolderTree's root carries no landmark role, id or test id, so it is reached as
 * the container that holds its "New Folder" control. Scoping to it matters: the
 * content page's own action buttons and the permanently-mounted cookie-consent
 * bar both match loose text locators, and the consent bar matches them on every
 * page.
 */
const folderSidebar = (page: Page): Locator =>
  page.locator('div.w-64').filter({ has: page.getByRole('button', { name: 'New Folder' }) });

/**
 * A folder's select target. Its accessible name is the folder name followed by
 * the content-count badge when the folder holds content ("Doomed 1"), so an
 * exact-name query only matches empty folders.
 */
const folderButtonIn = (scope: Page | Locator, name: string): Locator =>
  scope.getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}( \\d+)?$`) });

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The content page's folder breadcrumb — not the layout's page breadcrumb, which shares the name. */
const folderBreadcrumb = (page: Page): Locator =>
  page.getByRole('navigation', { name: 'Breadcrumb' }).filter({ has: page.getByRole('button', { name: 'All Content' }) });

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

      /*
       * Each folder row's select target is a real button carrying aria-current
       * while its folder is the one listed (it used to be a clickable <div>
       * whose only signal was the selected ground). "All Content" carries it
       * until a folder is chosen.
       */
      const sidebar = folderSidebar(authenticatedPage);
      const allContent = sidebar.getByRole('button', { name: 'All Content' });
      const folderButton = folderButtonIn(sidebar, folderName);
      await expect(allContent).toHaveAttribute('aria-current', 'true');
      await expect(folderButton).not.toHaveAttribute('aria-current', /.*/);

      await folderButton.click();
      await expect(folderButton).toHaveAttribute('aria-current', 'true');
      await expect(allContent).not.toHaveAttribute('aria-current', /.*/);
    });

    test('should show breadcrumb navigation', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * The old body passed if EITHER a breadcrumb OR a `.folder-tree` element
       * was visible (`expect(hasBC || hasTree)`). FolderBreadcrumb is a
       * <nav aria-label="Breadcrumb"> that follows the selected folder.
       */
      const folderName = `Crumb ${Date.now()}`;
      await createFolder(authenticatedPage, folderName);

      const breadcrumb = folderBreadcrumb(authenticatedPage);
      await expect(breadcrumb).toBeVisible();
      await expect(breadcrumb).toContainText('All Content');
      await expect(breadcrumb).not.toContainText(folderName);

      await folderButtonIn(folderSidebar(authenticatedPage), folderName).click();
      await expect(breadcrumb).toContainText(folderName);

      // And the breadcrumb navigates back up.
      await breadcrumb.getByRole('button', { name: 'All Content' }).click();
      await expect(breadcrumb).not.toContainText(folderName);
      await expect(
        folderSidebar(authenticatedPage).getByRole('button', { name: 'All Content' }),
      ).toHaveAttribute('aria-current', 'true');
    });
  });

  test.describe('Folder Actions', () => {
    test('should expose the expand toggle only for folders with children', async ({ authenticatedPage, token }) => {
      const stamp = Date.now();
      const parent = await seedFolder(authenticatedPage, token, { name: `Parent ${stamp}` });
      const leaf = await seedFolder(authenticatedPage, token, { name: `Leaf ${stamp}` });
      const child = await seedFolder(authenticatedPage, token, { name: `Child ${stamp}`, parentId: parent.id });

      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');
      const sidebar = folderSidebar(authenticatedPage);

      /*
       * The expand/collapse toggle is rendered for every folder but carries
       * `invisible` when the folder has no children, which removes it from the
       * accessibility tree. So a childless folder offers no toggle, and a
       * parent offers one that reveals its child.
       */
      await expect(folderButtonIn(sidebar, leaf.name)).toBeVisible({ timeout: 10000 });
      await expect(sidebar.getByRole('button', { name: `Expand folder ${leaf.name}` })).toBeHidden();

      const expand = sidebar.getByRole('button', { name: `Expand folder ${parent.name}` });
      await expect(expand).toBeVisible();
      await expect(expand).toHaveAttribute('aria-expanded', 'false');
      await expect(folderButtonIn(sidebar, child.name)).toHaveCount(0);

      await expand.click();
      const collapse = sidebar.getByRole('button', { name: `Collapse folder ${parent.name}` });
      await expect(collapse).toHaveAttribute('aria-expanded', 'true');
      await expect(folderButtonIn(sidebar, child.name)).toBeVisible();
    });

    test('should rename a folder', async ({ authenticatedPage, token }) => {
      const folder = await seedFolder(authenticatedPage, token, { name: `Rename Me ${Date.now()}` });
      const renamed = `Renamed ${Date.now()}`;

      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');
      const sidebar = folderSidebar(authenticatedPage);

      // The action is revealed on row hover (and on keyboard focus).
      await folderButtonIn(sidebar, folder.name).hover();
      await sidebar.getByRole('button', { name: `Rename folder ${folder.name}` }).click();

      const dialog = authenticatedPage.getByRole('dialog', { name: 'Rename Folder' });
      await expect(dialog).toBeVisible();
      const input = dialog.getByRole('textbox', { name: 'Folder Name' });
      await expect(input).toHaveValue(folder.name);

      // Blank, the submit is disabled rather than sending an empty name.
      await input.fill('   ');
      await expect(dialog.getByRole('button', { name: 'Rename', exact: true })).toBeDisabled();

      // Submitted with Enter: the dialog is a real <form>.
      await input.fill(renamed);
      await input.press('Enter');

      await expect(authenticatedPage.getByRole('alert').filter({ hasText: 'Folder renamed' })).toBeVisible();
      await expect(dialog).toBeHidden();
      await expect(folderButtonIn(sidebar, renamed)).toBeVisible();
      await expect(folderButtonIn(sidebar, folder.name)).toHaveCount(0);

      const folders = await apiGet<Array<{ id: string; name: string }>>(authenticatedPage, token, '/folders');
      expect(folders.find((f) => f.id === folder.id)?.name).toBe(renamed);
    });

    test('deleting a folder moves its content to the top level and resets the selection', async ({ authenticatedPage, token }) => {
      const stamp = Date.now();
      const folder = await seedFolder(authenticatedPage, token, { name: `Doomed ${stamp}` });
      const item = await seedContent(authenticatedPage, token, { name: `Survivor ${stamp}` });
      await moveContentToFolder(authenticatedPage, token, folder.id, [item.id]);

      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');
      await authenticatedPage.getByRole('button', { name: 'List view' }).click();
      const sidebar = folderSidebar(authenticatedPage);

      // Open the folder and select its one item.
      const folderButton = folderButtonIn(sidebar, folder.name);
      await folderButton.click();
      await expect(folderButton).toHaveAttribute('aria-current', 'true');
      const itemCheckbox = authenticatedPage.getByRole('checkbox', { name: `Select ${item.name}`, exact: true });
      await itemCheckbox.check();
      await expect(authenticatedPage.getByText('1 item selected')).toBeVisible();

      await folderButton.hover();
      await sidebar.getByRole('button', { name: `Delete folder ${folder.name}` }).click();

      const confirm = authenticatedPage.getByRole('dialog', { name: 'Delete Folder' });
      await expect(confirm).toBeVisible();
      await expect(confirm).toContainText(
        `Delete the folder "${folder.name}"? No content is deleted: everything in it, including any subfolders, moves to the top level (All Content).`,
      );
      await confirm.getByRole('button', { name: 'Delete Folder' }).click();

      await expect(
        authenticatedPage.getByRole('alert').filter({ hasText: `Folder "${folder.name}" deleted` }),
      ).toBeVisible();
      await expect(confirm).toBeHidden();
      await expect(folderButtonIn(sidebar, folder.name)).toHaveCount(0);

      // The listing falls back to All Content, the selection is gone, and the
      // folder's content is still there.
      await expect(sidebar.getByRole('button', { name: 'All Content' })).toHaveAttribute('aria-current', 'true');
      await expect(authenticatedPage.getByText(/items? selected/)).toBeHidden();
      await expect(itemCheckbox).toBeVisible({ timeout: 10000 });
      await expect(itemCheckbox).not.toBeChecked();

      const folders = await apiGet<Array<{ id: string }>>(authenticatedPage, token, '/folders');
      expect(folders.map((f) => f.id)).not.toContain(folder.id);
      const content = await apiGet<{ data: Array<{ id: string }> }>(authenticatedPage, token, '/content?page=1&limit=50');
      expect(content.data.map((c) => c.id)).toContain(item.id);
    });

    test('deleting a subfolder moves its content to the parent folder', async ({ authenticatedPage, token }) => {
      const stamp = Date.now();
      const parent = await seedFolder(authenticatedPage, token, { name: `Keeper ${stamp}` });
      const child = await seedFolder(authenticatedPage, token, { name: `Nested ${stamp}`, parentId: parent.id });
      const item = await seedContent(authenticatedPage, token, { name: `Nested Item ${stamp}` });
      await moveContentToFolder(authenticatedPage, token, child.id, [item.id]);

      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');
      await authenticatedPage.getByRole('button', { name: 'List view' }).click();
      const sidebar = folderSidebar(authenticatedPage);

      await sidebar.getByRole('button', { name: `Expand folder ${parent.name}` }).click();
      const childButton = folderButtonIn(sidebar, child.name);
      await childButton.hover();
      await sidebar.getByRole('button', { name: `Delete folder ${child.name}` }).click();

      const confirm = authenticatedPage.getByRole('dialog', { name: 'Delete Folder' });
      await expect(confirm).toContainText(`moves to the "${parent.name}" folder.`);
      await confirm.getByRole('button', { name: 'Delete Folder' }).click();
      await expect(confirm).toBeHidden();
      await expect(childButton).toHaveCount(0);

      // The item is now listed under the parent.
      await folderButtonIn(sidebar, parent.name).click();
      await expect(
        authenticatedPage.getByRole('checkbox', { name: `Select ${item.name}`, exact: true }),
      ).toBeVisible({ timeout: 10000 });
    });

    test('a viewer is offered neither rename nor delete', async ({ authenticatedPage, token }) => {
      const folder = await seedFolder(authenticatedPage, token, { name: `Viewer Folder ${Date.now()}` });
      await signInAsNewMember(authenticatedPage, token, 'viewer');

      await authenticatedPage.goto('/dashboard/content');
      await authenticatedPage.waitForLoadState('networkidle');

      // REACH CONTROL: the viewer sees the folder as a findable button.
      const folderButton = folderButtonIn(authenticatedPage, folder.name);
      await expect(folderButton).toBeVisible({ timeout: 10000 });
      await folderButton.hover();
      await expect(authenticatedPage.getByRole('button', { name: `Rename folder ${folder.name}` })).toHaveCount(0);
      await expect(authenticatedPage.getByRole('button', { name: `Delete folder ${folder.name}` })).toHaveCount(0);
      await expect(authenticatedPage.getByRole('button', { name: 'New Folder' })).toHaveCount(0);
    });
  });
});
