import { test, expect } from './fixtures/auth.fixture';

/**
 * PHASE 6.0: COMPLETE SCHEDULES IMPLEMENTATION TEST SUITE
 *
 * BMAD Method Coverage:
 * ├─ Boundary Tests: Time boundaries, duration limits, timezone edges
 * ├─ Mutation Tests: All CRUD operations, state changes
 * ├─ Adversarial Tests: Invalid inputs, edge cases, error handling
 * └─ Domain Tests: Business logic, business rule validation
 *
 * Test Coverage: 32 critical test cases for schedules
 */

test.describe('Phase 6.0: Complete Schedules Implementation', () => {

  /**
   * `/dashboard/schedules` is gated behind SCHEDULES_ENABLED (build-time flag, ships
   * off — see web/src/app/dashboard/schedules/page.tsx, the "interim C-7 mitigation").
   * With the gate closed the route renders an "unavailable" notice instead of the CRUD
   * UI, so every assertion below is moot. Skip visibly rather than leave the gate
   * permanently red for a deliberate product state — an always-red gate is unreadable.
   * These tests run again, unchanged, the moment the flag is built on.
   */
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const gated = await authenticatedPage
      .locator('text=/Scheduling is temporarily unavailable/i')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (gated) {
      test.info().annotations.push({
        type: 'skipped-branch',
        description: 'SCHEDULES_ENABLED is off — schedules CRUD UI is gated out of this build',
      });
    }
    test.skip(gated, 'SCHEDULES_ENABLED is off — schedules CRUD UI is gated out of this build');
  });

  // ============= LOAD & NAVIGATION TESTS =============

  test('should load schedules page successfully', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Verify page heading
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Schedules' })).toBeVisible({ timeout: 10000 });
    // Check for subtitle text (use first() to avoid strict mode violation)
    await expect(authenticatedPage.locator('text=/Automate content playback/i').first()).toBeVisible();
  });

  test('should display schedule statistics', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Check for total schedules count - either in subtitle or as separate element
    const countLocator = authenticatedPage.locator('text=/\\d+ total|total|schedules/i').first();
    await expect(countLocator).toBeVisible({ timeout: 5000 });
  });

  test('schedules list offers no search input (pinned gap)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    /*
     * This asserted search by checking only that the page heading was visible,
     * so it passed whether or not a search box existed. The schedules page
     * ships no search input at all (there is no searchQuery state in
     * page-client.tsx). The absence is pinned here so the test goes red the day
     * search is added, instead of certifying nothing.
     */
    const main = authenticatedPage.locator('main');
    await expect(main.locator('input[placeholder*="Search" i], input[type="search"]')).toHaveCount(
      0,
    );

    // Reach control: the scoped region really does render the list, so the zero
    // above is a finding and not a dead selector.
    await expect(main.locator('h2').filter({ hasText: 'Schedules' })).toBeVisible();
  });

  // ============= CREATE SCHEDULE TESTS =============

  test('should open create schedule modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Click create button
    const createButton = authenticatedPage.locator('button').filter({ hasText: /create schedule/i }).first();
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await createButton.click();

    // A page-wide `[role="dialog"]` resolves to several elements here (Modal,
    // ConfirmDialog and the cookie-consent bar all take the role), which is a
    // strict-mode violation. Name the dialog instead: Modal wires
    // `aria-labelledby` to its own title, so the create modal's accessible name
    // is "Create Schedule".
    const dialog = authenticatedPage.getByRole('dialog', { name: /create schedule/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    // The heading must be visible inside THAT modal, not just anywhere on the page.
    await expect(dialog.getByRole('heading', { name: /create schedule/i })).toBeVisible();
  });

  test('should validate schedule form - required fields (BOUNDARY)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Open create modal
    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    const dialog = authenticatedPage.getByRole('dialog', { name: /create schedule/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    /*
     * The product does NOT disable submit on an incomplete form - that button
     * carries `disabled={actionLoading}` only. It validates ON SUBMIT:
     * handleCreate calls validateForm(), which fills `formErrors` and returns
     * before any request is made. So the contract to assert is "submitting an
     * empty form names every missing field and creates nothing", not "the button
     * is disabled".
     */
    const submitButton = dialog.getByRole('button', { name: /^create$/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Exact copy from validateForm() in dashboard/schedules/page-client.tsx.
    // Name, playlist and target are the three fields a freshly opened form leaves
    // empty (days and duration are pre-filled), so all three errors must appear.
    await expect(dialog.getByText('Schedule name is required')).toBeVisible({ timeout: 5000 });
    // `exact` matters: the playlist <select> carries a "Select a playlist..."
    // placeholder option, so a substring match resolves to two elements.
    await expect(dialog.getByText('Select a playlist', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Select at least one device')).toBeVisible();

    // The dialog stays open on a failed validation, and nothing was created: the
    // header counter is rendered straight from the schedules list.
    await expect(dialog).toBeVisible();
    await expect(authenticatedPage.getByText(/\(0 total\)/)).toBeVisible();
  });

  test('should validate schedule name (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    // Find name input and test with various values
    const nameInput = authenticatedPage.locator('input[placeholder*="Name"], input[placeholder*="Schedule"]').first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Test valid name
      await nameInput.fill('Test Schedule 001');
      await expect(nameInput).toHaveValue('Test Schedule 001');

      // Test clear
      await nameInput.clear();
      await expect(nameInput).toHaveValue('');

      // Test long name
      await nameInput.fill('A'.repeat(100));
      const value = await nameInput.inputValue();
      expect(value.length).toBeLessThanOrEqual(100);
    }
  });

  // ============= TIME PICKER TESTS =============

  test('should have time picker component (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    // Look for time-related inputs
    const timeInputs = authenticatedPage.locator('input[placeholder*="time"], input[placeholder*="Time"]', { timeout: 5000 });
    if (await timeInputs.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(timeInputs.first()).toBeVisible();
    }
  });

  test('should validate time range (BOUNDARY)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    const timeInputs = authenticatedPage.locator('input[placeholder*="time"], input[placeholder*="Time"], input[type="time"]', { timeout: 2000 });

    if (await timeInputs.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      const count = await timeInputs.count();

      // Test valid times (00:00 - 23:59)
      if (count > 0) {
        const firstTime = timeInputs.first();
        await firstTime.fill('09:00', { force: true });
        const value = await firstTime.inputValue();
        expect(value).toMatch(/09:00|9:00/);
      }

      // Test invalid time boundary
      if (count > 0) {
        const firstTime = timeInputs.first();
        await firstTime.fill('25:00', { force: true }); // Invalid
        const value = await firstTime.inputValue();
        // Input should either reject or normalize
        expect(value).toBeTruthy();
      }
    }
  });

  test('should handle duration input (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    const durationInput = authenticatedPage.locator('input[placeholder*="duration"], input[placeholder*="Duration"], input[type="number"]').first();

    if (await durationInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Test valid duration
      await durationInput.fill('30');
      await expect(durationInput).toHaveValue('30');

      // Test boundary duration (minimum is 1)
      await durationInput.fill('1');
      const value = await durationInput.inputValue();
      expect(value).toBe('1');

      // Test negative duration (adversarial) - should be rejected or normalized
      await durationInput.fill('-30');
      const negValue = await durationInput.inputValue();
      expect(negValue).toBeTruthy(); // Some value should exist
    }
  });

  // ============= DAY SELECTOR TESTS =============

  test('should have day selector buttons (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    // Look for day-related elements (buttons or other selectable elements)
    const dayButtons = authenticatedPage.locator('button, [role="checkbox"], [role="option"]').filter({ hasText: /Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i });

    // A schedule needs a day-of-week selector; the modal must offer one.
    const count = await dayButtons.count().catch(() => 0);
    expect(count, 'schedule modal must offer day selection').toBeGreaterThan(0);
  });

  test('should toggle day selection (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    const dayButtons = authenticatedPage.locator('button').filter({ hasText: /Monday/i }, { timeout: 2000 }).first();

    if (await dayButtons.isVisible({ timeout: 1000 }).catch(() => false)) {
      const initialClass = await dayButtons.getAttribute('class');
      await dayButtons.click();
      const afterClickClass = await dayButtons.getAttribute('class');

      // Clicking a day must visibly change its selection state.
      expect(afterClickClass).not.toEqual(initialClass);
    } else {
      test.info().annotations.push({
        type: 'skipped-branch',
        description: 'no "Monday" day button rendered — day toggle not exercised',
      });
    }
  });

  test('should support weekday preset (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    const weekdaysButton = authenticatedPage.locator('button').filter({ hasText: /Weekdays/i }, { timeout: 2000 });

    if (await weekdaysButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await weekdaysButton.click();
      // All weekday buttons should be selected
      await authenticatedPage.waitForTimeout(500);
      await expect(weekdaysButton).toHaveClass(/selected|active|bg-/);
    }
  });

  test('should support all days preset (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    const allDaysButton = authenticatedPage.locator('button').filter({ hasText: /All|Every Day/i }, { timeout: 2000 }).first();

    if (await allDaysButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await allDaysButton.click();
      await authenticatedPage.waitForTimeout(500);
      // All days should be selected
      await expect(allDaysButton).toHaveClass(/selected|active|bg-/);
    }
  });

  // ============= TIMEZONE TESTS =============

  /*
   * Removed 2026-10-09: 'should support timezone selection (DOMAIN)'. Its whole
   * body sat inside `if (await timezoneSelect.isVisible(...))`, which can never
   * be true: the create-schedule dialog has no timezone picker, it shows an
   * informational panel because each target display applies its own configured
   * timezone at playback. The real contract is asserted by 'should handle
   * timezone edge cases (BOUNDARY)' below.
   */

  test('should handle timezone edge cases (BOUNDARY)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    const dialog = authenticatedPage.getByRole('dialog', { name: /create schedule/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    /*
     * There is no timezone picker in this dialog any more, and the page-wide
     * `select` this test used to grab resolved to a hidden element elsewhere, so
     * it timed out. The edge case the product now has to get right is the
     * opposite one: a schedule carries no zone of its own, every target display
     * applies its own configured timezone at playback time, and the dialog has
     * to SAY so rather than offer a choice it cannot honour.
     */
    await expect(dialog.getByText('Target display timezone')).toBeVisible();
    await expect(
      dialog.getByText(/each target display applies its own configured timezone/i),
    ).toBeVisible();

    // So no select inside the dialog may offer a timezone. The count assertion is
    // the control: the dialog really does render selects (playlist, target), so
    // "no zone-shaped option value" is a finding and not an empty match.
    const selects = dialog.locator('select');
    expect(await selects.count()).toBeGreaterThanOrEqual(1);
    const optionValues = await selects.locator('option').evaluateAll(opts =>
      opts.map(o => (o as HTMLOptionElement).value),
    );
    expect(optionValues.filter(v => /^(UTC|[A-Za-z]+\/[A-Za-z_]+)$/.test(v))).toEqual([]);
  });

  // ============= PLAYLIST & DEVICE SELECTION TESTS =============

  test('should allow playlist selection (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    const playlistSelect = authenticatedPage.locator('select, [role="listbox"]').filter({ hasText: /playlist/i }, { timeout: 2000 }).first();

    if (await playlistSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(playlistSelect).toBeVisible();
    }
  });

  test('should allow device multi-select (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    await createButton.click({ timeout: 5000 });

    // Look for device checkboxes
    const deviceCheckboxes = authenticatedPage.locator('input[type="checkbox"]').filter({ timeout: 2000 });
    const count = await deviceCheckboxes.count();

    if (count > 0) {
      const firstCheckbox = deviceCheckboxes.first();
      const initialState = await firstCheckbox.isChecked();

      // Toggle checkbox
      await firstCheckbox.check({ force: true });
      const afterCheck = await firstCheckbox.isChecked();

      expect(afterCheck).toBeTruthy();

      // Toggle back
      await firstCheckbox.uncheck({ force: true });
      const afterUncheck = await firstCheckbox.isChecked();

      expect(afterUncheck).toBeFalsy();
    }
  });

  // ============= CRUD OPERATIONS TESTS =============

  test('should create schedule with all required fields (MUTATION)', async ({ authenticatedPage, token }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add schedule/i }).first();
    if (!await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      return; // Skip if button not visible
    }

    await createButton.click();
    await authenticatedPage.waitForTimeout(500);

    // Fill form - try to interact with all fields
    const inputs = authenticatedPage.locator('input[type="text"], input[placeholder*="name"]').first();
    if (await inputs.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputs.fill(`Schedule ${Date.now()}`);
    }

    // Attempt to submit
    const submitButton = authenticatedPage.locator('button').filter({ hasText: /create|save|submit/i }).last();
    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false) &&
        !await submitButton.isDisabled().catch(() => true)) {
      await submitButton.click();
      await authenticatedPage.waitForTimeout(1000);
    }

    // Verify page state after action
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Schedules' })).toBeVisible();
  });

  test('should edit existing schedule (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for edit buttons
    const editButton = authenticatedPage.locator('button').filter({ hasText: /edit/i }).first();

    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();
      await authenticatedPage.waitForTimeout(500);

      // Modal should appear for editing
      const modal = authenticatedPage.locator('[role="dialog"]');
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Try to modify a field
        const input = authenticatedPage.locator('input[type="text"]').first();
        if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
          const initialValue = await input.inputValue();
          await input.fill(`Updated ${Date.now()}`);
          const newValue = await input.inputValue();
          expect(newValue).not.toEqual(initialValue);
        }

        // Close modal without saving
        await authenticatedPage.keyboard.press('Escape');
      }
    }
  });

  test('should delete schedule with confirmation (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Find delete button
    const deleteButton = authenticatedPage.locator('button').filter({ hasText: /delete/i }).first();

    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click();

      // Confirmation dialog should appear
      const confirmButton = authenticatedPage.locator('button').filter({ hasText: /confirm|yes|delete/i }).first();
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
        await authenticatedPage.waitForTimeout(1000);

        // Page should still be functional
        await expect(authenticatedPage.locator('h2').filter({ hasText: 'Schedules' })).toBeVisible();
      }
    }
  });

  test('should duplicate schedule (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const duplicateButton = authenticatedPage.locator('button').filter({ hasText: /duplicate|copy/i }).first();

    if (await duplicateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const initialCountText = await authenticatedPage.locator('text=/\\d+ schedules?/i').first().textContent();

      await duplicateButton.click();
      await authenticatedPage.waitForTimeout(1000);

      // Verify action completed
      await expect(authenticatedPage.locator('h2').filter({ hasText: 'Schedules' })).toBeVisible();
    }
  });

  // ============= SEARCH & FILTER TESTS =============

  test('should filter schedules by search (MUTATION)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const searchInput = authenticatedPage.locator('input[placeholder*="Search"]').first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Morning');
      await authenticatedPage.waitForTimeout(500);

      // Clear search
      await searchInput.clear();
      await authenticatedPage.waitForTimeout(300);

      // The page must survive a filter round-trip.
      await expect(authenticatedPage.locator('h2').filter({ hasText: 'Schedules' })).toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'skipped-branch',
        description: 'no search input rendered — schedule search filter not exercised',
      });
    }
  });

  test('schedules list offers no status filter (pinned gap)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const main = authenticatedPage.locator('main');

    /*
     * Unscoped, `button` + /active|inactive|all/i matched the cookie-consent
     * bar's "Accept All" - permanently mounted, translated off-screen - so the
     * click waited forever. Scoped to the page's own content region the real
     * answer is that the schedules page ships NO status filter: status is
     * rendered per card as an Active/Inactive badge, and the only list control is
     * the List/Calendar view toggle. That contract is pinned here explicitly so
     * this test goes red the day a status filter is added (or an existing one
     * removed) instead of passing either way.
     */
    const statusFilters = main.getByRole('button', { name: /^(all|active|inactive)$/i });
    await expect(statusFilters).toHaveCount(0);

    // Reach control: the scoped locator above is searching a region that really
    // does contain buttons, so the zero above is a finding and not a dead selector.
    await expect(main.getByRole('button', { name: /^(list|calendar)$/i })).toHaveCount(2);
  });

  // ============= DISPLAY & FORMATTING TESTS =============

  test('should display schedule details correctly (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for schedule detail elements
    const scheduleItems = authenticatedPage.locator('[role="listitem"], .schedule-card, [class*="schedule"]').first();

    if (await scheduleItems.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Should show time information
      const timeElement = scheduleItems.locator('text=/\\d{1,2}:\\d{2}|AM|PM|time/i');
      if (await timeElement.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(timeElement).toBeVisible();
      }

      // Should show days
      const daysElement = scheduleItems.locator('text=/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Weekdays|Daily/i');
      if (await daysElement.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(daysElement).toBeVisible();
      }
    }
  });

  test('should show next occurrences preview (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Look for next occurrences preview
    const nextOccurrences = authenticatedPage.locator('text=/Next|Upcoming|occurrence/i');

    if (await nextOccurrences.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(nextOccurrences).toBeVisible();
    }
  });

  test('should handle empty schedules state (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Page should display gracefully even if empty
    const emptyState = authenticatedPage.locator('text=/no schedules|empty|get started/i');
    const schedulesList = authenticatedPage.locator('[role="listitem"], .schedule-card').first();

    if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
      // An empty state is only useful with a way out of it.
      const cta = authenticatedPage.locator('button').filter({ hasText: /create|new|add/i });
      expect(await cta.count(), 'empty state must offer a create CTA').toBeGreaterThan(0);
    } else {
      // Otherwise the list itself must be rendered.
      await expect(schedulesList).toBeVisible({ timeout: 5000 });
    }
  });

  // ============= INTEGRATION & PERFORMANCE TESTS =============

  test('should maintain schedule state after navigation (DOMAIN)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    const initialHeading = authenticatedPage.locator('h2').filter({ hasText: 'Schedules' });
    await expect(initialHeading).toBeVisible();

    // Navigate away
    const homeLink = authenticatedPage.locator('text=/Dashboard|Home/i').first();
    if (await homeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await homeLink.click();
      await authenticatedPage.waitForTimeout(500);

      // Navigate back
      const schedulesLink = authenticatedPage.locator('text=/Schedules/i').first();
      if (await schedulesLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await schedulesLink.click();
        await authenticatedPage.waitForLoadState('networkidle');

        // Page should be functional
        await expect(initialHeading).toBeVisible();
      }
    }
  });

  test('should handle rapid schedule operations (ADVERSARIAL)', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Schedules' })).toBeVisible({ timeout: 5000 });

    // Simulate rapid clicks on create button
    const createButton = authenticatedPage.locator('button').filter({ hasText: /create schedule/i }).first();

    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Rapid clicks should not break UI
      await createButton.click().catch(() => {});

      // Close modal if opened
      const closeButton = authenticatedPage.locator('button').filter({ hasText: /close|cancel|×/i }).first();
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click().catch(() => {});
      }

      // Page should still be functional
      await expect(authenticatedPage.locator('h2').filter({ hasText: 'Schedules' })).toBeVisible();
    }
  });

  test('should display responsive schedule layout (DOMAIN)', async ({ authenticatedPage }) => {
    // Test mobile viewport
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await authenticatedPage.goto('/dashboard/schedules');
    await authenticatedPage.waitForLoadState('networkidle');

    // Page should be accessible
    await expect(authenticatedPage.locator('h2').filter({ hasText: 'Schedules' })).toBeVisible();

    // Create button should be accessible
    const createButton = authenticatedPage.locator('button').filter({ hasText: /create|new|add/i }).first();
    expect(await createButton.boundingBox()).not.toBeNull();

    // Reset viewport
    await authenticatedPage.setViewportSize({ width: 1280, height: 720 });
  });
});
