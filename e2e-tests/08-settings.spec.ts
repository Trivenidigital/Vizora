import { test, expect } from './fixtures/auth.fixture';
import { apiGet, apiSend } from './fixtures/seed';

test.describe('Settings Management', () => {
  test('should show settings page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check page loaded
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Settings' })).toBeVisible({ timeout: 10000 });
    
    // Check subtitle
    await expect(authenticatedPage.locator('text=/manage your account and preferences/i')).toBeVisible();
  });

  test('should display organization settings section', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check organization section
    await expect(authenticatedPage.locator('h3').filter({ hasText: 'Organization' })).toBeVisible({ timeout: 10000 });
    
    // Check for form fields
    await expect(authenticatedPage.locator('label').filter({ hasText: 'Organization Name' })).toBeVisible();
    // The field is labelled "Account Email" (the signed-in account's address,
    // rendered read-only) — there is no "Admin Email" label on this page.
    await expect(authenticatedPage.locator('label').filter({ hasText: 'Account Email' })).toBeVisible();
  });

  test('should have editable organization name field', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Find organization name input
    const orgNameInput = authenticatedPage.locator('input[type="text"]').first();
    await expect(orgNameInput).toBeVisible({ timeout: 10000 });
    
    // Should have default value
    const value = await orgNameInput.inputValue();
    expect(value).toBeTruthy();
    
    // Should be editable
    await orgNameInput.fill('Test Organization');
    await expect(orgNameInput).toHaveValue('Test Organization');
  });

  test('should display display settings section', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check display settings section
    await expect(authenticatedPage.locator('h3').filter({ hasText: 'Display Settings' })).toBeVisible({ timeout: 10000 });
    
    // Check for form fields
    await expect(authenticatedPage.locator('label').filter({ hasText: /default content duration/i })).toBeVisible();
    await expect(authenticatedPage.locator('label').filter({ hasText: 'Timezone' })).toBeVisible();
  });

  test('should have duration input field', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Find duration input
    const durationInput = authenticatedPage.locator('input[type="number"]').first();
    await expect(durationInput).toBeVisible({ timeout: 10000 });
    
    // Should have a numeric value
    const value = await durationInput.inputValue();
    expect(parseInt(value)).toBeGreaterThan(0);
    
    // Should be editable
    await durationInput.fill('45');
    await expect(durationInput).toHaveValue('45');
  });

  test('should have timezone selector', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Target the timezone select by id. `select` is page-wide and its FIRST match
    // is the Region select (US/IN), which has no America/Chicago option, so the
    // selectOption below used to fail against a perfectly good product.
    const timezoneSelect = authenticatedPage.locator('#settings-timezone');
    await expect(timezoneSelect).toBeVisible({ timeout: 10000 });
    
    // Should have options
    const options = await timezoneSelect.locator('option').count();
    expect(options).toBeGreaterThan(0);
    
    // Should be changeable
    await timezoneSelect.selectOption('America/Chicago');
    await expect(timezoneSelect).toHaveValue('America/Chicago');
  });

  test('should display notification settings section', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check notifications section
    await expect(authenticatedPage.locator('h3').filter({ hasText: 'Notifications' })).toBeVisible({ timeout: 10000 });
    
    // Check for notification toggle
    await expect(authenticatedPage.locator('text=Email Notifications')).toBeVisible();
    await expect(authenticatedPage.locator('text=/receive alerts about device status/i')).toBeVisible();
  });

  test('should have notification toggle checkbox', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Find notification checkbox
    const checkbox = authenticatedPage.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    
    // Should be toggleable
    const initialState = await checkbox.isChecked();
    await checkbox.click();
    await authenticatedPage.waitForTimeout(300);
    const newState = await checkbox.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('should display account section', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check account section
    await expect(authenticatedPage.locator('h3').filter({ hasText: 'Account' })).toBeVisible({ timeout: 10000 });
    
    // Check for account action buttons
    await expect(authenticatedPage.locator('button').filter({ hasText: /change password/i })).toBeVisible();
    // The button reads "Export My Data" (or "Exporting..." while in flight), which
    // /export data/i does not match.
    await expect(authenticatedPage.locator('button').filter({ hasText: /export my data/i })).toBeVisible();
    await expect(authenticatedPage.locator('button').filter({ hasText: /delete account/i })).toBeVisible();
  });

  test('should have save changes button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Check for save button
    const saveButton = authenticatedPage.locator('button').filter({ hasText: /save changes/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 10000 });
  });

  test('should maintain form state when toggling settings', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/settings');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Change multiple settings
    const orgInput = authenticatedPage.locator('input[type="text"]').first();
    await orgInput.fill('New Organization');
    
    const durationInput = authenticatedPage.locator('input[type="number"]').first();
    await durationInput.fill('60');
    
    const checkbox = authenticatedPage.locator('input[type="checkbox"]').first();
    await checkbox.click();
    
    // Wait a bit
    await authenticatedPage.waitForTimeout(500);
    
    // Verify values persisted
    await expect(orgInput).toHaveValue('New Organization');
    await expect(durationInput).toHaveValue('60');
  });

  /**
   * "Default Content Duration (seconds)" is bounded 1..86400, whole seconds,
   * in the browser AND on the API. Each bad value must show the inline error,
   * must not be saved, and the stored value must be unchanged after a reload.
   */
  test('rejects an invalid default duration inline and does not save it', async ({ authenticatedPage, token }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    const duration = page.getByLabel('Default Content Duration (seconds)');
    await expect(duration).toBeVisible({ timeout: 10000 });
    await expect(duration).toHaveAttribute('min', '1');
    await expect(duration).toHaveAttribute('max', '86400');
    await expect(duration).toHaveAttribute('step', '1');
    // The org loads asynchronously; wait for its value before editing, or the
    // load overwrites what is typed.
    await expect(duration).toHaveValue('30');

    const save = page.getByRole('button', { name: 'Save Changes' }).last();
    const error = page.locator('#settings-default-duration-error');

    let saves = 0;
    page.on('request', (r) => {
      if (r.method() === 'PATCH' && /\/api\/v1\/organizations\//.test(r.url())) saves += 1;
    });

    const cases: Array<[string, string]> = [
      ['-5', 'Default duration must be between 1 and 86400 seconds'],
      ['', 'Enter a default duration in seconds'],
      ['1.5', 'Default duration must be a whole number of seconds'],
    ];
    for (const [value, message] of cases) {
      await duration.fill(value);
      await save.click();
      await expect(error).toHaveText(message);
      await expect(duration).toHaveAttribute('aria-invalid', 'true');
      // Editing clears the error.
      await duration.fill('31');
      await expect(error).toHaveCount(0);
    }
    expect(saves, 'no invalid value may reach the API').toBe(0);

    // Nothing was stored: the server still holds the default.
    const org = await apiGet<{ settings?: { defaultDuration?: number } }>(page, token, '/organizations/current');
    expect(org.settings?.defaultDuration ?? 30).toBe(30);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(duration).toHaveValue('30');

    // CONTROL: a valid value does save (the API is the oracle; reload
    // persistence is its own test below).
    await duration.fill('45');
    await save.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Settings saved successfully' })).toBeVisible();
    await expect
      .poll(async () => (await apiGet<{ settings?: { defaultDuration?: number } }>(page, token, '/organizations/current')).settings?.defaultDuration)
      .toBe(45);

    // The API enforces the same bound on its own.
    const orgId = (await apiGet<{ id: string }>(page, token, '/organizations/current')).id;
    const res = await apiSend(page, token, 'PATCH', `/organizations/${orgId}`, { settings: { defaultDuration: -5 } });
    expect(res.status()).toBe(400);
  });

  /**
   * A saved setting must be what the page shows after a reload. The page reads
   * org settings from GET /auth/me, whose user+organization snapshot is cached
   * in Redis for 60s (`user_auth:`, JwtStrategy.USER_CACHE_TTL) and is NOT
   * invalidated by PATCH /organizations/:id - so a reload inside that window
   * shows the OLD value, and the next Save writes it back over the new one.
   * Reported as a product defect; this test stays red until it is fixed.
   */
  test('a saved default duration is shown after a reload', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    const duration = page.getByLabel('Default Content Duration (seconds)');
    await expect(duration).toHaveValue('30', { timeout: 10000 });
    await duration.fill('45');
    await page.getByRole('button', { name: 'Save Changes' }).last().click();
    await expect(page.getByRole('alert').filter({ hasText: 'Settings saved successfully' })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(duration).toHaveValue('45', { timeout: 10000 });
  });
});
