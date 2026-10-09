import { test, expect } from './fixtures/auth.fixture';

test.describe('Team Management (Wave 2)', () => {
  test.describe('Team Settings Page', () => {
    test('should display team page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/team');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage.locator('h2, h1').filter({ hasText: /team|members|users/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show current user in team list', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/team');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * `locator('table, [role="table"], [data-testid="team-list"]')` is a
       * multi-match, so isVisible() threw a strict-mode violation that
       * `.catch(() => false)` turned into "no users" — the body never ran, and
       * `rows > 0` would have counted the header row anyway.
       *
       * The auth fixture registers a brand-new organization per test whose only
       * member is "Test User", created with role `admin` ("First user is always
       * admin" — auth.service.ts). So the row, its role and its status are all
       * deterministic.
       */
      const row = authenticatedPage.getByRole('row').filter({ hasText: 'Test User' });
      await expect(row).toHaveCount(1, { timeout: 10000 });
      await expect(row).toContainText('admin');
      await expect(row).toContainText('Active');
    });

    test('should have invite button', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/team');
      await authenticatedPage.waitForLoadState('networkidle');

      const inviteButton = authenticatedPage.locator('button').filter({ hasText: /invite|add member|add user/i }).first();
      await expect(inviteButton).toBeVisible({ timeout: 10000 });
    });

    test('should open invite modal', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/team');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.click('button:has-text("Invite"), button:has-text("Add Member"), button:has-text("Add User")');

      const modal = authenticatedPage.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test('should have email input in invite modal', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/team');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.click('button:has-text("Invite"), button:has-text("Add Member"), button:has-text("Add User")');

      const emailInput = authenticatedPage.locator('input[type="email"], input[name="email"]').first();
      await expect(emailInput).toBeVisible({ timeout: 5000 });
    });

    test('should have role selector in invite modal', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/team');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.click('button:has-text("Invite"), button:has-text("Add Member"), button:has-text("Add User")');

      const roleSelect = authenticatedPage.locator('select, [data-testid="role-select"]').first();
      const roleRadios = authenticatedPage.locator('input[type="radio"][name*="role" i]');

      const hasSelect = await roleSelect.isVisible({ timeout: 5000 }).catch(() => false);
      const hasRadios = await roleRadios.first().isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasSelect || hasRadios).toBeTruthy();
    });

    test('should show role options (Admin, Editor, Viewer)', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/team');
      await authenticatedPage.waitForLoadState('networkidle');

      await authenticatedPage.click('button:has-text("Invite"), button:has-text("Add Member"), button:has-text("Add User")');

      // Look for role options
      const roleOptions = authenticatedPage.locator('text=/admin|editor|viewer/i');
      const count = await roleOptions.count();

      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('User Actions', () => {
    test('should have remove/deactivate option', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/team');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * The row's two controls are icon-only buttons whose ONLY label is a
       * `title` attribute — no aria-label and no text (an a11y gap, reported
       * rather than fixed here). `button` filtered on /remove|delete|deactivate/
       * matches on text content, so it found nothing; `button[aria-label*=
       * "action" i]` found nothing either; and `expect(... || true)` then passed
       * regardless. getByTitle reads the label the product actually provides.
       */
      const row = authenticatedPage.getByRole('row').filter({ hasText: 'Test User' });
      await expect(row).toHaveCount(1, { timeout: 10000 });
      await expect(row.getByTitle('Edit role')).toBeVisible();
      await expect(row.getByTitle('Deactivate')).toBeVisible();

      // Deactivation is confirmed, not immediate — and the safe option is the
      // one under Enter (ConfirmDialog focuses Cancel).
      await row.getByTitle('Deactivate').click();

      const confirm = authenticatedPage.getByRole('dialog', { name: 'Deactivate User' });
      await expect(confirm).toBeVisible({ timeout: 5000 });
      await expect(confirm).toContainText('Test User');
      await expect(confirm.getByRole('button', { name: 'Deactivate' })).toBeVisible();
      await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();

      // Backed out: this test asserts the prompt exists, not that the fixture's
      // own account can be locked out mid-run.
      await authenticatedPage.keyboard.press('Escape');
      await expect(confirm).toBeHidden();
      await expect(row).toContainText('Active');
    });

    test('should have change role option', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/team');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * There is no inline role dropdown on the rows — the old `locator(
       * 'select').first()` matched nothing on this page at all, and
       * `[data-testid="role-dropdown"]` exists nowhere in web/src. Changing a
       * role goes through the per-row "Edit role" control and the Edit User Role
       * dialog, which is what is asserted here.
       */
      const row = authenticatedPage.getByRole('row').filter({ hasText: 'Test User' });
      await expect(row).toHaveCount(1, { timeout: 10000 });
      await row.getByTitle('Edit role').click();

      const dialog = authenticatedPage.getByRole('dialog', { name: 'Edit User Role' });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // The modal's <label>Role</label> carries no htmlFor, so the select has no
      // accessible name; it is the only combobox in the dialog.
      const role = dialog.getByRole('combobox');
      await expect(role).toHaveValue('admin');
      for (const option of [/^Viewer/, /^Manager/, /^Admin/]) {
        await expect(role.getByRole('option', { name: option })).toHaveCount(1);
      }

      // Save is gated on the role having actually changed
      // (`editRole === selectedUser.role`), so the unchanged state must refuse…
      const save = dialog.getByRole('button', { name: 'Save Changes' });
      await expect(save).toBeDisabled();

      // …and CONTROL: picking a different role enables it, so the assertion
      // above is measuring the guard rather than a permanently dead button.
      await role.selectOption('manager');
      await expect(save).toBeEnabled();

      await authenticatedPage.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  });
});

test.describe('Audit Log (Wave 2)', () => {
  test.describe('Audit Log Page', () => {
    test('should display audit log page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/audit-log');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage.locator('h2, h1').filter({ hasText: /audit|activity|log/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show log entries or empty state', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/audit-log');
      await authenticatedPage.waitForLoadState('networkidle');

      const logTable = authenticatedPage.locator('table, [role="table"], [data-testid="audit-log"]');
      const emptyState = authenticatedPage.locator('text=/no activity|no logs|empty/i').first();

      const hasTable = await logTable.isVisible({ timeout: 5000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasTable || hasEmpty).toBeTruthy();
    });

    test('should have date filter', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/audit-log');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * Registration writes two audit rows inside the new organization —
       * `user_registered` and `user_login` (auth.service.ts) — so a fresh org's
       * log is never empty and the filters can be exercised for real, rather
       * than probed with `expect(hasDateFilter || true)`.
       *
       * The two date inputs have no accessible name (their <label>s carry no
       * htmlFor — reported), so they are addressed by type in DOM order:
       * Start Date then End Date.
       */
      const dates = authenticatedPage.locator('input[type="date"]');
      await expect(dates).toHaveCount(2);

      await expect(
        authenticatedPage.getByText('User Registered', { exact: true }),
      ).toBeVisible({ timeout: 10000 });

      // The filter is wired, not decorative: a start date in the future
      // excludes everything.
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await dates.first().fill(tomorrow);
      await expect(
        authenticatedPage.getByText('No entries match the current filters'),
      ).toBeVisible({ timeout: 10000 });

      // CONTROL: clearing it brings the rows back, so the empty state above was
      // the filter's doing and not a log that was empty all along.
      await authenticatedPage.getByRole('button', { name: 'Clear all filters' }).click();
      await expect(
        authenticatedPage.getByText('User Registered', { exact: true }),
      ).toBeVisible({ timeout: 10000 });
    });

    test('should have action type filter', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/audit-log');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * Three selects sit in the filter strip (Action, Entity Type, User) and
       * none of them has an accessible name, so `locator('select').first()` was
       * only ever "whichever select comes first" — it would have reported green
       * with the Action filter removed entirely. This one is identified by an
       * option only it carries.
       */
      const actionFilter = authenticatedPage
        .locator('select')
        .filter({ has: authenticatedPage.locator('option[value="user_invited"]') });
      await expect(actionFilter).toHaveCount(1);
      await expect(actionFilter.getByRole('option', { name: 'All Actions' })).toHaveCount(1);

      await expect(
        authenticatedPage.getByText('User Registered', { exact: true }),
      ).toBeVisible({ timeout: 10000 });

      // Wired: a fresh organization has created no content, so filtering to
      // Content Created must empty the table.
      await actionFilter.selectOption('content_created');
      await expect(
        authenticatedPage.getByText('No entries match the current filters'),
      ).toBeVisible({ timeout: 10000 });

      // CONTROL: back to All Actions and the rows return.
      await actionFilter.selectOption('');
      await expect(
        authenticatedPage.getByText('User Registered', { exact: true }),
      ).toBeVisible({ timeout: 10000 });
    });

    test('should show log entry details', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/audit-log');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * The old body counted `th` elements, and every assertion sat inside
       * `if (count > 0)` — so an audit page that rendered no table at all
       * skipped the lot. Worse, the fallback `count > 2` would have satisfied
       * the OR for any table with three columns, whatever they were.
       *
       * All seven columns are named here, and one real entry is read end to end.
       */
      for (const column of [
        'Timestamp',
        'User',
        'Action',
        'Entity Type',
        'Entity ID',
        'Changes',
        'IP Address',
      ]) {
        await expect(
          authenticatedPage.getByRole('columnheader', { name: column }),
        ).toBeVisible({ timeout: 10000 });
      }

      const row = authenticatedPage.getByRole('row').filter({ hasText: 'User Registered' });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('Test User');

      // `user_registered` stores a `changes` blob, so the row offers the
      // expander — and expanding it shows the stored JSON rather than a stub.
      await row.getByRole('button', { name: 'View' }).click();
      await expect(authenticatedPage.getByText('Changes:')).toBeVisible();
      await expect(authenticatedPage.locator('pre')).toContainText('organizationName');
    });

    test('shows no pagination while a single page of entries fits (pinned)', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings/audit-log');
      await authenticatedPage.waitForLoadState('networkidle');

      /*
       * The pager renders only when `totalPages > 1`, and the page size is 20.
       * A fresh organization's log holds the handful of rows registration
       * writes, so its absence is correct — which is what the old
       * `expect(hasPagination || true)` could never distinguish from the pager
       * having been deleted.
       *
       * Pinned rather than asserted present: audit rows are written server-side
       * only, so a test cannot seed 21 of them through any supported path.
       *
       * REACH CONTROL: the table is populated (a named row is on screen, and
       * Export CSV is enabled, which it is only while `logs.length > 0`) and
       * holds fewer rows than one page. So the absence below reads as "one
       * page", not "the table failed to render".
       */
      await expect(
        authenticatedPage.getByText('User Registered', { exact: true }),
      ).toBeVisible({ timeout: 10000 });
      await expect(authenticatedPage.getByRole('button', { name: 'Export CSV' })).toBeEnabled();

      const rows = await authenticatedPage.getByRole('row').count();
      expect(rows).toBeGreaterThan(1); // header + at least one entry
      expect(rows).toBeLessThan(22); // header + at most one page of 20

      await expect(authenticatedPage.getByRole('button', { name: 'Next' })).toHaveCount(0);
      await expect(authenticatedPage.getByRole('button', { name: 'Previous' })).toHaveCount(0);
    });
  });

  test.describe('Settings Navigation', () => {
    test('should have team link in settings', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      const teamLink = authenticatedPage.locator('a').filter({ hasText: /team/i }).first();
      await expect(teamLink).toBeVisible({ timeout: 10000 });
    });

    test('should have audit log link in settings', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/dashboard/settings');
      await authenticatedPage.waitForLoadState('networkidle');

      const auditLink = authenticatedPage.locator('a').filter({ hasText: /audit|activity log/i }).first();
      await expect(auditLink).toBeVisible({ timeout: 10000 });
    });
  });
});
