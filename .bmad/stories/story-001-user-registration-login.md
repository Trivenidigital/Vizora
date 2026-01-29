# Story 001: User Registration & Login

**ID:** STORY-001  
**Module:** Authentication  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28  
**Updated:** 2026-01-28

---

## User Story

**As a** new user  
**I want to** register an account and log in  
**So that** I can access the Vizora platform

---

## Acceptance Criteria

### AC-001: User Registration
**Given** I am on the registration page  
**When** I provide email, password, name, and organization name  
**Then** an account should be created and I should be redirected to the dashboard

**Validation Rules:**
- Email must be valid format
- Password must be at least 8 characters
- Password must contain uppercase, number
- Organization name required
- First/last name required

### AC-002: User Login
**Given** I have a registered account  
**When** I provide correct email and password  
**Then** I should be logged in and see the dashboard

**Validation Rules:**
- Email must match registered account
- Password must be correct
- Session token stored in cookie + localStorage

### AC-003: Login Error Handling
**Given** I provide incorrect credentials  
**When** I submit the login form  
**Then** I should see an error message
**And** I should remain on the login page

### AC-004: Session Persistence
**Given** I am logged in  
**When** I refresh the page  
**Then** I should remain logged in
**And** see the dashboard

### AC-005: Logout
**Given** I am logged in  
**When** I click logout  
**Then** my session should be cleared
**And** I should be redirected to login page

---

## Implementation Details

**Frontend Files:**
- `web/src/app/login/page.tsx`
- `web/src/app/register/page.tsx`
- `web/src/lib/api.ts` (login/register methods)
- `web/src/lib/hooks/useAuth.ts`

**Backend Files:**
- `middleware/src/modules/auth/auth.controller.ts`
- `middleware/src/modules/auth/auth.service.ts`
- `middleware/src/modules/users/users.service.ts`

**Database Tables:**
- `users`
- `organizations`

---

## Test Cases

See: `.bmad/testing/test-cases/story-001-tests.md`

**Total Test Cases:** 12  
**Passed:** 0  
**Failed:** 0  
**Blocked:** 0

---

## Evidence

**Test Evidence Location:** `.bmad/testing/evidence/story-001/`

**Screenshots Required:**
- Registration form with validation
- Successful registration
- Login form
- Successful login
- Dashboard after login
- Logout confirmation
- Error messages

---

## Dependencies

- Database migrations complete
- Email validation library (Zod)
- JWT token generation
- Cookie handling

---

## Bugs Found

None yet - testing pending

---

## Notes

- Cookie + localStorage dual storage implemented (2026-01-27)
- Token extraction bug fixed (2026-01-27 8:20pm)
- Middleware JWT validation working

---

**Status:** ⏳ READY FOR TEST
