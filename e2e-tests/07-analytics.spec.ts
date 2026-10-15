import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';

/**
 * These specs used to assert the February-2026 mock dashboard ("Content Served",
 * "System Uptime", the literal 366 / 12.5K / 98.5%, "from last month"). That UI
 * left the product in b2b81b9b; the page now reads live data
 * (web/src/app/dashboard/analytics/page-client.tsx), so every number here is
 * whatever the signed-in org actually has — for the freshly registered org the
 * auth fixture creates, that is zero.
 *
 * So the assertions below are on STRUCTURE and SHAPE: the labels that exist, and
 * the format each value is rendered in. They still fail if the summary request
 * fails, because the product then renders the literal placeholder `---` instead
 * of a number.
 */

/** The label <p> of a KPI card. */
const kpiLabel = (page: Page, label: string): Locator =>
  // `filter({ hasText: <regex> })` matches the RAW text, not the normalized one,
  // hence the explicit padding.
  page.locator('p').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) }).first();

/**
 * KPICard renders label, value and the supporting line as adjacent <p> siblings,
 * so both are reachable from the label without depending on a layout class.
 */
const kpiValue = (page: Page, label: string): Locator =>
  kpiLabel(page, label).locator('xpath=following-sibling::p[1]');

const kpiDetail = (page: Page, label: string): Locator =>
  kpiLabel(page, label).locator('xpath=following-sibling::p[2]');

test.describe('Analytics Dashboard', () => {
  test('should show analytics page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    const heading = authenticatedPage.getByRole('heading', { level: 2, name: 'Analytics' });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // The subtitle is the paragraph directly under the page heading. Anchoring on
    // the heading rather than on the sentence keeps this off the exact copy.
    await expect(heading.locator('xpath=following-sibling::p[1]')).toContainText(
      /device status/i,
    );
  });

  test('should display key metrics cards', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(kpiLabel(authenticatedPage, 'Total Devices')).toBeVisible({ timeout: 10000 });
    await expect(kpiLabel(authenticatedPage, 'Content Items')).toBeVisible();
    await expect(kpiLabel(authenticatedPage, 'Total Size')).toBeVisible();
    await expect(kpiLabel(authenticatedPage, 'Online Now')).toBeVisible();
  });

  test('should show metrics values', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    // Each KPI renders a live figure in a known format. `---` is the product's
    // placeholder for "the summary request did not answer", and none of these
    // patterns admit it, so a failed summary still fails the test.
    await expect(kpiValue(authenticatedPage, 'Total Devices')).toHaveText(/^\d+$/, {
      timeout: 10000,
    });
    await expect(kpiValue(authenticatedPage, 'Content Items')).toHaveText(/^\d+$/);
    await expect(kpiValue(authenticatedPage, 'Total Size')).toHaveText(
      /^\d+(\.\d+)?\s(B|KB|MB|GB|TB)$/,
    );
    await expect(kpiValue(authenticatedPage, 'Online Now')).toHaveText(/^\d+(\.\d+)?%$/);
  });

  test('should show supporting detail under each metric', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    // Replaces the old "from last month" / "above target" mock copy: the cards now
    // carry a derived breakdown of the same live summary.
    await expect(kpiDetail(authenticatedPage, 'Total Devices')).toContainText(/\d+ online/, {
      timeout: 10000,
    });
    await expect(kpiDetail(authenticatedPage, 'Content Items')).toContainText(/\d+ playlists?/);
    await expect(kpiDetail(authenticatedPage, 'Online Now')).toContainText(
      /\d+\/\d+ devices online/,
    );
  });

  test('should display date range buttons', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    // Check for date range buttons
    await expect(authenticatedPage.locator('button').filter({ hasText: 'week' })).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.locator('button').filter({ hasText: 'month' })).toBeVisible();
    await expect(authenticatedPage.locator('button').filter({ hasText: 'year' })).toBeVisible();
  });

  test('should display chart sections', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/analytics');
    await authenticatedPage.waitForLoadState('networkidle');

    // The six sections the page renders today. "Device Uptime Timeline" and
    // "Content Performance" are gone; availability and proof-of-play replaced
    // them, and each section keeps its heading whether or not it has data to
    // draw (empty and error states render inside the same card).
    const sections = [
      'Estimated Availability Trend',
      'Content Proof-of-Play',
      'Device Distribution',
      'Usage Trends by Reported Content Type',
      'Estimated Storage Footprint',
      'Playlist Playback Summary',
    ];

    for (const section of sections) {
      await expect(
        authenticatedPage.getByRole('heading', { name: section, exact: true }),
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
