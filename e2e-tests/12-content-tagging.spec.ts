import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import {
  apiGet,
  apiSend,
  seedContent,
  seedTag,
  signInAsNewMember,
  tagContent,
} from './fixtures/seed';

/**
 * CONTENT TAGGING
 *
 * Rewritten 2026-10-15. The previous file held 20 tests, 19 of them wholly
 * inside `if (await x.isVisible())` guards and three ending on
 * `expect(count).toBeGreaterThanOrEqual(0)`. Most probed a tag-creation surface
 * that did not exist (ContentTagger was mounted without `onCreateTag`), against
 * a fresh org with no content and no tags, so every guard was false and the
 * file certified nothing. Several matched `input[type="checkbox"]` page-wide,
 * which in an empty org resolved to nothing at all.
 *
 * Every test below seeds what it needs through the API and asserts the
 * behaviour unconditionally:
 *   - the tag panel creates a tag (admin), and a duplicate name surfaces the
 *     server's 409 message without discarding the operator's input;
 *   - the bulk "Tag" action adds a tag to selected content and removes it;
 *   - the tag filter narrows the list to tagged content and can be cleared;
 *   - a viewer is offered neither creation nor bulk tagging, and the API agrees.
 *
 * Content rows are addressed in LIST view: its row checkboxes carry
 * `aria-label="Select <title>"`, while the grid view's checkboxes carry no
 * accessible name at all (reported as an a11y gap, not worked around).
 */

const tagsToggle = (page: Page): Locator => page.getByRole('button', { name: /^Tags( \(\d+\))?$/ });

/** The expanded tag panel: the card that holds the tagger's controls. */
const tagPanel = (page: Page): Locator =>
  page.locator('div.eh-dash-card').filter({ has: page.getByRole('button', { name: '+ Add Tag' }) });

const tagChip = (scope: Locator, name: string): Locator =>
  scope.getByRole('button', { name, exact: true });

const contentRows = (page: Page): Locator => page.locator('table tbody tr');

const rowFor = (page: Page, title: string): Locator =>
  contentRows(page).filter({ has: page.getByRole('checkbox', { name: `Select ${title}`, exact: true }) });

async function openContentListView(page: Page): Promise<void> {
  await page.goto('/dashboard/content');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'List view' }).click();
  await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
}

async function openTagPanel(page: Page): Promise<void> {
  await expect(tagsToggle(page)).toBeVisible({ timeout: 10000 });
  await tagsToggle(page).click();
}

test.describe('Content tagging', () => {
  test('admin creates a tag from the tag panel and it is listed', async ({ authenticatedPage, token }) => {
    const page = authenticatedPage;
    await openContentListView(page);
    await openTagPanel(page);

    // Fresh org: the empty state now points at the create control it renders.
    await expect(
      page.getByText('No content tags yet. Create one here, then select content and choose Tag to apply it.'),
    ).toBeVisible();

    const name = `Promo ${Date.now()}`;
    await tagPanel(page).getByRole('button', { name: '+ Add Tag' }).click();
    const form = page.getByRole('form', { name: 'Create tag' });
    await expect(form).toBeVisible();

    // The colour picker is a labelled group; pick one that is not the default.
    const colours = form.getByRole('group', { name: 'Tag colour' }).getByRole('button');
    await expect(colours).toHaveCount(6);
    await form.getByRole('button', { name: 'green', exact: true }).click();
    await expect(form.getByRole('button', { name: 'green', exact: true })).toHaveAttribute('aria-pressed', 'true');

    const create = form.getByRole('button', { name: 'Create', exact: true });
    await expect(create).toBeDisabled(); // nothing typed yet
    await form.getByRole('textbox', { name: 'Tag name' }).fill(name);
    await expect(create).toBeEnabled();
    await create.click();

    await expect(page.getByRole('alert').filter({ hasText: `Tag "${name}" created` })).toBeVisible();
    await expect(form).toBeHidden();
    const chip = tagChip(page.locator('div.eh-dash-card'), name);
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');

    // Persisted, with the colour that was picked.
    const tags = await apiGet<Array<{ name: string; color: string | null; contentCount: number }>>(
      page,
      token,
      '/content/tags',
    );
    expect(tags).toEqual([expect.objectContaining({ name, color: 'green', contentCount: 0 })]);
  });

  test('a duplicate tag name shows the 409 message and keeps the form open', async ({ authenticatedPage, token }) => {
    const page = authenticatedPage;
    const existing = await seedTag(page, token, { name: `Holiday ${Date.now()}` });

    await openContentListView(page);
    await openTagPanel(page);
    await expect(tagChip(page.locator('div.eh-dash-card'), existing.name)).toBeVisible();

    await tagPanel(page).getByRole('button', { name: '+ Add Tag' }).click();
    const form = page.getByRole('form', { name: 'Create tag' });
    const input = form.getByRole('textbox', { name: 'Tag name' });
    await input.fill(existing.name);
    // Submitted with Enter: the create control is a real <form>.
    await input.press('Enter');

    await expect(
      page.getByRole('alert').filter({ hasText: `A tag named "${existing.name}" already exists` }),
    ).toBeVisible();
    await expect(form).toBeVisible();
    await expect(input).toHaveValue(existing.name);

    // Still exactly one tag of that name.
    const tags = await apiGet<Array<{ name: string }>>(page, token, '/content/tags');
    expect(tags.filter((t) => t.name === existing.name)).toHaveLength(1);
  });

  test('bulk Tag action adds a tag to selected content, and the tag filter shows exactly those', async ({ authenticatedPage, token }) => {
    const page = authenticatedPage;
    const stamp = Date.now();
    const a = await seedContent(page, token, { name: `Tag A ${stamp}` });
    const b = await seedContent(page, token, { name: `Tag B ${stamp}` });
    const c = await seedContent(page, token, { name: `Tag C ${stamp}` });
    const tag = await seedTag(page, token, { name: `Featured ${stamp}` });

    await openContentListView(page);
    await expect(contentRows(page)).toHaveCount(3, { timeout: 10000 });

    await page.getByRole('checkbox', { name: `Select ${a.name}`, exact: true }).check();
    await page.getByRole('checkbox', { name: `Select ${b.name}`, exact: true }).check();
    await expect(page.getByText('2 items selected')).toBeVisible();

    await page.getByRole('button', { name: 'Tag', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tag Selected Content' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Choose tags to add to, or remove from, 2 selected items.')).toBeVisible();

    const add = dialog.getByRole('button', { name: 'Add to Selected' });
    await expect(add).toBeDisabled(); // no tag chosen yet
    await tagChip(dialog, tag.name).click();
    await expect(tagChip(dialog, tag.name)).toHaveAttribute('aria-pressed', 'true');
    await add.click();

    await expect(page.getByRole('alert').filter({ hasText: 'Added 1 tag to 2 items' })).toBeVisible();
    await expect(dialog).toBeHidden();
    // Selection resets after a bulk action.
    await expect(page.getByText(/items? selected/)).toBeHidden();

    // Filter by the tag: exactly the two tagged items remain.
    await openTagPanel(page);
    await tagChip(page.locator('div.eh-dash-card'), tag.name).click();
    await expect(tagsToggle(page)).toHaveText(/Tags\s*\(1\)/);
    await expect(page.getByText(`Tag: ${tag.name}`)).toBeVisible();
    await expect(contentRows(page)).toHaveCount(2, { timeout: 10000 });
    await expect(rowFor(page, a.name)).toBeVisible();
    await expect(rowFor(page, b.name)).toBeVisible();
    await expect(rowFor(page, c.name)).toHaveCount(0);

    // Clearing the tag filter brings the untagged item back.
    await page.getByRole('button', { name: 'Clear tag filters' }).click();
    await expect(contentRows(page)).toHaveCount(3, { timeout: 10000 });
    await expect(rowFor(page, c.name)).toBeVisible();
    await expect(tagChip(page.locator('div.eh-dash-card'), tag.name)).toHaveAttribute('aria-pressed', 'false');
  });

  test('bulk Tag action removes a tag from selected content only', async ({ authenticatedPage, token }) => {
    const page = authenticatedPage;
    const stamp = Date.now();
    const keep = await seedContent(page, token, { name: `Keep ${stamp}` });
    const strip = await seedContent(page, token, { name: `Strip ${stamp}` });
    const tag = await seedTag(page, token, { name: `Seasonal ${stamp}` });
    await tagContent(page, token, [keep.id, strip.id], [tag.id]);

    await openContentListView(page);
    await expect(contentRows(page)).toHaveCount(2, { timeout: 10000 });

    await page.getByRole('checkbox', { name: `Select ${strip.name}`, exact: true }).check();
    await page.getByRole('button', { name: 'Tag', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tag Selected Content' });
    const remove = dialog.getByRole('button', { name: 'Remove from Selected' });
    await expect(remove).toBeDisabled();
    await tagChip(dialog, tag.name).click();
    await remove.click();

    await expect(page.getByRole('alert').filter({ hasText: 'Removed 1 tag from 1 item' })).toBeVisible();
    await expect(dialog).toBeHidden();

    await openTagPanel(page);
    await tagChip(page.locator('div.eh-dash-card'), tag.name).click();
    await expect(contentRows(page)).toHaveCount(1, { timeout: 10000 });
    await expect(rowFor(page, keep.name)).toBeVisible();

    // And the server agrees on the usage count.
    const tags = await apiGet<Array<{ id: string; contentCount: number }>>(page, token, '/content/tags');
    expect(tags.find((t) => t.id === tag.id)?.contentCount).toBe(1);
  });

  test('a viewer can filter by tag but is offered neither creation nor bulk tagging', async ({ authenticatedPage, token }) => {
    const page = authenticatedPage;
    const stamp = Date.now();
    const item = await seedContent(page, token, { name: `Viewer Item ${stamp}` });
    const tag = await seedTag(page, token, { name: `Viewer Tag ${stamp}` });
    await tagContent(page, token, [item.id], [tag.id]);

    const viewerToken = await signInAsNewMember(page, token, 'viewer');

    await openContentListView(page);
    await expect(rowFor(page, item.name)).toHaveCount(0); // viewers get no row checkboxes
    await expect(page.getByRole('button', { name: `Preview ${item.name}` })).toBeVisible({ timeout: 10000 });

    await openTagPanel(page);
    // REACH CONTROL: the panel renders, and its tag chip is a findable button.
    const chip = page.getByRole('button', { name: tag.name, exact: true });
    await expect(chip).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Tag' })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Select all content items' })).toHaveCount(0);

    // Filtering still works for a viewer.
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(`Tag: ${tag.name}`)).toBeVisible();

    // The server enforces the same boundary.
    const res = await apiSend(page, viewerToken, 'POST', '/content/tags', { name: `Nope ${stamp}` });
    expect(res.status()).toBe(403);
  });

  test('a viewer in an org with no tags is told who can create them', async ({ authenticatedPage, token }) => {
    const page = authenticatedPage;
    await signInAsNewMember(page, token, 'viewer');

    await page.goto('/dashboard/content');
    await page.waitForLoadState('networkidle');
    await openTagPanel(page);
    await expect(page.getByText('No content tags yet. An admin or manager can create them.')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Tag' })).toHaveCount(0);
  });
});
