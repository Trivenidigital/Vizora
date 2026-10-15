import { test, expect, apiPost, readData } from './fixtures/auth.fixture';

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

      const playlistName = `Test Playlist ${Date.now()}`;

      // Open the create dialog.
      await authenticatedPage.getByRole('button', { name: 'Create Playlist' }).first().click();

      /*
       * Everything below is scoped to the dialog. The old selector
       * (`input[name="name"], input[placeholder*="name" i], input[type="text"]`)
       * matched the page's own search box ("Search playlists by name...") first,
       * so the modal field stayed empty, "Create Playlist" stayed correctly
       * disabled, and the submit click timed out against a disabled button.
       */
      const dialog = authenticatedPage.getByRole('dialog', { name: 'Create New Playlist' });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await dialog.getByLabel('Playlist Name').fill(playlistName);
      await dialog.getByLabel('Description (Optional)').fill('Created by 18-playlist-builder e2e');

      const submit = dialog.getByRole('button', { name: 'Create Playlist' });
      await expect(submit).toBeEnabled();
      await submit.click();

      // The product closes the dialog and reloads the list in place; it does not
      // navigate to the builder.
      await expect(dialog).toBeHidden({ timeout: 10000 });
      await expect(authenticatedPage.getByText(playlistName).first()).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe('3-Panel Playlist Builder', () => {
    let playlistId: string;

    /*
     * Every test in this block used to skip itself. Two bugs made `playlistId`
     * permanently undefined, so all seven silently reported as skipped and the
     * playlist builder has never actually been exercised:
     *
     *   1. The POST sent only the auth cookie. CsrfMiddleware enforces a
     *      double-submit pair, so the request came back 403 and `response.ok()`
     *      was false. `apiPost` from the fixture sends both credentials.
     *   2. Even on success, the global ResponseEnvelopeInterceptor wraps every
     *      response as `{ success, data, meta }`, so `data.id` read `undefined`
     *      off the envelope rather than the playlist. `readData` unwraps it.
     *
     * Setup failure now FAILS rather than skipping. A test that quietly skips
     * itself when its fixture breaks reports green forever while covering
     * nothing, which is exactly how this block went unnoticed.
     */
    test.beforeEach(async ({ authenticatedPage, token }) => {
      const res = await apiPost(
        authenticatedPage,
        token,
        'http://localhost:3000/api/v1/playlists',
        { name: `Builder Test ${Date.now()}` },
      );
      expect(res.ok(), `playlist create failed: ${res.status()} ${await res.text()}`).toBeTruthy();

      const created = await readData<{ id: string }>(res);
      expect(created?.id, 'playlist create returned no id').toBeTruthy();
      playlistId = created.id;
    });

    test('should display 3-panel layout', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * Was `[class*="panel"], [class*="column"], [class*="grid"] > div` with
       * `count >= 2`. The builder is a `flex flex-col h-screen` layout and uses
       * none of those class names, so this counted zero — it only ever passed
       * because the whole block skipped itself (see the beforeEach).
       *
       * "3-panel" means the three regions are on screen together, so that is
       * what this asserts, using the same anchors the three sibling tests use
       * individually. Class names are not the contract; the regions are.
       */
      await expect(
        authenticatedPage.locator('text=/content library|available content|add content/i').first(),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        authenticatedPage.locator('text=/playlist items|sequence|order|playlist editor/i').first(),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        authenticatedPage.locator('text=/preview|live preview/i').first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test('should show content library panel', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for content library or available content section
      const contentLibrary = authenticatedPage.locator('text=/content library|available content|add content/i').first();
      await expect(contentLibrary).toBeVisible({ timeout: 10000 });
    });

    test('should show playlist editor panel', async ({ authenticatedPage }) => {
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
      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      const saveButton = authenticatedPage.locator('button').filter({ hasText: /save/i }).first();
      await expect(saveButton).toBeVisible({ timeout: 10000 });
    });

    test('should have undo/redo buttons', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/dashboard/playlists/${playlistId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * Both controls exist; the old selectors could not see them. They are
       * icon-only buttons whose ONLY label is a `title` ("Undo (Ctrl+Z)" /
       * "Redo (Ctrl+Y)") — no aria-label, no text, no test id. That is an a11y
       * gap reported rather than fixed here; `title` does serve as the
       * accessible name of last resort, so a role query by name finds them.
       *
       * Both are asserted, not "at least one": a builder with undo and no redo
       * is a defect, and the old `||` would have hidden it.
       */
      const undo = authenticatedPage.getByRole('button', { name: /undo/i });
      const redo = authenticatedPage.getByRole('button', { name: /redo/i });

      await expect(undo).toBeVisible({ timeout: 10000 });
      await expect(redo).toBeVisible({ timeout: 10000 });

      // Both start disabled on a freshly loaded playlist: nothing to undo yet.
      // This is the reach control — it proves the locators resolved the real
      // history controls and not some other button whose name contains "undo".
      await expect(undo).toBeDisabled();
      await expect(redo).toBeDisabled();
    });

    test('should support keyboard shortcuts for undo', async ({ authenticatedPage }) => {
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
