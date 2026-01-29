# Vizora E2E Test Fix Manifest

## Overview
**Current:** 5/26 passing (19%)
**Target:** 26/26 passing (100%)
**Approach:** BMAD (Break, Measure, Analyze, Document)

## Test Fix Priority

### PHASE 1: Selector Fixes (Quick Wins) - 30 min
**Impact:** Should bring us to 40-50% pass rate

#### Dashboard Tests (5 tests)
1. ✅ `should display dashboard with navigation`
   - **Issue:** `h1, h2` matches multiple elements → strict mode violation
   - **Fix:** Change to `h2:has-text("Dashboard Overview")`
   - **File:** `e2e-tests/02-dashboard.spec.ts:8`

2. ✅ `should display statistics cards`
   - **Issue:** Selector `[class*="stat"], [class*="card"]` too broad
   - **Actual:** Cards exist but need better selector
   - **Fix:** Use `role=button` or specific test IDs
   - **File:** `e2e-tests/02-dashboard.spec.ts:28`

3. ✅ `should navigate to displays page`
   - **Issue:** Wrong URL - should be `/dashboard/devices` not `/displays`
   - **Fix:** Update URL expectation
   - **File:** `e2e-tests/02-dashboard.spec.ts:36`

4. ✅ `should navigate to content page`
   - **Issue:** Same as #3 - URL mismatch
   - **Fix:** Check actual route structure
   - **File:** `e2e-tests/02-dashboard.spec.ts:47`

5. ✅ `should navigate to playlists page`
   - **Issue:** Same as #3 - URL mismatch
   - **Fix:** Check actual route structure
   - **File:** `e2e-tests/02-dashboard.spec.ts:58`

#### Display Management Tests (5 tests)
6. ⏳ `should show empty state when no displays`
   - **Need:** Inspect actual empty state
   - **File:** `e2e-tests/03-displays.spec.ts:4`

7. ⏳ `should open create display modal`
   - **Need:** Check modal trigger and rendering
   - **File:** `e2e-tests/03-displays.spec.ts:15`

8. ⏳ `should create new display`
   - **Need:** Check form fields and submission
   - **File:** `e2e-tests/03-displays.spec.ts:29`

9. ⏳ `should show pairing code for display`
   - **Need:** Check pairing UI
   - **File:** `e2e-tests/03-displays.spec.ts:46`

10. ⏳ `should delete display`
    - **Need:** Check delete button and confirmation
    - **File:** `e2e-tests/03-displays.spec.ts:71`

#### Content Management Tests (5 tests)
11-15. ⏳ Similar inspection needed

#### Playlist Management Tests (6 tests)
16-21. ⏳ Similar inspection needed

## Execution Log

### 2026-01-28 17:15 - Started PHASE 1
- Analyzed dashboard test failures
- Found root causes:
  1. Multi-element selectors causing strict mode violations
  2. URL path mismatches (actual vs expected)
  3. Timing issues with async loading
  4. Missing test data-testid attributes

### Actions Taken:
1. Fix dashboard test selectors
2. Update URL expectations
3. Add proper wait conditions
4. Run tests to verify fixes
5. Move to next phase

---

## Fix Patterns

### Pattern A: Strict Mode Violations
**Problem:** `locator('h1, h2')` matches multiple
**Solution:** Be specific - `locator('h2').filter({ hasText: 'Dashboard' })`

### Pattern B: URL Mismatches
**Problem:** Test expects `/displays`, actual is `/dashboard/devices`
**Solution:** Check router structure, update test

### Pattern C: Timing Issues
**Problem:** Elements not ready when test runs
**Solution:** Add `waitForLoadState`, `waitForSelector`, proper timeouts

### Pattern D: Missing Test IDs
**Problem:** CSS class selectors are brittle
**Solution:** Add `data-testid` to components for reliable selection

---

## Next Steps
1. Fix dashboard tests (5)
2. Run suite → measure progress
3. Fix display management tests (5)
4. Run suite → measure progress
5. Continue until 100%
