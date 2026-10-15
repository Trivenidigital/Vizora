import type { Locator, Page } from '@playwright/test';
import { test, expect, apiPost, readData } from './fixtures/auth.fixture';

/**
 * Seed one display through the API and return its nickname.
 *
 * The auth fixture registers a BRAND-NEW organization per test, so
 * /dashboard/health renders the "No devices found" empty state unless the test
 * puts a device there. Payload shape is CreateDisplayDto, as used by 03 and 09.
 */
async function seedDisplay(
  page: Page,
  token: string,
  status: 'online' | 'offline' | 'error' = 'online',
  name?: string,
  location = 'Test Location',
): Promise<string> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await apiPost(page, token, 'http://localhost:3000/api/v1/displays', {
    name: name ?? `E2E Health ${status} ${stamp}`,
    deviceId: `e2e-health-${stamp}`,
    location,
    status,
  });

  expect(res.ok(), `display create failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  const display = await readData(res);
  expect(display.nickname, 'created display must carry a nickname').toBeTruthy();
  return display.nickname;
}

/**
 * Stamp `lastHeartbeat` (ms ago) onto named displays in the REAL /displays
 * response. Only a device token can write a heartbeat, so this is the one way a
 * user-token spec can reach the heartbeat-dependent score rungs; every other
 * field still comes from the server.
 */
async function stampHeartbeats(page: Page, agesMs: Record<string, number>): Promise<void> {
  await page.route(/\/api\/v1\/displays(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    const list = body?.data?.data;
    expect(Array.isArray(list), 'GET /displays must return an enveloped page').toBe(true);
    for (const d of list) {
      if (d.nickname in agesMs) d.lastHeartbeat = new Date(Date.now() - agesMs[d.nickname]).toISOString();
    }
    await route.fulfill({ response, json: body });
  });
}

async function gotoHealth(page: Page): Promise<void> {
  await page.goto('/dashboard/health');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 2, name: 'Device Health' })).toBeVisible({ timeout: 10000 });
}

/** A device's health card, keyed by the <h3> that carries its name. */
const healthCardHeading = (page: Page, nickname: string) =>
  page.getByRole('heading', { level: 3, name: nickname });

/**
 * Every device card's title, in order. Each card also embeds
 * DeviceHealthMonitor, whose own <h3> reads "Device Health", and the empty
 * state's title is an <h3> too, so both are excluded.
 */
const cardTitles = (page: Page): Locator =>
  page
    .getByRole('heading', { level: 3 })
    .filter({ hasNotText: /^(Device Health|No devices found)$/ });

/** The whole card: the device grid's child that holds that heading. */
const healthCard = (page: Page, nickname: string): Locator =>
  page.locator('div.grid > div').filter({ has: healthCardHeading(page, nickname) });

/** A stat tile's label - the four tiles are the page's responsive grid. */
const statLabel = (page: Page, label: string) => page.getByText(label, { exact: true });

/** The number under a stat tile's label. */
const statValue = (page: Page, label: string): Locator =>
  statLabel(page, label).locator('xpath=following-sibling::p[1]');

/**
 * PHASE 7.1: DEVICE HEALTH MONITORING DASHBOARD TEST SUITE
 *
 * BMAD Method Coverage:
 * ├─ Boundary Tests: Health scores (0-100), metric thresholds
 * ├─ Mutation Tests: Health updates, alert state changes
 * ├─ Adversarial Tests: Extreme values, missing metrics
 * └─ Domain Tests: Health calculations, alert logic
 *
 * Test Coverage: 28 critical test cases for health monitoring
 */

test.describe('Phase 7.1: Device Health Monitoring Dashboard', () => {

  test('should load health monitoring page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Verify page heading
    await expect(authenticatedPage.locator('h2').filter({ hasText: /Health|Monitor/i })).toBeVisible({ timeout: 10000 });
  });

  test('a fresh org shows four zero stat tiles and the empty state (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await gotoHealth(authenticatedPage);

    for (const label of ['Total Devices', 'Healthy', 'Warnings', 'Critical']) {
      await expect(statValue(authenticatedPage, label)).toHaveText('0');
    }
    await expect(authenticatedPage.getByText('No devices found')).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: 'Pair Device' })).toBeVisible();
    await expect(cardTitles(authenticatedPage)).toHaveCount(0);
  });

  /**
   * Scores are derived client-side from status + last heartbeat
   * (`deriveDeviceHealthFromDisplay`). A heartbeat can only be written with a
   * DEVICE token, so the heartbeat-dependent rungs are reached by stamping
   * `lastHeartbeat` onto the real /displays response; status, name and location
   * are real seeded rows.
   *   online + heartbeat now        -> 100 Excellent (Healthy, >= 80)
   *   online + no heartbeat         ->  70 Good      (Warning, 50..79)
   *   online + heartbeat 20 min ago ->  55 Fair      (Warning) + warning banner
   *   error                         ->  35 Poor      (Critical) + critical banner
   */
  test('derives each rung of the health score and buckets the stat tiles (BOUNDARY)', async ({ authenticatedPage, token }) => {
    const stamp = Date.now();
    const fresh = await seedDisplay(authenticatedPage, token, 'online', `Fresh ${stamp}`);
    const silent = await seedDisplay(authenticatedPage, token, 'online', `Silent ${stamp}`);
    const stale = await seedDisplay(authenticatedPage, token, 'online', `Stale ${stamp}`);
    const faulty = await seedDisplay(authenticatedPage, token, 'error', `Faulty ${stamp}`);
    await stampHeartbeats(authenticatedPage, { [fresh]: 0, [stale]: 20 * 60_000 });

    await gotoHealth(authenticatedPage);

    await expect(statValue(authenticatedPage, 'Total Devices')).toHaveText('4');
    await expect(statValue(authenticatedPage, 'Healthy')).toHaveText('1');
    await expect(statValue(authenticatedPage, 'Warnings')).toHaveText('2');
    await expect(statValue(authenticatedPage, 'Critical')).toHaveText('1');

    const expectations: Array<[string, string, string]> = [
      [fresh, '100', 'Excellent'],
      [silent, '70', 'Good'],
      [stale, '55', 'Fair'],
      [faulty, '35', 'Poor'],
    ];
    for (const [name, score, label] of expectations) {
      const card = healthCard(authenticatedPage, name);
      await expect(card.getByText(score, { exact: true })).toBeVisible();
      await expect(card.getByText(label, { exact: true }).first()).toBeVisible();
    }

    // The banners follow the score, and only the matching ones render.
    await expect(healthCard(authenticatedPage, faulty)).toContainText('Critical: Device performance degraded. Consider maintenance.');
    await expect(healthCard(authenticatedPage, stale)).toContainText('Warning: Some metrics need attention.');
    await expect(healthCard(authenticatedPage, fresh)).not.toContainText(/Critical:|Warning:/);
    await expect(healthCard(authenticatedPage, silent)).not.toContainText(/Critical:|Warning:/);

    // Each rung has its own ink: four labels, at least three distinct colours
    // (Excellent and Good may legitimately share the brand palette).
    const inks = await Promise.all(
      expectations.map(([name, score]) =>
        healthCard(authenticatedPage, name).getByText(score, { exact: true }).evaluate((el) => getComputedStyle(el).color),
      ),
    );
    expect(new Set(inks).size).toBeGreaterThanOrEqual(3);
  });

  test('each device card shows its name and location (DOMAIN)', async ({ authenticatedPage, token }) => {
    const stamp = Date.now();
    const a = await seedDisplay(authenticatedPage, token, 'online', `Lobby ${stamp}`, 'Main Entrance');
    const b = await seedDisplay(authenticatedPage, token, 'offline', `Patio ${stamp}`, 'Back Garden');

    await gotoHealth(authenticatedPage);
    await expect(cardTitles(authenticatedPage)).toHaveCount(2);
    await expect(healthCard(authenticatedPage, a)).toContainText('Main Entrance');
    await expect(healthCard(authenticatedPage, b)).toContainText('Back Garden');
  });

  /**
   * No device telemetry reaches this page today (cpu/memory/storage/
   * temperature/uptime are always null in `deriveDeviceHealthFromDisplay`), so
   * the honest contract is that every metric says "Not reported" with an EMPTY
   * bar - never a placeholder percentage.
   */
  test('metrics without telemetry say "Not reported" with empty bars (ADVERSARIAL)', async ({ authenticatedPage, token }) => {
    const name = await seedDisplay(authenticatedPage, token, 'online');
    await gotoHealth(authenticatedPage);
    const card = healthCard(authenticatedPage, name);

    for (const metric of ['CPU', 'Memory', 'Storage', 'Temperature']) {
      const row = card.locator('div.flex.justify-between').filter({ has: authenticatedPage.getByText(metric, { exact: true }) });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('Not reported');
      const bar = row.locator('xpath=following-sibling::div[1]/div');
      await expect(bar).toHaveAttribute('style', /width:\s*0%/);
    }
    // The only percentage on the card is the health score itself (70 for an
    // online device that has never sent a heartbeat), never a metric.
    await expect(card.getByText(/\d+(\.\d)?%/)).toHaveText(['70%']);
    // Uptime and temperature are repeated in the card footer, also unreported,
    // and a device that has never sent a heartbeat says so.
    await expect(card.getByText('Not reported')).toHaveCount(7);
    await expect(card.getByText('Never', { exact: true })).toBeVisible();
  });

  test('shows the age of the last heartbeat (DOMAIN)', async ({ authenticatedPage, token }) => {
    const name = await seedDisplay(authenticatedPage, token, 'online');
    await stampHeartbeats(authenticatedPage, { [name]: 90_000 });
    await gotoHealth(authenticatedPage);

    const footer = healthCard(authenticatedPage, name).getByText('Last Heartbeat').locator('xpath=following-sibling::p[1]');
    await expect(footer).toHaveText(/^(8\d|9\d|1[0-2]\d)s ago$/);
  });

  test('sorts by health, name and status in both directions (MUTATION)', async ({ authenticatedPage, token }) => {
    const stamp = Date.now();
    const alpha = await seedDisplay(authenticatedPage, token, 'error', `Alpha ${stamp}`);
    const bravo = await seedDisplay(authenticatedPage, token, 'online', `Bravo ${stamp}`);
    const charlie = await seedDisplay(authenticatedPage, token, 'offline', `Charlie ${stamp}`);

    await gotoHealth(authenticatedPage);
    const titles = cardTitles(authenticatedPage);
    await expect(titles).toHaveCount(3);

    // Default: health, descending -> 70 (Bravo), 35 (Alpha), 25 (Charlie).
    await expect(titles).toHaveText([bravo, alpha, charlie]);

    const order = authenticatedPage.getByRole('button', { name: /^[↑↓]$/ });
    await order.click();
    await expect(titles).toHaveText([charlie, alpha, bravo]);

    const sort = authenticatedPage.locator('select').filter({ has: authenticatedPage.locator('option', { hasText: 'Sort by Health' }) });
    await sort.selectOption('name');
    await expect(titles).toHaveText([alpha, bravo, charlie]); // ascending
    await order.click();
    await expect(titles).toHaveText([charlie, bravo, alpha]);

    await sort.selectOption('status');
    // descending by status string: online > offline > error
    await expect(titles).toHaveText([bravo, charlie, alpha]);
  });

  test('searches by device name and by location (MUTATION)', async ({ authenticatedPage, token }) => {
    const stamp = Date.now();
    const a = await seedDisplay(authenticatedPage, token, 'online', `Counter ${stamp}`, 'Front Desk');
    const b = await seedDisplay(authenticatedPage, token, 'online', `Menu Board ${stamp}`, 'Drive Thru');

    await gotoHealth(authenticatedPage);
    const titles = cardTitles(authenticatedPage);
    await expect(titles).toHaveCount(2);

    const search = authenticatedPage.getByPlaceholder('Search devices by name or location...');
    await search.fill('counter');
    await expect(titles).toHaveText([a]);

    await search.fill('drive thru');
    await expect(titles).toHaveText([b]);

    await search.fill('nothing-matches-this');
    await expect(titles).toHaveCount(0);
    await expect(authenticatedPage.getByText('No devices found')).toBeVisible();
    // The tiles stay fleet-wide while the grid is filtered.
    await expect(statValue(authenticatedPage, 'Total Devices')).toHaveText('2');

    await search.fill('');
    await expect(titles).toHaveCount(2);
  });

  /**
   * The page really does auto-refresh: `HEALTH_REFRESH_INTERVAL_MS` is 30s and
   * the interval calls `loadDevicesAndHealth(false)`, which refetches the whole
   * display list without showing the spinner. So this is assertable for real -
   * seed a SECOND device after the page has settled and it must arrive on its
   * own. The old test only looked for the word "ago" and then passed
   * regardless, which is how it stayed green on a page showing an empty state.
   *
   * Slow by construction: one interval period has to elapse. It is the only
   * test here that waits.
   */
  test('should auto-refresh health data (BOUNDARY)', async ({ authenticatedPage, token }) => {
    test.setTimeout(150_000);

    const firstName = await seedDisplay(authenticatedPage, token);

    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Baseline: the first device's card is on screen, and the second one is
    // not. Together these are the control - they prove the card locator
    // resolves at all, and that the assertion below is observing an arrival
    // rather than something that was already there.
    await expect(healthCardHeading(authenticatedPage, firstName)).toBeVisible({ timeout: 15000 });

    const secondName = await seedDisplay(authenticatedPage, token);
    await expect(healthCardHeading(authenticatedPage, secondName)).toHaveCount(0);

    // A marker that a navigation would destroy: the new card has to appear in
    // THIS document, not via a reload.
    await authenticatedPage.evaluate(() => {
      (window as unknown as { __vizoraNoReload?: boolean }).__vizoraNoReload = true;
    });

    await expect(healthCardHeading(authenticatedPage, secondName)).toBeVisible({ timeout: 75_000 });
    await expect(statLabel(authenticatedPage, 'Total Devices')).toBeVisible();
    expect(
      await authenticatedPage.evaluate(
        () => (window as unknown as { __vizoraNoReload?: boolean }).__vizoraNoReload === true,
      ),
    ).toBe(true);
  });

  /**
   * "Reflow" is the claim, so measure it. The stat grid is `grid-cols-1
   * md:grid-cols-4`: below the `md` breakpoint the four tiles stack one per
   * row, at desktop width they sit side by side. The old test looked for any
   * element with a class containing "bg-" and then passed whether or not it
   * found one - it could not have gone red had the page rendered nothing at all.
   *
   * Measured through bounding boxes rather than class names, so it tracks what
   * actually lays out and does not churn when the utility classes do.
   */
  test('should display responsive health layout (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(authenticatedPage.locator('h2').filter({ hasText: /Health|Monitor/i })).toBeVisible({ timeout: 10000 });

    const total = statLabel(authenticatedPage, 'Total Devices');
    const healthy = statLabel(authenticatedPage, 'Healthy');
    await expect(total).toBeVisible();
    await expect(healthy).toBeVisible();

    const mobileTotal = (await total.boundingBox())!;
    const mobileHealthy = (await healthy.boundingBox())!;

    // Stacked: same left edge, the second tile strictly below the first.
    expect(Math.abs(mobileTotal.x - mobileHealthy.x)).toBeLessThanOrEqual(1);
    expect(mobileHealthy.y).toBeGreaterThan(mobileTotal.y + mobileTotal.height);

    await authenticatedPage.setViewportSize({ width: 1280, height: 720 });

    // Side by side: same baseline, the second tile strictly to the right. This
    // is the control for the measurement above - the same two boxes have to
    // change relationship, so a pair that never moves cannot pass both halves.
    await expect
      .poll(async () => {
        const a = await total.boundingBox();
        const b = await healthy.boundingBox();
        return a && b ? Math.round(b.x - a.x) : 0;
      }, { timeout: 10000 })
      .toBeGreaterThan(0);

    const wideTotal = (await total.boundingBox())!;
    const wideHealthy = (await healthy.boundingBox())!;
    expect(Math.abs(wideTotal.y - wideHealthy.y)).toBeLessThanOrEqual(1);
    expect(wideHealthy.x).toBeGreaterThan(wideTotal.x + wideTotal.width);
  });
});
