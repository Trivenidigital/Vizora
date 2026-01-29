# Test Cases: Story 002 - Organization Setup

**Story ID:** STORY-002  
**Module:** Organizations  
**Created:** 2026-01-28  
**Priority:** P0 - Critical

---

## Test Case Summary

**Total Cases:** 6  
**P0 Critical:** 6  
**Estimated Time:** 20 minutes

---

## TC-002-001: Organization Creation During Registration

**Priority:** P0  
**Pre-conditions:**
- On registration page

**Test Steps:**
1. Fill in registration form
2. Enter organization name: `My Test Company`
3. Complete registration
4. Login and navigate to settings
5. Verify organization details

**Expected Result:**
- Organization created automatically
- Organization name: "My Test Company"
- User is admin of organization
- Organization ID assigned

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-002/TC-002-001.png`

---

## TC-002-002: View Organization Settings

**Priority:** P0  
**Pre-conditions:**
- Logged in

**Test Steps:**
1. Click user menu
2. Click "Settings" or "Organization Settings"
3. Observe organization details page

**Expected Result:**
- Organization settings page displays
- Shows organization name
- Shows creation date
- Shows admin users (optional)
- Edit button available

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-002/TC-002-002.png`

---

## TC-002-003: Update Organization Name

**Priority:** P0  
**Pre-conditions:**
- On organization settings page

**Test Steps:**
1. Click "Edit" or organization name field
2. Change name to: `Updated Company Name`
3. Click "Save"
4. Refresh page
5. Verify name persisted

**Expected Result:**
- Name updates successfully
- Success toast notification
- New name displayed immediately
- Persists after page refresh

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-002/TC-002-003.png`

---

## TC-002-004: Organization Name Validation

**Priority:** P0  
**Pre-conditions:**
- On organization settings page

**Test Steps:**
1. Try to update organization name to empty string
2. Click "Save"
3. Check for validation error

**Expected Result:**
- Error message: "Organization name is required"
- Save button disabled OR form doesn't submit
- Name not updated in database

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-002/TC-002-004.png`

---

## TC-002-005: Data Scoping - Organization Context

**Priority:** P0  
**Pre-conditions:**
- Logged in
- At least 1 device, 1 content item, 1 playlist created

**Test Steps:**
1. Navigate to devices page
2. Note number of devices
3. Navigate to content page
4. Note number of content items
5. Check DevTools Network tab for API calls
6. Verify organization ID in requests

**Expected Result:**
- All API requests include organization context
- Only see data for your organization
- No other organization's data visible
- Organization ID in JWT token

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-002/TC-002-005.png`

---

## TC-002-006: Organization Info Display

**Priority:** P0  
**Pre-conditions:**
- Logged in

**Test Steps:**
1. Check navigation bar or header
2. Look for organization name display
3. Verify it shows current organization

**Expected Result:**
- Organization name visible in UI (header/sidebar)
- Correct organization name displayed
- User knows which organization they're in

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-002/TC-002-006.png`

---

## Test Execution Log

| TC ID | Date | Time | Status | Tester | Notes |
|-------|------|------|--------|--------|-------|
| TC-002-001 | - | - | ⏳ | - | - |
| TC-002-002 | - | - | ⏳ | - | - |
| TC-002-003 | - | - | ⏳ | - | - |
| TC-002-004 | - | - | ⏳ | - | - |
| TC-002-005 | - | - | ⏳ | - | - |
| TC-002-006 | - | - | ⏳ | - | - |

---

## Summary

**Total:** 6 test cases  
**Passed:** 0  
**Failed:** 0  
**Not Run:** 6

**Estimated Time:** 20 minutes
