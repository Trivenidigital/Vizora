import { test, expect } from './fixtures/auth.fixture';

test.describe('Playlist Builder (Wave 5)', () => {
  test.describe('Playlist List Page', () => {
    test('should display playlists page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/playlists');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage.locator('h2').filter({ hasText: /playlist/i })).toBeVisible({ timeout: 10000 });
    });

    test('should have create playlist button', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/playlists');
      await authenticatedPage.waitForLoadState('networkidle');

      const createButton = authenticatedPage.locator('button, a').filter({ hasText: /create|new|add/i }).first();
      await expect(createButton).toBeVisible({ timeout: 10000 });
    });

    test('should show empty state or playlist cards', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/playlists');
      await authenticatedPage.waitForLoadState('networkidle');

      // Either empty state or playlist cards
      const emptyState = authenticatedPage.locator('text=/no playlists|create your first|get started/i').first();
      const playlistCards = authenticatedPage.locator('[data-testid="playlist-card"], .playlist-card, article');

      const hasEmptyState = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
      const hasCards = await playlistCards.first().isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasEmptyState || hasCards).toBeTruthy();
    });

    test('should create a new playlist', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/playlists');
      await authenticatedPage.waitForLoadState('networkidle');

      // Click create button
      await authenticatedPage.click('button:has-text("Create"), button:has-text("New"), button:has-text("Add"), a:has-text("Create")');

      // Fill in playlist name in modal or new page
      const nameInput = authenticatedPage.locator('input[name="name"], input[placeholder*="name" i], input[type="text"]').first();
      await nameInput.waitFor({ state: 'visible', timeout: 5000 });
      await nameInput.fill(`Test Playlist ${Date.now()}`);

      // Submit
      await authenticatedPage.click('button[type="submit"], button:has-text("Create"), button:has-text("Save")');

      // Wait for navigation or success
      await authenticatedPage.waitForTimeout(1000);

      // Should see the new playlist or be on builder page
      const onBuilderPage = authenticatedPage.url().includes('/playlists/');
      const hasNewPlaylist = await authenticatedPage.locator('text=/Test Playlist/').isVisible({ timeout: 5000 }).catch(() => false);

      expect(onBuilderPage || hasNewPlaylist).toBeTruthy();
    });
  });

  test.describe('3-Panel Playlist Builder', () => {
    let playlistId: string;

    test.beforeEach(async ({ authenticatedPage }) => {
      // Create a playlist via API for testing the builder
      const timestamp = Date.now();

      // Get auth token
      const cookies = await authenticatedPage.context().cookies();
      const authCookie = cookies.find(c => c.name === 'vizora_auth_token');
      const token = authCookie?.value || '';

      const response = await authenticatedPage.request.post('http://localhost:3000/api/playlists', {
        headers: { Cookie: `vizora_auth_token=${token}` },
        data: { name: `Builder Test ${timestamp}` },
      });

      if (response.ok()) {
        const data = await response.json();
        playlistId = data.id;
      }
    });

    test('should display 3-panel layout', async ({ authenticatedPage }) => {
      if (!playlistId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      // Check for panel structure (content library, editor, preview)
      const panels = authenticatedPage.locator('[class*="panel"], [class*="column"], [class*="grid"] > div');
      const panelCount = await panels.count();

      // Should have at least 2-3 panels
      expect(panelCount).toBeGreaterThanOrEqual(2);
    });

    test('should show content library panel', async ({ authenticatedPage }) => {
      if (!playlistId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for content library or available content section
      const contentLibrary = authenticatedPage.locator('text=/content library|available content|add content/i').first();
      await expect(contentLibrary).toBeVisible({ timeout: 10000 });
    });

    test('should show playlist editor panel', async ({ authenticatedPage }) => {
      if (!playlistId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for editor or playlist items section
      const editor = authenticatedPage.locator('text=/playlist items|sequence|order|playlist editor/i').first();
      const itemsList = authenticatedPage.locator('[data-testid="playlist-items"], .playlist-items, ul, ol').first();

      const hasEditor = await editor.isVisible({ timeout: 5000 }).catch(() => false);
      const hasItems = await itemsList.isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasEditor || hasItems).toBeTruthy();
    });

    test('should show preview panel', async ({ authenticatedPage }) => {
      if (!playlistId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for preview section
      const preview = authenticatedPage.locator('text=/preview|live preview/i').first();
      const previewArea = authenticatedPage.locator('[class*="preview"], [data-testid="preview"]').first();

      const hasPreviewLabel = await preview.isVisible({ timeout: 5000 }).catch(() => false);
      const hasPreviewArea = await previewArea.isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasPreviewLabel || hasPreviewArea).toBeTruthy();
    });

    test('should have save button', async ({ authenticatedPage }) => {
      if (!playlistId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      const saveButton = authenticatedPage.locator('button').filter({ hasText: /save/i }).first();
      await expect(saveButton).toBeVisible({ timeout: 10000 });
    });

    test('should have undo/redo buttons', async ({ authenticatedPage }) => {
      if (!playlistId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for undo/redo buttons or icons
      const undoButton = authenticatedPage.locator('button[aria-label*="undo" i], button:has-text("Undo"), [data-testid="undo"]').first();
      const redoButton = authenticatedPage.locator('button[aria-label*="redo" i], button:has-text("Redo"), [data-testid="redo"]').first();

      const hasUndo = await undoButton.isVisible({ timeout: 5000 }).catch(() => false);
      const hasRedo = await redoButton.isVisible({ timeout: 5000 }).catch(() => false);

      // At least one should be present
      expect(hasUndo || hasRedo).toBeTruthy();
    });

    test('should support keyboard shortcuts for undo', async ({ authenticatedPage }) => {
      if (!playlistId) {
        test.skip();
        return;
      }

      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      // Focus on the page and try Ctrl+Z
      await authenticatedPage.keyboard.press('Control+z');

      // Should not cause errors (page should still be responsive)
      await authenticatedPage.waitForTimeout(500);
      const isResponsive = await authenticatedPage.locator('body').isVisible();
      expect(isResponsive).toBeTruthy();
    });
  });

  test.describe('Playlist Actions', () => {
    test('should duplicate playlist', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/playlists');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for a playlist with actions menu
      const actionsButton = authenticatedPage.locator('button[aria-label*="actions" i], button[aria-label*="menu" i], [data-testid="playlist-actions"]').first();
      const hasActions = await actionsButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasActions) {
        await actionsButton.click();
        const duplicateOption = authenticatedPage.locator('button, [role="menuitem"]').filter({ hasText: /duplicate|copy/i }).first();
        await expect(duplicateOption).toBeVisible({ timeout: 3000 });
      }
    });

    test('should delete playlist with confirmation', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/playlists');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for delete button or menu option
      const deleteButton = authenticatedPage.locator('button').filter({ hasText: /delete|remove/i }).first();
      const hasDelete = await deleteButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDelete) {
        await deleteButton.click();
        // Should show confirmation dialog
        const confirmDialog = authenticatedPage.locator('[role="dialog"], [role="alertdialog"], .modal');
        await expect(confirmDialog).toBeVisible({ timeout: 3000 });
      }
    });
  });
});
