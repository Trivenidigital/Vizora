# Test Cases: Story 003 - Multi-Tenant Isolation

**Story ID:** STORY-003  
**Module:** Security / Organizations  
**Created:** 2026-01-28  
**Priority:** P0 - CRITICAL SECURITY

---

## Test Case Summary

**Total Cases:** 8  
**P0 Critical:** 8 (ALL SECURITY CRITICAL)  
**Estimated Time:** 40 minutes

---

## TC-003-001: Device List Isolation

**Priority:** P0 - SECURITY  
**Pre-conditions:**
- Two separate organizations (Org A, Org B)
- Org A has 3 devices
- Org B has 2 devices

**Test Steps:**
1. Login as Org A user
2. Navigate to devices page
3. Count devices shown
4. Logout
5. Login as Org B user
6. Navigate to devices page
7. Count devices shown

**Expected Result:**
- Org A sees exactly 3 devices (their own)
- Org B sees exactly 2 devices (their own)
- No cross-organization data visible
- No "All Organizations" toggle visible

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-003/TC-003-001.png`

---

## TC-003-002: Content List Isolation

**Priority:** P0 - SECURITY  
**Pre-conditions:**
- Org A has 5 content items
- Org B has 3 content items

**Test Steps:**
1. Login as Org A user
2. Navigate to content page
3. Count content items
4. Note content titles
5. Logout and login as Org B
6. Navigate to content page
7. Verify completely different content

**Expected Result:**
- Org A sees only their 5 content items
- Org B sees only their 3 content items
- No overlap in content
- Search doesn't return other org's content

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-003/TC-003-002.png`

---

## TC-003-003: Playlist List Isolation

**Priority:** P0 - SECURITY  
**Pre-conditions:**
- Org A has 2 playlists
- Org B has 1 playlist

**Test Steps:**
1. Login as Org A user
2. Navigate to playlists page
3. Count playlists
4. Logout and login as Org B
5. Navigate to playlists page
6. Verify different playlists

**Expected Result:**
- Org A sees 2 playlists
- Org B sees 1 playlist
- No shared playlists
- Playlists are completely isolated

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-003/TC-003-003.png`

---

## TC-003-004: Direct API Access Attempt (Manual)

**Priority:** P0 - SECURITY  
**Pre-conditions:**
- Logged in as Org A
- Know device ID from Org B

**Test Steps:**
1. Login as Org A user
2. Open DevTools Network tab
3. Try to access Org B's device directly:
   - Note a device ID from Org A (e.g., "device-123")
   - Use browser console to make API call to Org B device ID
   - `fetch('/api/displays/ORG_B_DEVICE_ID', {headers: {Authorization: 'Bearer YOUR_TOKEN'}})`
4. Check response

**Expected Result:**
- Request returns 403 Forbidden OR 404 Not Found
- Error message: "Access denied" or "Not found"
- No data from Org B returned
- Security prevents cross-org access

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-003/TC-003-004.png`

---

## TC-003-005: Search Results Isolation

**Priority:** P0 - SECURITY  
**Pre-conditions:**
- Org A has content titled "Summer Promo"
- Org B has content titled "Summer Sale"

**Test Steps:**
1. Login as Org A
2. Navigate to content page
3. Search for "Summer"
4. Note results
5. Logout and login as Org B
6. Search for "Summer"
7. Compare results

**Expected Result:**
- Org A search returns only "Summer Promo"
- Org B search returns only "Summer Sale"
- No cross-contamination in search results

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-003/TC-003-005.png`

---

## TC-003-006: Assignment Isolation (Playlist to Device)

**Priority:** P0 - SECURITY  
**Pre-conditions:**
- Org A has playlist and device
- Org B has playlist and device

**Test Steps:**
1. Login as Org A
2. Try to assign Org A playlist to device
3. Check device dropdown
4. Verify only Org A devices shown
5. Check playlist dropdown
6. Verify only Org A playlists shown

**Expected Result:**
- Only Org A devices in device dropdown
- Only Org A playlists in playlist dropdown
- Cannot select Org B resources
- No API manipulation possible

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-003/TC-003-006.png`

---

## TC-003-007: Organization ID in JWT Token

**Priority:** P0 - SECURITY  
**Pre-conditions:**
- Logged in

**Test Steps:**
1. Login
2. Open DevTools Application tab
3. Check localStorage for token
4. Copy JWT token
5. Go to jwt.io
6. Paste token and decode
7. Check payload for organizationId

**Expected Result:**
- JWT contains organizationId field
- organizationId matches user's organization
- Token cannot be used for other orgs

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-003/TC-003-007.png`

---

## TC-003-008: API Request Organization Filtering

**Priority:** P0 - SECURITY  
**Pre-conditions:**
- Logged in
- DevTools open

**Test Steps:**
1. Navigate to devices page
2. Open DevTools Network tab
3. Find GET /api/displays request
4. Check request headers
5. Check response body
6. Verify filtering

**Expected Result:**
- Request includes JWT with org ID
- Response only contains org's devices
- No "organizationId" query parameter needed (server-side filtering)
- Middleware enforces isolation automatically

**Status:** ⏳ NOT RUN  
**Evidence:** `.bmad/testing/evidence/story-003/TC-003-008.png`

---

## Test Execution Log

| TC ID | Date | Time | Status | Tester | Notes |
|-------|------|------|--------|--------|-------|
| TC-003-001 | - | - | ⏳ | - | - |
| TC-003-002 | - | - | ⏳ | - | - |
| TC-003-003 | - | - | ⏳ | - | - |
| TC-003-004 | - | - | ⏳ | - | SECURITY CRITICAL |
| TC-003-005 | - | - | ⏳ | - | - |
| TC-003-006 | - | - | ⏳ | - | - |
| TC-003-007 | - | - | ⏳ | - | SECURITY CRITICAL |
| TC-003-008 | - | - | ⏳ | - | SECURITY CRITICAL |

---

## Summary

**Total:** 8 test cases  
**Passed:** 0  
**Failed:** 0  
**Not Run:** 8

**⚠️ CRITICAL SECURITY TESTS - DO NOT SKIP**

**Estimated Time:** 40 minutes

---

## Notes

These tests verify the MOST CRITICAL security feature: multi-tenant data isolation.

**Failure in any of these tests is a CRITICAL security vulnerability.**

If any test fails:
1. **DO NOT DEPLOY**
2. Document bug as P0
3. Fix immediately
4. Re-test thoroughly
