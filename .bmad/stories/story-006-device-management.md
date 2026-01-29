# Story 006: Device Management (Edit/Delete)

**ID:** STORY-006  
**Module:** Device Management  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28  
**Updated:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want to** edit and delete devices  
**So that** I can keep my device list organized and accurate

---

## Acceptance Criteria

### AC-001: Edit Device
**Given** I have a paired device  
**When** I click "Edit" on the device  
**Then** a modal should open with editable fields:
- Device name (required)
- Location (optional)
- Notes (optional)

**Validation:**
- Name: 2-50 characters
- Location: 0-100 characters
- Notes: 0-500 characters

### AC-002: Save Device Changes
**Given** I edit device details  
**When** I click "Save"  
**Then** changes should persist to database
**And** device list should update immediately
**And** success toast should appear

### AC-003: Delete Device
**Given** I have a device  
**When** I click "Delete"  
**Then** a confirmation dialog should appear
**And** require confirmation before deleting

**Confirmation Dialog:**
- Show device name
- Warn about data loss
- "Cancel" and "Delete" buttons

### AC-004: Unpair Device
**Given** I delete a device  
**When** the device is running  
**Then** it should detect unpair
**And** return to pairing screen
**And** generate new pairing code

---

## Implementation Details

**Frontend Files:**
- `web/src/app/dashboard/devices/page.tsx` (edit/delete UI)
- Edit modal component
- Delete confirmation dialog

**Backend Files:**
- `middleware/src/modules/displays/displays.controller.ts`
- PUT `/displays/:id` (update)
- DELETE `/displays/:id` (delete)

**Realtime:**
- Notify display app on unpair
- Display app listens for "unpaired" event

---

## Test Cases

See: `.bmad/testing/test-cases/story-006-tests.md`

**Total Test Cases:** 10  
**Passed:** 0  
**Failed:** 0  
**Blocked:** 0

---

## Edge Cases

- Edit device while offline
- Delete device while content is playing
- Concurrent edits by multiple users
- Special characters in device name/location

---

## Dependencies

- Device pairing (Story-004)
- Device list (Story-005)

---

## Bugs Found

None yet - testing pending

---

**Status:** ⏳ READY FOR TEST
