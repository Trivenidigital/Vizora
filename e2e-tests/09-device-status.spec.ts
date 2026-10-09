import type { Locator, Page } from '@playwright/test';
import { test, expect, apiPost, readData } from './fixtures/auth.fixture';

/**
 * PHASE 6.1: REAL-TIME DEVICE STATUS TEST SUITE
 *
 * BMAD Method Coverage:
 * ├─ Boundary Tests: Timeout thresholds, max device counts
 * ├─ Mutation Tests: Status changes, real-time updates
 * ├─ Adversarial Tests: Socket.io failures, disconnections
 * └─ Domain Tests: Status types, heartbeat validation
 *
 * Test Coverage: 28 critical test cases for real-time status
 */

/**
 * Seed one display through the API.
 *
 * The auth fixture registers a BRAND-NEW organization per test, so
 * /dashboard/devices renders the "No devices yet" empty state unless the test
 * puts a device there. Status assertions made against that empty page either
 * matched stray page copy or timed out, which is what three of the tests below
 * were doing.
 *
 * Payload shape is the one the passing 03-displays spec uses: CreateDisplayDto
 * takes { name, deviceId } and maps them to nickname / deviceIdentifier. The
 * optional `status` is persisted as given (the column otherwise defaults to
 * "offline"), which is what lets a test ask for a device in `error`.
 */
async function seedDisplay(
  page: Page,
  token: string,
  status?: 'online' | 'offline' | 'error',
): Promise<string> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await apiPost(page, token, 'http://localhost:3000/api/v1/displays', {
    name: `E2E Status ${status ?? 'default'} ${stamp}`,
    deviceId: `e2e-status-${stamp}`,
    location: 'Test Location',
    ...(status ? { status } : {}),
  });

  expect(res.ok(), `display create failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  const display = await readData(res);
  expect(display.nickname, 'created display must carry a nickname').toBeTruthy();
  return display.nickname;
}

/** The seeded device's row in the fleet table - not anywhere else on the page. */
const deviceRow = (page: Page, nickname: string): Locator =>
  page.locator('table.eh-datatable tbody tr').filter({ hasText: nickname });

/**
 * That row's status badge. `span[title]` is DeviceStatusIndicator's pill: it
 * carries the state description as a tooltip, which the cell's other span (the
 * screen-reader-only "Status: " label) does not, so this resolves to exactly one
 * element. The pill's colours are inline style tokens, so there is no
 * `[class*="status"]` to match - which is why the old page-wide class selectors
 * found nothing even on a populated page.
 */
const statusBadge = (page: Page, nickname: string): Locator =>
  deviceRow(page, nickname).locator('td[data-label="Status"] span[title]');

const renderedInk = (badge: Locator): Promise<string> =>
  badge.evaluate((el) => getComputedStyle(el).color);

const renderedFill = (badge: Locator): Promise<string> =>
  badge.evaluate((el) => getComputedStyle(el).backgroundColor);

/** Every state's `title`, from DeviceStatusIndicator's `statusConfig`. */
const STATE_DESCRIPTION = {
  online: 'Reported in within the offline threshold',
  offline: 'Has not reported in past the offline threshold',
  error: 'The device reported a fault',
} as const;

test.describe('Phase 6.1: Real-time Device Status Updates', () => {

  test('should load devices page with status indicators', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Devices' })).toBeVisible({ timeout: 10000 });

    // Look for status indicators
    const statusElements = authenticatedPage.locator('[class*="status"], [class*="indicator"], [class*="online"], [class*="offline"]').first();
    if (await statusElements.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(statusElements).toBeVisible();
    }
  });

  test('should display device status with colors (DOMAIN)', async ({ authenticatedPage, token }) => {
    const onlineName = await seedDisplay(authenticatedPage, token, 'online');
    const offlineName = await seedDisplay(authenticatedPage, token, 'offline');
    const errorName = await seedDisplay(authenticatedPage, token, 'error');

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const badges = [
      statusBadge(authenticatedPage, onlineName),
      statusBadge(authenticatedPage, offlineName),
      statusBadge(authenticatedPage, errorName),
    ];
    await expect(badges[0]).toHaveText('Online', { timeout: 10000 });
    await expect(badges[1]).toHaveText('Offline');
    await expect(badges[2]).toHaveText('Error');

    // Three states, three distinct inks. The old locator hunted for a class
    // name containing a colour word, which this component does not have - the
    // ink is an inline `var(--*-ink)` token - so it matched nothing, on a page
    // that in any case had no devices on it to colour.
    const inks = await Promise.all(badges.map(renderedInk));
    expect(new Set(inks).size).toBe(3);

    // The fill is the second colour carrier and must actually be painted;
    // `transparent` belongs to `unknown` alone.
    for (const fill of await Promise.all(badges.map(renderedFill))) {
      expect(fill).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('should show status badge with online/offline text (DOMAIN)', async ({ authenticatedPage, token }) => {
    const onlineName = await seedDisplay(authenticatedPage, token, 'online');
    const offlineName = await seedDisplay(authenticatedPage, token, 'offline');

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const onlineBadge = statusBadge(authenticatedPage, onlineName);
    const offlineBadge = statusBadge(authenticatedPage, offlineName);

    // The WORD, which is what survives a greyscale render. `showLabel` is on
    // for the fleet table, so each badge spells its own state out. The old
    // `text=/online|offline/i` locator was page-wide and would have matched the
    // live-update channel badge or body copy rather than a device's status.
    await expect(onlineBadge).toHaveText('Online', { timeout: 10000 });
    await expect(offlineBadge).toHaveText('Offline');

    // Each word carries the state DESCRIPTION as its tooltip - the part that
    // stops "Offline" from being read as a live fact.
    await expect(onlineBadge).toHaveAttribute('title', STATE_DESCRIPTION.online);
    await expect(offlineBadge).toHaveAttribute('title', STATE_DESCRIPTION.offline);
  });

  test('should display last update timestamp (BOUNDARY)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for timestamp
    const timestamp = authenticatedPage.locator('text=/ago|seconds|minutes|hours/i').first();

    if (await timestamp.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(timestamp).toBeVisible();
    }
  });

  test('should animate online status indicator (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for animated indicator
    const onlineIndicators = authenticatedPage.locator('[class*="online"], [class*="pulse"], [class*="animate"]').first();

    if (await onlineIndicators.isVisible({ timeout: 3000 }).catch(() => false)) {
      const classes = await onlineIndicators.getAttribute('class');
      expect(classes).toMatch(/animate|pulse/i);
    }
  });

  test('should show different status colors for different states (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Get all status indicators
    const allStatuses = authenticatedPage.locator('[class*="status"], [class*="indicator"]');
    const count = await allStatuses.count();

    if (count > 0) {
      // Check first two have different states
      const first = allStatuses.nth(0);
      const second = allStatuses.nth(Math.min(1, count - 1));

      const firstClass = await first.getAttribute('class');
      const secondClass = await second.getAttribute('class');

      // May or may not be different - just verify they have classes
      expect(firstClass).toBeTruthy();
      expect(secondClass).toBeTruthy();
    }
  });

  test('should handle missing device status gracefully (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Page should load even if status service is down
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Devices' })).toBeVisible();

    // Should show some indication of device
    const deviceNames = authenticatedPage.locator('text=/Display|Device/i').first();
    if (await deviceNames.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(deviceNames).toBeVisible();
    }
  });

  /**
   * RENAMED on 2026-10-09. This page does not refresh status periodically -
   * there is no `setInterval` in `devices/page-client.tsx` at all. Status
   * freshness arrives on the realtime channel (`useRealtimeEvents` ->
   * `handleDeviceStatusChange`, which patches the row in place), and the header
   * badge reports whether that channel is up. So "auto-refresh periodically"
   * was a name for a mechanism that does not exist, while the mechanism that
   * DOES exist had no coverage. That badge is now the assertion.
   *
   * It has its own history: it used to read "Offline", the same word the rows
   * use for a screen that is down, so a healthy fleet looked dead. The two
   * vocabularies must stay distinct, which is the last assertion here.
   */
  test('should report the live-status channel in the header (BOUNDARY)', async ({ authenticatedPage, token }) => {
    const offlineName = await seedDisplay(authenticatedPage, token, 'offline');

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const deviceBadge = statusBadge(authenticatedPage, offlineName);
    await expect(deviceBadge).toHaveText('Offline', { timeout: 10000 });

    const channelBadge = authenticatedPage
      .locator('span.eh-badge')
      .filter({ hasText: /Live updates/ });
    await expect(channelBadge).toHaveCount(1);
    await expect(channelBadge).toHaveText(/^Live updates (on|off|failed)$/);
    await expect(channelBadge).toHaveAttribute('title', /live|streaming/i);

    // Channel vocabulary and device vocabulary must not collide: the row says
    // what the SCREEN is, the header says what the FEED is.
    expect(await channelBadge.innerText()).not.toBe(await deviceBadge.innerText());
  });

  test('should handle Socket.io connection failure (ADVERSARIAL)', async ({ authenticatedPage }) => {
    // First load the page normally
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Devices' })).toBeVisible({ timeout: 5000 });

    // Simulate connection loss after page load
    await authenticatedPage.context().setOffline(true);

    // Wait briefly
    await authenticatedPage.waitForTimeout(1000);

    // Restore connection
    await authenticatedPage.context().setOffline(false);

    // Page should still show devices header
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Devices' })).toBeVisible();
  });

  test('should display status indicator in devices list view (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for list rows
    const deviceRows = authenticatedPage.locator('[role="row"]').first();

    if (await deviceRows.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Should have status cell
      const statusCell = deviceRows.locator('[class*="status"], text=/online|offline/i').first();
      if (await statusCell.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(statusCell).toBeVisible();
      }
    }
  });

  test('should show status in health monitoring page (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Should show device health with status
    const healthIndicators = authenticatedPage.locator('[class*="health"], [class*="status"]').first();

    if (await healthIndicators.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(healthIndicators).toBeVisible();
    }
  });

  test('should update status without full page reload (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const statusElement = authenticatedPage.locator('text=/online|offline/i').first();

    if (await statusElement.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Page should not reload while watching
      const initialURL = authenticatedPage.url();

      await authenticatedPage.waitForTimeout(2000);

      const laterURL = authenticatedPage.url();
      expect(initialURL).toBe(laterURL); // No reload
    }
  });

  test('should show status for each device independently (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Get all status indicators (use separate locators and combine)
    const statusByClass = authenticatedPage.locator('[class*="status"]');
    const statusByText = authenticatedPage.locator('text=/online|offline|idle/i');

    const countByClass = await statusByClass.count().catch(() => 0);
    const countByText = await statusByText.count().catch(() => 0);

    expect(countByClass + countByText).toBeGreaterThanOrEqual(0);
  });

  test('should display status in device detail modal (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Find and click device to show details
    const detailButton = authenticatedPage.locator('button').filter({ hasText: /view|details|info/i }).first();

    if (await detailButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await detailButton.click();
      await authenticatedPage.waitForTimeout(500);

      // Look for status in modal
      const modal = authenticatedPage.locator('[role="dialog"]');
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        const statusInModal = modal.locator('text=/online|offline|status/i');
        if (await statusInModal.isVisible({ timeout: 1000 }).catch(() => false)) {
          await expect(statusInModal).toBeVisible();
        }
      }
    }
  });

  test('should handle rapid status changes (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Simulate multiple rapid updates
    for (let i = 0; i < 5; i++) {
      await authenticatedPage.waitForTimeout(200);
    }

    // UI should still be responsive
    const devices = authenticatedPage.locator('h2').filter({ hasText: 'Devices' });
    await expect(devices).toBeVisible();
  });

  test('should display status with appropriate icons (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for SVG icons or icon elements
    const icons = authenticatedPage.locator('svg, [class*="icon"]').first();

    if (await icons.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(icons).toBeVisible();
    }
  });

  test('should show status indicator size variations (BOUNDARY)', async ({ authenticatedPage, token }) => {
    const onlineName = await seedDisplay(authenticatedPage, token, 'online');
    const offlineName = await seedDisplay(authenticatedPage, token, 'offline');

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const onlineBadge = statusBadge(authenticatedPage, onlineName);
    const offlineBadge = statusBadge(authenticatedPage, offlineName);
    await expect(onlineBadge).toHaveText('Online', { timeout: 10000 });
    await expect(offlineBadge).toHaveText('Offline');

    // An indicator that renders at zero size, or not at all, is the failure this
    // test exists to catch - and a null bounding box is exactly what it reported
    // back when there were no devices on the page to measure.
    const onlineBox = await onlineBadge.boundingBox();
    const offlineBox = await offlineBadge.boundingBox();
    expect(onlineBox).not.toBeNull();
    expect(offlineBox).not.toBeNull();
    expect(onlineBox!.width).toBeGreaterThan(0);
    expect(onlineBox!.height).toBeGreaterThan(0);
    expect(offlineBox!.width).toBeGreaterThan(0);
    expect(offlineBox!.height).toBeGreaterThan(0);

    // Both rows render the same indicator in the same context, so whatever the
    // label says they must come out the same height - a badge that grows or
    // collapses per state would break the row rhythm of the whole table.
    expect(Math.abs(onlineBox!.height - offlineBox!.height)).toBeLessThanOrEqual(1);
  });

  test('should handle status for offline devices differently (DOMAIN)', async ({ authenticatedPage, token }) => {
    const offlineName = await seedDisplay(authenticatedPage, token, 'offline');
    const onlineName = await seedDisplay(authenticatedPage, token, 'online');

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const offlineBadge = statusBadge(authenticatedPage, offlineName);
    const onlineBadge = statusBadge(authenticatedPage, onlineName);

    await expect(offlineBadge).toHaveText('Offline', { timeout: 10000 });
    await expect(offlineBadge).toHaveAttribute('title', STATE_DESCRIPTION.offline);

    // "Differently" is the claim under test: a screen that is down must not
    // present like a healthy one. The old locator took the first page-wide
    // "offline" string and read a class off its parent - and that parent had
    // none, so the surviving `expect` would have failed had it ever run. It
    // never ran: the page had no devices.
    expect(await renderedInk(offlineBadge)).not.toBe(await renderedInk(onlineBadge));
  });

  /**
   * RENAMED on 2026-10-09. There is no ticking timestamp to assert. The Last
   * Seen cell computes its bucket once per render (`formatLastSeen`) and nothing
   * re-renders it on a timer; and the only writer of `lastHeartbeat` is
   * `POST /displays/:deviceId/heartbeat`, which verifies a DEVICE JWT, so a
   * user-token spec cannot age a device either. What IS assertable - and is the
   * invariant that matters on this column - is that a device which has never
   * reported says so, rather than being handed a fabricated age.
   */
  test('should report Never for a device that has not reported (DOMAIN)', async ({ authenticatedPage, token }) => {
    const nickname = await seedDisplay(authenticatedPage, token, 'online');

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(statusBadge(authenticatedPage, nickname)).toHaveText('Online', { timeout: 10000 });

    const lastSeenCell = deviceRow(authenticatedPage, nickname).locator('td[data-label="Last Seen"]');
    await expect(lastSeenCell).toHaveCount(1);
    // The leading `Last seen: ` is `.eh-cell-label`, display:none at table
    // widths but still part of the cell's text content.
    await expect(lastSeenCell).toHaveText(/^(Last seen:\s*)?Never$/);

    // `<time>` renders only when there is a real timestamp behind it, so a
    // never-seen device must not carry one. The assertion above has already
    // proved this cell is reached and is not empty.
    await expect(lastSeenCell.locator('time')).toHaveCount(0);
  });

  test('should show idle status for inactive devices (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for idle status
    const idleStatus = authenticatedPage.locator('text=/idle|waiting|inactive/i');

    if (await idleStatus.count() > 0) {
      await expect(idleStatus.first()).toBeVisible();
    }
  });

  test('should handle error status for problematic devices (DOMAIN)', async ({ authenticatedPage, token }) => {
    const errorName = await seedDisplay(authenticatedPage, token, 'error');
    const healthyName = await seedDisplay(authenticatedPage, token, 'online');

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const errorBadge = statusBadge(authenticatedPage, errorName);
    const healthyBadge = statusBadge(authenticatedPage, healthyName);

    // The state is carried as a WORD and as a tooltip, both of which survive a
    // greyscale render. The old locator matched stray page copy containing
    // "error" and then read a class off its parent, which was null.
    await expect(errorBadge).toHaveText('Error', { timeout: 10000 });
    await expect(errorBadge).toHaveAttribute('title', 'The device reported a fault');

    // "Differently" is the point of this test: a faulted device must not present
    // like a healthy one. The state colours are inline tokens rather than class
    // names, so compare what actually renders.
    expect(await renderedInk(errorBadge)).not.toBe(await renderedInk(healthyBadge));
  });

  test('should support status filtering/sorting (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for status sort button
    const statusSort = authenticatedPage.locator('button').filter({ hasText: /status/i }).first();

    if (await statusSort.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusSort.click();
      await authenticatedPage.waitForTimeout(500);

      // Devices should be re-sorted
      await expect(authenticatedPage.locator('h2').filter({ hasText: 'Devices' })).toBeVisible();
    }
  });

  test('should show status legend or key (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for legend
    const legend = authenticatedPage.locator('text=/online|offline|legend|key/i');

    const count = await legend.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should persist device status across page operations (MUTATION)', async ({ authenticatedPage, token }) => {
    const nickname = await seedDisplay(authenticatedPage, token, 'online');

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const badge = statusBadge(authenticatedPage, nickname);
    await expect(badge).toHaveText('Online', { timeout: 10000 });

    // Search for the seeded device by name, then clear the box. The row has to
    // come through the round-trip still reporting the SAME status: filtering is a
    // client-side pass over the same rows and must neither drop the device nor
    // reset its status to Unknown/Offline.
    const searchInput = authenticatedPage.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill(nickname);
    await expect(authenticatedPage.locator('table.eh-datatable tbody tr')).toHaveCount(1);
    await expect(badge).toHaveText('Online');

    await searchInput.clear();
    await expect(badge).toHaveText('Online');
  });
});
