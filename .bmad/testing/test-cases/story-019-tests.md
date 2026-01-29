# Test Cases: Story 019 - WebSocket Communication

**Story ID:** STORY-019 | **Priority:** P0 | **Time:** 40 min | **Cases:** 12

---

## TC-019-001: Connection Established
**Steps:** 1) Start display app 2) Check connection status  
**Expected:** "Connected" status shown  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-001.png`

## TC-019-002: Initial Config Message
**Steps:** 1) Connect display 2) Check DevTools console  
**Expected:** Receives "config" message with initial data  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-002.png`

## TC-019-003: Playlist Update Message
**Steps:** 1) Push playlist 2) Watch console  
**Expected:** Receives "playlistUpdate" message  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-003.png`

## TC-019-004: Command Message
**Steps:** 1) Send command from web (if implemented) 2) Check display  
**Expected:** Receives "command" message, executes  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-004.png`

## TC-019-005: Heartbeat Sent
**Steps:** 1) Display connected 2) Wait 30s 3) Check server logs  
**Expected:** Heartbeat message sent every 30s  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-005.png`

## TC-019-006: Disconnect Detection
**Steps:** 1) Stop realtime service 2) Watch display  
**Expected:** Connection status changes to "Disconnected"  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-006.png`

## TC-019-007: Auto-Reconnect
**Steps:** 1) Disconnect 2) Restart service 3) Wait  
**Expected:** Display auto-reconnects within 5 seconds  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-007.png`

## TC-019-008: Reconnection Backoff
**Steps:** 1) Repeatedly disconnect/connect 2) Check timing  
**Expected:** Exponential backoff (1s, 2s, 4s, 8s...)  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-008.png`

## TC-019-009: Error Message Handling
**Steps:** 1) Send invalid message 2) Check display  
**Expected:** Error logged, graceful handling  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-009.png`

## TC-019-010: Connection Timeout
**Steps:** 1) Block network 2) Wait 30s  
**Expected:** Timeout error shown  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-010.png`

## TC-019-011: Multiple Concurrent Connections
**Steps:** 1) Connect 3 displays 2) Push update  
**Expected:** All 3 receive message  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-011.png`

## TC-019-012: JWT Authentication
**Steps:** 1) Check WebSocket connection headers  
**Expected:** JWT token included in auth  
**Evidence:** `.bmad/testing/evidence/story-019/TC-019-012.png`

---

**Summary:** 12 cases | 0 passed | 12 not run | Est: 40 min
