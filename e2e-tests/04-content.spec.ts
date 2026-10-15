import { test, expect, apiPost, readData } from './fixtures/auth.fixture';

test.describe('Content Management', () => {
  test('should show content library', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/content');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check page loaded with specific heading
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Content Library' })).toBeVisible({ timeout: 10000 });
    
    // Should have upload button
    await expect(authenticatedPage.locator('button').filter({ hasText: /upload/i }).first()).toBeVisible();
    
    // Visual regression
    // await expect(authenticatedPage).toHaveScreenshot('content-library.png', { maxDiffPixels: 100 });
  });

  test('should open upload modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/content');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Click upload button
    const uploadButton = authenticatedPage.locator('button').filter({ hasText: /upload|add content|new/i }).first();
    await uploadButton.click();
    
    // Modal should appear
    await expect(authenticatedPage.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 });
    
    // Check for file input or form fields
    await expect(authenticatedPage.locator('input').first()).toBeVisible();
  });

  test('should create URL-based content', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/content');
    await authenticatedPage.waitForLoadState('networkidle');

    // Creating content through the UI is launch-critical: this must actually
    // submit and land in the library, not fill the form and cancel.
    const uploadButton = authenticatedPage.locator('button').filter({ hasText: /upload/i }).first();
    await expect(uploadButton).toBeVisible({ timeout: 10000 });
    await uploadButton.click();

    const modal = authenticatedPage.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 10000 });
    await authenticatedPage.waitForTimeout(500);

    // The URL field only renders once the type is switched to 'url'.
    await modal.locator('select').first().selectOption('url');

    const contentName = `Test URL Content ${Date.now()}`;
    await modal.locator('input[placeholder*="Summer Sale Banner"]').fill(contentName);
    await modal.locator('input[type="url"]').fill('https://example.com/e2e-gate-page');

    const submitButton = modal.locator('button').filter({ hasText: /upload content/i }).first();
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();

    // The new item must actually appear in the library.
    await expect(modal).toBeHidden({ timeout: 10000 });
    await expect(authenticatedPage.locator(`text="${contentName}"`).first()).toBeVisible({ timeout: 10000 });
  });

  test('should filter content by type', async ({ authenticatedPage, token }) => {
    // One item of each of two types, so every filter state has a known answer.
    const stamp = Date.now();
    const names: Record<string, string> = {};
    for (const type of ['image', 'video']) {
      names[type] = `Test ${type} ${stamp}`;
      const res = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/content', {
        name: names[type],
        type,
        url: `https://example.com/test.${type === 'image' ? 'jpg' : 'mp4'}`,
      });
      expect(res.ok(), `content create failed: ${res.status()} ${await res.text()}`).toBeTruthy();
    }

    await authenticatedPage.goto('/dashboard/content');
    await authenticatedPage.waitForLoadState('networkidle');
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Content Library' })).toBeVisible({ timeout: 5000 });

    await authenticatedPage.getByRole('button', { name: 'List view' }).click();
    const rows = authenticatedPage.locator('table tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 10000 });

    // The type pills are exact-named buttons; the old /all|image|video/i
    // matcher's first hit was whatever came first in the DOM.
    await authenticatedPage.getByRole('button', { name: 'Image', exact: true }).click();
    await expect(rows).toHaveCount(1, { timeout: 10000 });
    await expect(rows.first()).toContainText(names.image);
    await expect(authenticatedPage.getByText('Type: image')).toBeVisible();

    await authenticatedPage.getByRole('button', { name: 'Video', exact: true }).click();
    await expect(rows).toHaveCount(1, { timeout: 10000 });
    await expect(rows.first()).toContainText(names.video);

    // A type with nothing in it is the filtered-empty state, not "No content yet".
    await authenticatedPage.getByRole('button', { name: 'Pdf', exact: true }).click();
    await expect(rows).toHaveCount(0, { timeout: 10000 });
    await expect(authenticatedPage.getByText('No matching content')).toBeVisible();

    await authenticatedPage.getByRole('button', { name: 'All', exact: true }).click();
    await expect(rows).toHaveCount(2, { timeout: 10000 });
  });

  test('should delete content', async ({ authenticatedPage, token }) => {
    // Create content via API
    const contentRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/content', {
      name: `Test Content ${Date.now()}`,
      type: 'image',
      url: 'https://example.com/test.jpg',
    });

    expect(contentRes.ok(), `content create failed: ${contentRes.status()} ${await contentRes.text()}`).toBeTruthy();

    const content = await readData(contentRes);
    expect(content.name, 'created content must carry a name').toBeTruthy();

    await authenticatedPage.goto('/dashboard/content');
    await authenticatedPage.waitForLoadState('networkidle');

    // Content created through the API must be listed, then must be removable.
    // Scope to the `.eh-dash-card` the item renders in, not two DOM levels up.
    const contentItem = authenticatedPage.locator('.eh-dash-card').filter({ hasText: content.name }).first();
    await expect(contentItem).toBeVisible({ timeout: 10000 });

    const deleteButton = contentItem.locator('button.eh-icon-btn-danger').first();
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // Confirm inside the dialog. An unscoped match here picks the card's own
    // Delete button, which sits behind the modal overlay and never becomes clickable.
    const dialog = authenticatedPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.locator('button').filter({ hasText: /^\s*(confirm|yes|delete)\s*$/i }).first().click();

    // The deleted item must actually disappear from the library.
    await expect(authenticatedPage.locator(`text="${content.name}"`)).toHaveCount(0, { timeout: 10000 });
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Content Library' })).toBeVisible();
  });
});
