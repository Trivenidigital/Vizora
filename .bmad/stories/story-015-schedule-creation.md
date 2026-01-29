# Story 015: Schedule Creation

**ID:** STORY-015  
**Module:** Scheduling  
**Priority:** P1 - High  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want to** create schedules for playlists  
**So that** different content plays at different times

---

## Acceptance Criteria

### AC-001: Create Schedule
- Name (required)
- Date range (start/end)
- Time range (start/end)
- Days of week selection
- Assign playlist

### AC-002: Schedule Validation
- End date after start date
- End time after start time
- At least one day selected
- Playlist required

### AC-003: Schedule Display
- List all schedules
- Show active/inactive status
- Edit/delete options

---

## Implementation

**Files:**
- `web/src/app/dashboard/schedules/page.tsx`
- `middleware/src/modules/schedules/schedules.controller.ts`

---

## Test Cases

See: `.bmad/testing/test-cases/story-015-tests.md`  
**Total:** 10 test cases

---

**Status:** ⏳ READY FOR TEST
