import type { Locator, Page } from '@playwright/test';
import { test, expect, apiPost, readData } from './fixtures/auth.fixture';

/**
 * Seed one display through the API.
 *
 * The auth fixture registers a BRAND-NEW organization per test, so
 * /dashboard/devices renders the "No devices yet" empty state unless the test
 * puts a device there. Every test in this file used to open with
 * `const hasPreview = await previewButton.isVisible().catch(() => false)` and
 * then guard its whole body on that flag — against an empty fleet the flag was
 * always false, so the bodies never ran and the assertions that survived were
 * `expect(hasPreview || true)`.
 *
 * Payload shape is the one the passing 03-displays spec uses: CreateDisplayDto
 * takes { name, deviceId } and maps them to nickname / deviceIdentifier. A
 * seeded device is `offline` (the column's default), which is the state the
 * preview modal's assertions below are written against.
 */
async function seedDisplay(page: Page, token: string): Promise<string> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await apiPost(page, token, 'http://localhost:3000/api/v1/displays', {
    name: `E2E Preview ${stamp}`,
    deviceId: `e2e-preview-${stamp}`,
    location: 'Test Location',
  });

  expect(res.ok(), `display create failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  const display = await readData(res);
  expect(display.nickname, 'created display must carry a nickname').toBeTruthy();
  return display.nickname;
}

/** The seeded display's row in the fleet table — not anywhere else on the page. */
const deviceRow = (page: Page, nickname: string): Locator =>
  page.locator('table.eh-datatable tbody tr').filter({ hasText: nickname });

/**
 * The preview dialog. Modal (web/src/components/Modal.tsx) renders
 * role="dialog" + aria-modal + an accessible name from its title, so this
 * resolves to one element and needs no `.modal` / `[data-testid]` fallbacks.
 */
const previewDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Device Preview' });

/*
 * Removed 2026-10-09: the whole 'Device List View Toggle' describe, i.e.
 * 'should have view toggle (grid/list)' (removed in an earlier pass) and
 * 'should switch between grid and list view'.
 *
 * Both asserted a grid/list view toggle on /dashboard/devices that has never
 * existed — `view-toggle`, `grid-view`, `list-view`, `grid-icon` and
 * `list-icon` appear nowhere in web/src, and the fleet list is a table with no
 * alternate layout. The second test skipped its body on the missing toggle and
 * closed on `expect(hasGridLayout || true)`, so it reported green against a
 * feature that was never built. Deleted rather than the feature built.
 */

test.describe('Device Preview & Screenshots (Wave 5)', () => {
  test.describe('Device Preview Modal', () => {
    test('should have preview button on device row', async ({ authenticatedPage, token }) => {
      const nickname = await seedDisplay(authenticatedPage, token);

      await authenticatedPage.goto('/dashboard/devices');
      await authenticatedPage.waitForLoadState('networkidle');

      const row = deviceRow(authenticatedPage, nickname);
      await expect(row).toHaveCount(1, { timeout: 10000 });
      await expect(row.getByRole('button', { name: `Preview ${nickname}` })).toBeVisible();
    });

    test('should open preview modal', async ({ authenticatedPage, token }) => {
      const nickname = await seedDisplay(authenticatedPage, token);

      await authenticatedPage.goto('/dashboard/devices');
      await authenticatedPage.waitForLoadState('networkidle');

      await deviceRow(authenticatedPage, nickname)
        .getByRole('button', { name: `Preview ${nickname}` })
        .click();

      const dialog = previewDialog(authenticatedPage);
      await expect(dialog).toBeVisible({ timeout: 10000 });
      // The dialog is about THIS device, not just any dialog.
      await expect(dialog.getByRole('heading', { name: nickname })).toBeVisible();
    });

    test('should show the screenshot empty state for a device that has never captured one', async ({
      authenticatedPage,
      token,
    }) => {
      const nickname = await seedDisplay(authenticatedPage, token);

      await authenticatedPage.goto('/dashboard/devices');
      await authenticatedPage.waitForLoadState('networkidle');

      await deviceRow(authenticatedPage, nickname)
        .getByRole('button', { name: `Preview ${nickname}` })
        .click();

      const dialog = previewDialog(authenticatedPage);
      await expect(dialog).toBeVisible({ timeout: 10000 });

      /*
       * `GET /displays/:id/screenshot` returns null for a display with no
       * stored screenshot, and the modal renders its empty state for that —
       * not an error, and not a fabricated image. A freshly seeded display is
       * exactly that case, so this is deterministic rather than
       * `expect(hasContent || hasLabel)` over a body that never ran.
       */
      await expect(dialog.getByText('No screenshot available yet')).toBeVisible({ timeout: 15000 });
      // The capture affordance is present but refuses, because the device is
      // offline — which is the honest state, not a disabled-looking no-op.
      await expect(dialog.getByRole('button', { name: 'Device is offline' })).toBeDisabled();
      await expect(dialog.locator('img')).toHaveCount(0);
    });

    test('should have refresh screenshot button, disabled while the device is offline', async ({
      authenticatedPage,
      token,
    }) => {
      const nickname = await seedDisplay(authenticatedPage, token);

      await authenticatedPage.goto('/dashboard/devices');
      await authenticatedPage.waitForLoadState('networkidle');

      await deviceRow(authenticatedPage, nickname)
        .getByRole('button', { name: `Preview ${nickname}` })
        .click();

      const dialog = previewDialog(authenticatedPage);
      await expect(dialog).toBeVisible({ timeout: 10000 });

      /*
       * Both halves of the contract. The button exists (the old test only ever
       * reached `expect(hasRefresh || true)`), and it is disabled for a
       * non-online device — `disabled={refreshing || device.status !== 'online'}`
       * — with the reason stated on screen. A screenshot cannot be captured
       * from a device that is not connected, so an enabled button here would be
       * a lie the operator would chase.
       */
      const refresh = dialog.getByRole('button', { name: 'Refresh Screenshot' });
      await expect(refresh).toBeVisible();
      await expect(refresh).toBeDisabled();
      await expect(
        dialog.getByText(/Screenshots can only be captured from online devices/i),
      ).toBeVisible();
    });

    test('should close modal on escape', async ({ authenticatedPage, token }) => {
      const nickname = await seedDisplay(authenticatedPage, token);

      await authenticatedPage.goto('/dashboard/devices');
      await authenticatedPage.waitForLoadState('networkidle');

      await deviceRow(authenticatedPage, nickname)
        .getByRole('button', { name: `Preview ${nickname}` })
        .click();

      const dialog = previewDialog(authenticatedPage);
      await expect(dialog).toBeVisible({ timeout: 10000 });

      await authenticatedPage.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  });

  test.describe('Quick Playlist Change', () => {
    test('should have playlist dropdown on device row', async ({ authenticatedPage, token }) => {
      const nickname = await seedDisplay(authenticatedPage, token);

      await authenticatedPage.goto('/dashboard/devices');
      await authenticatedPage.waitForLoadState('networkidle');

      const row = deviceRow(authenticatedPage, nickname);
      await expect(row).toHaveCount(1, { timeout: 10000 });

      /*
       * The control is PlaylistQuickSelect, in the "Assigned Playlist" column.
       * The old locator was `select, [data-testid="playlist-select"],
       * [data-testid="quick-change"]` taken page-wide and unscoped: `select`
       * matched the "Devices per page" control at the bottom of the page first,
       * so the test reported a per-row dropdown without ever looking at a row —
       * and then closed on `expect(hasSelect || true)` regardless.
       *
       * Scoped to the row and addressed by its accessible name, so it can only
       * pass on the real control.
       */
      const select = row.getByRole('combobox', { name: `Assigned playlist for ${nickname}` });
      await expect(select).toBeVisible();
      // A freshly seeded display has no assignment, so the empty option is the
      // selected one.
      await expect(select).toHaveValue('');
    });

    test('should show playlist options in dropdown', async ({ authenticatedPage, token }) => {
      const nickname = await seedDisplay(authenticatedPage, token);

      const playlistName = `E2E Preview Playlist ${Date.now()}`;
      const playlistRes = await apiPost(
        authenticatedPage,
        token,
        'http://localhost:3000/api/v1/playlists',
        { name: playlistName },
      );
      expect(
        playlistRes.ok(),
        `playlist create failed: ${playlistRes.status()} ${await playlistRes.text()}`,
      ).toBeTruthy();
      const playlist = await readData(playlistRes);
      expect(playlist.id, 'created playlist must carry an id').toBeTruthy();

      await authenticatedPage.goto('/dashboard/devices');
      await authenticatedPage.waitForLoadState('networkidle');

      const select = deviceRow(authenticatedPage, nickname).getByRole('combobox', {
        name: `Assigned playlist for ${nickname}`,
      });
      await expect(select).toBeVisible({ timeout: 10000 });

      // The org's playlists ARE the options, alongside the "No playlist"
      // clear-assignment option. Pinned by name rather than by a count, because
      // `expect(optionCount).toBeGreaterThanOrEqual(0)` — the old assertion —
      // passes on an empty dropdown too.
      await expect(select.getByRole('option', { name: 'No playlist' })).toHaveCount(1);
      await expect(select.getByRole('option', { name: playlistName })).toHaveCount(1);

      // Choosing one assigns it. ASSIGNMENT, not playback — the column is
      // headed "Assigned Playlist" and nothing here observes what the screen
      // renders.
      await select.selectOption(playlist.id);
      await expect(authenticatedPage.getByText('Playlist updated')).toBeVisible({ timeout: 10000 });

      await authenticatedPage.reload();
      await authenticatedPage.waitForLoadState('networkidle');
      await expect(
        deviceRow(authenticatedPage, nickname).getByRole('combobox', {
          name: `Assigned playlist for ${nickname}`,
        }),
      ).toHaveValue(playlist.id, { timeout: 10000 });
    });
  });
});
