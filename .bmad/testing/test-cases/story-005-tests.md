# Test Cases: Story 005 - Device Status Monitoring

**Story ID:** STORY-005 | **Priority:** P0 | **Time:** 25 min | **Cases:** 8

---

## TC-005-001: Online Status Display
**Steps:** 1) Pair device 2) Check status badge  
**Expected:** Green badge, "Online" text  
**Evidence:** `.bmad/testing/evidence/story-005/TC-005-001.png`

## TC-005-002: Offline Status Display
**Steps:** 1) Stop display app 2) Wait 2+ minutes 3) Check status  
**Expected:** Red badge, "Offline" text, status auto-updates  
**Evidence:** `.bmad/testing/evidence/story-005/TC-005-002.png`

## TC-005-003: Last Seen - Just Now
**Steps:** 1) View online device 2) Check "Last Seen" column  
**Expected:** Shows "Just now" (<1 min)  
**Evidence:** `.bmad/testing/evidence/story-005/TC-005-003.png`

## TC-005-004: Last Seen - Minutes Ago
**Steps:** 1) Note time 2) Wait 5 min 3) Check display  
**Expected:** Shows "5 minutes ago"  
**Evidence:** `.bmad/testing/evidence/story-005/TC-005-004.png`

## TC-005-005: Last Seen - Hours/Days
**Steps:** 1) Check offline device 2) Verify timestamp format  
**Expected:** "X hours ago" or "X days ago" for older  
**Evidence:** `.bmad/testing/evidence/story-005/TC-005-005.png`

## TC-005-006: Auto-Refresh Status
**Steps:** 1) Keep page open 2) Stop display 3) Wait 2 min 4) Watch status change  
**Expected:** Status updates automatically without reload  
**Evidence:** `.bmad/testing/evidence/story-005/TC-005-006.png`

## TC-005-007: Heartbeat Metrics (Optional)
**Steps:** 1) Click device 2) Check details modal (if exists)  
**Expected:** Shows uptime, memory, CPU metrics  
**Evidence:** `.bmad/testing/evidence/story-005/TC-005-007.png`

## TC-005-008: Status Tooltip
**Steps:** 1) Hover over status badge  
**Expected:** Tooltip shows "Last heartbeat: [time]"  
**Evidence:** `.bmad/testing/evidence/story-005/TC-005-008.png`

---

**Summary:** 8 cases | 0 passed | 8 not run | Est: 25 min
