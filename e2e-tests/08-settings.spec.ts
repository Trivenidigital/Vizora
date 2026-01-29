import { test, expect } from './fixtures/auth.fixture';

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
    await expect(authenticatedPage.locator('label').filter({ hasText: 'Admin Email' })).toBeVisible();
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
    
    // Find timezone select
    const timezoneSelect = authenticatedPage.locator('select').first();
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
    await expect(authenticatedPage.locator('button').filter({ hasText: /export data/i })).toBeVisible();
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
});
