# Test Cases: Story 001 - User Registration & Login

**Story ID:** STORY-001  
**Module:** Authentication  
**Created:** 2026-01-28  
**Priority:** P0 - Critical

---

## Test Case Summary

**Total Cases:** 10  
**P0 Critical:** 8  
**P1 High:** 2  
**Estimated Time:** 30 minutes

---

## TC-001-001: User Registration - Valid Data

**Priority:** P0  
**Pre-conditions:**
- Browser open to login page
- Not logged in

**Test Steps:**
1. Navigate to `/register`
2. Fill in email: `testuser@example.com`
3. Fill in password: `SecurePass123!`
4. Fill in first name: `Test`
5. Fill in last name: `User`
6. Fill in organization name: `Test Organization`
7. Click "Register" button
8. Observe result

**Expected Result:**
- Registration succeeds
- Redirect to dashboard
- Welcome message displayed
- User logged in (token stored)

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-001/TC-001-001.png`

---

## TC-001-002: Registration Validation - Email Required

**Priority:** P0  
**Pre-conditions:**
- On registration page

**Test Steps:**
1. Leave email field empty
2. Fill in all other fields correctly
3. Click "Register"
4. Check for error message below email field

**Expected Result:**
- Form does not submit
- Error message: "Email is required"
- Error shown in red below email field
- No toast notification (inline error only)

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-001/TC-001-002.png`

---

## TC-001-003: Registration Validation - Email Format

**Priority:** P0  
**Pre-conditions:**
- On registration page

**Test Steps:**
1. Enter invalid email: `notanemail`
2. Fill in all other fields correctly
3. Click "Register"
4. Check for validation error

**Expected Result:**
- Form does not submit
- Error message: "Please enter a valid email address"
- Error shown below email field

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-001/TC-001-003.png`

---

## TC-001-004: Registration Validation - Password Strength

**Priority:** P0  
**Pre-conditions:**
- On registration page

**Test Steps:**
1. Enter valid email
2. Enter weak password: `pass`
3. Fill in other fields
4. Click "Register"

**Expected Result:**
- Error: "Password must be at least 8 characters"
- OR: "Password must contain uppercase letter and number"
- Form does not submit

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-001/TC-001-004.png`

---

## TC-001-005: Login - Valid Credentials

**Priority:** P0  
**Pre-conditions:**
- User registered
- On login page

**Test Steps:**
1. Navigate to `/login`
2. Enter email: `testuser@example.com`
3. Enter password: `SecurePass123!`
4. Click "Login" button
5. Observe result

**Expected Result:**
- Login succeeds
- Redirect to `/dashboard`
- Token stored in cookie AND localStorage
- User can access protected pages

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-001/TC-001-005.png`

---

## TC-001-006: Login - Invalid Credentials

**Priority:** P0  
**Pre-conditions:**
- On login page

**Test Steps:**
1. Enter email: `testuser@example.com`
2. Enter wrong password: `WrongPassword123!`
3. Click "Login"
4. Check for error

**Expected Result:**
- Login fails
- Error message: "Invalid credentials" or similar
- Remain on login page
- No token stored

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-001/TC-001-006.png`

---

## TC-001-007: Session Persistence - Page Reload

**Priority:** P0  
**Pre-conditions:**
- User logged in
- On dashboard page

**Test Steps:**
1. Note that you're logged in (on dashboard)
2. Press F5 to refresh page
3. Observe result

**Expected Result:**
- User remains logged in
- Still on dashboard
- No redirect to login
- Token still in cookie/localStorage

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-001/TC-001-007.png`

---

## TC-001-008: Session Persistence - New Tab

**Priority:** P1  
**Pre-conditions:**
- User logged in in one tab

**Test Steps:**
1. Open new tab
2. Navigate to `http://localhost:3001/dashboard`
3. Observe result

**Expected Result:**
- User automatically logged in
- Dashboard loads without login prompt
- Session shared across tabs

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-001/TC-001-008.png`

---

## TC-001-009: Logout - Clear Session

**Priority:** P0  
**Pre-conditions:**
- User logged in

**Test Steps:**
1. Click user menu/avatar
2. Click "Logout" button
3. Observe result
4. Check DevTools Application tab (cookies/localStorage)

**Expected Result:**
- Redirect to login page
- Token removed from cookie
- Token removed from localStorage
- Cannot access dashboard without logging in again

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-001/TC-001-009.png`

---

## TC-001-010: Protected Routes - Unauthorized Access

**Priority:** P0  
**Pre-conditions:**
- Not logged in (cleared cookies)

**Test Steps:**
1. Clear browser data
2. Navigate directly to `http://localhost:3001/dashboard`
3. Observe result

**Expected Result:**
- Redirect to `/login`
- Cannot access dashboard
- Login required message (optional)

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-001/TC-001-010.png`

---

## Test Execution Log

| TC ID | Date | Time | Status | Tester | Notes |
|-------|------|------|--------|--------|-------|
| TC-001-001 | - | - | ⏳ | - | - |
| TC-001-002 | - | - | ⏳ | - | - |
| TC-001-003 | - | - | ⏳ | - | - |
| TC-001-004 | - | - | ⏳ | - | - |
| TC-001-005 | - | - | ⏳ | - | - |
| TC-001-006 | - | - | ⏳ | - | - |
| TC-001-007 | - | - | ⏳ | - | - |
| TC-001-008 | - | - | ⏳ | - | - |
| TC-001-009 | - | - | ⏳ | - | - |
| TC-001-010 | - | - | ⏳ | - | - |

---

## Summary

**Total:** 10 test cases  
**Passed:** 0  
**Failed:** 0  
**Blocked:** 0  
**Not Run:** 10

**Estimated Time:** 30 minutes  
**Actual Time:** TBD
