# Story 020: Device Heartbeat Monitoring

**ID:** STORY-020  
**Module:** Realtime & Push  
**Priority:** P0 - Critical  
**Status:** Development Complete - Awaiting Test  
**Created:** 2026-01-28

---

## User Story

**As a** system  
**I want** devices to send regular heartbeats  
**So that** I can track their health and status

---

## Acceptance Criteria

### AC-001: Heartbeat Transmission
- Send every 30 seconds
- Include metrics: uptime, memory, CPU
- Update last_seen timestamp

### AC-002: Heartbeat Processing
- Realtime service receives heartbeat
- Update Redis cache
- Update database (throttled)

### AC-003: Status Calculation
- Online: heartbeat <2 min ago
- Offline: no heartbeat >=2 min
- Update device status automatically

### AC-004: Metrics Storage
- Store performance metrics
- Historical data (optional)
- Alert on anomalies (future)

---

## Implementation

**Files:**
- `display/src/services/heartbeat.service.ts`
- `realtime/src/services/realtime.service.ts`

---

## Test Cases

See: `.bmad/testing/test-cases/story-020-tests.md`  
**Total:** 8 test cases

---

**Status:** ⏳ READY FOR TEST
