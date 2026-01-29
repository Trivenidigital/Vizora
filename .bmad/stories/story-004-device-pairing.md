# Story 004: Device Pairing Flow

**ID:** STORY-004  
**Module:** Device Management  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28  
**Updated:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want to** pair display devices using a simple code  
**So that** I can quickly add screens to my signage network

---

## Acceptance Criteria

### AC-001: Generate Pairing Code
**Given** I am on the devices page  
**When** I click "Add Device"  
**Then** a pairing form should appear with code entry field

**Requirements:**
- User enters code FROM display device
- Simple, clear instructions
- Validation on code format

### AC-002: Display App Shows Code
**Given** I launch the display app (Electron)  
**When** the app starts without pairing  
**Then** a 6-digit pairing code should be displayed prominently

**Requirements:**
- Code visible from distance
- Auto-refresh every 5 minutes
- Instructions for where to enter code

### AC-003: Complete Pairing
**Given** I enter the pairing code in web app  
**When** I submit the form with device name  
**Then** the device should pair successfully
**And** appear in the devices list

**Validation:**
- Code must exist and be valid
- Code must not be expired
- Device name required (2-50 chars)
- Location optional

### AC-004: Device Appears in List
**Given** pairing succeeded  
**When** I view the devices page  
**Then** the new device should be listed
**And** show status "Online"

---

## Implementation Details

**Frontend Files:**
- `web/src/app/dashboard/devices/page.tsx` (pairing modal)
- `display/src/pages/PairingPage.tsx` (code display)

**Backend Files:**
- `middleware/src/modules/displays/displays.controller.ts`
- `middleware/src/modules/displays/displays.service.ts`
- API endpoints: POST `/displays/generate-code`, POST `/displays/:id/pair`

**Database:**
- `displays` table with pairing_code field
- Code expires after 10 minutes

---

## Test Cases

See: `.bmad/testing/test-cases/story-004-tests.md`

**Total Test Cases:** 10  
**Passed:** 0  
**Failed:** 0  
**Blocked:** 0

---

## Known Issues

- ✅ Fixed: Device pairing API mismatch (nickname→name) - 2026-01-27
- ✅ Fixed: Pairing flow redesigned (code entry, not generation) - 2026-01-27

---

## Dependencies

- Display app (Electron) running
- WebSocket connection
- Organization context

---

## Bugs Found

None yet - testing pending

---

**Status:** ⏳ READY FOR TEST
