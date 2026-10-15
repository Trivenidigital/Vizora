import { test, expect, apiPost, readData } from './fixtures/auth.fixture';

test.describe('Playlist Management', () => {
  test('should show playlists page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/playlists');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check page loaded with exact heading
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Playlists' })).toBeVisible({ timeout: 10000 });
    
    // Should have create button
    await expect(authenticatedPage.locator('button').filter({ hasText: /create|new/i }).first()).toBeVisible();
    
    // Visual regression
    // await expect(authenticatedPage).toHaveScreenshot('playlists-page.png', { maxDiffPixels: 100 });
  });

  test('should create new playlist', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/playlists');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Creating a playlist through the UI is launch-critical: every step must exist.
    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new/i }).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    const modal = authenticatedPage.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    await authenticatedPage.waitForTimeout(500);
    const playlistName = `Test Playlist ${Date.now()}`;
    // Scope to the modal: the page behind it has its own search input.
    const nameInput = modal.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(playlistName);

    // The modal is not a <form> — the confirm control is a plain button.
    const submitButton = modal.locator('button').filter({ hasText: /^\s*Create Playlist\s*$/ }).first();
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();

    // The new playlist must actually show up in the list.
    await expect(authenticatedPage.locator(`text="${playlistName}"`).first()).toBeVisible({ timeout: 10000 });
  });

  test('should add content to playlist', async ({ authenticatedPage, token }) => {
    // Create content and playlist via API
    const contentRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/content', {
      name: `Test Content ${Date.now()}`,
      type: 'image',
      url: 'https://example.com/test.jpg',
    });
    expect(contentRes.ok(), `content create failed: ${contentRes.status()} ${await contentRes.text()}`).toBeTruthy();
    const content = await readData(contentRes);
    expect(content.name, 'created content must carry a name').toBeTruthy();

    const playlistRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/playlists', {
      name: `Test Playlist ${Date.now()}`,
    });
    expect(playlistRes.ok(), `playlist create failed: ${playlistRes.status()} ${await playlistRes.text()}`).toBeTruthy();
    const playlist = await readData(playlistRes);
    expect(playlist.name, 'created playlist must carry a name').toBeTruthy();

    await authenticatedPage.goto('/dashboard/playlists');
    await authenticatedPage.waitForLoadState('networkidle');

    // The playlist just created must be listed, and its Edit action opens the
    // builder (the card title itself is not a link).
    await expect(authenticatedPage.locator(`text="${playlist.name}"`).first()).toBeVisible({ timeout: 10000 });
    await authenticatedPage.getByRole('button', { name: `Edit ${playlist.name}`, exact: true }).click();
    await expect(authenticatedPage).toHaveURL(new RegExp(`/dashboard/playlists/${playlist.id}$`), { timeout: 10000 });

    /*
     * The builder adds content by DRAG (dnd-kit): there is no "add content"
     * button, which is why the old body - guarded on one - never ran. Dropping
     * a library item on the editor calls addPlaylistItem immediately, so the
     * oracle is the API. dnd-kit's PointerSensor needs real intermediate mouse
     * moves; a single `dragTo` jump does not register as a drag.
     */
    const source = authenticatedPage.locator('[aria-roledescription="draggable"]').filter({ hasText: content.name });
    const target = authenticatedPage.getByText('Drag content from the library to build your playlist');
    await expect(source).toBeVisible({ timeout: 10000 });
    await expect(target).toBeVisible();

    const from = (await source.boundingBox())!;
    const to = (await target.boundingBox())!;
    await authenticatedPage.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await authenticatedPage.mouse.down();
    await authenticatedPage.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 5 });
    await authenticatedPage.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    await authenticatedPage.mouse.up();

    await expect(authenticatedPage.getByText('Empty Playlist')).toHaveCount(0, { timeout: 10000 });
    await expect(async () => {
      const res = await authenticatedPage.request.get(`http://localhost:3000/api/v1/playlists/${playlist.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok()).toBeTruthy();
      const fresh = await readData(res);
      expect((fresh.items ?? []).map((i: { contentId: string }) => i.contentId)).toEqual([content.id]);
    }).toPass({ timeout: 10000 });
  });

  /**
   * Renamed from "should reorder playlist items": it never performed a reorder.
   * Drag-and-drop reordering lives in the playlist builder and is not covered
   * here, so the name now matches what is actually asserted.
   */
  test('should render a playlist seeded with multiple items', async ({ authenticatedPage, token }) => {
    // Create playlist with multiple items via API
    const playlistRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/playlists', {
      name: `Test Playlist ${Date.now()}`,
    });
    expect(playlistRes.ok(), `playlist create failed: ${playlistRes.status()} ${await playlistRes.text()}`).toBeTruthy();
    const playlist = await readData(playlistRes);
    expect(playlist.id, 'created playlist must carry an id').toBeTruthy();

    // Seed two items so there is something orderable.
    for (let i = 0; i < 2; i++) {
      const contentRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/content', {
        name: `Test Content ${i} ${Date.now()}`,
        type: 'image',
        url: `https://example.com/test${i}.jpg`,
      });
      expect(contentRes.ok(), `content create failed: ${contentRes.status()} ${await contentRes.text()}`).toBeTruthy();

      const content = await readData(contentRes);
      const itemRes = await apiPost(
        authenticatedPage,
        token,
        `http://localhost:3000/api/v1/playlists/${playlist.id}/items`,
        // AddPlaylistItemDto takes only contentId + duration; order is server-assigned.
        { contentId: content.id, duration: 10 },
      );
      expect(itemRes.ok(), `playlist item add failed: ${itemRes.status()} ${await itemRes.text()}`).toBeTruthy();
    }

    await authenticatedPage.goto(`/dashboard/playlists`);
    await authenticatedPage.waitForLoadState('networkidle');

    // The card must report the two seeded items, not just render the page.
    const playlistCard = authenticatedPage.locator('.eh-dash-card').filter({ hasText: playlist.name }).first();
    await expect(playlistCard).toBeVisible({ timeout: 10000 });
    await expect(playlistCard).toContainText('2 items');
  });

  test('should assign playlist to display', async ({ authenticatedPage, token }) => {
    // Create display and playlist
    const displayRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/displays', {
      name: `Test Display ${Date.now()}`,
      deviceId: `e2e-gate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      location: 'Test',
    });
    expect(displayRes.ok(), `display create failed: ${displayRes.status()} ${await displayRes.text()}`).toBeTruthy();

    const display = await readData(displayRes);
    expect(display.nickname, 'created display must carry a nickname').toBeTruthy();

    const playlistRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/playlists', {
      name: `Test Playlist ${Date.now()}`,
    });
    expect(playlistRes.ok(), `playlist create failed: ${playlistRes.status()} ${await playlistRes.text()}`).toBeTruthy();

    const playlist = await readData(playlistRes);
    expect(playlist.name, 'created playlist must carry a name').toBeTruthy();

    // An empty playlist is deliberately not assignable ("Add content to this playlist
    // before assigning it"), so seed one item before exercising the assign flow.
    const itemContentRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/content', {
      name: `Test Content ${Date.now()}`,
      type: 'image',
      url: 'https://example.com/test.jpg',
    });
    expect(itemContentRes.ok(), `content create failed: ${itemContentRes.status()} ${await itemContentRes.text()}`).toBeTruthy();
    const itemContent = await readData(itemContentRes);

    const addItemRes = await apiPost(
      authenticatedPage,
      token,
      `http://localhost:3000/api/v1/playlists/${playlist.id}/items`,
      { contentId: itemContent.id, duration: 10 },
    );
    expect(addItemRes.ok(), `playlist item add failed: ${addItemRes.status()} ${await addItemRes.text()}`).toBeTruthy();

    await authenticatedPage.goto('/dashboard/playlists');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for the playlist card in the list
    const playlistCard = authenticatedPage.locator('.eh-dash-card').filter({ hasText: playlist.name }).first();
    await expect(playlistCard).toBeVisible({ timeout: 10000 });

    // Look for assign/push button on this playlist's card
    const assignButton = playlistCard.locator('button').filter({ hasText: /assign|push/i }).first();

    await expect(assignButton).toBeVisible({ timeout: 5000 });
    await assignButton.click();

    // Everything below must be scoped to the dialog: an unscoped "assign" match
    // resolves to the card's own Assign button, which the modal overlay covers.
    const dialog = authenticatedPage.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // The display created above must be offered as an assignment target.
    const displayOption = dialog.locator(`text="${display.nickname}"`).first();
    await expect(displayOption).toBeVisible({ timeout: 5000 });
    await displayOption.click();

    const confirmButton = dialog.locator('button').filter({ hasText: /assign|push|confirm/i }).last();
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    await confirmButton.click();

    // The assignment must be acknowledged, not silently dropped.
    await expect(dialog).toBeHidden({ timeout: 10000 });
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Playlists' })).toBeVisible();

    // The real oracle: the operator's assignment is persisted on the display.
    // `currentPlaylistId` is the assignment and nothing more — assigned != delivered
    // != acknowledged != playing — so this asserts assignment only.
    await expect(async () => {
      const check = await authenticatedPage.request.get(
        `http://localhost:3000/api/v1/displays/${display.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(check.ok(), `display fetch failed: ${check.status()}`).toBeTruthy();
      const fresh = await readData(check);
      expect(fresh.currentPlaylistId, 'assignment must be persisted on the display').toBe(playlist.id);
    }).toPass({ timeout: 10000 });
  });

  test('should delete playlist', async ({ authenticatedPage, token }) => {
    // Create playlist
    const playlistRes = await apiPost(authenticatedPage, token, 'http://localhost:3000/api/v1/playlists', {
      name: `Test Playlist ${Date.now()}`,
    });
    expect(playlistRes.ok(), `playlist create failed: ${playlistRes.status()} ${await playlistRes.text()}`).toBeTruthy();
    const playlist = await readData(playlistRes);
    expect(playlist.name, 'created playlist must carry a name').toBeTruthy();

    await authenticatedPage.goto('/dashboard/playlists');
    await authenticatedPage.waitForLoadState('networkidle');

    // The playlist just created must be listed, then must be deletable.
    // Playlists render as `.eh-dash-card` cards, so scope to the card, not to
    // two DOM levels above the name.
    const playlistCard = authenticatedPage.locator('.eh-dash-card').filter({ hasText: playlist.name }).first();
    await expect(playlistCard).toBeVisible({ timeout: 10000 });

    const deleteButton = playlistCard.locator('button').filter({ hasText: /delete/i }).first();
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // Deletion is confirmed in a named dialog that states what is deleted.
    const confirm = authenticatedPage.getByRole('dialog', { name: 'Delete Playlist' });
    await expect(confirm).toBeVisible({ timeout: 5000 });
    await expect(confirm).toContainText(playlist.name);
    await confirm.getByRole('button', { name: /^(confirm|delete)$/i }).click();
    await expect(confirm).toBeHidden({ timeout: 10000 });

    // The deleted playlist must actually disappear from the list.
    await expect(authenticatedPage.locator('text=' + playlist.name)).toHaveCount(0, { timeout: 10000 });
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Playlists' })).toBeVisible();
  });
});
