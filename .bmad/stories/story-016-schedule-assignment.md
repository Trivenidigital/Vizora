# Story 016: Schedule Assignment to Devices

**ID:** STORY-016  
**Module:** Scheduling  
**Priority:** P1 - High  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want to** assign schedules to devices  
**So that** content changes automatically based on time

---

## Acceptance Criteria

### AC-001: Assign to Single Device
- Select device from list
- Assign schedule
- Device shows scheduled content at correct time

### AC-002: Assign to Multiple Devices
- Select multiple devices
- Bulk assign schedule
- All devices receive schedule

### AC-003: View Assignments
- See which devices have schedule
- See which schedule is active now
- Edit/remove assignments

---

## Implementation

**Files:**
- `web/src/app/dashboard/schedules/page.tsx`
- `middleware/src/modules/schedules/schedules.service.ts`

---

## Test Cases

See: `.bmad/testing/test-cases/story-016-tests.md`  
**Total:** 8 test cases

---

**Status:** ⏳ READY FOR TEST
