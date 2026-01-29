# Story 017: Schedule Conflicts & Priority

**ID:** STORY-017  
**Module:** Scheduling  
**Priority:** P1 - High  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want** schedule conflicts resolved automatically  
**So that** the correct content always plays

---

## Acceptance Criteria

### AC-001: Conflict Detection
- Detect overlapping schedules
- Show warning during creation
- Allow override with priority

### AC-002: Priority System
- Higher priority wins conflicts
- Default priority: 1 (low)
- Max priority: 10 (critical)

### AC-003: Resolution Logic
- Active schedule: Highest priority in time range
- Fallback: Default playlist if no schedule active
- Real-time resolution on devices

---

## Implementation

**Files:**
- `realtime/src/services/schedule.service.ts`
- `middleware/src/modules/schedules/schedules.service.ts`

---

## Test Cases

See: `.bmad/testing/test-cases/story-017-tests.md`  
**Total:** 8 test cases

---

**Status:** ⏳ READY FOR TEST
