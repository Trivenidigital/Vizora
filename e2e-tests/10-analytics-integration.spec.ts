import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { seedContent, seedDisplay, seedPlaylist } from './fixtures/seed';

/**
 * ANALYTICS — data integration
 *
 * Rewritten 2026-10-15. 17 of 22 tests ran inside `if (await x.isVisible())`
 * guards on loose selectors (`[class*="card"]`, `text=/content/i`) and four
 * ended on `toBeGreaterThanOrEqual(0)`; none could fail. The KPI cards,
 * date-range buttons and section headings are covered by 07-analytics; this
 * file covers what flows INTO them:
 *   - a fresh org renders every section's empty state, never a fabricated number;
 *   - seeded devices/content/playlists reach the KPIs and the distribution chart;
 *   - the date range re-queries the API and relabels the trend;
 *   - loading, export and phone-width layout.
 */

const card = (page: Page, title: string): Locator =>
  page.locator('div.eh-dash-card').filter({ has: page.getByRole('heading', { level: 3, name: title }) });

const kpiValue = (page: Page, label: string): Locator =>
  page.locator('p').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) }).first().locator('xpath=following-sibling::p[1]');

const kpiDetail = (page: Page, label: string): Locator =>
  page.locator('p').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) }).first().locator('xpath=following-sibling::p[2]');

async function gotoAnalytics(page: Page): Promise<void> {
  await page.goto('/dashboard/analytics');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 2, name: 'Analytics' })).toBeVisible({ timeout: 10000 });
}

test.describe('Analytics data integration', () => {
  test('a fresh org shows empty states, not fabricated figures (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await gotoAnalytics(authenticatedPage);

    await expect(kpiValue(authenticatedPage, 'Total Devices')).toHaveText('0');
    await expect(kpiValue(authenticatedPage, 'Content Items')).toHaveText('0');
    await expect(kpiValue(authenticatedPage, 'Online Now')).toHaveText('0%');

    const empties: Array<[string, string]> = [
      ['Estimated Availability Trend', 'No availability estimate available yet.'],
      ['Content Proof-of-Play', 'No content proof-of-play data yet.'],
      ['Device Distribution', 'No devices registered yet. Pair devices to see distribution.'],
      ['Estimated Storage Footprint', 'No stored content yet.'],
      ['Playlist Playback Summary', 'No playlist playback data yet.'],
    ];
    for (const [title, message] of empties) {
      const section = card(authenticatedPage, title);
      await expect(section).toBeVisible();
      await expect(section.getByText(message, { exact: false })).toBeVisible();
      // An empty section draws no chart.
      await expect(section.locator('svg.recharts-surface')).toHaveCount(0);
    }
    await expect(authenticatedPage.getByRole('alert', { name: 'Analytics data unavailable' })).toHaveCount(0);
  });

  test('seeded devices, content and playlists reach the KPIs and the distribution chart (DOMAIN)', async ({ authenticatedPage, token }) => {
    await seedDisplay(authenticatedPage, token, { status: 'online' });
    await seedDisplay(authenticatedPage, token, { status: 'offline' });
    await seedContent(authenticatedPage, token);
    await seedContent(authenticatedPage, token);
    await seedContent(authenticatedPage, token);
    await seedPlaylist(authenticatedPage, token);

    await gotoAnalytics(authenticatedPage);

    await expect(kpiValue(authenticatedPage, 'Total Devices')).toHaveText('2');
    await expect(kpiDetail(authenticatedPage, 'Total Devices')).toContainText('1 online');
    await expect(kpiValue(authenticatedPage, 'Content Items')).toHaveText('3');
    await expect(kpiDetail(authenticatedPage, 'Content Items')).toContainText('1 playlists');
    await expect(kpiValue(authenticatedPage, 'Online Now')).toHaveText('50%');
    await expect(kpiDetail(authenticatedPage, 'Online Now')).toContainText('1/2 devices online');

    // With devices registered the distribution section draws a chart instead
    // of its empty state.
    const distribution = card(authenticatedPage, 'Device Distribution');
    await expect(distribution.getByText('No devices registered yet')).toHaveCount(0);
    await expect(distribution.locator('.recharts-wrapper')).toHaveCount(1, { timeout: 10000 });
  });

  test('the date range re-queries the API and relabels the trend (BOUNDARY)', async ({ authenticatedPage }) => {
    await gotoAnalytics(authenticatedPage);
    const badge = card(authenticatedPage, 'Estimated Availability Trend').locator('.eh-badge');
    await expect(badge).toHaveText('Last 30 Days'); // month is the default

    const ranges: Array<[string, string]> = [
      ['week', 'Last 7 Days'],
      ['year', '30 sampled days'],
      ['month', 'Last 30 Days'],
    ];
    for (const [range, label] of ranges) {
      const request = authenticatedPage.waitForRequest(
        (r) => r.url().includes(`/analytics/device-metrics?range=${range}`),
      );
      await authenticatedPage.getByRole('button', { name: range, exact: true }).click();
      await request;
      await expect(badge).toHaveText(label);
    }

    // Rapid switching settles on the LAST choice.
    await authenticatedPage.getByRole('button', { name: 'week', exact: true }).click();
    await authenticatedPage.getByRole('button', { name: 'year', exact: true }).click();
    await expect(badge).toHaveText('30 sampled days');
    await expect(authenticatedPage.getByRole('heading', { level: 2, name: 'Analytics' })).toBeVisible();
  });

  test('shows a loading indicator while a section is fetching (BOUNDARY)', async ({ authenticatedPage }) => {
    // Hold the device-distribution response so the loading state is observable
    // rather than raced.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await authenticatedPage.route('**/api/v1/analytics/device-distribution*', async (route) => {
      await held;
      await route.continue();
    });

    await authenticatedPage.goto('/dashboard/analytics');
    const distribution = card(authenticatedPage, 'Device Distribution');
    await expect(distribution.locator('.animate-spin')).toBeVisible({ timeout: 10000 });

    release();
    await expect(distribution.locator('.animate-spin')).toHaveCount(0, { timeout: 10000 });
    await expect(distribution.getByText('No devices registered yet')).toBeVisible();
  });

  test('a failed section says so instead of rendering as empty (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/v1/analytics/device-distribution*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom","statusCode":500}' }),
    );
    await gotoAnalytics(authenticatedPage);

    const alert = authenticatedPage.getByRole('alert', { name: 'Analytics data unavailable' });
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText('do not treat missing charts as no data');
    await expect(card(authenticatedPage, 'Device Distribution').getByText('Unable to load device distribution data.')).toBeVisible();
    // The other sections still render.
    await expect(card(authenticatedPage, 'Playlist Playback Summary').getByText('No playlist playback data yet.', { exact: false })).toBeVisible();
  });

  test('exports the selected range as CSV (MUTATION)', async ({ authenticatedPage, token }) => {
    await seedDisplay(authenticatedPage, token, { status: 'online' });
    await gotoAnalytics(authenticatedPage);
    await authenticatedPage.getByRole('button', { name: 'week', exact: true }).click();

    const download = authenticatedPage.waitForEvent('download');
    await authenticatedPage.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;

    const today = new Date().toISOString().split('T')[0];
    expect(file.suggestedFilename()).toBe(`analytics-week-${today}.csv`);
    const path = await file.path();
    const { readFileSync } = await import('node:fs');
    const csv = readFileSync(path, 'utf8');
    expect(csv.length).toBeGreaterThan(0);
    expect(csv.split('\n').length).toBeGreaterThan(1);
  });

  test('handles a connection blip before load (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await authenticatedPage.context().setOffline(true);
    await authenticatedPage.waitForTimeout(500);
    await authenticatedPage.context().setOffline(false);

    await gotoAnalytics(authenticatedPage);
    await expect(kpiValue(authenticatedPage, 'Total Devices')).toHaveText(/^\d+$/);
  });

  test('charts fit a phone-width viewport (DOMAIN)', async ({ authenticatedPage, token }) => {
    await seedDisplay(authenticatedPage, token, { status: 'online' });
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await gotoAnalytics(authenticatedPage);

    const chart = card(authenticatedPage, 'Device Distribution').locator('.recharts-wrapper');
    await expect(chart).toHaveCount(1, { timeout: 10000 });
    const box = await chart.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  });
});
