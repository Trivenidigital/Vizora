# Test Cases: Story 020 - Device Heartbeat

**Story ID:** STORY-020 | **Priority:** P0 | **Time:** 30 min | **Cases:** 8

---

## TC-020-001: Heartbeat Transmission Interval
**Steps:** 1) Connect display 2) Monitor server logs 3) Time intervals  
**Expected:** Heartbeat sent every 30 seconds  
**Evidence:** `.bmad/testing/evidence/story-020/TC-020-001.png`

## TC-020-002: Heartbeat Payload
**Steps:** 1) Capture heartbeat message 2) Check payload  
**Expected:** Contains: deviceId, uptime, memory, CPU  
**Evidence:** `.bmad/testing/evidence/story-020/TC-020-002.png`

## TC-020-003: Last Seen Update
**Steps:** 1) Send heartbeat 2) Check devices page  
**Expected:** "Last Seen" timestamp updates  
**Evidence:** `.bmad/testing/evidence/story-020/TC-020-003.png`

## TC-020-004: Status Change to Offline
**Steps:** 1) Stop display 2) Wait 2+ minutes 3) Check status  
**Expected:** Status changes from Online to Offline  
**Evidence:** `.bmad/testing/evidence/story-020/TC-020-004.png`

## TC-020-005: Status Change to Online
**Steps:** 1) Start offline display 2) Wait for heartbeat  
**Expected:** Status changes to Online immediately  
**Evidence:** `.bmad/testing/evidence/story-020/TC-020-005.png`

## TC-020-006: Metrics Display (If Implemented)
**Steps:** 1) View device details  
**Expected:** Shows uptime, memory, CPU from heartbeat  
**Evidence:** `.bmad/testing/evidence/story-020/TC-020-006.png`

## TC-020-007: Missing Heartbeat Alert (Future)
**Steps:** 1) Stop heartbeat 2) Check for alert  
**Expected:** (Optional) Alert if heartbeat missing >5 min  
**Evidence:** `.bmad/testing/evidence/story-020/TC-020-007.png`

## TC-020-008: Redis Cache Update
**Steps:** 1) Send heartbeat 2) Check Redis (if accessible)  
**Expected:** Device status updated in Redis cache  
**Evidence:** `.bmad/testing/evidence/story-020/TC-020-008.png`

---

**Summary:** 8 cases | 0 passed | 8 not run | Est: 30 min
