# Test Cases: Story 016 - Schedule Assignment

**Story ID:** STORY-016 | **Priority:** P1 | **Time:** 30 min | **Cases:** 8

---

## TC-016-001: Assign to Single Device
**Steps:** 1) Click "Assign" on schedule 2) Select 1 device 3) Save  
**Expected:** Schedule assigned, device shows schedule badge  
**Evidence:** `.bmad/testing/evidence/story-016/TC-016-001.png`

## TC-016-002: Assign to Multiple Devices
**Steps:** 1) Select 3 devices 2) Assign schedule  
**Expected:** All 3 devices receive schedule  
**Evidence:** `.bmad/testing/evidence/story-016/TC-016-002.png`

## TC-016-003: View Assigned Devices
**Steps:** 1) View schedule details  
**Expected:** List of assigned devices shown  
**Evidence:** `.bmad/testing/evidence/story-016/TC-016-003.png`

## TC-016-004: View Device Schedules
**Steps:** 1) Navigate to devices 2) Check device details  
**Expected:** Shows schedules assigned to device  
**Evidence:** `.bmad/testing/evidence/story-016/TC-016-004.png`

## TC-016-005: Unassign Schedule
**Steps:** 1) Click "Unassign" on device 2) Confirm  
**Expected:** Schedule removed from device  
**Evidence:** `.bmad/testing/evidence/story-016/TC-016-005.png`

## TC-016-006: Schedule Badge on Device
**Steps:** 1) Assign schedule 2) View devices page  
**Expected:** Device shows "Scheduled" badge or icon  
**Evidence:** `.bmad/testing/evidence/story-016/TC-016-006.png`

## TC-016-007: Bulk Assign
**Steps:** 1) Select all devices 2) Assign schedule  
**Expected:** Schedule assigned to all simultaneously  
**Evidence:** `.bmad/testing/evidence/story-016/TC-016-007.png`

## TC-016-008: Assignment Notification
**Steps:** 1) Assign schedule to device  
**Expected:** Success toast: "Schedule assigned to X devices"  
**Evidence:** `.bmad/testing/evidence/story-016/TC-016-008.png`

---

**Summary:** 8 cases | 0 passed | 8 not run | Est: 30 min
