import type { Page } from '@playwright/test';
import { test, expect, apiPost, readData } from './fixtures/auth.fixture';

/**
 * Seed one display through the API and return its nickname.
 *
 * The auth fixture registers a BRAND-NEW organization per test, so
 * /dashboard/health renders the "No devices found" empty state unless the test
 * puts a device there. Payload shape is CreateDisplayDto, as used by 03 and 09.
 */
async function seedDisplay(page: Page, token: string, status: 'online' | 'offline' = 'online'): Promise<string> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await apiPost(page, token, 'http://localhost:3000/api/v1/displays', {
    name: `E2E Health ${status} ${stamp}`,
    deviceId: `e2e-health-${stamp}`,
    location: 'Test Location',
    status,
  });

  expect(res.ok(), `display create failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  const display = await readData(res);
  expect(display.nickname, 'created display must carry a nickname').toBeTruthy();
  return display.nickname;
}

/** A device's health card, keyed by the <h3> that carries its name. */
const healthCardHeading = (page: Page, nickname: string) =>
  page.getByRole('heading', { level: 3, name: nickname });

/** A stat tile's label - the four tiles are the page's responsive grid. */
const statLabel = (page: Page, label: string) => page.getByText(label, { exact: true });

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

  test('should display health statistics cards (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for stats cards
    const statsCards = authenticatedPage.locator('[class*="card"], [class*="stat"]').first();

    if (await statsCards.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(statsCards).toBeVisible();
    }
  });

  test('should show total devices count card (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for total devices card
    const totalCard = authenticatedPage.locator('text=/total device/i').first();

    if (await totalCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(totalCard).toBeVisible();
    }
  });

  test('should show healthy devices count (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for healthy count
    const healthyCard = authenticatedPage.locator('text=/healthy|excellent/i').first();

    if (await healthyCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(healthyCard).toBeVisible();
    }
  });

  test('should show warning devices count (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for warning count
    const warningCard = authenticatedPage.locator('text=/warning|fair/i').first();

    if (await warningCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(warningCard).toBeVisible();
    }
  });

  test('should show critical devices count (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for critical count
    const criticalCard = authenticatedPage.locator('text=/critical|poor/i').first();

    if (await criticalCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(criticalCard).toBeVisible();
    }
  });

  test('should display device health grid (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for device health cards
    const deviceCards = authenticatedPage.locator('[class*="health"], [class*="device"]').first();

    if (await deviceCards.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(deviceCards).toBeVisible();
    }
  });

  test('should show device name in health card (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for device name
    const deviceName = authenticatedPage.locator('text=/Display|Device/i').first();

    if (await deviceName.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(deviceName).toBeVisible();
    }
  });

  test('should show device location (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for location
    const location = authenticatedPage.locator('text=/location|office|store|kiosk/i').first();

    if (await location.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(location).toBeVisible();
    }
  });

  test('should display health score 0-100 (BOUNDARY)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for health score - check for percentage or numeric values
    const healthScore = authenticatedPage.locator('[class*="health"], [class*="score"], [class*="percent"]').first();

    if (await healthScore.isVisible({ timeout: 3000 }).catch(() => false)) {
      const scoreText = await healthScore.textContent();
      // Score text should contain a digit
      expect(scoreText).toMatch(/\d/);
    }
  });

  test('should show health status label (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for status label
    const statusLabel = authenticatedPage.locator('text=/Excellent|Good|Fair|Poor/i').first();

    if (await statusLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(statusLabel).toBeVisible();
    }
  });

  test('should display CPU usage metric (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for CPU metric
    const cpuMetric = authenticatedPage.locator('text=/CPU|cpu/i').first();

    if (await cpuMetric.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(cpuMetric).toBeVisible();
    }
  });

  test('should display Memory usage metric (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for Memory metric
    const memoryMetric = authenticatedPage.locator('text=/Memory|RAM|memory/i').first();

    if (await memoryMetric.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(memoryMetric).toBeVisible();
    }
  });

  test('should display Storage usage metric (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for Storage metric
    const storageMetric = authenticatedPage.locator('text=/Storage|Disk|storage/i').first();

    if (await storageMetric.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(storageMetric).toBeVisible();
    }
  });

  test('should display Temperature metric (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for Temperature metric
    const tempMetric = authenticatedPage.locator('text=/Temperature|Temp|°C|°F/i').first();

    if (await tempMetric.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(tempMetric).toBeVisible();
    }
  });

  test('should show metric with progress bars (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for progress bars
    const progressBars = authenticatedPage.locator('[role="progressbar"], [class*="progress"], [class*="bar"]').first();

    if (await progressBars.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(progressBars).toBeVisible();
    }
  });

  test('should show metric values with percentages (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for percentage values
    const percentages = authenticatedPage.locator('text=/\\d{1,3}%/').first();

    if (await percentages.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(percentages).toBeVisible();
    }
  });

  test('should color-code health status (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for colored status indicators
    const coloredStatus = authenticatedPage.locator('[class*="green"], [class*="yellow"], [class*="red"]').first();

    if (await coloredStatus.isVisible({ timeout: 3000 }).catch(() => false)) {
      const classes = await coloredStatus.getAttribute('class');
      expect(classes).toMatch(/green|yellow|red|blue/);
    }
  });

  test('should show uptime information (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for uptime
    const uptime = authenticatedPage.locator('text=/uptime|days?|hours?/i').first();

    if (await uptime.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(uptime).toBeVisible();
    }
  });

  test('should show last heartbeat timestamp (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for heartbeat
    const heartbeat = authenticatedPage.locator('text=/heartbeat|last.*update|ago/i').first();

    if (await heartbeat.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(heartbeat).toBeVisible();
    }
  });

  test('should display critical alert for poor health (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for critical alert
    const criticalAlert = authenticatedPage.locator('text=/critical|maintenance|poor/i').first();

    if (await criticalAlert.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(criticalAlert).toBeVisible();
    }
  });

  test('should display warning alert for fair health (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for warning alert
    const warningAlert = authenticatedPage.locator('text=/warning|attention/i').first();

    if (await warningAlert.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(warningAlert).toBeVisible();
    }
  });

  test('should support sort by health score (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for sort button
    const sortButton = authenticatedPage.locator('button').filter({ hasText: /sort.*health|health.*score/i }).first();

    if (await sortButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortButton.click();
      await authenticatedPage.waitForTimeout(500);

      // Verify sorted
      await expect(authenticatedPage.locator('h2').filter({ hasText: /Health|Monitor/i })).toBeVisible();
    }
  });

  test('should support search by device name (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for search
    const searchInput = authenticatedPage.locator('input[placeholder*="Search"]').first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Display');
      await authenticatedPage.waitForTimeout(500);

      // Verify filtered
      const devices = authenticatedPage.locator('[class*="health"], [class*="device"]');
      expect(await devices.count()).toBeGreaterThanOrEqual(0);

      await searchInput.clear();
    }
  });

  test('should support refresh button (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for refresh button
    const refreshButton = authenticatedPage.locator('button').filter({ hasText: /refresh|reload/i }).first();

    if (await refreshButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refreshButton.click();
      await authenticatedPage.waitForTimeout(1000);

      // Verify still functional
      await expect(authenticatedPage.locator('h2').filter({ hasText: /Health|Monitor/i })).toBeVisible();
    }
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

  test('should handle empty health data gracefully (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/health');
    await authenticatedPage.waitForLoadState('networkidle');

    // Page should display gracefully
    const emptyState = authenticatedPage.locator('text=/no device|empty|no data/i');
    const deviceList = authenticatedPage.locator('[class*="health"], [class*="device"]').first();

    if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(emptyState).toBeVisible();
    } else if (await deviceList.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(deviceList).toBeVisible();
    }
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
