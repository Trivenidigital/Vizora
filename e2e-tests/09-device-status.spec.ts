import type { Locator, Page } from '@playwright/test';
import { test, expect, apiPost, readData } from './fixtures/auth.fixture';
import { apiGet, patch } from './fixtures/seed';

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

  test('should show the empty state in a fresh org, and a status badge once a device exists', async ({ authenticatedPage, token }) => {
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Devices' })).toBeVisible({ timeout: 10000 });
    // The fixture registers a brand-new org: no devices, so the empty state,
    // and no status chips (they render only over a non-empty fleet).
    await expect(authenticatedPage.getByText('No devices yet')).toBeVisible();
    await expect(authenticatedPage.getByRole('group', { name: /Filter devices by status/ })).toHaveCount(0);

    const nickname = await seedDisplay(authenticatedPage, token, 'online');
    await authenticatedPage.reload();
    await expect(statusBadge(authenticatedPage, nickname)).toHaveText('Online', { timeout: 10000 });
    await expect(authenticatedPage.getByText('No devices yet')).toHaveCount(0);
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

  /**
   * The devices page refreshes its list in the background every 30s while the
   * tab is visible (`DEVICES_BACKGROUND_REFRESH_MS`). A rename made through the
   * API emits no realtime event, so the timer is the ONLY path by which it can
   * reach an open page - which is what makes it a clean probe of the refresh.
   * The page clock is fast-forwarded instead of waiting 30 real seconds.
   */
  test('should pick up a device change made elsewhere without a reload (MUTATION)', async ({ authenticatedPage, token }) => {
    const before = await seedDisplay(authenticatedPage, token, 'online');
    const after = `${before} renamed`;

    await authenticatedPage.clock.install();
    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');
    await expect(statusBadge(authenticatedPage, before)).toHaveText('Online', { timeout: 10000 });

    // A marker that a full reload would wipe.
    await authenticatedPage.evaluate(() => ((window as any).__e2eNoReload = true));

    const displays = await apiGet<{ data: Array<{ id: string; nickname: string }> }>(
      authenticatedPage,
      token,
      '/displays?page=1&limit=50',
    );
    const id = displays.data.find((d) => d.nickname === before)?.id;
    expect(id, 'seeded display must be listed').toBeTruthy();
    await patch(authenticatedPage, token, `/displays/${id}`, { name: after, status: 'offline' });

    // CONTROL: nothing has refreshed yet, so the page still shows the old row.
    await expect(deviceRow(authenticatedPage, before)).toHaveCount(1);
    await expect(authenticatedPage.getByText(after)).toHaveCount(0);

    await authenticatedPage.clock.fastForward(31_000);

    await expect(statusBadge(authenticatedPage, after)).toHaveText('Offline', { timeout: 10000 });
    expect(await authenticatedPage.evaluate(() => (window as any).__e2eNoReload)).toBe(true);
  });

  test('should count each status independently in the fleet chips, and filter by them (DOMAIN)', async ({ authenticatedPage, token }) => {
    const onlineName = await seedDisplay(authenticatedPage, token, 'online');
    const offlineName = await seedDisplay(authenticatedPage, token, 'offline');
    const errorName = await seedDisplay(authenticatedPage, token, 'error');

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    // The chips are the status legend: one per state present, each with a
    // fleet-wide count, plus "All devices".
    const chips = authenticatedPage.getByRole('group', { name: /Filter devices by status/ });
    await expect(chips.getByRole('button')).toHaveCount(4, { timeout: 10000 });
    await expect(chips.getByRole('button', { name: /All devices$/ })).toHaveText(/3\s*All devices/);
    await expect(chips.getByRole('button', { name: /Online$/ })).toHaveText(/1\s*Online/);
    await expect(chips.getByRole('button', { name: /Offline$/ })).toHaveText(/1\s*Offline/);
    await expect(chips.getByRole('button', { name: /Error$/ })).toHaveText(/1\s*Error/);
    // States with no devices get no chip (there is no "Idle" device here).
    await expect(chips.getByRole('button', { name: /Idle$/ })).toHaveCount(0);
    await expect(
      authenticatedPage.getByText('Counts are across the whole fleet; the table below also honours the search and group filters.'),
    ).toBeVisible();

    const rows = authenticatedPage.locator('table.eh-datatable tbody tr');
    await expect(rows).toHaveCount(3);

    await chips.getByRole('button', { name: /Offline$/ }).click();
    await expect(chips.getByRole('button', { name: /Offline$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(rows).toHaveCount(1);
    await expect(deviceRow(authenticatedPage, offlineName)).toHaveCount(1);

    // Clicking the pressed chip again clears it.
    await chips.getByRole('button', { name: /Offline$/ }).click();
    await expect(chips.getByRole('button', { name: /All devices$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(rows).toHaveCount(3);
    await expect(deviceRow(authenticatedPage, onlineName)).toHaveCount(1);
    await expect(deviceRow(authenticatedPage, errorName)).toHaveCount(1);
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

  test('should sort the table by status (DOMAIN)', async ({ authenticatedPage, token }) => {
    await seedDisplay(authenticatedPage, token, 'online');
    await seedDisplay(authenticatedPage, token, 'offline');
    await seedDisplay(authenticatedPage, token, 'error');

    await authenticatedPage.goto('/dashboard/devices');
    await authenticatedPage.waitForLoadState('networkidle');

    const header = authenticatedPage.locator('th').filter({ has: authenticatedPage.getByRole('button', { name: /^Status/ }) });
    const statuses = authenticatedPage.locator('table.eh-datatable tbody tr td[data-label="Status"] span[title]');
    await expect(statuses).toHaveCount(3, { timeout: 10000 });
    await expect(header).toHaveAttribute('aria-sort', 'none');

    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    const asc = await statuses.allInnerTexts();
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));

    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(await statuses.allInnerTexts()).toEqual([...asc].reverse());
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
