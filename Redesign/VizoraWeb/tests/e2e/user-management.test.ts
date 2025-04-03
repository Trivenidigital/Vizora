import { test, expect, helpers, mockApiResponses, mockSocketEvents } from './setup';

test.describe('User Management', () => {
  test.beforeEach(async ({ page, authContext }) => {
    await helpers.login(page, authContext.user.email, 'TestP@ss1');
  });

  test('should create new user', async ({ page }) => {
    // Navigate to user management
    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Click add user button
    await page.click('button:has-text("Add User")');
    await page.waitForURL('/users/add');

    // Fill user details
    await page.fill('input[name="email"]', 'newuser@example.com');
    await page.fill('input[name="firstName"]', 'New');
    await page.fill('input[name="lastName"]', 'User');
    await page.fill('input[name="password"]', 'NewP@ss1');
    await page.selectOption('select[name="role"]', 'user');
    await page.click('button:has-text("Create")');

    // Verify user creation
    await expect(page.locator('text=User created successfully')).toBeVisible();
    await expect(page.locator('text=newuser@example.com')).toBeVisible();
  });

  test('should edit user details', async ({ page }) => {
    // Navigate to user management
    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Find and edit user
    await page.click('button:has-text("Edit")');
    await page.fill('input[name="firstName"]', 'Updated');
    await page.fill('input[name="lastName"]', 'Name');
    await page.click('button:has-text("Save")');

    // Verify user update
    await expect(page.locator('text=User updated successfully')).toBeVisible();
    await expect(page.locator('text=Updated Name')).toBeVisible();
  });

  test('should manage user permissions', async ({ page }) => {
    // Navigate to user management
    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Find and edit user permissions
    await page.click('button:has-text("Permissions")');
    await page.check('input[name="canManageDisplays"]');
    await page.check('input[name="canManageContent"]');
    await page.check('input[name="canManageUsers"]');
    await page.click('button:has-text("Save Permissions")');

    // Verify permissions update
    await expect(page.locator('text=Permissions updated successfully')).toBeVisible();
  });

  test('should handle user deactivation', async ({ page }) => {
    // Navigate to user management
    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Find and deactivate user
    await page.click('button:has-text("Deactivate")');
    await page.click('button:has-text("Confirm")');

    // Verify user deactivation
    await expect(page.locator('text=User deactivated successfully')).toBeVisible();
    await expect(page.locator('text=Inactive')).toBeVisible();
  });

  test('should handle user reactivation', async ({ page }) => {
    // Navigate to user management
    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Find and reactivate user
    await page.click('button:has-text("Reactivate")');
    await page.click('button:has-text("Confirm")');

    // Verify user reactivation
    await expect(page.locator('text=User reactivated successfully')).toBeVisible();
    await expect(page.locator('text=Active')).toBeVisible();
  });

  test('should handle password reset', async ({ page }) => {
    // Navigate to user management
    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Find and reset user password
    await page.click('button:has-text("Reset Password")');
    await page.click('button:has-text("Confirm")');

    // Verify password reset
    await expect(page.locator('text=Password reset email sent')).toBeVisible();
  });

  test('should handle role-based access', async ({ page }) => {
    // Navigate to user management
    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Create user with different roles
    await page.click('button:has-text("Add User")');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'AdminP@ss1');
    await page.selectOption('select[name="role"]', 'admin');
    await page.click('button:has-text("Create")');

    await page.click('button:has-text("Add User")');
    await page.fill('input[name="email"]', 'manager@example.com');
    await page.fill('input[name="password"]', 'ManagerP@ss1');
    await page.selectOption('select[name="role"]', 'manager');
    await page.click('button:has-text("Create")');

    // Verify role assignments
    await expect(page.locator('text=admin@example.com')).toBeVisible();
    await expect(page.locator('text=manager@example.com')).toBeVisible();
  });

  test('should handle user groups', async ({ page }) => {
    // Navigate to user management
    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Create user group
    await page.click('button:has-text("Create Group")');
    await page.fill('input[name="groupName"]', 'Test Group');
    await page.click('button:has-text("Create")');

    // Add users to group
    await page.click('button:has-text("Add Users")');
    await page.check('input[name="user1"]');
    await page.check('input[name="user2"]');
    await page.click('button:has-text("Add")');

    // Verify group creation and users
    await expect(page.locator('text=Group created successfully')).toBeVisible();
    await expect(page.locator('text=2 members')).toBeVisible();
  });

  test('should handle audit logs', async ({ page }) => {
    // Navigate to user management
    await page.click('a[href="/users"]');
    await page.waitForURL('/users');

    // Click audit logs tab
    await page.click('button:has-text("Audit Logs")');

    // Filter audit logs
    await page.fill('input[name="dateRange"]', 'Last 7 days');
    await page.selectOption('select[name="actionType"]', 'user_created');
    await page.click('button:has-text("Apply Filter")');

    // Verify filtered logs
    await expect(page.locator('div[data-testid="audit-logs"]')).toBeVisible();
    await expect(page.locator('text=User Created')).toBeVisible();
  });
}); 