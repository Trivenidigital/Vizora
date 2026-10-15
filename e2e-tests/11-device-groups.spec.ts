import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { apiGet, seedDisplay, seedDisplayGroup, signInAsNewMember } from './fixtures/seed';

/**
 * DEVICE GROUPS
 *
 * Rewritten 2026-10-15. 16 of 19 tests were wholly inside isVisible / count
 * guards and four ended on `toBeGreaterThanOrEqual(0)`. Most grabbed
 * `input[type="checkbox"]` page-wide - in a fresh org with no devices and no
 * groups that matched nothing, so the "filter", "multi-select", "bulk" and
 * "clear" tests all exercised an empty page. Groups now exist because each test
 * seeds them.
 *
 * The group panel is a collapsed "Device Groups (N)" card on the devices page;
 * each group is a checkbox labelled "<name> <N> device(s)", and checking groups
 * filters the device table to their members.
 *
 * Nested groups were removed as dead code at this commit (DisplayGroup has no
 * parent column), so the old hierarchy probes are gone with them.
 */

const devicesHeading = (page: Page): Locator => page.locator('h2').filter({ hasText: 'Devices' });
const rows = (page: Page): Locator => page.locator('table.eh-datatable tbody tr');
const row = (page: Page, nickname: string): Locator => rows(page).filter({ hasText: nickname });
const groupPanel = (page: Page): Locator => page.locator('#device-group-filter');
const groupCheckbox = (page: Page, name: string): Locator =>
  groupPanel(page).getByRole('checkbox', { name: new RegExp(`^${name} \\d+ devices?$`) });

async function openGroupPanel(page: Page, expectedCount: number): Promise<void> {
  await page.goto('/dashboard/devices');
  await page.waitForLoadState('networkidle');
  await expect(devicesHeading(page)).toBeVisible({ timeout: 10000 });
  const toggle = page.getByRole('button', { name: `Device Groups (${expectedCount})` });
  await expect(toggle).toBeVisible({ timeout: 10000 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(groupPanel(page)).toBeVisible();
}

test.describe('Device groups', () => {
  test('a fresh org shows an empty group panel with a create action', async ({ authenticatedPage }) => {
    await openGroupPanel(authenticatedPage, 0);
    await expect(groupPanel(authenticatedPage).getByText('No device groups yet')).toBeVisible();
    await expect(groupPanel(authenticatedPage).getByRole('button', { name: '+ Create New Group' })).toBeVisible();
    await expect(groupPanel(authenticatedPage).getByRole('checkbox')).toHaveCount(0);
  });

  test('lists each group with its device count and description (DOMAIN)', async ({ authenticatedPage, token }) => {
    const d1 = await seedDisplay(authenticatedPage, token);
    const d2 = await seedDisplay(authenticatedPage, token);
    const stamp = Date.now();
    await seedDisplayGroup(authenticatedPage, token, {
      name: `Store A ${stamp}`, description: 'Front of house', displayIds: [d1.id, d2.id],
    });
    await seedDisplayGroup(authenticatedPage, token, { name: `Store B ${stamp}`, displayIds: [d1.id] });
    await seedDisplayGroup(authenticatedPage, token, { name: `Empty ${stamp}` });

    await openGroupPanel(authenticatedPage, 3);
    await expect(groupPanel(authenticatedPage).getByRole('checkbox')).toHaveCount(3);
    await expect(groupPanel(authenticatedPage).getByRole('checkbox', { name: `Store A ${stamp} 2 devices` })).toBeVisible();
    await expect(groupPanel(authenticatedPage).getByRole('checkbox', { name: `Store B ${stamp} 1 device` })).toBeVisible();
    await expect(groupPanel(authenticatedPage).getByRole('checkbox', { name: `Empty ${stamp} 0 devices` })).toBeVisible();
    // The description is carried as the info icon's tooltip.
    await expect(groupPanel(authenticatedPage).getByTitle('Front of house')).toHaveCount(1);
  });

  test('selecting groups filters the table to their members, and unselecting restores it (MUTATION)', async ({ authenticatedPage, token }) => {
    const a = await seedDisplay(authenticatedPage, token, { name: `Lobby ${Date.now()}` });
    const b = await seedDisplay(authenticatedPage, token, { name: `Kitchen ${Date.now()}` });
    const c = await seedDisplay(authenticatedPage, token, { name: `Patio ${Date.now()}` });
    const stamp = Date.now();
    await seedDisplayGroup(authenticatedPage, token, { name: `North ${stamp}`, displayIds: [a.id] });
    await seedDisplayGroup(authenticatedPage, token, { name: `South ${stamp}`, displayIds: [b.id] });

    await openGroupPanel(authenticatedPage, 2);
    await expect(rows(authenticatedPage)).toHaveCount(3);

    // One group.
    await groupCheckbox(authenticatedPage, `North ${stamp}`).check();
    await expect(groupPanel(authenticatedPage).getByText('1 group selected')).toBeVisible();
    await expect(rows(authenticatedPage)).toHaveCount(1);
    await expect(row(authenticatedPage, a.name)).toHaveCount(1);

    // Two groups: the union of their members.
    await groupCheckbox(authenticatedPage, `South ${stamp}`).check();
    await expect(groupPanel(authenticatedPage).getByText('2 groups selected')).toBeVisible();
    await expect(rows(authenticatedPage)).toHaveCount(2);
    await expect(row(authenticatedPage, b.name)).toHaveCount(1);
    await expect(row(authenticatedPage, c.name)).toHaveCount(0);

    // Clearing every selection restores the whole fleet.
    await groupCheckbox(authenticatedPage, `North ${stamp}`).uncheck();
    await groupCheckbox(authenticatedPage, `South ${stamp}`).uncheck();
    await expect(groupPanel(authenticatedPage).getByText(/groups? selected/)).toHaveCount(0);
    await expect(rows(authenticatedPage)).toHaveCount(3);
  });

  test('a group with no members filters to the no-match state, not "No devices yet" (BOUNDARY)', async ({ authenticatedPage, token }) => {
    await seedDisplay(authenticatedPage, token);
    const empty = await seedDisplayGroup(authenticatedPage, token, { name: `Hollow ${Date.now()}` });

    await openGroupPanel(authenticatedPage, 1);
    await groupCheckbox(authenticatedPage, empty.name).check();
    await expect(rows(authenticatedPage)).toHaveCount(0);
    await expect(authenticatedPage.getByText('No devices match these filters')).toBeVisible();
    await expect(authenticatedPage.getByText('No devices yet')).toHaveCount(0);
  });

  test('validates the group name before enabling Create (BOUNDARY)', async ({ authenticatedPage }) => {
    await openGroupPanel(authenticatedPage, 0);
    const panel = groupPanel(authenticatedPage);
    await panel.getByRole('button', { name: '+ Create New Group' }).click();

    const nameInput = panel.getByPlaceholder(/^Group name/);
    const create = panel.getByRole('button', { name: 'Create', exact: true });
    await expect(nameInput).toBeVisible();

    // Cancel stays live throughout: enablement is decided per button by the
    // name, the form is not simply rendered disabled.
    await expect(create).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
    await nameInput.fill('   ');
    await expect(create).toBeDisabled();
    await nameInput.fill(`E2E Group ${Date.now()}`);
    await expect(create).toBeEnabled();
    await nameInput.fill('');
    await expect(create).toBeDisabled();
  });

  test('creates a group from the panel (MUTATION)', async ({ authenticatedPage, token }) => {
    const name = `Drive-thru ${Date.now()}`;
    await openGroupPanel(authenticatedPage, 0);
    const panel = groupPanel(authenticatedPage);

    await panel.getByRole('button', { name: '+ Create New Group' }).click();
    await panel.getByPlaceholder(/^Group name/).fill(name);
    await panel.getByPlaceholder('Description (optional)').fill('Outdoor screens');
    await panel.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(authenticatedPage.getByRole('alert').filter({ hasText: 'Group created' })).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: 'Device Groups (1)' })).toBeVisible();
    await expect(panel.getByRole('checkbox', { name: `${name} 0 devices` })).toBeVisible();
    await expect(panel.getByPlaceholder(/^Group name/)).toHaveCount(0);

    const groups = await apiGet<{ data: Array<{ name: string; description: string | null }> }>(
      authenticatedPage,
      token,
      '/display-groups?page=1&limit=50',
    );
    expect(groups.data).toEqual([expect.objectContaining({ name, description: 'Outdoor screens' })]);
  });

  test('adds selected devices to a group with the bulk action (MUTATION)', async ({ authenticatedPage, token }) => {
    const a = await seedDisplay(authenticatedPage, token);
    const b = await seedDisplay(authenticatedPage, token);
    const c = await seedDisplay(authenticatedPage, token);
    const group = await seedDisplayGroup(authenticatedPage, token, { name: `Bulk ${Date.now()}` });

    await openGroupPanel(authenticatedPage, 1);
    await expect(groupCheckbox(authenticatedPage, group.name)).toHaveAccessibleName(`${group.name} 0 devices`);

    await authenticatedPage.getByRole('checkbox', { name: `Select ${a.name}` }).check();
    await authenticatedPage.getByRole('checkbox', { name: `Select ${b.name}` }).check();
    await expect(authenticatedPage.getByText('2 devices selected')).toBeVisible();
    await authenticatedPage.getByRole('button', { name: 'Add to Group' }).click();

    const dialog = authenticatedPage.getByRole('dialog', { name: 'Add Selected Devices to Group' });
    await expect(dialog).toContainText('Add 2 selected devices to a group.');
    const submit = dialog.getByRole('button', { name: 'Add to Group' });
    await expect(submit).toBeDisabled();
    await dialog.getByRole('combobox', { name: 'Group to add devices to' }).selectOption({ label: group.name });
    await submit.click();
    await expect(dialog).toBeHidden();

    // The count updates and the group now filters to exactly those two.
    await expect(groupCheckbox(authenticatedPage, group.name)).toHaveAccessibleName(`${group.name} 2 devices`, { timeout: 10000 });
    await groupCheckbox(authenticatedPage, group.name).check();
    await expect(rows(authenticatedPage)).toHaveCount(2);
    await expect(row(authenticatedPage, c.name)).toHaveCount(0);
  });

  test('offers no way to rename, delete or remove members from a group (pinned gap)', async ({ authenticatedPage, token }) => {
    const d = await seedDisplay(authenticatedPage, token);
    const group = await seedDisplayGroup(authenticatedPage, token, { name: `Fixed ${Date.now()}`, displayIds: [d.id] });

    await openGroupPanel(authenticatedPage, 1);
    const panel = groupPanel(authenticatedPage);

    /*
     * `updateDisplayGroup`, `deleteDisplayGroup` and `removeDisplaysFromGroup`
     * exist on the API client (web/src/lib/api/displays.ts) with NO call site
     * in web/src. The panel renders, per group, only its selection checkbox;
     * the one button is "+ Create New Group". Reported as a gap, not built.
     *
     * REACH CONTROL: the panel holds the group's checkbox and exactly one
     * button, so the zeros below are about the product, not a dead locator.
     */
    await expect(groupCheckbox(authenticatedPage, group.name)).toBeVisible();
    await expect(panel.getByRole('button')).toHaveCount(1);
    await expect(panel.getByRole('button')).toHaveText('+ Create New Group');
    await expect(authenticatedPage.getByRole('button', { name: /rename.*group|edit.*group/i })).toHaveCount(0);
    await expect(authenticatedPage.getByRole('button', { name: /delete.*group|remove.*group/i })).toHaveCount(0);
    await expect(authenticatedPage.getByRole('button', { name: /remove from group/i })).toHaveCount(0);
  });

  test('a viewer can filter by group but not create one', async ({ authenticatedPage, token }) => {
    const d = await seedDisplay(authenticatedPage, token);
    const group = await seedDisplayGroup(authenticatedPage, token, { name: `Viewer ${Date.now()}`, displayIds: [d.id] });
    await signInAsNewMember(authenticatedPage, token, 'viewer');

    await openGroupPanel(authenticatedPage, 1);
    // REACH CONTROL: the group is there and selectable.
    await groupCheckbox(authenticatedPage, group.name).check();
    await expect(rows(authenticatedPage)).toHaveCount(1);
    await expect(groupPanel(authenticatedPage).getByRole('button', { name: '+ Create New Group' })).toHaveCount(0);
  });
});
