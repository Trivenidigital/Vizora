import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';

/**
 * TYPING INTO DIALOG FIELDS, KEY BY KEY
 *
 * `fill()` sets an input's value in one atomic step, so it cannot see a
 * dialog that steals focus between keystrokes. useDialog's effect depended on
 * an inline `onClose`, so every keystroke re-rendered the parent, re-ran the
 * effect and moved focus to the dialog's first focusable element (the close
 * button): a user typing "hello" got "h". The whole suite filled forms with
 * `fill()` and never saw it.
 *
 * `pressSequentially` sends one key event per character, as a person does.
 */

async function typeLikeAPerson(page: Page, field: ReturnType<Page['getByLabel']>, text: string): Promise<void> {
  // Pre-hydration keystrokes are discarded on re-render; retry the whole
  // sequence from empty until the page is interactive, then assert it held.
  await expect(async () => {
    await field.clear();
    await field.click();
    await field.pressSequentially(text, { delay: 30 });
    await expect(field).toHaveValue(text, { timeout: 1000 });
  }).toPass({ timeout: 20000 });
}

test.describe('Dialogs keep focus while typing', () => {
  test('Create Playlist name accepts a typed phrase and keeps focus', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/playlists');
    await authenticatedPage.waitForLoadState('networkidle');

    await authenticatedPage.getByRole('button', { name: 'Create Playlist' }).first().click();
    const dialog = authenticatedPage.getByRole('dialog', { name: 'Create New Playlist' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const name = dialog.getByLabel('Playlist Name');
    await typeLikeAPerson(authenticatedPage, name, 'hello world');
    await expect(name).toBeFocused();
    // CONTROL: the close button is focusable and is NOT where focus went.
    await expect(dialog.getByRole('button', { name: 'Close modal' })).not.toBeFocused();

    // A second field in the same dialog behaves the same.
    const description = dialog.getByLabel('Description (Optional)');
    await typeLikeAPerson(authenticatedPage, description, 'typed one key at a time');
    await expect(description).toBeFocused();
    await expect(name).toHaveValue('hello world');
  });

  test('Create Schedule name accepts a typed phrase and keeps focus', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    await authenticatedPage.getByRole('button', { name: 'Create Schedule' }).first().click();
    const dialog = authenticatedPage.getByRole('dialog', { name: 'Create Schedule' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const name = dialog.getByPlaceholder('e.g., Morning Content, Holiday Special');
    await typeLikeAPerson(authenticatedPage, name as never, 'hello world');
    await expect(name).toBeFocused();
  });
});
