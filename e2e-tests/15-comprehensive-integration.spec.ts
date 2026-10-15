import { test, expect } from './fixtures/auth.fixture';
import { apiGet, seedContent, seedDisplay, seedDisplayGroup, seedPlaylist, seedTag, tagContent } from './fixtures/seed';

/**
 * COMPREHENSIVE INTEGRATION TEST SUITE - PHASE 6-7 FEATURES
 *
 * BMAD Method Coverage:
 * ├─ Boundary Tests: Cross-feature interactions, data boundaries
 * ├─ Mutation Tests: State changes across features
 * ├─ Adversarial Tests: Feature conflicts, race conditions
 * └─ Domain Tests: Business workflows, feature integration
 *
 * Test Coverage: 20 critical integration test cases
 */

test.describe('Comprehensive Integration Tests - Phases 6-7', () => {

  test('should navigate between features through the sidebar (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');
    await expect(authenticatedPage.getByRole('heading', { level: 2, name: 'Device Health' })).toBeVisible({ timeout: 10000 });

    // Schedules is in the nav only when SCHEDULES_ENABLED is built on, which
    // the e2e stack requires; a missing link here is an environment failure.
    const hops: Array<[string, RegExp, string]> = [
      ['Schedules', /\/dashboard\/schedules$/, 'Schedules'],
      ['Devices', /\/dashboard\/devices$/, 'Devices'],
      ['Analytics', /\/dashboard\/analytics$/, 'Analytics'],
      ['Content', /\/dashboard\/content$/, 'Content Library'],
      ['Schedules', /\/dashboard\/schedules$/, 'Schedules'],
    ];
    for (const [link, url, heading] of hops) {
      await authenticatedPage.getByRole('link', { name: link, exact: true }).click();
      await expect(authenticatedPage).toHaveURL(url);
      await expect(authenticatedPage.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible({ timeout: 10000 });
    }
  });

  test('should use the command palette to hop between features (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const search = authenticatedPage.getByPlaceholder('Search commands...');
    const hops: Array<[string, RegExp, string]> = [
      ['schedules', /\/dashboard\/schedules$/, 'Schedules'],
      ['analytics', /\/dashboard\/analytics$/, 'Analytics'],
      ['content', /\/dashboard\/content$/, 'Content Library'],
    ];
    for (const [query, url, heading] of hops) {
      await authenticatedPage.keyboard.press('Control+k');
      await expect(search).toBeVisible({ timeout: 5000 });
      await search.fill(query);
      // The highlighted option is the one Enter will run.
      await expect(authenticatedPage.getByRole('option', { selected: true })).toContainText(`Go to ${heading === 'Content Library' ? 'Content' : heading}`);
      await authenticatedPage.keyboard.press('Enter');
      await expect(authenticatedPage).toHaveURL(url);
      await expect(authenticatedPage.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible({ timeout: 10000 });
      await expect(search).toBeHidden();
    }
  });

  test('should filter content by tag and search simultaneously (MUTATION)', async ({ authenticatedPage, token }) => {
    const stamp = Date.now();
    const hit = await seedContent(authenticatedPage, token, { name: `Alpha Promo ${stamp}` });
    const taggedMiss = await seedContent(authenticatedPage, token, { name: `Beta Promo ${stamp}` });
    const searchMiss = await seedContent(authenticatedPage, token, { name: `Alpha Plain ${stamp}` });
    const tag = await seedTag(authenticatedPage, token, { name: `Promo ${stamp}` });
    await tagContent(authenticatedPage, token, [hit.id, taggedMiss.id], [tag.id]);

    await authenticatedPage.goto('/dashboard/content');
    await authenticatedPage.waitForLoadState('networkidle');
    await authenticatedPage.getByRole('button', { name: 'List view' }).click();
    const rows = authenticatedPage.locator('table tbody tr');
    await expect(rows).toHaveCount(3, { timeout: 10000 });

    await authenticatedPage.getByRole('button', { name: /^Tags( \(\d+\))?$/ }).click();
    await authenticatedPage.getByRole('button', { name: tag.name, exact: true }).click();
    await expect(rows).toHaveCount(2, { timeout: 10000 });

    await authenticatedPage.getByPlaceholder('Search content by title...').fill('alpha');
    await expect(rows).toHaveCount(1, { timeout: 10000 });
    await expect(rows.first()).toContainText(hit.name);
    await expect(authenticatedPage.getByText(searchMiss.name)).toHaveCount(0);
  });

  test('should keep each device status visible while filtering by group (DOMAIN)', async ({ authenticatedPage, token }) => {
    const online = await seedDisplay(authenticatedPage, token, { status: 'online' });
    const error = await seedDisplay(authenticatedPage, token, { status: 'error' });
    const outside = await seedDisplay(authenticatedPage, token, { status: 'offline' });
    const group = await seedDisplayGroup(authenticatedPage, token, { name: `Floor ${Date.now()}`, displayIds: [online.id, error.id] });

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');
    await authenticatedPage.getByRole('button', { name: 'Device Groups (1)' }).click();
    await authenticatedPage.locator('#device-group-filter').getByRole('checkbox', { name: new RegExp(`^${group.name}`) }).check();

    const rows = authenticatedPage.locator('table.eh-datatable tbody tr');
    await expect(rows).toHaveCount(2);
    const badge = (name: string) => rows.filter({ hasText: name }).locator('td[data-label="Status"] span[title]');
    await expect(badge(online.name)).toHaveText('Online');
    await expect(badge(error.name)).toHaveText('Error');
    await expect(rows.filter({ hasText: outside.name })).toHaveCount(0);

    // The status chips stay fleet-wide while the table is filtered.
    await expect(
      authenticatedPage.getByRole('group', { name: /Filter devices by status/ }).getByRole('button', { name: /All devices$/ }),
    ).toHaveText(/3\s*All devices/);
  });

  test('should create a schedule targeting a device group (MUTATION)', async ({ authenticatedPage, token }) => {
    const playlist = await seedPlaylist(authenticatedPage, token);
    const display = await seedDisplay(authenticatedPage, token);
    const group = await seedDisplayGroup(authenticatedPage, token, { name: `Region ${Date.now()}`, displayIds: [display.id] });
    const name = `Group Schedule ${Date.now()}`;

    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');
    await authenticatedPage.getByRole('button', { name: 'Create Schedule' }).first().click();
    const dialog = authenticatedPage.getByRole('dialog', { name: 'Create Schedule' });
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder('e.g., Morning Content, Holiday Special').fill(name);
    await dialog.locator('select').first().selectOption({ label: playlist.name });
    await dialog.getByRole('button', { name: 'Device Group' }).click();
    const groupSelect = dialog.locator('select').filter({ has: authenticatedPage.locator('option', { hasText: 'Select a group...' }) });
    await groupSelect.selectOption({ label: `${group.name} (1 devices)` });
    await dialog.getByRole('button', { name: /^create$/i }).click();

    await expect(dialog).toBeHidden({ timeout: 10000 });
    const card = authenticatedPage.locator('div.eh-dash-card').filter({ has: authenticatedPage.getByRole('heading', { level: 3, name }) });
    await expect(card).toContainText(`${group.name} (1 devices)`);

    const schedules = await apiGet<{ data: Array<{ name: string; displayGroupId: string | null; displayId: string | null }> }>(
      authenticatedPage,
      token,
      '/schedules?page=1&limit=50',
    );
    expect(schedules.data).toEqual([expect.objectContaining({ name, displayGroupId: group.id, displayId: null })]);
  });

  test('should combine device search with a group filter (MUTATION)', async ({ authenticatedPage, token }) => {
    const stamp = Date.now();
    const a = await seedDisplay(authenticatedPage, token, { name: `Lobby A ${stamp}` });
    const b = await seedDisplay(authenticatedPage, token, { name: `Kitchen B ${stamp}` });
    const c = await seedDisplay(authenticatedPage, token, { name: `Lobby C ${stamp}` });
    const group = await seedDisplayGroup(authenticatedPage, token, { name: `Ground ${stamp}`, displayIds: [a.id, b.id] });

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');
    const rows = authenticatedPage.locator('table.eh-datatable tbody tr');
    await expect(rows).toHaveCount(3, { timeout: 10000 });

    await authenticatedPage.getByPlaceholder('Search devices by name or location...').fill('lobby');
    await expect(rows).toHaveCount(2);

    await authenticatedPage.getByRole('button', { name: 'Device Groups (1)' }).click();
    await authenticatedPage.locator('#device-group-filter').getByRole('checkbox', { name: new RegExp(`^${group.name}`) }).check();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(a.name);
    await expect(rows.filter({ hasText: c.name })).toHaveCount(0);
  });

  test('should combine content search with a type filter (ADVERSARIAL)', async ({ authenticatedPage, token }) => {
    const stamp = Date.now();
    const imagePromo = await seedContent(authenticatedPage, token, { name: `Promo Shot ${stamp}`, type: 'image' });
    await seedContent(authenticatedPage, token, { name: `Promo Link ${stamp}`, type: 'url' });
    await seedContent(authenticatedPage, token, { name: `Other Shot ${stamp}`, type: 'image' });

    await authenticatedPage.goto('/dashboard/content');
    await authenticatedPage.waitForLoadState('networkidle');
    await authenticatedPage.getByRole('button', { name: 'List view' }).click();
    const rows = authenticatedPage.locator('table tbody tr');
    await expect(rows).toHaveCount(3, { timeout: 10000 });

    await authenticatedPage.getByPlaceholder('Search content by title...').fill('promo');
    await expect(rows).toHaveCount(2, { timeout: 10000 });
    await authenticatedPage.getByRole('button', { name: 'Image', exact: true }).click();
    await expect(rows).toHaveCount(1, { timeout: 10000 });
    await expect(rows.first()).toContainText(imagePromo.name);
    await expect(authenticatedPage.getByText('Type: image')).toBeVisible();

    // "Clear all" drops every filter at once.
    await authenticatedPage.getByRole('button', { name: 'Clear all' }).click();
    await expect(rows).toHaveCount(3, { timeout: 10000 });
  });

  test('should navigate full feature workflow (DOMAIN)', async ({ authenticatedPage }) => {
    const pages = [
      '/dashboard',
      '/dashboard/devices',
      '/dashboard/content',
      '/dashboard/schedules',
      '/dashboard/analytics',
      '/dashboard/health',
    ];

    for (const page of pages) {
      await authenticatedPage.goto(page);
      await authenticatedPage.waitForLoadState('networkidle');

      // Each page must render a heading. (h1 or h2: the gated schedules route
      // renders its notice as an h1 — see the SCHEDULES_ENABLED note in 06.)
      await expect(authenticatedPage.locator('h1, h2').first(), `${page} must render a heading`).toBeVisible({ timeout: 5000 });
    }
  });

  test('should maintain authentication across all features (DOMAIN)', async ({ authenticatedPage, token }) => {
    // Token should be valid
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(0);

    // Navigate to different pages and verify auth works
    const pages = ['/dashboard', '/dashboard/devices', '/dashboard/content'];

    for (const page of pages) {
      await authenticatedPage.goto(page);
      await authenticatedPage.waitForLoadState('networkidle');

      // Should not be redirected to login
      const url = authenticatedPage.url();
      expect(url).not.toContain('/login');
      expect(url).toContain('localhost');
    }
  });

  test('should handle page reload while on feature pages (ADVERSARIAL)', async ({ authenticatedPage }) => {
    const pages = ['/dashboard/health', '/dashboard/schedules', '/dashboard/devices'];

    for (const page of pages) {
      await authenticatedPage.goto(page);
      await authenticatedPage.waitForLoadState('networkidle');

      // Reload page
      await authenticatedPage.reload();
      await authenticatedPage.waitForLoadState('networkidle');

      // Page must still render after a reload.
      await expect(authenticatedPage.locator('h1, h2').first(), `${page} must render a heading after reload`).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle viewport resize across features (BOUNDARY)', async ({ authenticatedPage }) => {
    const pages = ['/dashboard/devices', '/dashboard/health', '/dashboard/content'];

    for (const page of pages) {
      await authenticatedPage.goto(page);
      await authenticatedPage.waitForLoadState('networkidle');

      // Resize to tablet
      await authenticatedPage.setViewportSize({ width: 768, height: 1024 });
      await authenticatedPage.waitForTimeout(500);

      // Resize to mobile
      await authenticatedPage.setViewportSize({ width: 375, height: 667 });
      await authenticatedPage.waitForTimeout(500);

      // Resize back to desktop
      await authenticatedPage.setViewportSize({ width: 1280, height: 720 });
      await authenticatedPage.waitForLoadState('networkidle');

      // Page must survive the resize round-trip.
      await expect(authenticatedPage.locator('h1, h2').first(), `${page} must render a heading after resize`).toBeVisible({ timeout: 5000 });
    }
  });

  test('should maintain state through rapid navigation (ADVERSARIAL)', async ({ authenticatedPage }) => {
    const pages = ['/dashboard', '/dashboard/devices', '/dashboard/content', '/dashboard/health', '/dashboard/schedules'];

    // Rapidly navigate through pages
    for (const page of pages) {
      await authenticatedPage.goto(page);
      await authenticatedPage.waitForTimeout(300);
    }

    // Final page should load properly (h1 or h2 — see the heading note above).
    const finalHeading = authenticatedPage.locator('h1, h2').first();
    await expect(finalHeading).toBeVisible({ timeout: 5000 });
  });

  test('should work without JavaScript errors across features (DOMAIN)', async ({ authenticatedPage }) => {
    const pages = ['/dashboard', '/dashboard/devices', '/dashboard/content', '/dashboard/health'];

    const errors: string[] = [];

    // Listen for console errors
    authenticatedPage.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    for (const page of pages) {
      await authenticatedPage.goto(page);
      await authenticatedPage.waitForLoadState('networkidle');
    }

    // A TypeError/ReferenceError on a dashboard page is a real bug, not noise.
    const criticalErrors = errors.filter(e =>
      e.includes('TypeError') ||
      e.includes('ReferenceError') ||
      e.includes('Cannot read property')
    );

    expect(criticalErrors, `dashboard pages emitted JS errors:\n${criticalErrors.join('\n')}`).toHaveLength(0);
  });
});
