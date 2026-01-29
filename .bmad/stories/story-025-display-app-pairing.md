# Story 025: Display App Pairing

**ID:** STORY-025  
**Module:** Display Application  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** display device  
**I want to** pair with the platform using a code  
**So that** I can receive and display content

---

## Acceptance Criteria

### AC-001: Show Pairing Code
- Display generates 6-digit code
- Code visible from distance
- Auto-refresh every 5 minutes
- Instructions shown

### AC-002: Pairing Process
- User enters code in web app
- Display polls for pairing status
- Shows "Pairing successful" message
- Transitions to content view

### AC-003: Pairing Confirmation
- Display name shown
- Organization confirmed
- Connection status: Connected

---

## Implementation

**Files:**
- `display/src/pages/PairingPage.tsx`
- `display/src/services/pairing.service.ts`

**Known Fixes:**
- ✅ Infinite polling fixed (2026-01-27 10:45pm)
- ✅ Error threshold added (stops after 3 errors)

---

## Test Cases

See: `.bmad/testing/test-cases/story-025-tests.md`  
**Total:** 8 test cases

---

**Status:** ⏳ READY FOR TEST
