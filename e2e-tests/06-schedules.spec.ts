import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { apiGet, seedDisplay, seedPlaylist, seedSchedule } from './fixtures/seed';

/**
 * SCHEDULES
 *
 * Rewritten 2026-10-15. 18 of the previous tests ran their bodies inside
 * `if (await x.isVisible())` guards against a fresh org with no playlists, no
 * displays and no schedules - so Edit/Delete/Duplicate/search never had a row
 * to act on and passed by doing nothing. Every test now seeds what it touches
 * through the API and asserts unconditionally.
 *
 * The route is gated by the build-time NEXT_PUBLIC_SCHEDULES_ENABLED flag. The
 * e2e stack (and CI's playwright job) builds it ON, so the gate notice here is
 * a broken environment, not a product state: it FAILS rather than skipping
 * the whole file, because a skipped count is not a safe count.
 */

const schedulesHeading = (page: Page): Locator => page.locator('h2').filter({ hasText: 'Schedules' });
const totalCount = (page: Page, n: number): Locator => page.getByText(`(${n} total)`);
const createDialog = (page: Page): Locator => page.getByRole('dialog', { name: 'Create Schedule' });

/** One schedule card, found by its <h3> title. */
const scheduleCard = (page: Page, name: string): Locator =>
  page.locator('div.eh-dash-card').filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) });

/**
 * The page's success toast. SOFT: at b14dd8bf the schedules page calls
 * useToast() but never renders its ToastContainer, so no toast is ever shown
 * (reported as a product defect). The soft assertion keeps that failure red
 * while the rest of each CRUD test still verifies the actual outcome.
 */
const scheduleToast = (page: Page, text: string): Locator => page.getByRole('alert').filter({ hasText: text });

const statusFilter = (page: Page): Locator => page.getByRole('group', { name: 'Filter schedules by status' });

async function gotoSchedules(page: Page): Promise<void> {
  await page.goto('/dashboard/schedules');
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByText(/Scheduling is temporarily unavailable/i),
    'NEXT_PUBLIC_SCHEDULES_ENABLED must be true when the e2e web server starts',
  ).toHaveCount(0);
  await expect(schedulesHeading(page)).toBeVisible({ timeout: 10000 });
}

async function openCreateDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Create Schedule' }).first().click();
  const dialog = createDialog(page);
  await expect(dialog).toBeVisible({ timeout: 5000 });
  return dialog;
}

/** DaySelector's summary line ("5 days selected: Monday, ..."). */
const daySummary = (dialog: Locator): Locator => dialog.getByText(/\d+ days? selected:/);

test.describe('Schedules', () => {
  // ============= LOAD & EMPTY STATE =============

  test('loads with heading, subtitle and a zero count in a fresh org', async ({ authenticatedPage }) => {
    await gotoSchedules(authenticatedPage);
    await expect(authenticatedPage.getByText(/Automate content playback/i).first()).toBeVisible();
    await expect(totalCount(authenticatedPage, 0)).toBeVisible();
  });

  test('empty org shows the empty state with a create action, and no filter controls', async ({ authenticatedPage }) => {
    await gotoSchedules(authenticatedPage);

    await expect(authenticatedPage.getByText('No schedules yet')).toBeVisible();
    // Two create controls: the header button and the empty state's action.
    await expect(authenticatedPage.getByRole('button', { name: 'Create Schedule' })).toHaveCount(2);

    // Search and status chips render only once schedules exist. REACH CONTROL:
    // the List/Calendar toggle is in the same region and IS found.
    await expect(authenticatedPage.getByRole('button', { name: /^(list|calendar)$/i })).toHaveCount(2);
    await expect(authenticatedPage.getByRole('textbox', { name: 'Search schedules by name' })).toHaveCount(0);
    await expect(statusFilter(authenticatedPage)).toHaveCount(0);
  });

  // ============= CREATE DIALOG =============

  test('opens the create dialog', async ({ authenticatedPage }) => {
    await gotoSchedules(authenticatedPage);
    const dialog = await openCreateDialog(authenticatedPage);
    await expect(dialog.getByRole('heading', { name: 'Create Schedule' })).toBeVisible();

    // Cancel closes it without creating anything.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(totalCount(authenticatedPage, 0)).toBeVisible();
  });

  test('submitting an empty form names every missing field and creates nothing (BOUNDARY)', async ({ authenticatedPage }) => {
    await gotoSchedules(authenticatedPage);
    const dialog = await openCreateDialog(authenticatedPage);

    /*
     * The product validates ON SUBMIT (the button carries
     * `disabled={actionLoading}` only). Name, playlist and target are the
     * fields a fresh form leaves empty; days and duration are pre-filled.
     */
    const submit = dialog.getByRole('button', { name: /^create$/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(dialog.getByText('Schedule name is required')).toBeVisible({ timeout: 5000 });
    // `exact`: the playlist <select>'s placeholder option is "Select a playlist...".
    await expect(dialog.getByText('Select a playlist', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Select at least one device')).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(totalCount(authenticatedPage, 0)).toBeVisible();
  });

  test('a whitespace-only name is rejected like an empty one (MUTATION)', async ({ authenticatedPage }) => {
    await gotoSchedules(authenticatedPage);
    const dialog = await openCreateDialog(authenticatedPage);

    const name = dialog.getByPlaceholder('e.g., Morning Content, Holiday Special');
    await name.fill('Test Schedule 001');
    await expect(name).toHaveValue('Test Schedule 001');

    await name.fill('   ');
    await dialog.getByRole('button', { name: /^create$/i }).click();
    await expect(dialog.getByText('Schedule name is required')).toBeVisible();

    // Typing clears the field's error.
    await name.fill('Morning');
    await expect(dialog.getByText('Schedule name is required')).toBeHidden();
  });

  test('start time is picked from 15-minute slots and presets (DOMAIN)', async ({ authenticatedPage }) => {
    await gotoSchedules(authenticatedPage);
    const dialog = await openCreateDialog(authenticatedPage);

    // TimePicker's trigger shows the current value, 09:00 by default.
    const trigger = dialog.getByRole('button', { name: '09:00', exact: true });
    await expect(trigger).toBeVisible();
    await trigger.click();

    /*
     * There is no free-text time entry, so an out-of-range value like 25:00
     * cannot be typed (the old test filled one into a selector that matched
     * nothing). The picker offers exactly 96 quarter-hour slots, 00:00..23:45,
     * plus its trigger - 97 buttons of that shape.
     */
    const slots = dialog.getByRole('button', { name: /^([01]\d|2[0-3]):(00|15|30|45)$/ });
    await expect(slots).toHaveCount(97);
    await expect(dialog.getByRole('button', { name: '23:45', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^24:/ })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Lunch Time (12:00 PM)' }).click();
    await expect(dialog.getByRole('button', { name: '12:00', exact: true })).toBeVisible();
    await expect(dialog.getByText('Common Times')).toBeHidden();
  });

  test('duration clamps to at least one minute and validates the upper bound (BOUNDARY)', async ({ authenticatedPage }) => {
    await gotoSchedules(authenticatedPage);
    const dialog = await openCreateDialog(authenticatedPage);

    const duration = dialog.locator('input[type="number"]');
    await expect(duration).toHaveValue('60');
    await expect(duration).toHaveAttribute('min', '1');
    await expect(duration).toHaveAttribute('max', '1440');

    await duration.fill('30');
    await expect(duration).toHaveValue('30');

    // onChange is Math.max(1, parseInt(v) || 0): negatives and zero become 1.
    await duration.fill('-30');
    await expect(duration).toHaveValue('1');
    await duration.fill('0');
    await expect(duration).toHaveValue('1');

    // Above the max is accepted by the field and rejected on submit.
    await duration.fill('1441');
    await dialog.getByRole('button', { name: /^create$/i }).click();
    await expect(dialog.getByText('Duration must be between 1 and 1440 minutes')).toBeVisible();
  });

  test('day toggles and presets drive the selected-days summary (DOMAIN)', async ({ authenticatedPage }) => {
    await gotoSchedules(authenticatedPage);
    const dialog = await openCreateDialog(authenticatedPage);

    // Default: weekdays.
    await expect(daySummary(dialog)).toHaveText(
      '5 days selected: Monday, Tuesday, Wednesday, Thursday, Friday',
    );

    // A single day toggles off (the button reads "Mon", titled "Monday").
    await dialog.getByTitle('Monday').click();
    await expect(daySummary(dialog)).toHaveText('4 days selected: Tuesday, Wednesday, Thursday, Friday');
    await dialog.getByTitle('Monday').click();
    await expect(daySummary(dialog)).toContainText('5 days selected');

    // "Weekdays" toggles all five off when all five are on...
    await dialog.getByRole('button', { name: 'Weekdays' }).click();
    await expect(dialog.getByText('Please select at least one day')).toBeVisible();
    await expect(daySummary(dialog)).toHaveCount(0);
    // ...and with no days, the next-occurrences preview disappears too.
    await expect(dialog.getByText('Next 10 Occurrences:')).toHaveCount(0);

    // "Weekends" then "All Days".
    await dialog.getByRole('button', { name: 'Weekends' }).click();
    await expect(daySummary(dialog)).toHaveText('2 days selected: Saturday, Sunday');
    await dialog.getByRole('button', { name: 'All Days' }).click();
    await expect(daySummary(dialog)).toContainText('7 days selected');

    // Submitting with no days names that error.
    await dialog.getByRole('button', { name: 'All Days' }).click();
    await dialog.getByRole('button', { name: /^create$/i }).click();
    await expect(dialog.getByText('Select at least one day', { exact: true })).toBeVisible();
  });

  test('previews the next ten occurrences for the chosen days (DOMAIN)', async ({ authenticatedPage }) => {
    await gotoSchedules(authenticatedPage);
    const dialog = await openCreateDialog(authenticatedPage);

    const preview = dialog.getByText('Next 10 Occurrences:').locator('xpath=..');
    await expect(preview).toBeVisible();
    // Ten dates ("Oct 15, 26") joined by bullets.
    const dates = (await preview.locator('div').innerText()).split(' • ');
    expect(dates).toHaveLength(10);
    for (const d of dates) expect(d).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{2}$/);
  });

  test('says the target display applies its own timezone, and offers no zone picker (BOUNDARY)', async ({ authenticatedPage, token }) => {
    // Seed a playlist so the dialog's playlist <select> has a real option.
    await seedPlaylist(authenticatedPage, token);
    await gotoSchedules(authenticatedPage);
    const dialog = await openCreateDialog(authenticatedPage);

    await expect(dialog.getByText('Target display timezone')).toBeVisible();
    await expect(dialog.getByText(/each target display applies its own configured timezone/i)).toBeVisible();

    // REACH CONTROL: the dialog renders a select with real options, so "no
    // zone-shaped option value" is a finding and not an empty match.
    const options = await dialog.locator('select option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value),
    );
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options.filter((v) => /^(UTC|[A-Za-z]+\/[A-Za-z_]+)$/.test(v))).toEqual([]);
  });

  test('lists the org playlists and displays as targets (DOMAIN)', async ({ authenticatedPage, token }) => {
    const playlist = await seedPlaylist(authenticatedPage, token);
    const d1 = await seedDisplay(authenticatedPage, token);
    const d2 = await seedDisplay(authenticatedPage, token);

    await gotoSchedules(authenticatedPage);
    const dialog = await openCreateDialog(authenticatedPage);

    const playlistSelect = dialog.locator('select').filter({ has: authenticatedPage.locator('option', { hasText: 'Select a playlist...' }) });
    await expect(playlistSelect.locator('option', { hasText: playlist.name })).toHaveCount(1);
    await playlistSelect.selectOption({ label: playlist.name });
    await expect(playlistSelect).toHaveValue(playlist.id);

    // Device targets are labelled checkboxes. An admin may pick several.
    const c1 = dialog.getByRole('checkbox', { name: d1.name });
    const c2 = dialog.getByRole('checkbox', { name: d2.name });
    await c1.check();
    await expect(dialog.getByText('1 device selected')).toBeVisible();
    await c2.check();
    await expect(dialog.getByText('2 devices selected')).toBeVisible();
    await c1.uncheck();
    await expect(c1).not.toBeChecked();
    await expect(dialog.getByText('1 device selected')).toBeVisible();
  });

  // ============= CRUD =============

  test('creates a schedule and lists it (MUTATION)', async ({ authenticatedPage, token }) => {
    const playlist = await seedPlaylist(authenticatedPage, token);
    const display = await seedDisplay(authenticatedPage, token);
    const name = `Morning Menu ${Date.now()}`;

    await gotoSchedules(authenticatedPage);
    const dialog = await openCreateDialog(authenticatedPage);
    await dialog.getByPlaceholder('e.g., Morning Content, Holiday Special').fill(name);
    await dialog.locator('select').first().selectOption({ label: playlist.name });
    await dialog.getByRole('checkbox', { name: display.name }).check();
    await dialog.getByRole('button', { name: /^create$/i }).click();

    await expect.soft(scheduleToast(authenticatedPage, 'Schedule created successfully')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(totalCount(authenticatedPage, 1)).toBeVisible();

    const card = scheduleCard(authenticatedPage, name);
    await expect(card).toBeVisible();
    await expect(card).toContainText('Active');
    await expect(card).toContainText('09:00 - 10:00');
    await expect(card).toContainText('Monday, Tuesday, Wednesday, Thursday, Friday');
    await expect(card).toContainText(playlist.name);
    await expect(card).toContainText(display.name);

    const schedules = await apiGet<{ data: Array<{ name: string; displayId: string }> }>(
      authenticatedPage,
      token,
      '/schedules?page=1&limit=50',
    );
    expect(schedules.data).toEqual([expect.objectContaining({ name, displayId: display.id })]);
  });

  test('edits an existing schedule (MUTATION)', async ({ authenticatedPage, token }) => {
    const playlist = await seedPlaylist(authenticatedPage, token);
    const display = await seedDisplay(authenticatedPage, token);
    const original = await seedSchedule(authenticatedPage, token, {
      name: `Lunch ${Date.now()}`,
      playlistId: playlist.id,
      displayId: display.id,
    });
    const renamed = `Lunch Rush ${Date.now()}`;

    await gotoSchedules(authenticatedPage);
    await scheduleCard(authenticatedPage, original.name).getByRole('button', { name: 'Edit' }).click();

    const dialog = authenticatedPage.getByRole('dialog', { name: 'Edit Schedule' });
    await expect(dialog).toBeVisible();
    const nameInput = dialog.getByPlaceholder('e.g., Morning Content, Holiday Special');
    await expect(nameInput).toHaveValue(original.name);
    await nameInput.fill(renamed);
    await dialog.getByRole('button', { name: 'Update' }).click();

    await expect.soft(scheduleToast(authenticatedPage, 'Schedule updated successfully')).toBeVisible();
    await expect(scheduleCard(authenticatedPage, renamed)).toBeVisible();
    await expect(scheduleCard(authenticatedPage, original.name)).toHaveCount(0);
    await expect(totalCount(authenticatedPage, 1)).toBeVisible();
  });

  test('deletes a schedule after confirmation (MUTATION)', async ({ authenticatedPage, token }) => {
    const playlist = await seedPlaylist(authenticatedPage, token);
    const display = await seedDisplay(authenticatedPage, token);
    const schedule = await seedSchedule(authenticatedPage, token, {
      name: `Doomed ${Date.now()}`,
      playlistId: playlist.id,
      displayId: display.id,
    });

    await gotoSchedules(authenticatedPage);
    await scheduleCard(authenticatedPage, schedule.name).getByRole('button', { name: 'Delete' }).click();

    const confirm = authenticatedPage.getByRole('dialog', { name: 'Delete Schedule' });
    await expect(confirm).toContainText(`Are you sure you want to delete "${schedule.name}"?`);
    await confirm.getByRole('button', { name: 'Confirm' }).click();

    await expect.soft(scheduleToast(authenticatedPage, 'Schedule deleted successfully')).toBeVisible();
    await expect(scheduleCard(authenticatedPage, schedule.name)).toHaveCount(0);
    await expect(totalCount(authenticatedPage, 0)).toBeVisible();
    await expect(authenticatedPage.getByText('No schedules yet')).toBeVisible();
  });

  test('duplicates a schedule (MUTATION)', async ({ authenticatedPage, token }) => {
    const playlist = await seedPlaylist(authenticatedPage, token);
    const display = await seedDisplay(authenticatedPage, token);
    const schedule = await seedSchedule(authenticatedPage, token, {
      name: `Original ${Date.now()}`,
      playlistId: playlist.id,
      displayId: display.id,
    });

    await gotoSchedules(authenticatedPage);
    await expect(totalCount(authenticatedPage, 1)).toBeVisible();
    await scheduleCard(authenticatedPage, schedule.name).getByRole('button', { name: 'Duplicate' }).click();

    await expect.soft(scheduleToast(authenticatedPage, 'Schedule duplicated successfully')).toBeVisible();
    await expect(totalCount(authenticatedPage, 2)).toBeVisible();

    const schedules = await apiGet<{ data: unknown[] }>(authenticatedPage, token, '/schedules?page=1&limit=50');
    expect(schedules.data).toHaveLength(2);
  });

  // ============= SEARCH & STATUS FILTER =============

  test('searches schedules by name and filters by Active/Inactive, with a filtered-empty state', async ({ authenticatedPage, token }) => {
    const playlist = await seedPlaylist(authenticatedPage, token);
    const display = await seedDisplay(authenticatedPage, token);
    const stamp = Date.now();
    const morning = await seedSchedule(authenticatedPage, token, {
      name: `Morning Menu ${stamp}`, playlistId: playlist.id, displayId: display.id, isActive: true,
    });
    const evening = await seedSchedule(authenticatedPage, token, {
      name: `Evening Promo ${stamp}`, playlistId: playlist.id, displayId: display.id, isActive: true,
    });
    const paused = await seedSchedule(authenticatedPage, token, {
      name: `Weekend Brunch ${stamp}`, playlistId: playlist.id, displayId: display.id, isActive: false,
    });

    await gotoSchedules(authenticatedPage);
    const cards = [morning, evening, paused].map((s) => scheduleCard(authenticatedPage, s.name));
    for (const card of cards) await expect(card).toBeVisible();

    // Status chips carry live counts, and "All" starts pressed.
    const chips = statusFilter(authenticatedPage);
    const all = chips.getByRole('button', { name: /All$/ });
    const active = chips.getByRole('button', { name: /Active$/ });
    const inactive = chips.getByRole('button', { name: /Inactive$/ });
    await expect(all).toHaveText(/3\s*All/);
    await expect(active).toHaveText(/2\s*Active/);
    await expect(inactive).toHaveText(/1\s*Inactive/);
    await expect(all).toHaveAttribute('aria-pressed', 'true');

    // Search is case-insensitive on name.
    const search = authenticatedPage.getByRole('textbox', { name: 'Search schedules by name' });
    await search.fill('MORNING');
    await expect(cards[0]).toBeVisible();
    await expect(cards[1]).toHaveCount(0);
    await expect(cards[2]).toHaveCount(0);
    await search.fill('');
    for (const card of cards) await expect(card).toBeVisible();

    // Inactive only.
    await inactive.click();
    await expect(inactive).toHaveAttribute('aria-pressed', 'true');
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    await expect(cards[2]).toBeVisible();
    await expect(cards[0]).toHaveCount(0);
    await expect(cards[1]).toHaveCount(0);

    // Active only.
    await active.click();
    await expect(cards[0]).toBeVisible();
    await expect(cards[1]).toBeVisible();
    await expect(cards[2]).toHaveCount(0);

    // Active + a search that matches only the inactive one = filtered-empty,
    // which is NOT the "No schedules yet" empty state.
    await search.fill('brunch');
    await expect(authenticatedPage.getByText('No schedules match these filters')).toBeVisible();
    await expect(
      authenticatedPage.getByText('3 schedules exist, but none match the current search or status filter.'),
    ).toBeVisible();
    await expect(authenticatedPage.getByText('No schedules yet')).toHaveCount(0);
    // The header count is the org's, not the filtered view's.
    await expect(totalCount(authenticatedPage, 3)).toBeVisible();

    await authenticatedPage.getByRole('button', { name: 'Clear filters' }).click();
    await expect(search).toHaveValue('');
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    for (const card of cards) await expect(card).toBeVisible();
  });

  // ============= NAVIGATION & LAYOUT =============

  test('survives navigating away and back (DOMAIN)', async ({ authenticatedPage, token }) => {
    const playlist = await seedPlaylist(authenticatedPage, token);
    const display = await seedDisplay(authenticatedPage, token);
    const schedule = await seedSchedule(authenticatedPage, token, {
      name: `Sticky ${Date.now()}`, playlistId: playlist.id, displayId: display.id,
    });

    await gotoSchedules(authenticatedPage);
    await expect(scheduleCard(authenticatedPage, schedule.name)).toBeVisible();

    await authenticatedPage.getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(authenticatedPage).toHaveURL(/\/dashboard$/);
    await authenticatedPage.getByRole('link', { name: 'Schedules', exact: true }).click();
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/schedules$/);
    await expect(scheduleCard(authenticatedPage, schedule.name)).toBeVisible({ timeout: 10000 });
  });

  test('reopening the create dialog after Cancel starts from a clean form (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await gotoSchedules(authenticatedPage);

    let dialog = await openCreateDialog(authenticatedPage);
    await dialog.getByPlaceholder('e.g., Morning Content, Holiday Special').fill('Half-typed');
    await dialog.getByRole('button', { name: /^create$/i }).click();
    await expect(dialog.getByText('Select a playlist', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    dialog = await openCreateDialog(authenticatedPage);
    await expect(dialog.getByPlaceholder('e.g., Morning Content, Holiday Special')).toHaveValue('');
    await expect(dialog.getByText('Select a playlist', { exact: true })).toHaveCount(0);
  });

  test('is usable at phone width (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await gotoSchedules(authenticatedPage);

    const create = authenticatedPage.getByRole('button', { name: 'Create Schedule' }).first();
    await expect(create).toBeVisible();
    await expect(create).toBeInViewport();
    await create.click();
    await expect(createDialog(authenticatedPage)).toBeVisible();
  });
});
