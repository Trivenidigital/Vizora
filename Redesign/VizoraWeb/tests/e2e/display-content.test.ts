import { test, expect, helpers, mockApiResponses, mockSocketEvents } from './setup';

test.describe('Display Content Management', () => {
  test.beforeEach(async ({ page, authContext }) => {
    await helpers.login(page, authContext.user.email, 'TestP@ss1');
  });

  test('should upload and schedule content', async ({ page }) => {
    // Navigate to content page
    await page.click('a[href="/content"]');
    await page.waitForURL('/content');

    // Click upload content button
    await page.click('button:has-text("Upload Content")');
    await page.waitForURL('/content/upload');

    // Fill in content details
    await page.fill('input[name="title"]', 'Test Content');
    await page.fill('textarea[name="description"]', 'Test Description');
    await page.setInputFiles('input[type="file"]', 'test-assets/test-image.jpg');
    await page.selectOption('select[name="type"]', 'image');
    await page.fill('input[name="duration"]', '30');
    await page.click('button:has-text("Upload")');

    // Wait for upload to complete
    await page.waitForSelector('text=Content uploaded successfully');

    // Navigate to schedule page
    await page.click('a[href="/content/schedule"]');
    await page.waitForURL('/content/schedule');

    // Select display and schedule content
    await page.selectOption('select[name="display"]', 'Test Display');
    await page.selectOption('select[name="content"]', 'Test Content');
    await page.fill('input[name="startDate"]', new Date().toISOString().split('T')[0]);
    await page.fill('input[name="endDate"]', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    await page.click('button:has-text("Schedule")');

    // Verify schedule success
    await expect(page.locator('text=Content scheduled successfully')).toBeVisible();
  });

  test('should handle content validation', async ({ page }) => {
    // Navigate to content page
    await page.click('a[href="/content"]');
    await page.waitForURL('/content');

    // Click upload content button
    await page.click('button:has-text("Upload Content")');
    await page.waitForURL('/content/upload');

    // Try to upload without required fields
    await page.click('button:has-text("Upload")');

    // Verify validation messages
    await expect(page.locator('text=Title is required')).toBeVisible();
    await expect(page.locator('text=Please select a file')).toBeVisible();
  });

  test('should handle content deletion', async ({ page }) => {
    // Navigate to content page
    await page.click('a[href="/content"]');
    await page.waitForURL('/content');

    // Find and delete test content
    await page.click('button:has-text("Delete")');
    await page.click('button:has-text("Confirm")');

    // Verify deletion success
    await expect(page.locator('text=Content deleted successfully')).toBeVisible();
  });

  test('should handle content updates', async ({ page }) => {
    // Navigate to content page
    await page.click('a[href="/content"]');
    await page.waitForURL('/content');

    // Find and edit test content
    await page.click('button:has-text("Edit")');
    await page.fill('input[name="title"]', 'Updated Content');
    await page.fill('textarea[name="description"]', 'Updated Description');
    await page.click('button:has-text("Save")');

    // Verify update success
    await expect(page.locator('text=Content updated successfully')).toBeVisible();
  });

  test('should handle content scheduling conflicts', async ({ page }) => {
    // Navigate to schedule page
    await page.click('a[href="/content/schedule"]');
    await page.waitForURL('/content/schedule');

    // Try to schedule overlapping content
    await page.selectOption('select[name="display"]', 'Test Display');
    await page.selectOption('select[name="content"]', 'Test Content');
    await page.fill('input[name="startDate"]', new Date().toISOString().split('T')[0]);
    await page.fill('input[name="endDate"]', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    await page.click('button:has-text("Schedule")');

    // Verify conflict message
    await expect(page.locator('text=Schedule conflict detected')).toBeVisible();
  });

  test('should handle content preview', async ({ page }) => {
    // Navigate to content page
    await page.click('a[href="/content"]');
    await page.waitForURL('/content');

    // Click preview button
    await page.click('button:has-text("Preview")');

    // Verify preview modal
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    await expect(page.locator('img[alt="Content Preview"]')).toBeVisible();
  });

  test('should handle content categories', async ({ page }) => {
    // Navigate to content page
    await page.click('a[href="/content"]');
    await page.waitForURL('/content');

    // Create new category
    await page.click('button:has-text("Add Category")');
    await page.fill('input[name="categoryName"]', 'Test Category');
    await page.click('button:has-text("Create")');

    // Verify category creation
    await expect(page.locator('text=Category created successfully')).toBeVisible();

    // Assign content to category
    await page.click('button:has-text("Assign Category")');
    await page.selectOption('select[name="category"]', 'Test Category');
    await page.click('button:has-text("Save")');

    // Verify category assignment
    await expect(page.locator('text=Category assigned successfully')).toBeVisible();
  });
}); 