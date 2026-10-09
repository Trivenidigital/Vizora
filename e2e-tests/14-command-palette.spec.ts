import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';

/**
 * PHASE 7.2: COMMAND PALETTE TEST SUITE
 *
 * BMAD Method Coverage:
 * ├─ Boundary Tests: Command count, search limits
 * ├─ Mutation Tests: Keyboard navigation, command execution
 * ├─ Adversarial Tests: Rapid keystrokes, invalid commands
 * └─ Domain Tests: Navigation commands, keyboard shortcuts
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Every locator in this file used to be `[role="dialog"], [class*="palette"],
 * [class*="command"]`. The palette (web/src/components/CommandPalette.tsx)
 * matches NONE of those: its modal is a bare <div> with no role, its command
 * rows are plain <button>s with no `option` role, and no class in the component
 * contains the string "palette" or "command". So `palette.isVisible()` was
 * always false, every `if (await palette.isVisible(...))` body was dead, and
 * the handful of assertions that did run were `expect(<x> || true)`.
 *
 * The handles this file uses instead:
 *   - the card itself, which as of 2026-10-09 declares
 *     `role="dialog" aria-modal="true" aria-label="Command palette"` — every
 *     scoped locator here resolves through `paletteCard`, so that one
 *     definition is the single place this file depends on those attributes;
 *   - the ⌘K hint chip, rendered only while the palette is CLOSED;
 *   - the search field, `placeholder="Search commands..."`, which exists only
 *     while the palette is OPEN and is therefore the open/closed observable;
 *   - the command rows, every one of which is titled "Go to <section>".
 *
 * Product gap found while writing this and deliberately NOT fixed here: the
 * command list is not a `listbox`/`option` structure and the selected row
 * carries no `aria-selected`/`aria-activedescendant`, so the selection ground
 * (`bg-[var(--lw-forest)]`) is the ONLY observable for "selected" — which is
 * why two tests below assert on that class.
 */

/**
 * Commands `getDefaultCommands` always returns. "Go to Schedules" is
 * deliberately absent: it is gated on SCHEDULES_ENABLED, a BUILD input
 * (NEXT_PUBLIC_SCHEDULES_ENABLED) the spec cannot see, so asserting either its
 * presence or its absence would pin a flag state rather than a contract.
 */
const CORE_COMMANDS = [
  'Go to Dashboard',
  'Go to Devices',
  'Go to Content',
  'Go to Playlists',
  'Go to Analytics',
  'Go to Settings',
] as const;

/** The selection ground. Tailwind emits the arbitrary value as the class name. */
const SELECTED = /bg-\[var\(--lw-forest\)\]/;

/** Present only while the palette is open — so this IS "the palette is open". */
const searchField = (page: Page): Locator => page.getByPlaceholder('Search commands...');

/** Present only while the palette is closed. */
const hint = (page: Page): Locator => page.getByText('⌘K', { exact: true });

/**
 * The open palette's card. Scoping every text query to it matters: the
 * cookie-consent bar is permanently mounted off-screen and its buttons match
 * loose text locators on every page.
 */
const paletteCard = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Command palette' });

const commands = (page: Page): Locator =>
  paletteCard(page).getByRole('button', { name: /^Go to / });

/**
 * One command row. `hasText` rather than an exact accessible name: each row
 * renders its title AND its description, so the button's accessible name is
 * "Go to Devices Manage your devices", not "Go to Devices".
 */
const command = (page: Page, title: string): Locator =>
  commands(page).filter({ hasText: title });

async function openPalette(page: Page): Promise<void> {
  await page.keyboard.press('Control+K');
  await expect(searchField(page)).toBeVisible({ timeout: 5000 });
}

test.describe('Phase 7.2: Command Palette (Power User Navigation)', () => {

  test('should display command palette hint in UI (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(hint(authenticatedPage)).toBeVisible({ timeout: 5000 });
  });

  test('should open palette with Cmd+K (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    // The wrapper's handler accepts either modifier (`e.metaKey || e.ctrlKey`),
    // so both are a real contract and both are asserted rather than one being
    // tried as a fallback for the other.
    await authenticatedPage.keyboard.press('Meta+K');
    await expect(searchField(authenticatedPage)).toBeVisible({ timeout: 5000 });

    await authenticatedPage.keyboard.press('Escape');
    await expect(searchField(authenticatedPage)).toBeHidden();

    await authenticatedPage.keyboard.press('Control+K');
    await expect(searchField(authenticatedPage)).toBeVisible({ timeout: 5000 });

    // And it announces itself as a modal dialog rather than a search box that
    // merely appeared. This is the one assertion that pins the attributes
    // `paletteCard` relies on, so a regression there fails here first.
    await expect(paletteCard(authenticatedPage)).toHaveAttribute('aria-modal', 'true');
  });

  test('should close palette with Escape (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    /*
     * This is not optional behaviour, which is what the old `expect(isClosed ||
     * true)` and its "May or may not close" comment asserted. Escape is wired
     * through CommandPalette's `setOpen`, and the component carries a long
     * comment explaining that every dismissal path used to write to local state
     * the controlled parent did not read — so Escape doing nothing is precisely
     * the regression this test exists to catch.
     */
    await authenticatedPage.keyboard.press('Escape');
    await expect(searchField(authenticatedPage)).toBeHidden();
    await expect(hint(authenticatedPage)).toBeVisible();
  });

  test('should display search input (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    // autoFocus: the palette is useless if the user has to click the field.
    await expect(searchField(authenticatedPage)).toBeFocused();
  });

  test('should filter commands by search (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    const unfiltered = await commands(authenticatedPage).count();
    expect(unfiltered).toBeGreaterThan(1);

    await searchField(authenticatedPage).fill('device');

    // "device" matches exactly one command: "Go to Devices" (by title, by
    // description "Manage your devices" and by keyword). Narrowing from many to
    // that one IS the filter contract.
    await expect(commands(authenticatedPage)).toHaveCount(1);
    await expect(command(authenticatedPage, 'Go to Devices')).toBeVisible();
  });

  test('should show navigation commands (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    for (const title of CORE_COMMANDS) {
      await expect(command(authenticatedPage, title)).toBeVisible();
    }
  });

  test('should show command description (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    const card = paletteCard(authenticatedPage);
    await expect(card.getByText('View dashboard overview', { exact: true })).toBeVisible();
    await expect(card.getByText('Manage your devices', { exact: true })).toBeVisible();
  });

  test('should navigate commands with arrow keys (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    const dashboard = command(authenticatedPage, 'Go to Dashboard');
    const devices = command(authenticatedPage, 'Go to Devices');

    // selectedIndex starts at 0, so the first command is already selected.
    await expect(dashboard).toHaveClass(SELECTED);

    await authenticatedPage.keyboard.press('ArrowDown');
    await expect(devices).toHaveClass(SELECTED);
    await expect(dashboard).not.toHaveClass(SELECTED);

    await authenticatedPage.keyboard.press('ArrowUp');
    await expect(dashboard).toHaveClass(SELECTED);
    await expect(devices).not.toHaveClass(SELECTED);
  });

  test('should highlight selected command (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    // Exactly one row is highlighted at a time — "highlighted" being a class,
    // because the component exposes no aria state for it (see the file header).
    const highlighted = paletteCard(authenticatedPage).locator('button[class*="lw-forest"]');
    await expect(highlighted).toHaveCount(1);
    await expect(highlighted).toHaveText(/Go to Dashboard/);

    await authenticatedPage.keyboard.press('ArrowDown');
    await expect(highlighted).toHaveCount(1);
    await expect(highlighted).toHaveText(/Go to Devices/);
  });

  test('should execute command with Enter (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    // Command order is fixed by getDefaultCommands, and the flag-gated
    // "Go to Schedules" sits after Playlists — so one ArrowDown is "Go to
    // Devices" whatever SCHEDULES_ENABLED is.
    await authenticatedPage.keyboard.press('ArrowDown');
    await expect(command(authenticatedPage, 'Go to Devices')).toHaveClass(SELECTED);

    await authenticatedPage.keyboard.press('Enter');

    await expect(authenticatedPage).toHaveURL(/\/dashboard\/devices$/);
    // Executing a command must also dismiss the palette: leaving it covering
    // the page it just navigated to is the exact bug CommandPalette's `setOpen`
    // docblock describes.
    await expect(searchField(authenticatedPage)).toBeHidden();
  });

  test('should show footer help text (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    const card = paletteCard(authenticatedPage);
    await expect(card.getByText('↑↓ Navigate')).toBeVisible();
    await expect(card.getByText('↵ Select')).toBeVisible();
    await expect(card.getByText('Esc to close')).toBeVisible();

    // The footer is conditional on there being results, so a query that matches
    // nothing must remove it. This also proves the three assertions above were
    // reading the footer rather than any text that happens to sit on the page.
    await searchField(authenticatedPage).fill('zzzzz-no-such-command');
    await expect(card.getByText('No commands found')).toBeVisible();
    await expect(card.getByText('Esc to close')).toHaveCount(0);
  });

  test('should show keyboard shortcuts in help (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    // The ESC key cap in the search row — a separate affordance from the footer
    // asserted above, and the only dismissal hint that survives an empty result
    // set (the footer does not).
    await expect(paletteCard(authenticatedPage).getByText('ESC', { exact: true })).toBeVisible();

    await searchField(authenticatedPage).fill('zzzzz-no-such-command');
    await expect(paletteCard(authenticatedPage).getByText('ESC', { exact: true })).toBeVisible();
  });

  test('should group commands by category (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    const card = paletteCard(authenticatedPage);

    /*
     * The grouping exists — the header text is `category.replace('-', ' ')`, so
     * it is lowercase in the DOM and uppercased by CSS.
     *
     * Every default command is a navigation command, so the other two
     * categories the component can render ('action', 'quick-access') produce no
     * header at all. That is pinned here as a deliberate absence, with the
     * 'navigation' assertion above as the reach control: it proves this scoped
     * locator is searching a region that really does contain category headers.
     */
    await expect(card.getByText('navigation', { exact: true })).toBeVisible();
    await expect(card.getByText('action', { exact: true })).toHaveCount(0);
    await expect(card.getByText('quick access', { exact: true })).toHaveCount(0);
  });

  test('should support case-insensitive search (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    await searchField(authenticatedPage).fill('DEVICE');
    await expect(commands(authenticatedPage)).toHaveCount(1);
    await expect(command(authenticatedPage, 'Go to Devices')).toBeVisible();

    await searchField(authenticatedPage).fill('device');
    await expect(commands(authenticatedPage)).toHaveCount(1);
    await expect(command(authenticatedPage, 'Go to Devices')).toBeVisible();
  });

  test('should clear search with backspace (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    const unfiltered = await commands(authenticatedPage).count();

    await searchField(authenticatedPage).fill('device');
    await expect(commands(authenticatedPage)).toHaveCount(1);

    for (let i = 0; i < 'device'.length; i++) {
      await authenticatedPage.keyboard.press('Backspace');
    }

    await expect(searchField(authenticatedPage)).toHaveValue('');
    await expect(commands(authenticatedPage)).toHaveCount(unfiltered);
  });

  test('should navigate to devices from command (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    await searchField(authenticatedPage).fill('devices');
    await expect(commands(authenticatedPage)).toHaveCount(1);

    // Typing resets selectedIndex to 0, so Enter runs the only remaining match.
    await authenticatedPage.keyboard.press('Enter');

    await expect(authenticatedPage).toHaveURL(/\/dashboard\/devices$/);
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Devices', level: 2 }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to content from command (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    await searchField(authenticatedPage).fill('content');

    // Two commands match: "Go to Content" by title, and "Go to Playlists"
    // because 'content' is one of its keywords. Content is first in the
    // unfiltered order, so it is the one Enter runs.
    await expect(command(authenticatedPage, 'Go to Content')).toBeVisible();
    await expect(command(authenticatedPage, 'Go to Playlists')).toBeVisible();

    await authenticatedPage.keyboard.press('Enter');

    await expect(authenticatedPage).toHaveURL(/\/dashboard\/content$/);
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Content Library', level: 2 }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle rapid key presses (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    for (let i = 0; i < 10; i++) {
      await authenticatedPage.keyboard.press('Control+K');
      await authenticatedPage.waitForTimeout(100);
    }

    /*
     * ⌘K is a toggle (`setIsOpen(prev => !prev)`), so an even number of presses
     * must leave it closed. The old body said "Should either be open or closed,
     * not broken" and asserted `expect(true)` — which is also what a palette
     * that had stopped responding to the shortcut entirely would produce. The
     * press below is the control for exactly that: parity is only meaningful if
     * the toggle still works.
     */
    await expect(searchField(authenticatedPage)).toBeHidden();
    await expect(hint(authenticatedPage)).toBeVisible();

    await authenticatedPage.keyboard.press('Control+K');
    await expect(searchField(authenticatedPage)).toBeVisible({ timeout: 5000 });
  });

  test('should be accessible from all pages (DOMAIN)', async ({ authenticatedPage }) => {
    const pages = ['/dashboard', '/dashboard/devices', '/dashboard/content'];

    for (const path of pages) {
      await authenticatedPage.goto(path);
      await authenticatedPage.waitForLoadState('networkidle');

      // CommandPaletteWrapper is mounted on the dashboard shell, so this is a
      // contract on every /dashboard/* route, not a best effort.
      await authenticatedPage.keyboard.press('Control+K');
      await expect(searchField(authenticatedPage)).toBeVisible({ timeout: 5000 });
      await expect(command(authenticatedPage, 'Go to Settings')).toBeVisible();

      await authenticatedPage.keyboard.press('Escape');
      await expect(searchField(authenticatedPage)).toBeHidden();
    }
  });

  test('should show all available commands (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    for (const title of CORE_COMMANDS) {
      await expect(command(authenticatedPage, title)).toBeVisible();
    }
  });

  test('should support search with spaces (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);

    await searchField(authenticatedPage).fill('go to devices');
    await expect(commands(authenticatedPage)).toHaveCount(1);
    await expect(command(authenticatedPage, 'Go to Devices')).toBeVisible();

    // The filter is a plain substring match over title/description/keywords,
    // not token matching — reordering the same words finds nothing. Pinned
    // because it is the actual behaviour, and because "spaces are supported"
    // would otherwise be indistinguishable from "spaces match everything".
    await searchField(authenticatedPage).fill('devices go to');
    await expect(commands(authenticatedPage)).toHaveCount(0);
    await expect(
      paletteCard(authenticatedPage).getByText('No commands found'),
    ).toBeVisible();
  });

  test('should hide palette hint when palette opens (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    // The chip is rendered under `{!open && ...}`, so this is a real either/or,
    // not the "UI is consistent" / `expect(true)` the old body settled for.
    await expect(hint(authenticatedPage)).toBeVisible({ timeout: 5000 });

    await openPalette(authenticatedPage);
    await expect(hint(authenticatedPage)).toHaveCount(0);

    await authenticatedPage.keyboard.press('Escape');
    await expect(hint(authenticatedPage)).toBeVisible();
  });

  test('keeps the typed query when reopened, and persists no command history across reloads (pinned gap)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);
    await searchField(authenticatedPage).fill('devices');

    await authenticatedPage.keyboard.press('Escape');
    await expect(searchField(authenticatedPage)).toBeHidden();

    /*
     * Escape closes the palette WITHOUT clearing `search` — unlike Enter and a
     * backdrop click, both of which call `setSearch('')`. That asymmetry is
     * reported as a product inconsistency rather than fixed here; it is pinned
     * so that making the three paths consistent is a deliberate, visible change.
     */
    await authenticatedPage.keyboard.press('Control+K');
    await expect(searchField(authenticatedPage)).toHaveValue('devices');

    /*
     * There is no command history: nothing is written to storage and no
     * "Recent" group exists, so a reload starts from an empty query. The old
     * test was named "should maintain command history across sessions" and
     * asserted `expect(<anything> || true)` — it claimed a feature that was
     * never built.
     *
     * Reach control: after the reload the palette must still open and still
     * offer its commands, so an empty query means "the query was not persisted"
     * rather than "the palette is broken".
     */
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');

    await openPalette(authenticatedPage);
    await expect(command(authenticatedPage, 'Go to Dashboard')).toBeVisible();
    await expect(searchField(authenticatedPage)).toHaveValue('');
  });
});
