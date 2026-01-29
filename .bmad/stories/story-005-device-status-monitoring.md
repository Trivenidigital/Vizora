# Story 005: Device Status Monitoring

**ID:** STORY-005  
**Module:** Device Management  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28  
**Updated:** 2026-01-28

---

## User Story

**As a** Vizora user  
**I want to** see the real-time status of all my devices  
**So that** I know which screens are online and working

---

## Acceptance Criteria

### AC-001: Status Display
**Given** I am on the devices page  
**When** I view the devices list  
**Then** each device should show current status:
- 🟢 Online (green badge)
- 🔴 Offline (red badge)

**Status Logic:**
- Online: Heartbeat received <2 minutes ago
- Offline: No heartbeat for 2+ minutes

### AC-002: Last Seen Timestamp
**Given** I view a device  
**When** I check the "Last Seen" column  
**Then** I should see:
- "Just now" (< 1 min ago)
- "X minutes ago" (1-59 min)
- "X hours ago" (1-23 hours)
- "X days ago" (>= 1 day)

### AC-003: Automatic Status Updates
**Given** I am viewing the devices page  
**When** a device status changes  
**Then** the status should update automatically
**And** last seen timestamp should refresh

**Update Mechanism:**
- Polling every 30 seconds OR
- WebSocket real-time updates

### AC-004: Heartbeat Mechanism
**Given** a display device is running  
**When** connected to the platform  
**Then** it should send heartbeat every 30 seconds
**And** include metrics (uptime, memory, CPU)

---

## Implementation Details

**Frontend Files:**
- `web/src/app/dashboard/devices/page.tsx` (status display)

**Backend Files:**
- `realtime/src/services/realtime.service.ts` (heartbeat handler)
- `middleware/src/modules/displays/displays.service.ts` (status query)

**Display App:**
- `display/src/services/heartbeat.service.ts` (sends heartbeat)

**Database:**
- `displays.last_seen` timestamp field
- `displays.status` enum field

---

## Test Cases

See: `.bmad/testing/test-cases/story-005-tests.md`

**Total Test Cases:** 8  
**Passed:** 0  
**Failed:** 0  
**Blocked:** 0

---

## Dependencies

- Device pairing (Story-004)
- WebSocket connection (Story-019)
- Display app running

---

## Bugs Found

None yet - testing pending

---

**Status:** ⏳ READY FOR TEST
